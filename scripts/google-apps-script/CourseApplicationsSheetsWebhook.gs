/**
 * ====================================================================
 * PATHFINDER COURSE APPLICATION MANAGEMENT SYSTEM
 * GOOGLE APPS SCRIPT: GOOGLE FORMS TO PATHFINDER WEBHOOK SYNC
 * ====================================================================
 * Author: PathFinder Platform Operations
 * Target: Google Forms (3 Separate Course Application Forms)
 * Version: 1.3.0 (Identity Conflict Detection & Safe Diagnostic Ping)
 *
 * PURPOSE:
 * Automatically synchronizes student applications from Google Forms directly
 * into PathFinder whenever a new form response is submitted.
 *
 * CRITICAL BUSINESS & DATA CONTRACT:
 * - Google Forms and linked Google Sheets handle the complete submission,
 *   including payment proof file uploads and academic questionnaire details.
 * - This script extracts and transmits ONLY:
 *     1. Student Name (studentName)
 *     2. Student Email (studentEmail / enteredEmail)
 *     3. Authenticated Google Account (respondentEmail, if collected)
 *     4. Selected Course (courseId / canonical track slug)
 *     5. Genuine Response ID (responseId from formResponse.getId())
 * - Payment proof, Drive URLs, Base64 files, and other form answers remain
 *   safely stored in Google Drive and Google Sheets. They are NEVER sent here.
 * - The administrator opens the linked Google Sheet separately, verifies
 *   the payment proof, and approves/rejects the application in PathFinder.
 *
 * CANONICAL COURSE IDENTIFIERS & FORM URLS:
 * 1. Bioplastic Innovation:   "bioplastic-innovation"
 *    Form: https://forms.gle/8GiUvQuT6wU8iZbU6
 *    Canonical Database UUID: d2756643-0b82-4ebe-a123-9fa3be97bd13
 * 2. AI in Drug Discovery:     "ai-in-drug-discovery"
 *    Form: https://forms.gle/KZHJbuiKSpDsBqzp7
 *    Canonical Database UUID: d6a21b1f-2682-4cf2-a83d-2c030f476625
 * 3. Bioinformatics:           "bioinformatics"
 *    Form: https://forms.gle/ZN1HcXnv5g2Z9YXd9
 *    Canonical Database UUID: 840fed84-696d-458e-aeee-2df6b88d3428
 *
 * ====================================================================
 * SETUP INSTRUCTIONS (FOR EACH OF THE 3 GOOGLE FORMS)
 * ====================================================================
 * 1. Open the Google Form in Google Forms Editor (not Google Sheets).
 * 2. In the top-right corner, click the three vertical dots (More) -> "Script editor".
 * 3. Delete any default code in Code.gs and paste this entire script.
 * 4. Rename the project to "PathFinder Sync - [Course Name]".
 * 5. Configure Script Properties (Project Settings [gear icon] -> Script Properties):
 *    - Key: WEBHOOK_URL
 *      Value: https://<your-pathfinder-domain>/api/course-applications/webhook
 *    - Key: WEBHOOK_SECRET
 *      Value: <your-secure-HMAC-secret> (matches COURSE_APPLICATION_WEBHOOK_SECRET)
 *    - Key: COURSE_SLUG
 *      Value: bioplastic-innovation (OR ai-in-drug-discovery OR bioinformatics)
 *    - Key: VERCEL_PROTECTION_BYPASS (Optional for Vercel Protected Preview Deployments)
 *      Value: <your-vercel-automation-bypass-secret> (never commit or expose this)
 * 6. Set up the Form-Bound Installable Trigger:
 *    - In the left sidebar of Apps Script, click "Triggers" (clock icon).
 *    - Click "+ Add Trigger" (bottom right).
 *    - Choose which function to run: onFormSubmit
 *    - Which deployment should run: Head
 *    - Select event source: "From form" (DO NOT select "From spreadsheet")
 *    - Select event type: "On form submit"
 *    - Failure notification settings: "Notify me immediately"
 *    - Click "Save" and authorize the Google permissions requested.
 * 7. Verification of Google Sheets Link:
 *    - In the Google Form, ensure the "Responses" tab has a linked Google Sheet
 *      (green Sheets icon -> "Link to Sheets" / "Select existing spreadsheet").
 *    - Google Forms automatically writes the complete response and payment proof
 *      to the linked Google Sheet natively. The Form-bound trigger runs concurrently
 *      without interfering with Sheet row writing.
 * 8. Diagnostics:
 *    - Run `testWebhookDiagnosticPing` (or `testWebhookConnection`) from the editor toolbar to verify configuration.
 *      This sends an in-band zero-mutation diagnostic ping with valid HMAC and confirms HTTP 200 DIAGNOSTIC_PONG.
 * ====================================================================
 */

/**
 * Explicit question-title mappings for each canonical course form.
 * Matches questions case-insensitively against trimmed titles.
 */
var QUESTION_MAPPINGS = {
  nameQuestions: [
    "full legal name",
    "full name",
    "student name",
    "applicant name",
    "candidate name",
    "your name",
    "name"
  ],
  emailQuestions: [
    "email address",
    "email",
    "student email",
    "applicant email",
    "candidate email",
    "e-mail",
    "mail id"
  ]
};

/**
 * Main trigger function called automatically when a form response is submitted.
 * MUST be installed as an installable trigger with Event source: "From form".
 *
 * @param {Object} e Event object passed by Google Forms trigger.
 */
function onFormSubmit(e) {
  var startTime = new Date().getTime();
  Logger.log("[PATHFINDER_SYNC] onFormSubmit triggered at " + new Date().toISOString());

  try {
    // 1. Validate Form-Bound Event Object
    if (!e || !e.response || typeof e.response.getId !== "function") {
      throw new Error(
        "Invalid trigger event: e.response.getId() is inaccessible. " +
        "Ensure this script is bound to the Google Form and installed with: " +
        "Event source: 'From form' -> Event type: 'On form submit'. " +
        "Spreadsheet-bound triggers do not provide e.response."
      );
    }

    var formResponse = e.response;

    // 2. Extract Genuine, Immutable Response ID (Never locale-dependent)
    var responseId = String(formResponse.getId()).trim();
    if (!responseId || responseId.length < 3) {
      throw new Error("Extracted Google Form responseId is invalid or empty.");
    }

    var timestamp = formResponse.getTimestamp()
      ? formResponse.getTimestamp().getTime()
      : Date.now();

    // 3. Resolve Script Properties
    var config = getConfiguration_();

    // 4. Extract Student Name & Email from FormResponse
    var submission = extractFormResponseData_(formResponse, config.courseSlug);
    submission.responseId = responseId;
    submission.timestamp = timestamp;

    Logger.log("[PATHFINDER_SYNC] Response ID: " + submission.responseId);
    Logger.log("[PATHFINDER_SYNC] Applicant: " + submission.studentName + " (" + submission.studentEmail + ")");
    Logger.log("[PATHFINDER_SYNC] Course Slug: " + submission.courseId);

    // 5. Construct Payload (Student Name, Effective Email, Respondent Google Account, Entered Email, Course, Response ID)
    var payloadObj = {
      responseId: submission.responseId,
      timestamp: submission.timestamp,
      courseId: submission.courseId,
      studentName: submission.studentName,
      studentEmail: submission.studentEmail,
      respondentEmail: submission.respondentEmail || null,
      enteredEmail: submission.enteredEmail || null
    };

    var rawJsonPayload = JSON.stringify(payloadObj);

    // 6. Compute HMAC-SHA256 Signature
    var hexSignature = computeHmacSha256Hex_(rawJsonPayload, config.webhookSecret);
    var timestampMs = String(submission.timestamp || Date.now());

    // 7. Dispatch Webhook Request with Retry Mechanism (and optional Vercel Protection Bypass header)
    var response = sendWebhookWithRetry_(
      config.webhookUrl,
      rawJsonPayload,
      hexSignature,
      timestampMs,
      config.vercelBypassSecret,
      3 // max retries
    );

    var durationMs = new Date().getTime() - startTime;
    Logger.log("[PATHFINDER_SYNC] Synchronization completed successfully in " + durationMs + "ms. Server response: " + response);

  } catch (err) {
    Logger.log("[PATHFINDER_SYNC] ERROR: " + err.message);
    if (err.stack) {
      Logger.log("[PATHFINDER_SYNC] Stack: " + err.stack);
    }
    // Re-throw so Google Apps Script records the execution failure in Triggers dashboard
    throw err;
  }
}

/**
 * Reads and validates required configuration from Script Properties.
 * Fails fast if any essential configuration is missing.
 *
 * @return {Object} Validated config object with webhookUrl, webhookSecret, and courseSlug.
 */
function getConfiguration_() {
  var props = PropertiesService.getScriptProperties();
  var webhookUrl = (props.getProperty("WEBHOOK_URL") || "").trim();
  var webhookSecret = (props.getProperty("WEBHOOK_SECRET") || "").trim();
  var courseSlug = (props.getProperty("COURSE_SLUG") || "").trim();

  if (!webhookUrl) {
    throw new Error("Missing required Script Property 'WEBHOOK_URL'. Please set it in Project Settings -> Script Properties.");
  }

  if (!webhookSecret || webhookSecret.length < 16) {
    throw new Error("Missing or invalid Script Property 'WEBHOOK_SECRET'. Minimum 16 characters required (32+ character / 64-hex string recommended).");
  }

  if (!courseSlug) {
    throw new Error("Missing required Script Property 'COURSE_SLUG'. Please set it to 'bioplastic-innovation', 'ai-in-drug-discovery', or 'bioinformatics'.");
  }

  // Validate allowed canonical course slugs
  var allowedCourses = ["bioplastic-innovation", "ai-in-drug-discovery", "bioinformatics"];
  if (allowedCourses.indexOf(courseSlug.toLowerCase()) === -1) {
    throw new Error("Invalid COURSE_SLUG '" + courseSlug + "'. Allowed values: " + allowedCourses.join(", "));
  }

  // Optional: Read Vercel Automation Protection Bypass secret for protected preview deployments
  var vercelBypassSecret = (
    props.getProperty("VERCEL_PROTECTION_BYPASS") ||
    props.getProperty("VERCEL_AUTOMATION_BYPASS_SECRET") ||
    ""
  ).trim();

  return {
    webhookUrl: webhookUrl,
    webhookSecret: webhookSecret,
    courseSlug: courseSlug.toLowerCase(),
    vercelBypassSecret: vercelBypassSecret || null
  };
}

/**
 * Extracts student name and email from a genuine FormResponse item collection.
 * Uses explicit question-title mappings and checks respondent email settings.
 *
 * @param {FormResponse} formResponse The Google Forms response object.
 * @param {string} courseSlug The configured canonical course slug.
 * @return {Object} Normalized submission fields.
 */
function extractFormResponseData_(formResponse, courseSlug) {
  var studentName = "";
  var respondentEmail = "";
  var enteredEmail = "";

  // 1. Check if the Form collected respondent email via native Google Form settings
  if (typeof formResponse.getRespondentEmail === "function") {
    var rawResp = formResponse.getRespondentEmail();
    if (rawResp && isValidEmailFormat_(rawResp)) {
      respondentEmail = rawResp.toLowerCase().trim();
    }
  }

  // 2. Iterate through all submitted item responses
  var itemResponses = formResponse.getItemResponses();
  for (var i = 0; i < itemResponses.length; i++) {
    var item = itemResponses[i].getItem();
    var questionTitle = item.getTitle().toLowerCase().trim();
    var rawAnswer = itemResponses[i].getResponse();

    var answerStr = Array.isArray(rawAnswer)
      ? rawAnswer.join(", ").trim()
      : String(rawAnswer || "").trim();

    if (!answerStr) continue;

    // Match Name Question
    if (!studentName && matchesQuestionTitle_(questionTitle, QUESTION_MAPPINGS.nameQuestions)) {
      studentName = answerStr;
    }

    // Match Email Question (Candidate contact email)
    if (!enteredEmail && matchesQuestionTitle_(questionTitle, QUESTION_MAPPINGS.emailQuestions)) {
      if (isValidEmailFormat_(answerStr)) {
        enteredEmail = answerStr.toLowerCase().trim();
      }
    }
  }

  // Effective contact email: candidate entered email preferred, falling back to respondent email
  var effectiveEmail = enteredEmail || respondentEmail;

  // Validation
  if (!studentName || studentName.length < 2) {
    throw new Error(
      "Could not extract student name from FormResponse. " +
      "Ensure the name question in your Google Form matches one of: " +
      QUESTION_MAPPINGS.nameQuestions.join(", ")
    );
  }

  if (!effectiveEmail || !isValidEmailFormat_(effectiveEmail)) {
    throw new Error(
      "Could not extract a valid student email from FormResponse. " +
      "Found: '" + effectiveEmail + "'. " +
      "Ensure the email question matches one of: " +
      QUESTION_MAPPINGS.emailQuestions.join(", ")
    );
  }

  return {
    courseId: courseSlug,
    studentName: studentName.trim(),
    studentEmail: effectiveEmail,
    respondentEmail: respondentEmail || null,
    enteredEmail: enteredEmail || null
  };
}

/**
 * Matches a question title against an array of allowed question names.
 * Prioritizes exact matches, and excludes ambiguous question titles
 * (e.g. "college name", "father's name", "emergency contact name").
 */
function matchesQuestionTitle_(actualTitle, candidates) {
  var normalized = (actualTitle || "").toLowerCase().trim();
  if (!normalized) return false;

  // 1. First Priority: Exact title match
  for (var i = 0; i < candidates.length; i++) {
    if (normalized === candidates[i].toLowerCase().trim()) {
      return true;
    }
  }

  // 2. Disqualify titles containing non-student entity keywords
  var disqualifiers = [
    "college",
    "institution",
    "university",
    "school",
    "department",
    "father",
    "mother",
    "parent",
    "guardian",
    "emergency",
    "reference",
    "mentor"
  ];
  for (var d = 0; d < disqualifiers.length; d++) {
    if (normalized.indexOf(disqualifiers[d]) !== -1) {
      return false;
    }
  }

  // 3. Substring match only for specific composite titles (avoiding bare "name" substring match)
  for (var j = 0; j < candidates.length; j++) {
    var candidate = candidates[j].toLowerCase().trim();
    if (candidate === "name") {
      // Bare "name" must match explicit student name phrases
      if (
        normalized === "name" ||
        normalized === "your name" ||
        normalized.indexOf("full name") !== -1 ||
        normalized.indexOf("legal name") !== -1 ||
        normalized.indexOf("student name") !== -1 ||
        normalized.indexOf("applicant name") !== -1 ||
        normalized.indexOf("candidate name") !== -1
      ) {
        return true;
      }
    } else if (normalized.indexOf(candidate) !== -1) {
      return true;
    }
  }

  return false;
}

/**
 * Basic email format validator.
 */
function isValidEmailFormat_(email) {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Computes an HMAC-SHA256 signature and returns it as a lowercase hex string.
 *
 * @param {string} rawPayload The exact JSON string to sign.
 * @param {string} secret The HMAC secret key.
 * @return {string} 64-character lowercase hex string.
 */
function computeHmacSha256Hex_(rawPayload, secret) {
  var rawBytes = Utilities.computeHmacSha256Signature(rawPayload, secret);
  var hex = "";
  for (var i = 0; i < rawBytes.length; i++) {
    var byteVal = rawBytes[i];
    if (byteVal < 0) {
      byteVal += 256;
    }
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) {
      byteHex = "0" + byteHex;
    }
    hex += byteHex;
  }
  return hex.toLowerCase();
}

/**
 * Sends HTTPS POST request to the PathFinder webhook endpoint with retries and exponential backoff.
 *
 * @param {string} url Target webhook URL.
 * @param {string} payload JSON string payload.
 * @param {string} signature 64-char hex HMAC signature.
 * @param {string} timestamp Epoch timestamp string in milliseconds.
 * @param {string|number|null} vercelBypassSecretOrRetries Vercel bypass secret string or maxRetries if omitted.
 * @param {number} [maybeRetries] Maximum number of retry attempts.
 * @return {string} Server response text.
 */
function sendWebhookWithRetry_(url, payload, signature, timestamp, vercelBypassSecretOrRetries, maybeRetries) {
  var vercelBypassSecret = null;
  var maxRetries = 3;

  if (typeof vercelBypassSecretOrRetries === "string") {
    vercelBypassSecret = vercelBypassSecretOrRetries;
    maxRetries = typeof maybeRetries === "number" ? maybeRetries : 3;
  } else if (typeof vercelBypassSecretOrRetries === "number") {
    maxRetries = vercelBypassSecretOrRetries;
  }

  var attempt = 0;
  var lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      var requestHeaders = {
        "x-webhook-signature": signature,
        "x-webhook-timestamp": timestamp
      };

      if (vercelBypassSecret) {
        requestHeaders["x-vercel-protection-bypass"] = vercelBypassSecret;
      }

      var options = {
        method: "post",
        contentType: "application/json",
        payload: payload,
        headers: requestHeaders,
        muteHttpExceptions: true
      };

      Logger.log("[PATHFINDER_SYNC] Dispatching webhook request (attempt " + attempt + "/" + maxRetries + ")...");
      var response = UrlFetchApp.fetch(url, options);
      var statusCode = response.getResponseCode();
      var responseBody = response.getContentText();

      Logger.log("[PATHFINDER_SYNC] Server responded with HTTP status " + statusCode);

      if (statusCode >= 200 && statusCode < 300) {
        return responseBody;
      }

      // If client-side error (4xx), do not retry (signature, payload, or course issue)
      if (statusCode >= 400 && statusCode < 500) {
        throw new Error("Webhook rejected with HTTP " + statusCode + ": " + responseBody);
      }

      // Server error (5xx): Retry with exponential backoff
      Logger.log("[PATHFINDER_SYNC] Server error (" + statusCode + "). Retrying...");
      lastError = new Error("HTTP " + statusCode + ": " + responseBody);

    } catch (err) {
      lastError = err;
      Logger.log("[PATHFINDER_SYNC] Network/Fetch exception on attempt " + attempt + ": " + err.message);

      // If already a non-retryable 4xx error, break immediately
      if (err.message && err.message.indexOf("Webhook rejected with HTTP 4") !== -1) {
        throw err;
      }
    }

    if (attempt < maxRetries) {
      var backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      Logger.log("[PATHFINDER_SYNC] Waiting " + backoffMs + "ms before next retry...");
      Utilities.sleep(backoffMs);
    }
  }

  throw new Error("Webhook failed after " + maxRetries + " attempts. Last error: " + (lastError ? lastError.message : "Unknown error"));
}

// ====================================================================
// UTILITY & TESTING FUNCTIONS (For Operator Diagnostics)
// ====================================================================

/**
 * Diagnostic function: Test webhook connectivity directly from the Apps Script editor.
 * Run this function to verify that Script Properties and HMAC signatures are working.
 */
function testWebhookConnection() {
  Logger.log("[PATHFINDER_DIAGNOSTIC] Starting safe testWebhookConnection()...");

  var config = getConfiguration_();
  Logger.log("[PATHFINDER_DIAGNOSTIC] Config loaded. Target URL: " + config.webhookUrl + " | Course: " + config.courseSlug);

  var timestamp = Date.now();
  var diagnosticPayload = {
    diagnostic: true,
    action: "ping",
    courseId: config.courseSlug,
    timestamp: timestamp
  };

  var rawJson = JSON.stringify(diagnosticPayload);
  var signature = computeHmacSha256Hex_(rawJson, config.webhookSecret);
  var timestampStr = String(timestamp);

  Logger.log("[PATHFINDER_DIAGNOSTIC] Signature generated: " + signature.substring(0, 16) + "...");
  Logger.log("[PATHFINDER_DIAGNOSTIC] Sending safe diagnostic ping (0 database mutations)...");

  var requestHeaders = {
    "x-webhook-signature": signature,
    "x-webhook-timestamp": timestampStr
  };

  if (config.vercelBypassSecret) {
    requestHeaders["x-vercel-protection-bypass"] = config.vercelBypassSecret;
    Logger.log("[PATHFINDER_DIAGNOSTIC] Vercel Protection Bypass header attached.");
  } else {
    Logger.log("[PATHFINDER_DIAGNOSTIC] Vercel Protection Bypass: not configured (optional).");
  }

  var options = {
    method: "post",
    contentType: "application/json",
    payload: rawJson,
    headers: requestHeaders,
    muteHttpExceptions: true
  };

  var res = UrlFetchApp.fetch(config.webhookUrl, options);
  var statusCode = res.getResponseCode();
  var responseText = res.getContentText();
  Logger.log("[PATHFINDER_DIAGNOSTIC] Server response HTTP " + statusCode + ": " + responseText);

  if (statusCode === 200) {
    Logger.log("[PATHFINDER_DIAGNOSTIC] SUCCESS: Webhook URL, HMAC Secret, and Course Configuration verified safely!");
  } else {
    Logger.log("[PATHFINDER_DIAGNOSTIC] FAILED: Server rejected diagnostic ping (HTTP " + statusCode + "). Inspect response above.");
  }
}

/**
 * Diagnostic function: Test webhook connectivity directly from the Apps Script editor.
 * Safe alias matching the specification and delivery guide.
 */
function testWebhookDiagnosticPing() {
  return testWebhookConnection();
}

/**
 * Helper function: Programmatically set Script Properties in bulk.
 * Edit the values below and run this once if you prefer not to use the UI.
 */
function setScriptPropertiesHelper() {
  var properties = {
    WEBHOOK_URL: "https://pathfinder-forge-52-gkhziw43p-vrajs-projects-ecf0c974.vercel.app/api/course-applications/webhook",
    WEBHOOK_SECRET: "YOUR_32_CHAR_OR_64_HEX_SECRET_HERE",
    COURSE_SLUG: "bioplastic-innovation", // Change to ai-in-drug-discovery or bioinformatics for other forms
    VERCEL_PROTECTION_BYPASS: "" // Optional: Paste your Vercel Automation Bypass secret here if on a protected preview deployment
  };
  PropertiesService.getScriptProperties().setProperties(properties);
  Logger.log("[PATHFINDER_CONFIG] Script Properties successfully set!");
}
