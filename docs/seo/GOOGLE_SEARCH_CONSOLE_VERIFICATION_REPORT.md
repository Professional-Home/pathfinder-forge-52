# MICRYLIS BIOTECH — GOOGLE SEARCH CONSOLE VERIFICATION REPORT
**Ownership Verification Tracking & Diagnostics**
**Date**: November 14, 2026  
**Production Domain**: `https://project.micrylisbiotech.com`  
**Git Branch**: `feature/seo-optimization`  
**Status**: **VERIFIED & ACTIVE (Ownership Auto-Verified)**  

---

## 1. Overview & Objective
To establish and maintain official Google Search Console (GSC) property ownership for `https://project.micrylisbiotech.com` using the HTML file verification method.

As of November 14, 2026, property ownership has been **successfully verified** by Google Search Console (`Ownership auto verified`).

---

## 2. Verification History & Token Management

### A. Token Progression
1. **Legacy Token (`google2217dd6b41f733b3.html`)**:
   - Initial pre-existing token found in repository.
   - Preserved in production to maintain backwards compatibility.
2. **First Hotfix Token (`googlee4c634efcfa8054e.html`)**:
   - Added via isolated branch `fix/google-search-console-verification` and merged to `main` via PR #21 (`5b23fd8`).
   - Content: `google-site-verification: googlee4c634efcfa8054e.html`
   - Verified live on production (`HTTP 200 OK`).
3. **Active Official Token (`googlea1738a9f0280edb8.html`)**:
   - Supplied by Google Search Console during active property setup.
   - Added via isolated branch `fix/google-search-console-verification-v2` and merged to `main` via PR #22 (`1d9cb55`).
   - Exact Content: `google-site-verification: googlea1738a9f0280edb8.html`
   - Deployed live on production at `https://project.micrylisbiotech.com/googlea1738a9f0280edb8.html`.
   - Confirmed live: `HTTP/1.1 200 OK` (Server: Vercel, Cache: HIT).
   - **Google Search Console Result: "Ownership auto verified"**.

### B. Preservation Requirement
> [!IMPORTANT]
> The verification file `public/googlea1738a9f0280edb8.html` MUST remain permanently on the production website. Google periodically re-verifies ownership; removing or modifying this file will revoke Search Console property ownership.

---

## 3. Static File Architecture & Verification

### A. Static Directory Structure
In this TanStack Start / Vite / Nitro project architecture:
* Static assets placed in `public/` are served directly at the root domain by Vercel.
* File Location: `public/googlea1738a9f0280edb8.html`
* Live Production URL: `https://project.micrylisbiotech.com/googlea1738a9f0280edb8.html`

### B. Live Production Endpoint Diagnostics
- **Command**: `curl.exe -s -i https://project.micrylisbiotech.com/googlea1738a9f0280edb8.html`
- **Response**:
  ```text
  HTTP/1.1 200 OK
  Server: Vercel
  Content-Type: text/html; charset=utf-8
  Content-Length: 54
  X-Vercel-Cache: HIT

  google-site-verification: googlea1738a9f0280edb8.html
  ```
- **Verification Method**: HTML file upload
- **GSC Feedback**: Ownership auto verified

---

## 4. Verification Checkpoint Status

| Checkpoint | Target | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Active Verification Token** | `public/googlea1738a9f0280edb8.html` | **LIVE & ACTIVE** | Merged via PR #22 into `main` and deployed to Vercel. |
| **Legacy / Secondary Tokens** | `googlee4c634efcfa8054e.html`, `google2217dd6b41f733b3.html` | **PRESERVED** | Kept intact in production to prevent regressions. |
| **Production HTTP Response** | `https://project.micrylisbiotech.com/googlea1738a9f0280edb8.html` | **HTTP 200 OK** | Serves exact verification string with `text/html; charset=utf-8`. |
| **GSC Console Ownership** | Google Search Console UI | **OWNERSHIP AUTO VERIFIED** | Successfully recognized by Google Search Console. |
| **Permanent Preservation** | Production Repository | **LOCKED** | Must never be deleted, modified, or overwritten. |

---

## 5. Next Steps for Google Search Console

1. [x] **HTML Verification File Live & Auto-Verified**: Property ownership is established.
2. [ ] **Sitemap Submission**: Submit `https://project.micrylisbiotech.com/sitemap.xml` in GSC after Phase 5 sitemap overhaul is deployed to production.
3. [ ] **URL Inspection & Indexing Monitoring**: Monitor Google indexing reports as Phase 2 through Phase 4 metadata and structured data are rolled out.
4. [ ] **Core Web Vitals Monitoring**: Track real-user CrUX data and field metrics reported in Search Console.
