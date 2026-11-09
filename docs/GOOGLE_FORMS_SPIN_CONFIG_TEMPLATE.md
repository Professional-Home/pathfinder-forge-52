# PathFinder Spin & Win — Google Forms & Webhook Configuration Guide

This document describes the exact production environment variables and parameters required to connect the 6 Google Forms and Google Sheets submission webhook to the PathFinder Spin & Win system.

---

## 1. Required Environment Variables

Add the following variables to your production `.env` (or Vercel / server environment settings):

```env
# ====================================================================
# PATHFINDER SPIN & WIN — GOOGLE FORMS & WEBHOOK CONFIGURATION
# ====================================================================

# 1. Dedicated Google Form URLs (One for each of the 6 reward categories)
GOOGLE_FORM_URL_DISCOUNT_25="https://docs.google.com/forms/d/e/1FAIpQLSc..._DISCOUNT_25/viewform"
GOOGLE_FORM_URL_DISCOUNT_50="https://docs.google.com/forms/d/e/1FAIpQLSc..._DISCOUNT_50/viewform"
GOOGLE_FORM_URL_FREE_MENTORSHIP="https://docs.google.com/forms/d/e/1FAIpQLSc..._FREE_MENTORSHIP/viewform"
GOOGLE_FORM_URL_LIVE_CALL_FOUNDER="https://docs.google.com/forms/d/e/1FAIpQLSc..._LIVE_CALL_FOUNDER/viewform"
GOOGLE_FORM_URL_IELTS_INTERVIEW="https://docs.google.com/forms/d/e/1FAIpQLSc..._IELTS_INTERVIEW/viewform"
GOOGLE_FORM_URL_FREE_FULL_PROJECT="https://docs.google.com/forms/d/e/1FAIpQLSc..._FREE_FULL_PROJECT/viewform"

# 2. Google Form Prefill Entry IDs (Extracted from "Get pre-filled link")
GOOGLE_FORM_ENTRY_VOUCHER="entry.123456789"
GOOGLE_FORM_ENTRY_EMAIL="entry.987654321"
GOOGLE_FORM_ENTRY_NAME="entry.456789123"

# 3. Webhook HMAC-SHA256 Signing Secret (Shared with Google Apps Script)
# Generate using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SPIN_WEBHOOK_SECRET="your_secure_32_byte_hmac_signing_secret_here"
```

---

## 2. How to Retrieve Google Form Entry IDs

To prefill the voucher code, email, and name into Google Forms automatically when a winner clicks **"Accept & Open Form"**:

1. Open your Google Form in Google Drive.
2. Click the three dots menu (top right) $\rightarrow$ **Get pre-filled link**.
3. In the prefilled link form:
   - Type `VOUCHER_CODE` into the Voucher/Code field.
   - Type `EMAIL_ADDRESS` into the Email field.
   - Type `FULL_NAME` into the Full Name field.
4. Click **Get link**, then copy the generated link.
5. Inspect the query string of the copied link. You will see parameters like:
   `viewform?usp=pp_url&entry.123456789=VOUCHER_CODE&entry.987654321=EMAIL_ADDRESS&entry.456789123=FULL_NAME`
6. Copy the entry keys into your `.env`:
   - `GOOGLE_FORM_ENTRY_VOUCHER="entry.123456789"`
   - `GOOGLE_FORM_ENTRY_EMAIL="entry.987654321"`
   - `GOOGLE_FORM_ENTRY_NAME="entry.456789123"`

> [!NOTE]
> If all 6 forms use the same question order or a shared template, the entry IDs may be identical across all 6 forms. If they differ, ensure the fields are standardized.

---

## 3. Webhook Architecture & Security

When a participant submits the Google Form, the attached Google Sheet executes an `onFormSubmit` Apps Script trigger that posts to:
`POST https://<your-domain>/api/spin-webhook`

The request is authenticated via:
- Header `X-Spin-Signature`: `HMAC-SHA256(canonicalPayload, SPIN_WEBHOOK_SECRET)`
- Header `X-Spin-Timestamp`: Current epoch timestamp in milliseconds.
- Timestamp freshness check: Must be within 5 minutes (prevents replay attacks).
- Constant-time signature comparison (`crypto.timingSafeEqual`).
- Voucher and email ownership validation.
- Campaign deadline validation (`20 November 2026 23:59:59 IST`).

The complete, ready-to-deploy Google Apps Script implementation is available at:
`scripts/google-apps-script/SpinWinSheetsWebhook.gs`

---

## 4. Production Database Migration Sequence

When provisioning the Spin & Win campaign in Supabase, execute migrations in this exact versioned order:

1. `supabase_spin_wheel_schema.sql` (v1: Base tables, single-spin constraint, deny-by-default RLS)
2. `supabase_spin_wheel_lifecycle_v2.sql` (v2: Reward & form lifecycle columns, audit logs, webhook logs)
3. `supabase_spin_wheel_integrity_v3.sql` (v3: Atomic redemption RPC, atomic webhook verification RPC, partial-unique webhook index)
4. `supabase_auth_profile_schema.sql` (Base profile schema & signup trigger)
5. `supabase_auth_admin_rpc_lockdown_v1.sql` (Drops legacy vulnerable RPCs, locks down profile role)


