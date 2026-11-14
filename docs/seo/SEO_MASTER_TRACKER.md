# MICRYLIS BIOTECH — SEO MASTER TRACKER
**Permanent Project Source of Truth**

---

## 1. Project Overview
- **Organization**: Micrylis Biotech
- **Project Initiative**: Full-Scale Search Engine Optimization (SEO) & Search Experience Optimization (SXO)
- **Starting Point**: SEO implementation from absolute zero on a live production web application.
- **Project Scope**: Comprehensive technical SEO, page-wise metadata, OpenGraph & social sharing protocols, semantic structured data (Schema.org JSON-LD), dynamic sitemap accuracy, Core Web Vitals optimization, GEO (Generative Engine Optimization for AI citations / `llms.txt`), and automated search engine verification.
- **Phase Current**: Phase 1 — Git Setup, Master Documentation & Complete Technical SEO Audit
- **Project Status**: `In Progress` (Phase 1 Audit & Documentation Active)

---

## 2. Website Information
- **Production URL**: `https://project.micrylisbiotech.com`
- **Hosting Platform**: Vercel Serverless Edge (HTTP/1.1, SSL/TLS, Custom Domain)
- **Primary Domain**: `project.micrylisbiotech.com`
- **Application Type**: Hybrid SSR & Client-Rendered Modern Web Application
- **Primary Language**: English (`en`)
- **Target Audience**: Bioscience & biotechnology students, academic researchers, biotech startups, computational biologists, bioinformatics interns, and IELTS test candidates.

---

## 3. SEO Goals
1. **Zero to Full Indexation**: Achieve 100% crawl and valid index status for all 22+ public routes on Google, Bing, and major search engines.
2. **Canonical HTML `<title>` & Metadata Compliance**: Eliminate missing document title tags (Lighthouse score 0 for document-title), repair encoding mojibake (`â€”`), and inject unique title and description tags for all static and dynamic pages.
3. **Canonical Link Protocol**: Ensure every indexable page serves an unambiguous self-referential `<link rel="canonical" href="...">` tag to prevent duplicate content dilution.
4. **Structured Data Rich Results**: Implement Schema.org JSON-LD structured data (`Organization`, `WebSite`, `Course`, `BlogPosting`, `Event`, `BreadcrumbList`) to achieve rich search snippets.
5. **Clean Sitemap & Robots Architecture**: Ensure `sitemap.xml` strictly contains canonical `200 OK` endpoints, stripping all 301/302 redirects (`/courses`, `/webinar`, `/community/events`, `/community/webinars`), while dynamically generating project URLs (`/projects/bioplastic-innovation`, etc.).
6. **Social Sharing Readiness**: Provide valid Open Graph (`og:*`) and Twitter Card (`twitter:*`) tags with absolute image URLs (`512x512` and `1200x630`) on every public route.
7. **Performance & Core Web Vitals**: Elevate Mobile Performance score from 40 to 80+ by addressing render-blocking resources, font loading, unused JavaScript, and LCP bottlenecks (currently 6.8s).
8. **Generative Engine Optimization (GEO)**: Deploy `llms.txt` and semantic entity context to ensure accurate brand citations in ChatGPT, Perplexity, Gemini, and Google AI Overviews.

---

## 4. Existing Technical Architecture
- **Framework**: TanStack Start (`@tanstack/react-start` v1.168.60) built on Nitro server (`3.0.260603-beta`)
- **Router**: TanStack Router (`@tanstack/react-router` v1.170.16) with file-based routing in `src/routes/` and generated route tree in `src/routeTree.gen.ts`
- **Frontend Library**: React 19 (`react` & `react-dom` v19.2.0)
- **Build Tool**: Vite 8 (`vite` v8.0.16) with `@tailwindcss/vite` v4.2.1 and `@lovable.dev/vite-tanstack-config`
- **Styling**: Tailwind CSS v4 (`tailwindcss` v4.2.1) + Framer Motion v12 (`framer-motion` v12.42.2) + Radix UI primitives
- **Backend / CMS**: Supabase (`@supabase/supabase-js` v2.110.1) handling authentication, profiles, reviews, dynamic courses, blogs, events, opportunities, and spin wheel
- **Deployment Target**: Vercel (configured via `vercel.json` with secure HTTP headers and Nitro Vercel preset)
- **Smooth Scroll**: Lenis (`lenis/react` v1.3.25)
- **Root Shell**: `src/routes/__root.tsx` renders HTML head tags via TanStack Start `HeadContent` and client hydration scripts via `Scripts`

---

## 5. Public Website Routes Inventory

### A. Primary Public Canonical Routes (22 Endpoints)
| Route Path | Type | Primary Content | Current Title Status | H1 Presence |
| :--- | :--- | :--- | :--- | :--- |
| `/` | Static | Homepage, Mentorship, Value Prop, Reviews | Missing `<title>` tag (inherits root meta) | Yes (`Don't Just Learn Biology Build the Future of It`) |
| `/about` | Static | About Us, Company Mission, Contact Information | Mojibake title in meta | Yes (`About Us & Contact`) |
| `/projects` | Static / Query | Research Projects & Internships Directory | Mojibake title in meta | Yes (`Projects built for students, researchers, and startups`) |
| `/projects/bioplastic-innovation` | Dynamic | Bioplastic Innovation 30-Day Research Project | Inherited generic/partial title | Yes (`BioPlastic Innovation`) |
| `/projects/ai-in-drug-discovery` | Dynamic | AI Drug Discovery & Computational Screening | Inherited generic/partial title | Yes (`AI in Drug Discovery`) |
| `/projects/bioinformatics` | Dynamic | Computational Biology, Genomics & NGS Research | Inherited generic/partial title | Yes (`AI-Integrated Bioinformatics & NGS Platform`) |
| `/ielts` | Static | IELTS Preparation Coaching & Mentors | Mojibake title in meta | Yes (`Master IELTS with World-Class Mentors`) |
| `/blog` | Static / Query | Biotech Blog & Insights Listing | Mojibake title in meta | Yes (`Biotech Research & Career Insights`) |
| `/blog/$slug` | Dynamic | Individual Biotech Research Article | Title in meta with mojibake | Yes (`{post.title}`) |
| `/community` | Static | Community Hub & Initiatives Overview | Mojibake title in meta | Yes (`Learn, Compete & Build Together`) |
| `/community/competitions` | Static | Bio-Hackathons, Hackathons & Challenges | Static meta title | Yes (`Bio-Hackathons & Challenges`) |
| `/community/conferences` | Static | Academic Conferences, Meetups & Hubs | Static meta title | Yes (`Academic Conferences & Meetups`) |
| `/community/national-bio-challenge`| Static | National Bio Challenge 2026 Flagship | Static meta title | Yes (`National Bio Challenge 2026`) |
| `/community/workshops` | Static | Hands-On Biotech & Nextflow Bootcamps | Static meta title | Yes (`Hands-On Biotech Workshops`) |
| `/events` | Static / Query | Micrylis Research Events & Symposiums | Mojibake title in meta | Yes (`Micrylis Research Events`) |
| `/events/$id` | Dynamic | Individual Event Detail & Registration | NO head block defined | Conditional (`{event.name}`) |
| `/opportunities` | Static / Query | Biotech Internships & Research Postings | Mojibake title in meta | Yes (`Opportunities & Internships`) |
| `/opportunities/$slug` | Dynamic | Individual Opportunity Detail Page | Static generic title (duplicate) | Yes (`{opportunity.title}`) |
| `/tools/colony-counter` | Interactive | AI Petri Dish Colony Counter Computer Vision | Mojibake title in meta | Yes (`AI Petri Dish Colony Counter`) |
| `/spin` | Interactive | Spin & Win Interactive Promotional Wheel | Mojibake title in meta | Yes (`Micrylis Spin & Win`) |
| `/privacy-policy` | Legal | Official Privacy Policy & Data Practices | NO head block defined | Yes (`Privacy Policy`) |
| `/refund-policy` | Legal | Refund & Cancellation Terms | NO head block defined | Yes (`Refund Policy`) |
| `/return-policy` | Legal | Digital Products Return Policy | NO head block defined | Yes (`Return Policy`) |
| `/disclaimer` | Legal | Website & Educational Service Disclaimer | NO head block defined | Yes (`Disclaimer`) |
| `/employees` | Legal | Employee Code of Conduct & Workplace Policies | NO head block defined | Yes (`Employee Code of Conduct & Policies`) |

### B. Redirecting Routes (Aliases — Must NOT Be in Sitemap)
| Source Route | HTTP Action | Destination Route | Status in Sitemap |
| :--- | :--- | :--- | :--- |
| `/courses` | Client Redirect | `/projects` | **Erronously present in sitemap.xml** |
| `/courses/$slug` | Client Redirect | `/projects/$slug` | **Erronously generated in sitemap.xml** |
| `/community/events` | Client Redirect | `/events` | **Erronously present in sitemap.xml** |
| `/community/webinars` | Client Redirect | `/webinars` | **Erronously present in sitemap.xml** |
| `/webinar` | Client Redirect | `/webinars` | **Erronously present in sitemap.xml** |

### C. Private & Disallowed Routes (Excluded from Search)
- `/admin/*` (All admin panel routes — Protected by admin session check)
- `/dashboard/*` (User dashboards, enrollments, bookings — Protected by auth session)
- `/login`, `/signup`, `/reset-password`, `/onboarding` (Auth flows — `robots: noindex`)
- `/auth/callback` (OAuth handshake endpoint)

---

## 6. SEO Implementation Roadmap
- **Phase 1 (Current)**: Git Setup, Master Documentation & Complete SEO Audit
- **Phase 2 (Pending)**: Core HTML Head & Metadata Modernization (Fix missing `<title>`, repair UTF-8 mojibake, canonical URL tags, robots directives)
- **Phase 3 (Pending)**: Page-Wise Targeted Metadata Optimization (Unique keyword-optimized titles, meta descriptions, and OpenGraph/Twitter cards for all 22+ public routes)
- **Phase 4 (Pending)**: Structured Data (Schema.org JSON-LD) Engine (Organization, WebSite, Course, BlogPosting, Event, BreadcrumbList)
- **Phase 5 (Pending)**: Sitemap & Robots Architecture Fix (Remove redirecting routes, add dynamic project slugs, update sitemap generator, add LLM discovery)
- **Phase 6 (Pending)**: Performance & Core Web Vitals Optimization (Font preloading, image optimization, LCP speed-up, bundle efficiency)
- **Phase 7 (Pending)**: Final Verification, Search Console Readiness & Production Merge Proposal

---

## 7. Phase-wise Progress Tracker
| Phase | Scope | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Git Setup + Master Documentation + Full SEO Audit | **In Progress** | Git synced, branch created, audit completed, reports established |
| **Phase 2** | Core Head, Canonical & Encoding Modernization | Pending | Awaiting Phase 1 review & approval |
| **Phase 3** | Page-Wise Metadata & Social Sharing Tags | Pending | Dependent on Phase 2 |
| **Phase 4** | Schema.org JSON-LD Structured Data Implementation | Pending | Dependent on Phase 3 |
| **Phase 5** | Dynamic Sitemap & Robots Pipeline Refinement | Pending | Dependent on Phase 4 |
| **Phase 6** | Performance & Core Web Vitals Optimization | Pending | Dependent on Phase 5 |
| **Phase 7** | Search Console Verification & Final Staging Verification | Pending | Final phase before PR |

---

## 8. Completed Tasks (Phase 1)
- [x] Inspected working tree, branches, remotes, reflogs, and uncommitted changes (Part 1).
- [x] Preserved uncommitted database migration SQL files safely without deletion or loss.
- [x] Fetched latest remote commits from `origin` (fetched `1b987d6..1bf1616` on `origin/main`).
- [x] Safely fast-forwarded local `main` to `origin/main` (`1bf1616`).
- [x] Cleanly synchronized existing working branch (`fix/spin-otp-error-sanitization`) with `main` via fast-forward.
- [x] Verified that target branch `feature/seo-optimization` did not previously exist locally or remotely.
- [x] Created and checked out dedicated feature branch `feature/seo-optimization`.
- [x] Executed TypeScript verification check (`npx tsc --noEmit`) — exited with code 0 (zero compile errors).
- [x] Checked live production availability at `https://project.micrylisbiotech.com` (HTTP 200 OK via Vercel).
- [x] Executed full headless Lighthouse audit on live production URL (`https://project.micrylisbiotech.com`).
- [x] Extracted concrete measured CWV scores: Performance 40, Accessibility 87, Best Practices 96, SEO 92.
- [x] Diagnosed critical SEO failure: Document lacks standard `<title>` tag (Score 0 on document-title audit).
- [x] Cataloged full inventory of 22 primary canonical public routes, 5 redirecting routes, and private spaces.
- [x] Established master documentation tracker (`docs/seo/SEO_MASTER_TRACKER.md`).
- [x] Implemented exact Google Search Console HTML verification file (`public/googlee4c634efcfa8054e.html`).
- [x] Verified build output includes `public/googlee4c634efcfa8054e.html` into `.vercel/output/static/` directly.
- [x] Established dedicated Google Search Console verification report (`docs/seo/GOOGLE_SEARCH_CONSOLE_VERIFICATION_REPORT.md`).

---

## 9. Pending Tasks (Future Phases)
- [ ] Fix root document title tag implementation in `src/routes/__root.tsx` (Phase 2).
- [ ] Clean up UTF-8 mojibake (`â€”`) in title and description metadata across all route files (Phase 2).
- [ ] Implement self-referencing canonical URL tags across all public routes (Phase 2).
- [ ] Implement page-specific SEO titles, descriptions, and OpenGraph images for all 22+ public routes (Phase 3).
- [ ] Implement dynamic metadata loaders for `/projects/$slug`, `/blog/$slug`, `/events/$id`, and `/opportunities/$slug` (Phase 3).
- [ ] Build Schema.org JSON-LD structured data generators for Organization, WebSite, Course, BlogPosting, Event, and BreadcrumbList (Phase 4).
- [ ] Fix `scripts/generate-sitemap.mjs` to purge redirecting routes (`/courses`, `/webinar`, `/community/events`, `/community/webinars`) (Phase 5).
- [ ] Update `scripts/generate-sitemap.mjs` to fetch and include `/projects/$slug` canonical URLs (Phase 5).
- [ ] Deploy `llms.txt` and `public/robots.txt` AI agent directives (Phase 5).
- [ ] Optimize font loading, image formats, and reduce render-blocking JavaScript to improve LCP and TBT (Phase 6).
- [ ] Verify Google Search Console ownership verification via HTML file or DNS TXT (Phase 7).

---

## 10. Manual Tasks Required (User Action)
- [ ] **Google Search Console Ownership Verification**: Exact verification file `public/googlee4c634efcfa8054e.html` has been added. Once deployed to production by user, log into Google Search Console for property `https://project.micrylisbiotech.com` and click "Verify" via HTML file.
- [ ] **Google Search Console Sitemap Submission**: After Phase 5 sitemap fixes are deployed, submit `https://project.micrylisbiotech.com/sitemap.xml` in GSC.
- [ ] **Bing Webmaster Tools**: Import verified Google Search Console property into Bing Webmaster Tools.
- [ ] **Google Analytics 4 (GA4)**: Verify if GA4 measurement ID (`G-XXXXXXXXXX`) is to be connected for organic traffic and engagement tracking.

---

## 11. Files Created
- `docs/seo/SEO_MASTER_TRACKER.md` (Permanent source of truth tracker)
- `docs/seo/SEO_AUDIT_REPORT.md` (Comprehensive initial technical audit report)
- `docs/seo/GOOGLE_SEARCH_CONSOLE_VERIFICATION_REPORT.md` (Google Search Console verification report)
- `public/googlee4c634efcfa8054e.html` (Exact GSC verification token file)

---

## 12. Files Modified
- None in Phase 1 (Strict safety rule: Application source code preserved without modifications during Phase 1).

---

## 13. Technical Decisions
- **Branch Isolation**: All SEO work is isolated strictly on `feature/seo-optimization`. Neither `main` nor `fix/spin-otp-error-sanitization` will receive direct modifications.
- **TanStack Start Head Management**: TanStack Start supports `head: () => ({ meta: [...], links: [...] })`. Because `head` meta tags must generate valid HTML `<title>` tags, we will structure the head output with root `title: "..."` property and meta tags that standard search engine parsers recognize.
- **Dynamic Domain Detection**: Preserved domain resolution architecture (`VITE_SITE_URL` -> `VERCEL_URL` -> `project.micrylisbiotech.com`) to prevent hardcoding issues across preview and production environments.
- **Canonical Route Preference**: For research programs, `/projects/$slug` is the canonical destination; `/courses/$slug` is a legacy alias that redirects to `/projects/$slug`. All sitemaps and canonical tags will point exclusively to `/projects/...`.

---

## 14. Testing and Verification Results
- **Git Branch Check**: Checked out on `feature/seo-optimization` with clean branch ancestry.
- **TypeScript Compilation (`tsc --noEmit`)**: **PASSED** (Exit code 0, zero compilation errors).
- **HTTP Status Check**: `curl.exe -I https://project.micrylisbiotech.com` -> **HTTP/1.1 200 OK** (Vercel).
- **Robots.txt Check**: `curl.exe -I https://project.micrylisbiotech.com/robots.txt` -> **HTTP/1.1 200 OK**.
- **Sitemap.xml Check**: `curl.exe -I https://project.micrylisbiotech.com/sitemap.xml` -> **HTTP/1.1 200 OK**.
- **Google Site Verification Check (Legacy)**: `curl.exe -I https://project.micrylisbiotech.com/google2217dd6b41f733b3.html` -> **HTTP/1.1 200 OK**.
- **Google Site Verification Check (Exact Required Token)**: Local build verified in `.vercel/output/static/googlee4c634efcfa8054e.html`. Live URL currently returns HTTP 404 (expected, pending user deployment of `feature/seo-optimization`).
- **Lighthouse Production Audit (Headless Chrome 13.6.0)**:
  - **SEO Score**: 92 / 100
  - **Performance Score**: 40 / 100
  - **Accessibility Score**: 87 / 100
  - **Best Practices Score**: 96 / 100
  - **First Contentful Paint (FCP)**: 1.9 s
  - **Largest Contentful Paint (LCP)**: 6.8 s (Critical bottleneck)
  - **Total Blocking Time (TBT)**: 2,030 ms (High script execution overhead)
  - **Cumulative Layout Shift (CLS)**: 0.002 (Excellent stability)
  - **Speed Index**: 7.7 s

---

## 15. Issues Identified
1. **Critical — Missing HTML `<title>` Element**: The document rendered by SSR does not include a `<title>...</title>` element in `<head>`. TanStack Start head config uses `{ name: "title", content: "..." }`, which fails HTML standards and caused Lighthouse audit `document-title` to score 0.
2. **Critical — UTF-8 Character Encoding Mojibake (`â€”`)**: Em-dash characters in title and description metadata strings across `__root.tsx`, `about.tsx`, `ielts.tsx`, `projects.tsx`, `blog.tsx`, etc., were saved or interpreted as Windows-1252 / Mojibake, resulting in corrupt titles like `"About Us & Contact â€” Micrylis Biotech"`.
3. **Critical — Absence of Canonical URL Tags**: No page in the application currently defines `<link rel="canonical" href="...">`.
4. **Critical — Redirect URLs in Sitemap**: `public/sitemap.xml` includes `/courses`, `/webinar`, `/community/events`, and `/community/webinars`, all of which execute client redirects to other routes.
5. **High — Missing Dynamic Course/Project URLs in Sitemap**: Sitemaps do not contain the canonical project URLs (`/projects/bioplastic-innovation`, `/projects/ai-in-drug-discovery`, `/projects/bioinformatics`), but instead include redirecting `/courses/...` paths.
6. **High — Absence of Schema.org Structured Data**: No JSON-LD structured data is present for `Organization`, `WebSite`, `Course`, `BlogPosting`, or `Event`.
7. **High — Relative OpenGraph Image URLs**: OpenGraph images are declared as relative paths (`/logo.png`) rather than absolute URLs (`https://project.micrylisbiotech.com/logo.png`), which causes preview failure on WhatsApp, LinkedIn, and Facebook.
8. **Medium — Duplicate Titles on Opportunity Detail Pages**: `src/routes/opportunities/$slug.tsx` uses a static hardcoded title `"Opportunity Details â€” Micrylis Biotech"` for all dynamic listings.
9. **Medium — Missing Metadata on Legal & Event Detail Pages**: `disclaimer.tsx`, `employees.tsx`, `privacy-policy.tsx`, `refund-policy.tsx`, `return-policy.tsx`, and `events/$id.tsx` have no `head()` definition.
10. **Medium — Suboptimal Mobile Core Web Vitals**: LCP of 6.8s and TBT of 2,030ms due to font blocking and heavy JavaScript execution on mobile viewports.

---

## 16. Issues Resolved
- None yet (Resolved status will be recorded in Phase 2 through Phase 7 upon verification).

---

## 17. Git Branch Information
- **Original Branch**: `fix/spin-otp-error-sanitization`
- **Synchronized With**: `main` (commit `1bf1616f30158d506b96a3f9b8d35871d3ed2eaa`)
- **Active SEO Feature Branch**: `feature/seo-optimization`
- **Base Commit**: `1bf1616f30158d506b96a3f9b8d35871d3ed2eaa`
- **Remote Origin**: `https://github.com/Professional-Home/pathfinder-forge-52.git`

---

## 18. Commit History (SEO Feature Branch)
- `b964337 docs(seo): establish SEO master tracker` (Initial master documentation setup)
- `310d123 docs(seo): add initial technical audit report` (Comprehensive technical SEO, routes, and performance audit)
- `ac168b9 chore(seo): record audit commit milestones in tracker` (Final master tracker update for Phase 1)
- `fix(seo): add exact Google Search Console verification file` (Added exact GSC HTML verification asset and verification report)

---

## 19. Current Project Status
- **Phase**: Phase 1 — Complete (Google Search Console Verification Asset Installed)
- **Readiness**: Exact Google Search Console verification asset installed and verified in build output. Detailed verification report compiled. Ready for deployment and verification. Phase 2 awaiting user approval.

---

## 20. Next Recommended Phase
- **Phase 2 — Core Head, Canonical & Encoding Modernization**:
  1. Fix HTML `<title>` tag rendering in TanStack Start `__root.tsx`.
  2. Normalize all character encoding (eliminate `â€”` across all route metadata).
  3. Implement canonical `<link rel="canonical">` tag generator utility.
  4. Implement absolute Open Graph & Twitter image URL resolution.
  5. Add `robots` meta tag defaults for public indexable pages.

---

## 21. Change History
- **2026-11-14**: Phase 1 initiated. Safe Git synchronization completed. Created `feature/seo-optimization` branch. Executed full technical SEO and Lighthouse audit. Initialized `SEO_MASTER_TRACKER.md` and `SEO_AUDIT_REPORT.md`.
- **2026-11-14**: GSC Verification Fix. Implemented exact Google Search Console verification file `public/googlee4c634efcfa8054e.html`. Created `docs/seo/GOOGLE_SEARCH_CONSOLE_VERIFICATION_REPORT.md`. Verified local production build packaging into `.vercel/output/static/`.
