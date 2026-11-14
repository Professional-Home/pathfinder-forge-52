# MICRYLIS BIOTECH — INITIAL COMPREHENSIVE SEO AUDIT REPORT
**Phase 1 Technical Audit & Indexing Readiness Assessment**
**Date**: November 14, 2026  
**Audited Domain**: `https://project.micrylisbiotech.com`  
**Git Feature Branch**: `feature/seo-optimization`  

---

## 1. Executive Summary

Micrylis Biotech operates a modern, high-performance web platform built on **TanStack Start (Vite + React 19 + Nitro)** and hosted on **Vercel Edge**. The site provides educational programs, research project internships (Bioplastics, AI in Drug Discovery, Bioinformatics), IELTS mentor coaching, academic webinars, an interactive AI Petri dish colony counter tool, and community initiatives.

Prior to this audit, no systematic search engine optimization had been performed. This audit investigated the live production deployment (`https://project.micrylisbiotech.com`) as well as the codebase configuration.

### Key Audit Highlights:
- **Zero Standard Document `<title>` Tag**: Lighthouse scored **0 on `document-title`** because `<head>` contains `<meta name="title" content="...">` instead of standard HTML `<title>...</title>`. Search engines fail to display custom page titles in SERPs.
- **Widespread Character Encoding Mojibake (`â€”`)**: Em-dash characters in titles and meta descriptions across root and child routes were corrupted into `â€”`, projecting a broken appearance in search results.
- **Complete Lack of Canonical Tags**: Not a single route has a `<link rel="canonical" href="...">` tag.
- **Sitemap Inaccuracies & Redirect Waste**: `public/sitemap.xml` contains multiple redirecting routes (`/courses`, `/webinar`, `/community/events`, `/community/webinars`) while omitting primary canonical project destinations (`/projects/bioplastic-innovation`, `/projects/ai-in-drug-discovery`, `/projects/bioinformatics`).
- **No Structured Data (Schema.org JSON-LD)**: No `Organization`, `WebSite`, `Course`, `BlogPosting`, or `Event` schema markup exists.
- **Lighthouse Production Scores**:
  - **SEO**: **92 / 100** (Deduction driven by missing document title)
  - **Best Practices**: **96 / 100**
  - **Accessibility**: **87 / 100**
  - **Performance**: **40 / 100** (Mobile FCP: 1.9s, LCP: 6.8s, TBT: 2,030ms)

---

## 2. Existing Architecture

| Dimension | Details |
| :--- | :--- |
| **Framework** | TanStack Start (`@tanstack/react-start` 1.168.60) |
| **Routing** | TanStack Router (`@tanstack/react-router` 1.170.16) with file-based routing |
| **Server Engine** | Nitro (`3.0.260603-beta`) configured with `preset: "vercel"` |
| **Build Tool** | Vite 8 (`vite` 8.0.16) + `@lovable.dev/vite-tanstack-config` |
| **Rendering Strategy**| Hybrid SSR with Client Hydration (HTML streamed by Nitro server on Vercel) |
| **UI & Styling** | Tailwind CSS v4 (`@tailwindcss/vite` 4.2.1), Framer Motion 12, Radix UI primitives |
| **Backend / Database**| Supabase (`@supabase/supabase-js` 2.110.1) |
| **Production Server** | Vercel Edge Serverless (`Server: Vercel`, HTTP/1.1 200 OK, SSL/TLS enabled) |
| **Root Shell** | `src/routes/__root.tsx` renders `<html lang="en">`, `<head>`, `<HeadContent />`, and `<Scripts />` |

---

## 3. Public Routes Inventory

### A. Primary Public Canonical Endpoints (22 Routes)
1. `/` — Homepage (Hero, Mentorship, Paths, Social Proof, Ratings & FAQ)
2. `/about` — About Us, Mission, Industry Focus, and Contact Information
3. `/projects` — Research Projects & Internships Overview
4. `/projects/bioplastic-innovation` — 30-Day Bioplastic Research Project Detail
5. `/projects/ai-in-drug-discovery` — 30-Day AI Drug Discovery Project Detail
6. `/projects/bioinformatics` — 30-Day Bioinformatics & NGS Research Project Detail
7. `/ielts` — IELTS Preparation Coaching Program & Verified Mentor Showcase
8. `/blog` — Biotech Research & Career Insights Blog Listing
9. `/blog/$slug` — Individual Blog Article Detail Page
10. `/community` — Biotech Community Initiatives & Learning Hub
11. `/community/competitions` — Bio-Hackathons & Scientific Competitions
12. `/community/conferences` — Academic Conferences & Research Meetups
13. `/community/national-bio-challenge` — Flagship National Bio Challenge 2026
14. `/community/workshops` — Hands-On Biotech & Nextflow Bootcamps
15. `/events` — Exclusive Biotech Workshops & Symposiums
16. `/events/$id` — Single Event Registration & Schedule Detail
17. `/opportunities` — Curated Biotechnology Internships & Job Postings
18. `/opportunities/$slug` — Single Opportunity Listing Detail
19. `/tools/colony-counter` — AI Petri Dish Colony Counter Computer Vision Tool
20. `/spin` — Micrylis Spin & Win Interactive Promotional Wheel
21. `/privacy-policy` — Official Privacy Policy
22. `/refund-policy` — Refund & Cancellation Terms
23. `/return-policy` — Digital Products Return Policy
24. `/disclaimer` — Legal & Medical Disclaimer
25. `/employees` — Workplace Code of Conduct & Policies

### B. Client Redirecting Routes (Aliases)
1. `/courses` $\to$ Redirects to `/projects`
2. `/courses/$slug` $\to$ Redirects to `/projects/$slug`
3. `/community/events` $\to$ Redirects to `/events`
4. `/community/webinars` $\to$ Redirects to `/webinars`
5. `/webinar` $\to$ Redirects to `/webinars`

### C. Private & Auth Protected Routes (Disallowed from Crawling)
- `/admin/*` — Admin CMS dashboard, mentor management, reviews, and event editing.
- `/dashboard/*` — Registered student dashboard, enrolled courses, mentorship bookings, certificates.
- `/login`, `/signup`, `/reset-password`, `/onboarding`, `/auth/callback` — Authentication flow.

---

## 4. Technical SEO Audit

### A. HTML Title Element
- **Current State**: `FAIL`. In the live HTML returned by the server, there is no `<title>` tag. Instead, `__root.tsx` renders `<meta name="title" content="...">`.
- **Crawler Impact**: Search engines such as Google require an explicit `<title>` tag. Lighthouse reports `document-title` failure with score 0.
- **Remediation**: Configure `title: "..."` in the root and child route `head()` definitions so TanStack Start renders `<title>Text</title>`.

### B. Character Encoding & Mojibake
- **Current State**: `FAIL`. The em-dash character `—` was encoded as `â€”` across `__root.tsx`, `about.tsx`, `ielts.tsx`, `projects/index.tsx`, `blog/index.tsx`, `webinars.tsx`, and `spin.tsx`.
- **Crawler Impact**: Search engine result pages display garbled characters in snippet titles.
- **Remediation**: Normalize all strings to standard UTF-8 em-dashes `—` or ASCII separators `|`.

### C. Canonical URL Protocol
- **Current State**: `FAIL`. Zero canonical tags exist across the entire platform.
- **Crawler Impact**: Risk of duplicate content penalties, protocol ambiguity (http vs https), and URL parameter fragmentation.
- **Remediation**: Inject `<link rel="canonical" href="https://project.micrylisbiotech.com{path}" />` on every indexable page.

### D. Robots Directives & `robots.txt`
- **Current State**: `PASS (with improvements recommended)`. `robots.txt` exists at `/robots.txt` and returns HTTP 200. It correctly disallows `/admin/`, `/dashboard/`, `/login`, etc., and references `https://project.micrylisbiotech.com/sitemap.xml`.
- **Improvement**: Add specific crawl-delay or AI crawler directives (`GPTBot`, `ClaudeBot`, `PerplexityBot`), and link to `llms.txt`.

### E. XML Sitemap
- **Current State**: `FAIL (Structure & Route Mismatches)`.
  1. Contains 301/302 redirecting routes (`/courses`, `/webinar`, `/community/events`, `/community/webinars`).
  2. Generates `/courses/$slug` instead of canonical `/projects/$slug`.
  3. Lacks `/projects/bioplastic-innovation`, `/projects/ai-in-drug-discovery`, `/projects/bioinformatics`.
- **Remediation**: Overhaul `scripts/generate-sitemap.mjs` to strictly output 200 OK canonical routes.

### F. Heading Hierarchy (`H1`–`H3`)
- **Current State**: `PARTIAL PASS`.
  - Homepage has an H1 (`Don't Just Learn Biology Build the Future of It`), but it lacks keyword targeting.
  - Dedicated pages (`/about`, `/projects`, `/ielts`, `/blog`, `/webinars`) have single, clear H1s.
  - `/events/$id` renders an H1 only if the event exists; otherwise displays an error H1.

### G. Image Optimization & `alt` Attributes
- **Current State**: `PARTIAL PASS`.
  - The main logo link in `src/components/brand.tsx` uses `alt="" aria-hidden`, missing brand entity value.
  - Some user avatar images use generic `alt="Profile"`.
  - Webinar speaker images have dynamic speaker name alt tags.
  - Formats: High-resolution PNGs are loaded without WebP/AVIF alternatives.

### H. Open Graph & Social Sharing
- **Current State**: `FAIL`.
  - Global `og:image` and `twitter:image` specify relative `/logo.png` instead of absolute `https://project.micrylisbiotech.com/logo.png`.
  - No `og:url` is emitted.
  - Dynamic child routes (`/blog/$slug`, `/projects/$slug`) do not override `og:image` or `og:title`.

### I. Structured Data (Schema.org JSON-LD)
- **Current State**: `FAIL`. Zero JSON-LD tags exist across the entire application.

---

## 5. Page-wise SEO Audit

| Route | Current Title in Code | Meta Description | Canonical Tag | Indexability | Primary SEO Deficiency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | `Micrylis â€” Personalized mentorship, in 5 minutes` | Generic (5 min mentorship) | Missing | `index, follow` | Missing `<title>`, mojibake, missing biotech research keywords |
| `/about` | `About Us & Contact â€” Micrylis Biotech` | Good summary | Missing | `index, follow` | Mojibake in title, missing Organization schema |
| `/projects` | `Projects â€” Micrylis Biotech` | Short (internships in bioplastics...) | Missing | `index, follow` | Mojibake, thin metadata, missing Course listing schema |
| `/projects/bioplastic-innovation` | Dynamic (`Project â€” Micrylis`) | From DB | Missing | `index, follow` | Lacks dedicated Course schema, no OpenGraph image |
| `/projects/ai-in-drug-discovery` | Dynamic (`Project â€” Micrylis`) | From DB | Missing | `index, follow` | Lacks dedicated Course schema, no OpenGraph image |
| `/projects/bioinformatics` | Dynamic (`Project â€” Micrylis`) | From DB | Missing | `index, follow` | Lacks dedicated Course schema, no OpenGraph image |
| `/ielts` | `IELTS Preparation â€” Apply Now \| Micrylis Biotech` | Coaching summary | Missing | `index, follow` | Mojibake, lacks EducationalOrganization schema |
| `/blog` | `Biotech Blog & Insights â€” Micrylis Biotech` | Industry insights | Missing | `index, follow` | Mojibake, missing CollectionPage schema |
| `/blog/$slug` | Dynamic (`{title} â€” Micrylis Biotech`) | Post excerpt | Missing | `index, follow` | Mojibake, lacks BlogPosting JSON-LD, missing dynamic og:image |
| `/community` | `Biotech Community & Challenges â€” Micrylis` | Community connect | Missing | `index, follow` | Mojibake, thin metadata |
| `/community/national-bio-challenge` | Dynamic / Static | Good summary | Missing | `index, follow` | Lacks Event / Competition schema |
| `/events` | `Biotechnology & Bioinformatics Events â€” Micrylis` | Workshop summary | Missing | `index, follow` | Mojibake, lacks Event schema |
| `/events/$id` | None (Inherits root) | None (Inherits root) | Missing | `index, follow` | Completely missing `head()` definition, generic root fallback |
| `/opportunities` | `Internships & Research Opportunities â€” Micrylis Biotech` | Curated postings | Missing | `index, follow` | Mojibake, missing JobPosting / Collection schema |
| `/opportunities/$slug` | `Opportunity Details â€” Micrylis Biotech` (Static) | Static generic | Missing | `index, follow` | Duplicate title across all dynamic opportunity pages! |
| `/tools/colony-counter`| `AI Petri Dish Colony Counter â€” Micrylis Biotech` | Good computer vision summary | Missing | `index, follow` | Mojibake, lacks WebApplication schema, unlinked from nav |
| `/spin` | `Spin & Win Exclusive Rewards â€” Micrylis Biotech` | Promotional summary | Missing | `index, follow` | Mojibake |
| `/privacy-policy` | None (Inherits root) | None (Inherits root) | Missing | `index, follow` | Missing `head()` block |
| `/refund-policy` | None (Inherits root) | None (Inherits root) | Missing | `index, follow` | Missing `head()` block |
| `/return-policy` | None (Inherits root) | None (Inherits root) | Missing | `index, follow` | Missing `head()` block, unlinked from footer |
| `/disclaimer` | None (Inherits root) | None (Inherits root) | Missing | `index, follow` | Missing `head()` block |
| `/employees` | None (Inherits root) | None (Inherits root) | Missing | `index, follow` | Missing `head()` block |

---

## 6. Google Indexing Readiness

| Checkpoint | Status | Evidence / Notes |
| :--- | :--- | :--- |
| **Domain Resolution** | **READY** | `https://project.micrylisbiotech.com` resolves cleanly with valid HTTPS/TLS certificate. |
| **Search Console HTML Verification**| **READY** | `public/google2217dd6b41f733b3.html` exists and returns HTTP 200 live at `https://project.micrylisbiotech.com/google2217dd6b41f733b3.html`. |
| **Robots.txt Crawlability** | **READY** | Standard bots permitted on `/`, private areas disallowed. |
| **SSR HTML Delivery** | **READY** | Nitro server streams full DOM markup on first response; content is accessible to non-JS crawlers. |
| **HTML `<title>` Tag Presence** | **NOT READY** | Lacks standard `<title>` tag. Google SERP title generation will be impaired until fixed. |
| **Canonical Link Tags** | **NOT READY** | No canonical tags deployed. |
| **Sitemap Integrity** | **NOT READY** | Contains redirect URLs; requires regeneration before submitting to GSC. |

---

## 7. Content SEO Audit

1. **Homepage Keyword Focus**:
   - Current content emphasizes "Personalized mentorship, in 5 minutes" and "Don't Just Learn Biology Build the Future of It".
   - *Opportunity*: Infuse high-intent search queries: "Biotechnology Research Internships", "Computational Drug Discovery Training", "Bioinformatics Project Certification", and "Micrylis Biotech".
2. **Project Landing Pages (`/projects/$slug`)**:
   - The 3 flagship programs have substantial curriculum details, learning objectives, and project timelines.
   - *Opportunity*: Add rich FAQ sections, targeted course schema, and keyword-rich subtitles to capture searches for "bioplastic research online", "computational biology internship India", etc.
3. **Thin Metadata on Dynamic Pages**:
   - Opportunity detail pages (`/opportunities/$slug`) share an identical title tag: "Opportunity Details — Micrylis Biotech". Search engines will flag this as duplicate title tag error.
   - Event detail pages (`/events/$id`) inherit generic root metadata.
4. **Internal Linking Hierarchy**:
   - The colony counter tool (`/tools/colony-counter`) is a high-value interactive asset, but is currently orphaned from the primary navigation header and footer.
   - `/return-policy` is orphaned from footer navigation.

---

## 8. Performance Audit (Measured via Lighthouse 13.6.0)

**Target URL**: `https://project.micrylisbiotech.com/` (Audited in Headless Chrome, Mobile Emulation)

### Core Scores:
- **Performance**: **40 / 100**
- **Accessibility**: **87 / 100**
- **Best Practices**: **96 / 100**
- **SEO**: **92 / 100**

### Measured Core Web Vitals:
| Metric | Measured Value | Google Threshold (Good) | Evaluation |
| :--- | :--- | :--- | :--- |
| **First Contentful Paint (FCP)** | 1.9 s | $\le$ 1.8 s | Needs Improvement |
| **Largest Contentful Paint (LCP)** | **6.8 s** | $\le$ 2.5 s | **Poor (Critical Bottleneck)** |
| **Total Blocking Time (TBT)** | **2,030 ms** | $\le$ 200 ms | **Poor (Heavy Main Thread)** |
| **Cumulative Layout Shift (CLS)** | **0.002** | $\le$ 0.10 | **Good (Excellent Stability)** |
| **Speed Index** | 7.7 s | $\le$ 3.4 s | Poor |

### Performance Diagnostics:
- **Render-Blocking Webfonts**: Loading multiple weights of Inter and Geist fonts via Google Fonts and jsdelivr CSS files blocks initial render.
- **Client Script Overhead**: Framer Motion animation hydration and Lenis smooth scroll listeners generate 2,030ms of main thread execution time during load.
- **Unused JavaScript**: Approximately 65 KiB of unused JavaScript loaded during initial landing page visit.

---

## 9. Critical Issues

1. **ISSUE-01: Document Lacks Standard `<title>` Element**
   - **Affected File**: `src/routes/__root.tsx`
   - **Impact**: Lighthouse score 0 for `document-title`. Search engines fail to parse explicit page titles.
   - **Solution**: Configure root `title: "..."` property in TanStack Start route head definitions.
   - **Priority**: Critical (P0)

2. **ISSUE-02: Character Encoding Mojibake (`â€”`)**
   - **Affected Files**: `src/routes/__root.tsx`, `about.tsx`, `ielts.tsx`, `projects/index.tsx`, `blog/index.tsx`, `webinars.tsx`, `spin.tsx`, `community/*.tsx`
   - **Impact**: Corrupt characters display in search result snippets, damaging brand credibility and click-through rates.
   - **Solution**: Replace corrupt `â€”` sequences with clean UTF-8 em-dashes `—` or ASCII pipe separators `|`.
   - **Priority**: Critical (P0)

3. **ISSUE-03: Total Absence of Canonical URL Link Tags**
   - **Affected Files**: All public routes in `src/routes/`
   - **Impact**: Ambiguous canonicalization, risk of duplicate indexing between naked/www and query strings.
   - **Solution**: Create a centralized canonical link generator and attach `<link rel="canonical">` to every route.
   - **Priority**: Critical (P0)

4. **ISSUE-04: Sitemap Contains 301/302 Redirect Routes**
   - **Affected Files**: `scripts/generate-sitemap.mjs`, `public/sitemap.xml`
   - **Impact**: Search crawlers encounter redirect loops/waste crawl budget on `/courses`, `/webinar`, `/community/events`, `/community/webinars`.
   - **Solution**: Remove redirecting aliases from `STATIC_ROUTES` in `generate-sitemap.mjs`.
   - **Priority**: Critical (P0)

---

## 10. High Priority Issues

5. **ISSUE-05: Missing Canonical Project URLs in Sitemap**
   - **Affected Files**: `scripts/generate-sitemap.mjs`
   - **Impact**: Dynamic project pages (`/projects/bioplastic-innovation`, `/projects/ai-in-drug-discovery`, `/projects/bioinformatics`) are not generated in sitemap.
   - **Solution**: Update sitemap script to query published projects and emit `/projects/${slug}` entries.
   - **Priority**: High (P1)

6. **ISSUE-06: Complete Absence of Schema.org Structured Data**
   - **Affected Files**: `src/routes/__root.tsx`, `projects/$slug.tsx`, `blog/$slug.tsx`, `events/$id.tsx`
   - **Impact**: Zero eligibility for Google rich snippets, knowledge graph cards, or course carousel listings.
   - **Solution**: Inject JSON-LD structured data for `Organization`, `WebSite`, `Course`, `BlogPosting`, and `Event`.
   - **Priority**: High (P1)

7. **ISSUE-07: Relative OpenGraph Image URLs**
   - **Affected Files**: `src/routes/__root.tsx`
   - **Impact**: Social share previews on WhatsApp, Facebook, and LinkedIn fail to render preview images because `/logo.png` is relative.
   - **Solution**: Use absolute URLs (`https://project.micrylisbiotech.com/logo.png`).
   - **Priority**: High (P1)

8. **ISSUE-08: Duplicate Metadata on Opportunity Details Pages**
   - **Affected Files**: `src/routes/opportunities/$slug.tsx`
   - **Impact**: All opportunity listings share the identical hardcoded title tag.
   - **Solution**: Bind `head()` to loader data to generate dynamic titles: `"{opportunity.title} — Biotech Opportunity | Micrylis"`.
   - **Priority**: High (P1)

---

## 11. Medium Priority Issues

9. **ISSUE-09: Missing Head Definitions on Legal and Dynamic Event Pages**
   - **Affected Files**: `src/routes/privacy-policy.tsx`, `refund-policy.tsx`, `return-policy.tsx`, `disclaimer.tsx`, `employees.tsx`, `events/$id.tsx`
   - **Impact**: Pages fall back to generic homepage metadata.
   - **Solution**: Add explicit `head()` definitions with appropriate titles and meta descriptions.
   - **Priority**: Medium (P2)

10. **ISSUE-10: Brand Logo Missing Descriptive Alt Text**
    - **Affected Files**: `src/components/brand.tsx`
    - **Impact**: `alt="" aria-hidden` ignores brand entity naming for screen readers and search crawlers.
    - **Solution**: Set `alt="Micrylis Biotech Logo"`.
    - **Priority**: Medium (P2)

11. **ISSUE-11: High Mobile LCP (6.8s) and TBT (2,030ms)**
    - **Affected Files**: `src/routes/__root.tsx`, font link preloads, component bundles
    - **Impact**: Poor mobile user experience, potential Core Web Vitals ranking demotion.
    - **Solution**: Preload critical fonts, defer non-critical scripts, optimize image weights.
    - **Priority**: Medium (P2)

12. **ISSUE-12: Orphaned Public Tools (`/tools/colony-counter`)**
    - **Affected Files**: `src/lib/nav-config.ts`, `src/components/site-header.tsx`, `site-footer.tsx`
    - **Impact**: Crawlers and visitors have limited discovery paths to this high-value tool.
    - **Solution**: Add a link to Colony Counter in the footer and resources dropdown.
    - **Priority**: Medium (P2)

---

## 12. Low Priority Issues

13. **ISSUE-13: Missing AI Crawler / GEO Discovery (`llms.txt`)**
    - **Affected Files**: `public/llms.txt`, `public/robots.txt`
    - **Impact**: Reduced accuracy in AI overview citations (Perplexity, ChatGPT, Gemini).
    - **Solution**: Deploy clean Markdown `llms.txt` summarizing Micrylis Biotech entities and offerings.
    - **Priority**: Low (P3)

14. **ISSUE-14: Return Policy Omitted from Footer Links**
    - **Affected Files**: `src/components/site-footer.tsx`
    - **Impact**: Minor internal linking gap for legal compliance.
    - **Solution**: Add `/return-policy` to `COMPANY_LINKS` array.
    - **Priority**: Low (P3)

---

## 13. Recommended SEO Implementation Roadmap

- **Phase 1 (Complete)**:
  - Git Branch Synchronization & Feature Branch Isolation (`feature/seo-optimization`)
  - Initial Comprehensive Audit & Master Tracking Establishment
- **Phase 2 (Next)**:
  - Core `<title>` Tag & HTML Head Modernization
  - Mojibake Clean-Up across all routes
  - Centralized Canonical URL Generation Utility
  - Absolute Open Graph & Twitter Tag Resolution
- **Phase 3**:
  - Page-Wise Metadata Optimization (All 22 Canonical Routes)
  - Dynamic Loaders for Course, Blog, Event, and Opportunity Metadata
- **Phase 4**:
  - Schema.org JSON-LD Structured Data Engine (`Organization`, `WebSite`, `Course`, `BlogPosting`, `Event`, `BreadcrumbList`)
- **Phase 5**:
  - Sitemap & Robots Architecture Refinement (Purge redirects, add dynamic projects, add `llms.txt`)
- **Phase 6**:
  - Performance & Core Web Vitals Optimization (Font preloading, LCP reduction, script deferral)
- **Phase 7**:
  - Verification, Testing & Pull Request Preparation

---

## 14. Manual Tasks (User Action Required)

1. **Google Search Console Ownership Verification**:
   - Visit [Google Search Console](https://search.google.com/search-console).
   - Add property `https://project.micrylisbiotech.com`.
   - Verify via HTML file (file already exists live: `https://project.micrylisbiotech.com/google2217dd6b41f733b3.html`).
2. **Sitemap Submission**:
   - Following deployment of Phase 5 fixes, submit `https://project.micrylisbiotech.com/sitemap.xml` in GSC.
3. **Bing Webmaster Tools**:
   - Connect and sync verified Google Search Console property into Bing Webmaster Tools.

---

## 15. Files Requiring Future Changes (Phases 2–6)

1. `src/routes/__root.tsx` — Root head configuration, title element, absolute OG tags, font preloads.
2. `src/routes/index.tsx` — Homepage specific metadata, title, and Schema.org WebSite JSON-LD.
3. `src/routes/about.tsx` — About Us metadata and Organization JSON-LD.
4. `src/routes/ielts.tsx` — IELTS title encoding fix and program metadata.
5. `src/routes/projects/index.tsx` — Projects directory title and metadata.
6. `src/routes/projects/$slug.tsx` — Dynamic project metadata loader and Course JSON-LD.
7. `src/routes/blog/index.tsx` — Blog listing metadata.
8. `src/routes/blog/$slug.tsx` — Dynamic article metadata and BlogPosting JSON-LD.
9. `src/routes/events/index.tsx` & `src/routes/events/$id.tsx` — Event listing and single event metadata + Event JSON-LD.
10. `src/routes/opportunities/index.tsx` & `src/routes/opportunities/$slug.tsx` — Dynamic opportunity metadata.
11. `src/routes/community/*.tsx` — Community sub-page metadata.
12. `src/routes/tools/colony-counter.tsx` — Colony counter tool metadata and WebApplication schema.
13. `src/routes/privacy-policy.tsx`, `refund-policy.tsx`, `return-policy.tsx`, `disclaimer.tsx`, `employees.tsx` — Legal page metadata.
14. `src/components/brand.tsx` — Logo alt text accessibility.
15. `src/components/site-footer.tsx` — Footer links and navigation updates.
16. `scripts/generate-sitemap.mjs` — Dynamic project fetching, redirect cleanup.
17. `public/robots.txt` & `public/llms.txt` — AI engine discoverability.

---

## 16. Audit Limitations

1. **Google Search Console Field Data**: As this is Phase 1 without direct API access to the client's Google Search Console account, impressions, click data, and actual indexing state in Google's index are inferred from server response checks, sitemap validation, and live crawl simulation.
2. **Dynamic Supabase Data In Production**: Exact numbers of dynamic blog articles, active events, and opportunity rows depend on live database queries and Supabase credentials.
3. **Third-Party CDN & Asset Caching**: Vercel Edge cache behavior was observed with `Cache-Control: public, max-age=0, must-revalidate`. Cloudinary image optimization configurations were reviewed in code.
