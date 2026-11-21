/**
 * ==============================================================================
 * PATHFINDER COURSE APPLICATION MANAGEMENT SYSTEM
 * GOOGLE APPS SCRIPT: SPIN & WIN SHARED SHEET WEBHOOK INTEGRATION (v3.0)
 * ==============================================================================
 * Author: PathFinder Platform Operations
 * Target: Single Google Sheet connected to all 6 Spin Wheel promotional forms
 * Version: 3.0.0 (Multi-Tab Course Selection & Reward Discrimination)
 *
 * PURPOSE:
 * Automatically synchronizes course scholarship and discount applications from
 * the shared Spin & Win Google Sheet directly into PathFinder CMS Admin Panel.
 *
 * ARCHITECTURAL CONTRACT:
 * - All 6 promotional Google Forms write into this single Google Sheet (separate tabs).
 * - Course Forms (Ingested into CMS Course Applications):
 *     1. 25% Discount (has 'Course selection' column)
 *     2. 50% Discount (has 'Course selection' column)
 *     3. Free Full Project of Your Choice (has 'Course selection' column)
 * - Non-Course Forms (Filtered out - NOT ingested into CMS):
 *     4. Free Mentorship Session (marked as PROCESSED locally, 0 CMS mutation)
 *     5. Live Mentorship Call with the Founder (marked as PROCESSED locally, 0 CMS mutation)
 *     6. Free IELTS Interview Session (marked as PROCESSED locally, 0 CMS mutation)
 *
 * CANONICAL COURSE MAPPINGS:
 * - "BioPlastic Innovation"                  -> "bioplastic-innovation"
 * - "Bioinformatics & Computational Biology" -> "bioinformatics"
 * - "AI in Drug Discovery"                   -> "ai-in-drug-discovery"
 *
 * ==============================================================================
 * SETUP INSTRUCTIONS (FOR THE SINGLE SHARED GOOGLE SHEET)
 * ==============================================================================
 * 1. Open your shared Google Spreadsheet in Google Sheets.
 * 2. In the top menu, click "Extensions" -> "Apps Script".
 * 3. Delete any default code in Code.gs and paste this entire script.
 * 4. Rename the Apps Script project to "PathFinder Spin Wheel Webhook Sync".
 * 5. Configure Script Properties (Project Settings [gear icon] -> Script Properties):
 *    - Key: WEBHOOK_URL
 *      Value: https://project.micrylisbiotech.com/api/course-applications/webhook
 *    - Key: WEBHOOK_SECRET
 *      Value: effd4c346b43a24d22543efa9779d8b8eb44fc3fd7a024a894c6d2adb199ab64
 *    - Key: VERCEL_PROTECTION_BYPASS (Optional for preview deployments)
 *      Value: <bypass-secret-if-applicable>
 * 6. Set up the Spreadsheet-Bound Installable Trigger:
 *    - In the left sidebar of Apps Script, click "Triggers" (clock icon).
 *    - Click "+ Add Trigger" (bottom right).
 *    - Choose which function to run: onFormSubmit
 *    - Which deployment should run: Head
 *    - Select event source: "From spreadsheet"
 *    - Select event type: "On form submit"
 *    - Failure notification settings: "Notify me immediately"
 *    - Click "Save" and authorize Google permissions.
 * 7. Diagnostics & Self-Test:
 *    - Select function "testWebhookConnection" from the editor toolbar dropdown and click "Run".
 *    - Check Execution log to confirm HTTP 200 DIAGNOSTIC_PONG.
 * ==============================================================================
 */

/**
 * Dedicated column header for recording synchronization receipts
 */
var STATUS_COLUMN_HEADER = "Webhook Status";

/** Default production endpoint */
var DEFAULT_WEBHOOK_URL = "https://project.micrylisbiotech.com/api/course-applications/webhook";

/** Non-course reward tab keywords (strictly skipped from CMS application intake) */
var NON_COURSE_KEYWORDS = ["mentorship", "founder", "ielts", "interview", "call"];

/**
 * Resolves the target Spreadsheet instance supporting both container-bound
 * and standalone Apps Script execution contexts.
 */
function resolveSpreadsheet(e) {
  if (e && e.source) {
    return e.source;
  }
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {}

  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = (props.getProperty("SPREADSHEET_ID") || "").trim();
  if (spreadsheetId) {
    try {
      return SpreadsheetApp.openById(spreadsheetId);
    } catch (openErr) {
      Logger.log("WARNING: Could not open spreadsheet via SPREADSHEET_ID: " + openErr.message);
    }
  }
  return null;
}

/**
 * Normalizes course selection title into authoritative canonical track slug.
 * Matches:
 *  - "BioPlastic Innovation"                  -> "bioplastic-innovation"
 *  - "Bioinformatics & Computational Biology" -> "bioinformatics"
 *  - "AI in Drug Discovery"                   -> "ai-in-drug-discovery"
 */
function resolveCanonicalCourseSlug(rawInput) {
  if (!rawInput) return null;
  var norm = String(rawInput).trim().toLowerCase();

  if (norm.indexOf("bioplastic") !== -1) {
    return "bioplastic-innovation";
  }
  if (norm.indexOf("drug") !== -1 || norm.indexOf("ai in drug") !== -1) {
    return "ai-in-drug-discovery";
  }
  if (
    norm.indexOf("bioinformatics") !== -1 ||
    norm.indexOf("computational") !== -1 ||
    norm.indexOf("genomic") !== -1 ||
    norm.indexOf("bio") !== -1
  ) {
    return "bioinformatics";
  }

  return null;
}

/**
 * Determines whether a sheet tab is for a non-course reward.
 */
function isNonCourseRewardTab(sheetName) {
  if (!sheetName) return false;
  var lower = sheetName.toLowerCase();
  for (var i = 0; i < NON_COURSE_KEYWORDS.length; i++) {
    if (lower.indexOf(NON_COURSE_KEYWORDS[i]) !== -1) {
      return true;
    }
  }
  return false;
}

/**
 * Finds or creates the dedicated status column under script lock.
 */
function getOrCreateStatusColumn(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol > 0) {
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var c = 0; c < headers.length; c++) {
      if (String(headers[c] || "").trim().toLowerCase() === STATUS_COLUMN_HEADER.toLowerCase()) {
        return c + 1;
      }
    }
  }
  var newCol = (lastCol > 0 ? lastCol : 0) + 1;
  sheet.getRange(1, newCol).setValue(STATUS_COLUMN_HEADER);
  return newCol;
}

/**
 * Extracts submission data using resilient header matching across all tabs.
 */
function extractSubmissionData(e, sheet, row) {
  var headerMap = {};

  if (e && e.namedValues) {
    for (var key in e.namedValues) {
      var arr = e.namedValues[key];
      headerMap[key.trim()] = arr && arr.length > 0 ? String(arr[0]).trim() : "";
    }
  } else if (sheet && row > 1) {
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var values = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c] || "").trim();
        var v = values[c] !== undefined && values[c] !== null ? String(values[c]).trim() : "";
        if (h) headerMap[h] = v;
      }
    }
  }

  var name = "";
  var emailEntered = "";
  var emailGoogle = "";
  var phone = "";
  var qualification = "";
  var voucherCode = "";
  var courseRaw = "";

  for (var header in headerMap) {
    var val = headerMap[header];
    if (!val) continue;

    var norm = header.toLowerCase().replace(/[\s\-_]+/g, " ").trim();

    // 1. Name
    if (!name && norm.indexOf("name") !== -1 && norm.indexOf("user") === -1 && norm.indexOf("voucher") === -1) {
      name = val;
    }

    // 2. Contact email (Email ID* > Email ID > Email)
    if (norm === "email id" || norm === "emailid" || norm.indexOf("email id") !== -1) {
      if (!emailEntered) emailEntered = val;
    } else if (norm === "email address" || norm === "email") {
      if (!emailGoogle) emailGoogle = val;
    }

    // 3. Contact Number / Phone
    if (!phone && (norm.indexOf("contact") !== -1 || norm.indexOf("phone") !== -1 || norm.indexOf("mobile") !== -1 || norm.indexOf("whatsapp") !== -1)) {
      phone = val;
    }

    // 4. Qualification
    if (!qualification && norm.indexOf("qualification") !== -1) {
      qualification = val;
    }

    // 5. Voucher Code
    if (!voucherCode && (norm.indexOf("voucher") !== -1 || norm.indexOf("code") !== -1)) {
      if (norm.indexOf("pin") === -1 && norm.indexOf("zip") === -1 && norm.indexOf("postal") === -1) {
        voucherCode = val;
      }
    }

    // 6. Course Selection (Dropdown added to 25%, 50%, and full course)
    if (!courseRaw && (norm.indexOf("course") !== -1 || norm.indexOf("track") !== -1 || norm.indexOf("program") !== -1)) {
      // Exclude fee payment descriptions
      if (norm.indexOf("fee") === -1 && norm.indexOf("payable") === -1 && norm.indexOf("original") === -1) {
        courseRaw = val;
      }
    }
  }

  var finalStudentEmail = (emailEntered || emailGoogle || "").toLowerCase().trim();
  var finalRespondentEmail = (emailGoogle || emailEntered || "").toLowerCase().trim();

  return {
    name: name.trim(),
    studentEmail: finalStudentEmail,
    respondentEmail: finalRespondentEmail,
    phone: phone.trim(),
    qualification: qualification.trim(),
    voucherCode: voucherCode.trim(),
    courseRaw: courseRaw.trim(),
  };
}

/**
 * Main Spreadsheet-bound Trigger Function.
 * Installed with: Event source: "From spreadsheet" -> Event type: "On form submit".
 */
function onFormSubmit(e) {
  var startTime = new Date().getTime();
  Logger.log("[PATHFINDER_SPIN_SYNC] onFormSubmit triggered at " + new Date().toISOString());

  var props = PropertiesService.getScriptProperties();
  var webhookUrl = (props.getProperty("WEBHOOK_URL") || DEFAULT_WEBHOOK_URL).trim();
  var webhookSecret = (props.getProperty("WEBHOOK_SECRET") || "").trim();
  var bypassSecret = (props.getProperty("VERCEL_PROTECTION_BYPASS") || "").trim();

  if (!webhookSecret) {
    Logger.log("ERROR: WEBHOOK_SECRET is not configured in Script Properties. Webhook aborted.");
    return;
  }

  // Identify target spreadsheet, active sheet and row
  var ss = resolveSpreadsheet(e);
  if (!ss) {
    Logger.log("ERROR: Could not resolve target Spreadsheet. Please add SPREADSHEET_ID to Script Properties.");
    return;
  }

  var range = e ? e.range : null;
  var sheet = null;
  if (range) {
    sheet = range.getSheet();
  } else {
    sheet = ss.getActiveSheet();
  }
  var row = range ? range.getRow() : (sheet ? sheet.getLastRow() : 0);

  if (!sheet || row <= 1) {
    Logger.log("WARNING: Invalid sheet or row <= 1. Aborting.");
    return;
  }

  var sheetName = sheet.getName();
  Logger.log("Processing submission in tab: '" + sheetName + "', row: " + row);

  // 1. NON-COURSE REWARD CHECK
  // If the submission is from a Mentorship, Founder Call, or IELTS form:
  // As specified: "CMS applications me nahi lana hai"
  if (isNonCourseRewardTab(sheetName)) {
    Logger.log("Non-course reward tab detected ('" + sheetName + "'). Skipping CMS course application creation.");
    var lockNc = LockService.getScriptLock();
    if (lockNc.tryLock(5000)) {
      try {
        var statusColNc = getOrCreateStatusColumn(sheet);
        sheet.getRange(row, statusColNc).setValue("PROCESSED (NON_COURSE_REWARD): " + new Date().toISOString());
      } finally {
        lockNc.releaseLock();
      }
    }
    return;
  }

  // 2. SCRIPT LOCK ACQUISITION
  var lock = LockService.getScriptLock();
  var lockAcquired = false;
  try {
    lockAcquired = lock.tryLock(10000); // 10s timeout
  } catch (lockErr) {
    Logger.log("WARNING: Script lock error: " + lockErr.message);
    return;
  }

  if (!lockAcquired) {
    Logger.log("WARNING: Could not acquire script lock within 10s for row " + row + ". Aborting to prevent collision.");
    return;
  }

  var statusCol = 0;

  try {
    statusCol = getOrCreateStatusColumn(sheet);

    // Fast check under lock: avoid reprocessing if already verified
    var currentStatus = String(sheet.getRange(row, statusCol).getValue() || "").trim();
    if (currentStatus.indexOf("VERIFIED") === 0 || currentStatus.indexOf("DUPLICATE") === 0) {
      Logger.log("Row " + row + " in tab '" + sheetName + "' already processed (" + currentStatus + "). Skipping.");
      return;
    }

    // 3. EXTRACT SUBMISSION DATA
    var formData = extractSubmissionData(e, sheet, row);
    var name = formData.name;
    var studentEmail = formData.studentEmail;
    var respondentEmail = formData.respondentEmail;
    var phone = formData.phone;
    var qualification = formData.qualification;
    var voucherCode = formData.voucherCode;
    var courseRaw = formData.courseRaw;

    if (!studentEmail) {
      Logger.log("WARNING: Missing student email in row " + row + ". Skipping.");
      sheet.getRange(row, statusCol).setValue("SKIPPED (MISSING_EMAIL): " + new Date().toISOString());
      return;
    }

    // Resolve course slug
    var courseSlug = resolveCanonicalCourseSlug(courseRaw);
    if (!courseSlug) {
      Logger.log("WARNING: Could not resolve course from '" + courseRaw + "' in row " + row + ".");
      sheet.getRange(row, statusCol).setValue("FAILED (UNKNOWN_COURSE_SELECTION): " + new Date().toISOString());
      return;
    }

    // 4. CONSTRUCT GLOBALLY UNIQUE RESPONSE ID
    var ssId = sheet.getParent().getId();
    var sheetId = sheet.getSheetId();
    var formResponseId = "ss_" + ssId + "_sh_" + sheetId + "_row_" + row;

    var timestamp = new Date().getTime();

    // 5. BUILD CANONICAL WEBHOOK PAYLOAD
    var payloadObj = {
      responseId: formResponseId,
      timestamp: timestamp,
      courseId: courseSlug,
      studentName: name || "Student Applicant",
      studentEmail: studentEmail,
      enteredEmail: studentEmail,
      respondentEmail: respondentEmail || studentEmail,
      voucherCode: voucherCode,
      phone: phone,
      qualification: qualification,
      rewardTitle: sheetName,
    };

    var payloadJson = JSON.stringify(payloadObj);

    // 6. COMPUTE HMAC-SHA256 SIGNATURE
    var signatureBytes = Utilities.computeHmacSha256Signature(payloadJson, webhookSecret);
    var signatureHex = bytesToHex(signatureBytes);

    // 7. DISPATCH HTTP POST REQUEST
    var headers = {
      "x-webhook-signature": signatureHex,
      "x-webhook-timestamp": String(timestamp),
      "X-Spin-Signature": signatureHex,
      "X-Spin-Timestamp": String(timestamp),
      "User-Agent": "PathFinder-GoogleAppsScript-SpinWheelSync/3.0",
    };

    if (bypassSecret) {
      headers["x-vercel-protection-bypass"] = bypassSecret;
    }

    var options = {
      method: "post",
      contentType: "application/json",
      payload: payloadJson,
      headers: headers,
      muteHttpExceptions: true,
    };

    Logger.log("Dispatching webhook for row " + row + " (" + courseSlug + ")...");
    var response = UrlFetchApp.fetch(webhookUrl, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText() || "";

    Logger.log("Webhook response code: " + responseCode);

    if (responseCode === 200) {
      var resJson = null;
      try {
        resJson = JSON.parse(responseText);
      } catch (pErr) {}

      var appNumber = (resJson && resJson.applicationNumber) ? resJson.applicationNumber : "SUCCESS";

      if (resJson && resJson.isDuplicate === true) {
        sheet.getRange(row, statusCol).setValue("DUPLICATE (" + appNumber + "): " + new Date().toISOString());
        Logger.log("Row " + row + " marked as DUPLICATE (" + appNumber + ").");
      } else {
        sheet.getRange(row, statusCol).setValue("VERIFIED (" + appNumber + "): " + new Date().toISOString());
        Logger.log("Row " + row + " marked as VERIFIED (" + appNumber + ").");
      }
    } else {
      var errSnippet = responseText.substring(0, 100).replace(/[\r\n]+/g, " ");
      sheet.getRange(row, statusCol).setValue("FAILED (HTTP " + responseCode + "): " + new Date().toISOString());
      Logger.log("ERROR: Webhook returned HTTP " + responseCode + ": " + errSnippet);
    }
  } catch (err) {
    Logger.log("EXCEPTION in onFormSubmit: " + err.message);
    if (statusCol > 0) {
      sheet.getRange(row, statusCol).setValue("ERROR (" + err.message.substring(0, 50) + "): " + new Date().toISOString());
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Safe Diagnostic Self-Test (Zero Database Mutations).
 * Run this from the Apps Script toolbar to verify connectivity and HMAC credentials.
 */
function testWebhookConnection() {
  Logger.log("[PATHFINDER_DIAGNOSTIC] Starting safe testWebhookConnection()...");

  var props = PropertiesService.getScriptProperties();
  var webhookUrl = (props.getProperty("WEBHOOK_URL") || DEFAULT_WEBHOOK_URL).trim();
  var webhookSecret = (props.getProperty("WEBHOOK_SECRET") || "").trim();
  var bypassSecret = (props.getProperty("VERCEL_PROTECTION_BYPASS") || "").trim();

  if (!webhookSecret) {
    Logger.log("ERROR: WEBHOOK_SECRET is not configured in Script Properties.");
    return;
  }

  var timestamp = new Date().getTime();
  var payloadObj = {
    action: "diagnostic_ping",
    diagnostic: true,
    timestamp: timestamp,
    courseId: "bioplastic-innovation",
    notes: "Safe self-test ping from SpinWheelSharedSheetWebhook.gs (0 mutations).",
  };

  var payloadJson = JSON.stringify(payloadObj);
  var signatureBytes = Utilities.computeHmacSha256Signature(payloadJson, webhookSecret);
  var signatureHex = bytesToHex(signatureBytes);

  var headers = {
    "x-webhook-signature": signatureHex,
    "x-webhook-timestamp": String(timestamp),
    "X-Spin-Signature": signatureHex,
    "X-Spin-Timestamp": String(timestamp),
    "User-Agent": "PathFinder-GoogleAppsScript-SpinWheelSync/3.0",
  };

  if (bypassSecret) {
    headers["x-vercel-protection-bypass"] = bypassSecret;
  }

  var options = {
    method: "post",
    contentType: "application/json",
    payload: payloadJson,
    headers: headers,
    muteHttpExceptions: true,
  };

  Logger.log("Sending diagnostic ping to " + webhookUrl + "...");
  var response = UrlFetchApp.fetch(webhookUrl, options);
  var code = response.getResponseCode();
  var text = response.getContentText() || "";

  Logger.log("Server response HTTP " + code + ": " + text);

  if (code === 200) {
    Logger.log("SUCCESS: Webhook URL and HMAC Secret verified safely! Ready for live submissions.");
  } else {
    Logger.log("FAILURE: Verification failed with HTTP " + code);
  }
}

/**
 * Test & Process the latest row directly from the active sheet tab.
 * Select this function in the toolbar and click "Run" to test without re-submitting the form!
 */
function processLatestRow() {
  var ss = resolveSpreadsheet();
  if (!ss) {
    Logger.log("ERROR: Could not find active spreadsheet.");
    Logger.log("If your Apps Script was opened standalone or from Google Form, please add your Google Sheet ID to Script Properties as 'SPREADSHEET_ID'.");
    Logger.log("You can copy the ID from your Google Sheet URL: https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit");
    return;
  }

  // Find the tab that has response data
  var targetSheet = ss.getActiveSheet();
  var sheets = ss.getSheets();

  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    var sName = s.getName();
    if (!isNonCourseRewardTab(sName) && s.getLastRow() > 1) {
      targetSheet = s;
      break;
    }
  }

  if (!targetSheet || targetSheet.getLastRow() <= 1) {
    Logger.log("[TEST_LATEST] No response rows found in any course tabs of spreadsheet '" + ss.getName() + "'.");
    return;
  }

  var sheetName = targetSheet.getName();
  var lastRow = targetSheet.getLastRow();
  Logger.log("[TEST_LATEST] Found response in tab: '" + sheetName + "', Row: " + lastRow);

  // Clear previous status on the last row so it can be re-tested
  var statusCol = getOrCreateStatusColumn(targetSheet);
  targetSheet.getRange(lastRow, statusCol).setValue("");

  var simulatedEvent = {
    source: ss,
    range: targetSheet.getRange(lastRow, 1, 1, targetSheet.getLastColumn())
  };

  Logger.log("[TEST_LATEST] Triggering onFormSubmit for row " + lastRow + " in tab '" + sheetName + "'...");
  onFormSubmit(simulatedEvent);
  Logger.log("[TEST_LATEST] Completed. Status: " + targetSheet.getRange(lastRow, statusCol).getValue());
}

/**
 * Converts byte array to lowercase hexadecimal string.
 */
function bytesToHex(bytes) {
  var hex = "";
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0) b += 256;
    var byteString = b.toString(16);
    if (byteString.length === 1) {
      hex += "0";
    }
    hex += byteString;
  }
  return hex;
}
