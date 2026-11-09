/**
 * ==============================================================================
 * PathFinder Spin & Win — Multi-Form Google Sheets to Webhook Integration (v2.4)
 * ==============================================================================
 * 
 * Standalone & Container-Bound Compatible:
 * - Supports both standalone Apps Script projects (e.g. "PathFinder Spin & Win Webhook")
 *   and container-bound scripts attached directly to Google Sheets.
 * - Supports all 6 promotional reward Google Forms linked to a single Spreadsheet.
 * - Tab-agnostic: Dynamically handles responses from separate form tabs.
 * - Header-driven: Prioritizes 'Email ID' preferentially over 'Email address',
 *   and dynamically locates 'Voucher Code' and 'Name' regardless of column order.
 * - Dual Trigger Resolution:
 *   * Uses e.source and e.source.getId() whenever available from the event object.
 *   * Falls back to SpreadsheetApp.openById(SPREADSHEET_ID) for standalone execution.
 * - Duplicate Trigger Prevention:
 *   * Includes 'installSpreadsheetTrigger()' which checks for existing triggers
 *     before creating one, preventing duplicate dispatches.
 * - Optional Vercel Deployment Protection Bypass:
 *   * Supports an optional 'VERCEL_PROTECTION_BYPASS' Script Property.
 *   * When configured, attaches 'x-vercel-protection-bypass' to outgoing headers,
 *     allowing automated webhooks to pass through Vercel SSO / Deployment Protection.
 *   * If absent, standard header dispatch is preserved without modification.
 *   * Zero secret exposure in logs, cells, or error output.
 * - Strict Lock Failure Handling:
 *   * Aborts immediately if script lock cannot be acquired within 10s.
 *   * Never creates columns, modifies cells, or dispatches webhooks without lock ownership.
 *   * Authoritative row-status verification executes exclusively under lock.
 *   * Preserves read-only fast pre-check outside the lock.
 * - Contract-Strict Verification:
 *   * Marks VERIFIED only when response HTTP is 200 and body matches { success: true, status: "SUCCESS" }.
 *   * Marks DUPLICATE only when response HTTP is 200 and body matches { success: true, status: "DUPLICATE" }.
 *   * Treats malformed or unexpected HTTP 200 responses as failures.
 * - Complete Error Sanitization:
 *   * Never logs raw exception messages, server responses, payloads, emails, vouchers, or secrets.
 *   * Diagnostic cell output restricted to safe HTTP codes and validated error categories.
 * - Globally Unique Submission Identity:
 *   * Builds form_response_id using complete Spreadsheet ID + Sheet GID + Row number.
 * - Retryable failures: Failed requests remain marked FAILED and can be safely retried.
 * - Safe Self-Test: 'testConfiguration()' verifies properties, SPREADSHEET_ID, & HMAC
 *   without dispatching fake participant data.
 * 
 * Setup Instructions:
 * 1. Open your Apps Script project (Standalone or Bound).
 * 2. Paste this entire script into Code.gs and Save.
 * 3. Configure Script Properties:
 *    - Click Project Settings (gear icon on the left).
 *    - Scroll down to "Script Properties" -> "Edit script properties".
 *    - Add configuration properties:
 *      * WEBHOOK_URL: "https://<your-preview-or-staging-domain>/api/spin-webhook"
 *      * WEBHOOK_SECRET: The exact secret from your server's SPIN_WEBHOOK_SECRET
 *      * SPREADSHEET_ID: The full Google Spreadsheet ID (from your sheet URL).
 *      * VERCEL_PROTECTION_BYPASS (Optional): If your Vercel Preview deployment is protected by
 *        Vercel Authentication / SSO, provide your project's automation bypass secret.
 * 4. Run Self-Test:
 *    - Select function "testConfiguration" from the dropdown and click "Run".
 *    - Check Execution log to confirm all checks PASS.
 * 5. Install Trigger Safely:
 *    - Select function "installSpreadsheetTrigger" from the dropdown and click "Run".
 *    - This creates exactly one installable trigger, preventing duplicates.
 * ==============================================================================
 */

/**
 * Dedicated column header for recording webhook synchronization receipts.
 */
var STATUS_COLUMN_HEADER = "Webhook Status";

/**
 * Validated backend error codes allowed in diagnostic cell status.
 * Any server code outside this set is mapped to a generic category to prevent reflection.
 */
var VALIDATED_BACKEND_ERROR_CODES = [
  "SUCCESS",
  "CAMPAIGN_EXPIRED",
  "MISSING_HEADERS",
  "INVALID_TIMESTAMP",
  "EXPIRED_TIMESTAMP",
  "CONFIGURATION_ERROR",
  "INVALID_SIGNATURE",
  "INVALID_JSON",
  "MISSING_FIELDS",
  "DATABASE_ERROR",
  "VOUCHER_NOT_FOUND",
  "EMAIL_MISMATCH",
  "REWARD_MISMATCH",
  "DUPLICATE_SUBMISSION",
  "RATE_LIMITED",
  "INTERNAL_ERROR"
];

/**
 * Resolves the target Spreadsheet instance supporting both container-bound
 * and standalone Apps Script execution contexts.
 * Priority: e.source -> SpreadsheetApp.getActiveSpreadsheet() -> SpreadsheetApp.openById(SPREADSHEET_ID).
 * @param {Object} [e] - Form submit event object.
 * @param {Object} [props] - ScriptProperties instance.
 * @return {Spreadsheet|null}
 */
function resolveSpreadsheet(e, props) {
  if (e && e.source) {
    return e.source;
  }
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {}

  var p = props || PropertiesService.getScriptProperties();
  var spreadsheetId = (p.getProperty("SPREADSHEET_ID") || "").trim();
  if (spreadsheetId) {
    try {
      return SpreadsheetApp.openById(spreadsheetId);
    } catch (openErr) {
      Logger.log("WARNING: Could not open spreadsheet via SPREADSHEET_ID: " + categorizeException(openErr));
    }
  }
  return null;
}

/**
 * Triggered automatically whenever a new Google Form response is submitted to any tab.
 * @param {Object} e - The form submission event object provided by Google Sheets.
 */
function onFormSubmitTrigger(e) {
  var props = PropertiesService.getScriptProperties();
  var webhookUrl = (props.getProperty("WEBHOOK_URL") || "").trim();
  var webhookSecret = (props.getProperty("WEBHOOK_SECRET") || "").trim();
  var bypassSecret = (props.getProperty("VERCEL_PROTECTION_BYPASS") || "").trim();

  if (!webhookUrl || !webhookSecret) {
    Logger.log("ERROR: WEBHOOK_URL or WEBHOOK_SECRET is not configured in Script Properties. Submission aborted.");
    return;
  }

  // Resolve target spreadsheet (e.source -> getActiveSpreadsheet() -> openById(SPREADSHEET_ID))
  var ss = resolveSpreadsheet(e, props);

  // Identify active sheet and row
  var range = e ? e.range : null;
  var sheet = null;
  if (range) {
    sheet = range.getSheet();
  } else if (ss) {
    sheet = ss.getActiveSheet();
  }
  var row = range ? range.getRow() : 0;

  // Guard against invalid sheet or header row
  if (!sheet || row <= 1) {
    Logger.log("WARNING: Invalid sheet or row. Aborting.");
    return;
  }

  var sheetName = sheet.getName();

  // 1. Fast Duplicate Pre-Check (Strictly Read-Only, Never Mutates Sheet)
  // If the status column already exists and row is already verified, avoid lock contention.
  var existingStatusCol = findExistingStatusColumn(sheet);
  if (existingStatusCol > 0) {
    var preStatus = String(sheet.getRange(row, existingStatusCol).getValue() || "").trim();
    if (preStatus.indexOf("VERIFIED") === 0 || preStatus.indexOf("DUPLICATE") === 0) {
      Logger.log("Duplicate dispatch prevented (read-only pre-check): Row " + row + " in tab '" + sheetName + "' already finalized.");
      return;
    }
  }

  // 2. Strict Lock Acquisition
  // Must acquire lock BEFORE modifying sheet (creating column) or dispatching webhook.
  var lock = LockService.getScriptLock();
  var lockAcquired = false;
  try {
    lockAcquired = lock.tryLock(10000); // 10-second timeout
  } catch (lockErr) {
    Logger.log("WARNING: Script lock acquisition threw an exception. Aborting.");
    return;
  }

  if (!lockAcquired) {
    Logger.log("WARNING: Could not acquire script lock within 10s for row " + row + ". Aborting to prevent concurrent collision.");
    // Do not mark row as VERIFIED or DUPLICATE. The row remains retryable.
    return;
  }

  var statusCol = 0;

  try {
    // 3. Under Lock: Ensure dedicated status column exists (Sheet mutation happens only under lock)
    statusCol = getOrCreateStatusColumn(sheet);

    // 4. Under Lock: Authoritative Row-Status Check
    var authoritativeStatus = String(sheet.getRange(row, statusCol).getValue() || "").trim();
    if (authoritativeStatus.indexOf("VERIFIED") === 0 || authoritativeStatus.indexOf("DUPLICATE") === 0) {
      Logger.log("Duplicate dispatch prevented (authoritative lock check): Row " + row + " in tab '" + sheetName + "' already finalized.");
      return;
    }

    // 5. Extract Submission Data using Header-Based Detection
    var formData = extractSubmissionData(e, sheet, row);
    var email = formData.email;
    var voucherCode = formData.voucherCode;
    var rewardId = formData.rewardId;

    if (!email || !voucherCode) {
      Logger.log("WARNING: Missing required fields in row " + row + " (Tab: '" + sheetName + "'). Skipping webhook.");
      sheet.getRange(row, statusCol).setValue("SKIPPED (MISSING_REQUIRED_FIELDS): " + new Date().toISOString());
      return;
    }

    // 6. Construct Globally Unique Form Response ID using Complete Spreadsheet ID
    var spreadsheetId = "";
    if (e && e.source) {
      try {
        spreadsheetId = e.source.getId();
      } catch (srcErr) {}
    }
    if (!spreadsheetId && ss) {
      try {
        spreadsheetId = ss.getId();
      } catch (ssErr) {}
    }
    if (!spreadsheetId) {
      spreadsheetId = (props.getProperty("SPREADSHEET_ID") || "").trim() || "ss";
    }

    var sheetId = sheet.getSheetId();
    var formResponseId = "ss_" + spreadsheetId + "_sh_" + sheetId + "_row_" + row;

    var timestamp = new Date().getTime();

    // 7. Build Canonical JSON Payload matching PathFinder Backend Contract
    var payloadObj = {
      voucher_code: voucherCode,
      email: email,
      form_response_id: formResponseId,
      timestamp: timestamp,
    };

    if (rewardId) {
      payloadObj.reward_id = rewardId;
    }

    var payloadJson = JSON.stringify(payloadObj);

    // 8. Compute HMAC-SHA256 Signature
    var signatureBytes = Utilities.computeHmacSha256Signature(payloadJson, webhookSecret);
    var signatureHex = bytesToHex(signatureBytes);

    // 9. Dispatch Request to Webhook Endpoint
    var headers = {
      "X-Spin-Signature": signatureHex,
      "X-Spin-Timestamp": String(timestamp),
      "User-Agent": "PathFinder-GoogleAppsScript-Webhook/2.4",
    };

    // Attach optional Vercel Deployment Protection bypass header if configured
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

    Logger.log("Dispatching webhook for row " + row + " in tab '" + sheetName + "'...");

    var response = UrlFetchApp.fetch(webhookUrl, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText() || "";

    Logger.log("Webhook response received. HTTP Code: " + responseCode);

    // 10. Parse Response and Enforce Contract-Strict Status Recording
    if (responseCode === 200) {
      var resJson = null;
      try {
        resJson = JSON.parse(responseText);
      } catch (jsonErr) {}

      // Contract Check: Successful verification must match { success: true, status: "SUCCESS" }
      if (resJson && resJson.success === true && resJson.status === "SUCCESS") {
        sheet.getRange(row, statusCol).setValue("VERIFIED: " + new Date().toISOString());
        Logger.log("Row " + row + " marked as VERIFIED.");
      }
      // Contract Check: Idempotent duplicate verification must match { success: true, status: "DUPLICATE" }
      else if (resJson && resJson.success === true && resJson.status === "DUPLICATE") {
        sheet.getRange(row, statusCol).setValue("DUPLICATE: " + new Date().toISOString());
        Logger.log("Row " + row + " marked as DUPLICATE.");
      }
      // Malformed or unexpected HTTP 200 payload -> Treat strictly as failure
      else {
        var unexpectedErr = parseSanitizedError(responseCode, responseText);
        if (unexpectedErr === "HTTP 200") {
          unexpectedErr = "HTTP 200 - UNEXPECTED_PAYLOAD";
        }
        sheet.getRange(row, statusCol).setValue("FAILED (" + unexpectedErr + "): " + new Date().toISOString());
        Logger.log("Webhook response unexpected for row " + row + " -> " + unexpectedErr);
      }
    } else {
      // Failed request (non-200): Record sanitized failure code so submission can be inspected and retried
      var sanitizedErr = parseSanitizedError(responseCode, responseText);
      sheet.getRange(row, statusCol).setValue("FAILED (" + sanitizedErr + "): " + new Date().toISOString());
      Logger.log("Webhook dispatch failed for row " + row + " -> " + sanitizedErr);
    }
  } catch (err) {
    var errorCat = categorizeException(err);
    Logger.log("ERROR in onFormSubmitTrigger: [" + errorCat + "]");
    if (sheet && row > 1 && statusCol > 0) {
      sheet.getRange(row, statusCol).setValue("FAILED (" + errorCat + "): " + new Date().toISOString());
    }
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
      } catch (releaseErr) {}
    }
  }
}

/**
 * Searches for 'Webhook Status' column header strictly read-only without modifying sheet.
 * @param {Sheet} sheet - The active Google Sheet tab.
 * @return {number} 1-based column index if found, or 0 if not found.
 */
function findExistingStatusColumn(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol <= 0) return 0;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    var headerText = String(headers[i] || "").trim().toLowerCase();
    if (headerText === STATUS_COLUMN_HEADER.toLowerCase()) {
      return i + 1; // 1-based index
    }
  }
  return 0;
}

/**
 * Finds the 1-based column index of 'Webhook Status'. If it does not exist,
 * appends the column header to row 1. MUST be called under lock.
 * @param {Sheet} sheet - The active Google Sheet tab.
 * @return {number} 1-based column index.
 */
function getOrCreateStatusColumn(sheet) {
  var existingCol = findExistingStatusColumn(sheet);
  if (existingCol > 0) {
    return existingCol;
  }

  // Create header in the next column under lock ownership
  var lastCol = sheet.getLastColumn();
  var newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue(STATUS_COLUMN_HEADER);
  return newCol;
}

/**
 * Header-based extraction supporting all six forms with varied column ordering.
 * Preferentially reads 'Email ID' before 'Email address'.
 * @param {Object} e - Event object.
 * @param {Sheet} sheet - Active sheet.
 * @param {number} row - Active row number.
 * @return {Object} Extracted data: email, voucherCode, name, rewardId.
 */
function extractSubmissionData(e, sheet, row) {
  var headerMap = {};

  if (e && e.namedValues) {
    for (var key in e.namedValues) {
      var arr = e.namedValues[key];
      headerMap[key.trim()] = (arr && arr.length > 0) ? String(arr[0]).trim() : "";
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

  var emailPrimary = "";
  var emailSecondary = "";
  var emailTertiary = "";
  var voucherCode = "";
  var name = "";
  var rewardId = "";

  for (var header in headerMap) {
    var val = headerMap[header];
    if (!val) continue;

    var norm = header.toLowerCase().replace(/[\s\-_]+/g, " ").trim();

    // 1. Email Extraction with Priority: 'Email ID' > 'Email Address' > general 'Email'
    if (norm === "email id" || norm === "emailid") {
      emailPrimary = val;
    } else if (norm.indexOf("email id") !== -1 && !emailPrimary) {
      emailPrimary = val;
    } else if (norm === "email address" || norm === "email") {
      if (!emailSecondary) emailSecondary = val;
    } else if (norm.indexOf("email") !== -1 && !emailTertiary) {
      emailTertiary = val;
    }

    // 2. Voucher Code Extraction (looks for 'voucher' or 'code', excludes zip/pin codes)
    if (!voucherCode) {
      if (norm.indexOf("voucher") !== -1 || norm.indexOf("code") !== -1) {
        if (norm.indexOf("pin") === -1 && norm.indexOf("zip") === -1 && norm.indexOf("postal") === -1) {
          voucherCode = val;
        }
      }
    }

    // 3. Participant Name Extraction
    if (!name) {
      if (norm.indexOf("name") !== -1) {
        if (norm.indexOf("file") === -1 && norm.indexOf("user") === -1 && norm.indexOf("voucher") === -1) {
          name = val;
        }
      }
    }

    // 4. Reward ID Extraction (if form contains explicit question)
    if (!rewardId) {
      if (norm.indexOf("reward") !== -1 || norm.indexOf("prize") !== -1) {
        rewardId = val;
      }
    }
  }

  var finalEmail = (emailPrimary || emailSecondary || emailTertiary || "").toLowerCase().trim();

  return {
    email: finalEmail,
    voucherCode: voucherCode.trim(),
    name: name.trim(),
    rewardId: rewardId.trim(),
  };
}

/**
 * Converts raw byte array into lowercase hex string.
 */
function bytesToHex(bytes) {
  var hex = "";
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0) b += 256;
    var s = b.toString(16);
    if (s.length === 1) s = "0" + s;
    hex += s;
  }
  return hex;
}

/**
 * Categorizes an exception into a safe, generic error string without exposing raw messages.
 * @param {Error|any} err - The caught exception.
 * @return {string} Generic error category.
 */
function categorizeException(err) {
  if (!err) return "UNKNOWN_ERROR";
  var msg = String(err.message || err).toLowerCase();
  if (msg.indexOf("timeout") !== -1 || msg.indexOf("timed out") !== -1) {
    return "TIMEOUT_ERROR";
  }
  if (msg.indexOf("urlfetch") !== -1 || msg.indexOf("dns") !== -1 || msg.indexOf("connection") !== -1 || msg.indexOf("network") !== -1) {
    return "NETWORK_ERROR";
  }
  if (msg.indexOf("json") !== -1 || msg.indexOf("parse") !== -1) {
    return "PARSING_ERROR";
  }
  if (msg.indexOf("lock") !== -1) {
    return "LOCK_ERROR";
  }
  if (msg.indexOf("not found") !== -1 || msg.indexOf("permission") !== -1) {
    return "ACCESS_ERROR";
  }
  return "EXECUTION_ERROR";
}

/**
 * Extracts a strictly sanitized error string from HTTP response code and body.
 * Only accepts error codes explicitly listed in VALIDATED_BACKEND_ERROR_CODES.
 * Maps all other responses to generic CLIENT_ERROR or SERVER_ERROR categories.
 * @param {number} code - HTTP status code.
 * @param {string} text - Raw HTTP response text.
 * @return {string} Sanitized diagnostic string.
 */
function parseSanitizedError(code, text) {
  var statusPrefix = "HTTP " + code;
  if (!text) {
    if (code >= 400 && code < 500) {
      return statusPrefix + " - CLIENT_ERROR";
    } else if (code >= 500) {
      return statusPrefix + " - SERVER_ERROR";
    }
    return statusPrefix;
  }

  try {
    var obj = JSON.parse(text);
    if (obj && obj.code && typeof obj.code === "string") {
      var candidateCode = obj.code.trim().toUpperCase();
      // Whitelist check: Only accept codes explicitly listed in VALIDATED_BACKEND_ERROR_CODES
      for (var i = 0; i < VALIDATED_BACKEND_ERROR_CODES.length; i++) {
        if (candidateCode === VALIDATED_BACKEND_ERROR_CODES[i]) {
          return statusPrefix + " - " + candidateCode;
        }
      }
    }
  } catch (e) {
    // Malformed response text ignored
  }

  // Fallback to safe category based on HTTP status range
  if (code >= 400 && code < 500) {
    return statusPrefix + " - CLIENT_ERROR";
  } else if (code >= 500) {
    return statusPrefix + " - SERVER_ERROR";
  }
  return statusPrefix;
}

/**
 * Safe Helper to create exactly ONE installable onFormSubmit trigger for the configured spreadsheet.
 * Checks for existing matching triggers before creating a new one to prevent duplicate dispatches.
 * Can be run manually from the Apps Script editor toolbar.
 */
function installSpreadsheetTrigger() {
  Logger.log("=== Installing Spreadsheet Form Submit Trigger ===");
  var props = PropertiesService.getScriptProperties();
  var ss = resolveSpreadsheet(null, props);

  if (!ss) {
    Logger.log("ERROR: Target spreadsheet not found. For standalone scripts, ensure SPREADSHEET_ID is configured in Script Properties.");
    return;
  }

  var targetSpreadsheetId = ss.getId();
  var triggers = ScriptApp.getProjectTriggers();
  var existingCount = 0;

  for (var i = 0; i < triggers.length; i++) {
    var t = triggers[i];
    if (t.getHandlerFunction() === "onFormSubmitTrigger") {
      var sourceId = t.getTriggerSourceId();
      if (!sourceId || sourceId === targetSpreadsheetId) {
        existingCount++;
      }
    }
  }

  if (existingCount > 0) {
    Logger.log("INFO: Trigger already installed (" + existingCount + " matching trigger found for spreadsheet ID: " + targetSpreadsheetId + "). No new trigger created.");
    return;
  }

  try {
    ScriptApp.newTrigger("onFormSubmitTrigger")
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
    Logger.log("✓ SUCCESS: Created installable onFormSubmit trigger for spreadsheet: " + targetSpreadsheetId);
  } catch (err) {
    Logger.log("ERROR: Failed to create trigger: " + categorizeException(err));
  }
}

/**
 * Safe Configuration Self-Test:
 * Validates Script Properties, URL syntax, secret length, SPREADSHEET_ID resolution, HMAC generation,
 * and Spreadsheet structure without sending fake participant data to the real webhook.
 */
function testConfiguration() {
  Logger.log("==================================================");
  Logger.log("PathFinder Webhook Configuration Self-Test (v2.4)");
  Logger.log("==================================================");

  var props = PropertiesService.getScriptProperties();
  var webhookUrl = (props.getProperty("WEBHOOK_URL") || "").trim();
  var webhookSecret = (props.getProperty("WEBHOOK_SECRET") || "").trim();
  var spreadsheetIdProp = (props.getProperty("SPREADSHEET_ID") || "").trim();
  var bypassSecret = (props.getProperty("VERCEL_PROTECTION_BYPASS") || "").trim();
  var errors = [];
  var warnings = [];

  // 1. Verify WEBHOOK_URL
  if (!webhookUrl) {
    errors.push("Missing WEBHOOK_URL in Script Properties.");
  } else {
    if (!webhookUrl.startsWith("https://")) {
      errors.push("WEBHOOK_URL must start with https:// (Current protocol is invalid).");
    }
    if (webhookUrl.indexOf("/api/spin-webhook") === -1) {
      warnings.push("WEBHOOK_URL does not include '/api/spin-webhook'. Verify endpoint path.");
    }
    var maskedDomain = webhookUrl.replace(/https:\/\/[^\/]+/, "https://[PROTECTED-HOST]");
    Logger.log("✓ WEBHOOK_URL property is configured: " + maskedDomain);
  }

  // 2. Verify WEBHOOK_SECRET
  if (!webhookSecret) {
    errors.push("Missing WEBHOOK_SECRET in Script Properties.");
  } else {
    var secretLen = webhookSecret.length;
    if (secretLen < 32) {
      warnings.push("WEBHOOK_SECRET length is " + secretLen + " chars. Recommended minimum is 32 characters.");
    }
    Logger.log("✓ WEBHOOK_SECRET property is configured (Length: " + secretLen + " chars, Value: [PROTECTED])");
  }

  // 3. Inspect VERCEL_PROTECTION_BYPASS (Optional)
  if (bypassSecret) {
    Logger.log("✓ VERCEL_PROTECTION_BYPASS is configured (Length: " + bypassSecret.length + " chars, Value: [PROTECTED]). Requests will include 'x-vercel-protection-bypass'.");
  } else {
    Logger.log("ℹ VERCEL_PROTECTION_BYPASS is not set (optional for public endpoints, required if Vercel Authentication / SSO is active).");
  }

  // 4. Test HMAC Generation
  try {
    var samplePayload = JSON.stringify({ ping: true, timestamp: Date.now() });
    var sampleSig = bytesToHex(Utilities.computeHmacSha256Signature(samplePayload, webhookSecret || "test_secret_key_32_bytes_minimum"));
    if (!sampleSig || sampleSig.length !== 64) {
      errors.push("HMAC-SHA256 signature generator did not produce expected 64-char hex string.");
    } else {
      Logger.log("✓ HMAC-SHA256 crypto engine verified (SHA-256 output length: 64 hex chars).");
    }
  } catch (hmacErr) {
    errors.push("HMAC generation test failed: " + categorizeException(hmacErr));
  }

  // 5. Test Spreadsheet Connectivity (Supports Container-Bound and Standalone)
  var ss = null;
  var connectionSource = "";

  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      connectionSource = "Container-bound active spreadsheet";
    }
  } catch (boundErr) {}

  if (!ss && spreadsheetIdProp) {
    try {
      ss = SpreadsheetApp.openById(spreadsheetIdProp);
      if (ss) {
        connectionSource = "Standalone SPREADSHEET_ID property";
      }
    } catch (openErr) {
      errors.push("Failed to open spreadsheet using SPREADSHEET_ID ('" + spreadsheetIdProp + "'): " + categorizeException(openErr));
    }
  }

  if (ss) {
    try {
      var sheets = ss.getSheets();
      Logger.log("✓ Connected via " + connectionSource + " (Spreadsheet ID: " + ss.getId() + ")");
      Logger.log("  Discovered " + sheets.length + " sheet tabs:");
      for (var s = 0; s < sheets.length; s++) {
        var tab = sheets[s];
        Logger.log("   - Tab [" + (s + 1) + "]: '" + tab.getName() + "' (GID: " + tab.getSheetId() + ", Rows: " + tab.getLastRow() + ", Cols: " + tab.getLastColumn() + ")");
      }
    } catch (tabErr) {
      errors.push("Could not inspect spreadsheet tabs: " + categorizeException(tabErr));
    }
  } else {
    if (!spreadsheetIdProp) {
      errors.push("No spreadsheet connected. Standalone script projects must configure SPREADSHEET_ID in Script Properties.");
    }
  }

  Logger.log("--------------------------------------------------");
  if (errors.length > 0) {
    Logger.log("TEST RESULT: FAILED with " + errors.length + " error(s):");
    for (var i = 0; i < errors.length; i++) {
      Logger.log(" [ERROR] " + errors[i]);
    }
  } else {
    Logger.log("TEST RESULT: PASSED! Script Properties and crypto environment are valid.");
    Logger.log("No test participant data was dispatched to the server.");
    if (warnings.length > 0) {
      for (var w = 0; w < warnings.length; w++) {
        Logger.log(" [WARNING] " + warnings[w]);
      }
    }
  }
  Logger.log("==================================================");
}
