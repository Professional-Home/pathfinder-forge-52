# MICRYLIS BIOTECH — SEO MASTER TRACKER
**Permanent Project Source of Truth**

---

## 1. Project Overview
- **Organization**: Micrylis Biotech
- **Project Initiative**: Full-Scale Search Engine Optimization (SEO) & Search Experience Optimization (SXO)
- **Starting Point**: SEO implementation from absolute zero on a live production web application.
- **Project Scope**: Comprehensive technical SEO, page-wise metadata, OpenGraph & social sharing protocols, semantic structured data (Schema.org JSON-LD), dynamic sitemap accuracy, Core Web Vitals optimization, GEO (Generative Engine Optimization for AI citations / `llms.txt`), and automated search engine verification.
- **Phase Current**: Phase 2 — Complete (Core HTML Head, Metadata, Canonical URLs & Protected Routes Implemented)
- **Project Status**: `In Progress` (Phase 1 & Phase 2 Complete; Ready for Phase 3/4)

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
2. **Canonical HTML `<title>` & Metadata Compliance**: Eliminate missing document title tags (Lighthouse score 0 for document-title), repair encoding mojibake (`â€”`), and inject unique title and description tags for all static and dynamic pages. *(Phase 2 Complete)*
3. **Canonical Link Protocol**: Ensure every indexable page serves an unambiguous self-referential `<link rel="canonical" href="...">` tag to prevent duplicate content dilution. *(Phase 2 Complete)*
4. **Structured Data Rich Results**: Implement Schema.org JSON-LD structured data (`Organization`, `WebSite`, `Course`, `BlogPosting`, `Event`, `BreadcrumbList`) to achieve rich search snippets.
5. **Clean Sitemap & Robots Architecture**: Ensure `sitemap.xml` strictly contains canonical `200 OK` endpoints, stripping all 301/302 redirects (`/courses`, `/webinar`, `/community/events`, `/community/webinars`), while dynamically generating project URLs (`/projects/bioplastic-innovation`, etc.).
6. **Social Sharing Readiness**: Provide valid Open Graph (`og:*`) and Twitter Card (`twitter:*`) tags with absolute image URLs (`512x512` and `1200x630`) on every public route. *(Phase 2 Complete)*
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
- **SEO Helper Utility**: `src/lib/seo-metadata.ts` generates standardized, type-safe `<title>`, meta descriptions, canonical `<link rel="canonical">`, Open Graph, Twitter cards, and `robots` directives.

---

## 5. Public Website Routes Inventory & Phase 2 Status

### A. Primary Public Canonical Routes (22 Endpoints)
| Route Path | Type | Standard HTML `<title>` | Canonical Link Target | Meta Description Status | OG / Twitter Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Static | `Micrylis Biotech — Personalized Mentorship & Biotech Research Projects` | `https://project.micrylisbiotech.com` | Verified Unique | Absolute URLs Verified |
| `/about` | Static | `About Us & Contact — Micrylis Biotech` | `https://project.micrylisbiotech.com/about` | Verified Unique | Absolute URLs Verified |
| `/projects` | Static / Query | `Projects & Research Internships — Micrylis Biotech` | `https://project.micrylisbiotech.com/projects` | Verified Unique | Absolute URLs Verified |
| `/projects/$slug` | Dynamic | Dynamic Program Title + ` — Micrylis Biotech` | `https://project.micrylisbiotech.com/projects/{slug}` | Dynamic Data-Driven | Dynamic / Absolute |
| `/ielts` | Static | `IELTS Preparation — Apply Now \| Micrylis Biotech` | `https://project.micrylisbiotech.com/ielts` | Verified Unique | Absolute URLs Verified |
| `/blog` | Static / Query | `Biotech Blog & Insights — Micrylis Biotech` | `https://project.micrylisbiotech.com/blog` | Verified Unique | Absolute URLs Verified |
| `/blog/$slug` | Dynamic | Dynamic Post Title + ` — Micrylis Biotech` | `https://project.micrylisbiotech.com/blog/{slug}` | Dynamic Article Excerpt | Dynamic / Absolute |
| `/community` | Static | `Biotech Community & Challenges — Micrylis Biotech` | `https://project.micrylisbiotech.com/community` | Verified Unique | Absolute URLs Verified |
| `/community/competitions` | Static | `Biotech Competitions & Hackathons — Micrylis Biotech` | `https://project.micrylisbiotech.com/community/competitions` | Verified Unique | Absolute URLs Verified |
| `/community/conferences` | Static | `Biotechnology Conferences & Meetups — Micrylis Biotech` | `https://project.micrylisbiotech.com/community/conferences` | Verified Unique | Absolute URLs Verified |
| `/community/national-bio-challenge`| Static | `National Bio Challenge 2026 — Micrylis Biotech` | `https://project.micrylisbiotech.com/community/national-bio-challenge` | Verified Unique | Absolute URLs Verified |
| `/community/workshops` | Static | `Biotechnology & Bioinformatics Workshops — Micrylis Biotech` | `https://project.micrylisbiotech.com/community/workshops` | Verified Unique | Absolute URLs Verified |
| `/events` | Static / Query | `Biotechnology & Bioinformatics Events — Micrylis Biotech` | `https://project.micrylisbiotech.com/events` | Verified Unique | Absolute URLs Verified |
| `/events/$id` | Dynamic | Dynamic Event Name + ` — Micrylis Biotech` | `https://project.micrylisbiotech.com/events/{id}` | Dynamic Data-Driven | Dynamic / Absolute |
| `/opportunities` | Protected / Auth | `Internships & Research Opportunities — Micrylis Biotech` | `https://project.micrylisbiotech.com/opportunities` | Verified Unique | Absolute URLs Verified |
| `/opportunities/$slug` | Protected / Auth | Dynamic Listing Title + ` — Micrylis Biotech` | `https://project.micrylisbiotech.com/opportunities/{slug}` | Dynamic Data-Driven | Dynamic / Absolute |
| `/tools/colony-counter` | Interactive | `AI Petri Dish Colony Counter — Micrylis Biotech` | `https://project.micrylisbiotech.com/tools/colony-counter` | Verified Unique | Absolute URLs Verified |
| `/spin` | Interactive | `Spin & Win Exclusive Rewards — Micrylis Biotech` | `https://project.micrylisbiotech.com/spin` | Verified Unique | Absolute URLs Verified |
| `/webinars` | Static / Query | `Bioinformatics & Biotechnology Webinars — Micrylis Biotech` | `https://project.micrylisbiotech.com/webinars` | Verified Unique | Absolute URLs Verified |
| `/privacy-policy` | Legal | `Privacy Policy — Micrylis Biotech` | `https://project.micrylisbiotech.com/privacy-policy` | Verified Legal Summary | Absolute URLs Verified |
| `/refund-policy` | Legal | `Refund Policy — Micrylis Biotech` | `https://project.micrylisbiotech.com/refund-policy` | Verified Legal Summary | Absolute URLs Verified |
| `/return-policy` | Legal | `Return Policy — Micrylis Biotech` | `https://project.micrylisbiotech.com/return-policy` | Verified Legal Summary | Absolute URLs Verified |
| `/disclaimer` | Legal | `Disclaimer — Micrylis Biotech` | `https://project.micrylisbiotech.com/disclaimer` | Verified Legal Summary | Absolute URLs Verified |

### B. Redirecting Routes (Aliases — Unchanged, Must NOT Be in Sitemap)
| Source Route | HTTP Action | Destination Route | Status in Sitemap |
| :--- | :--- | :--- | :--- |
| `/courses` | Client Redirect | `/projects` | **Erronously present in sitemap.xml (Pending Phase 5)** |
| `/courses/$slug` | Client Redirect | `/projects/$slug` | **Erronously generated in sitemap.xml (Pending Phase 5)** |
| `/community/events` | Client Redirect | `/events` | **Erronously present in sitemap.xml (Pending Phase 5)** |
| `/community/webinars` | Client Redirect | `/webinars` | **Erronously present in sitemap.xml (Pending Phase 5)** |
| `/webinar` | Client Redirect | `/webinars` | **Erronously present in sitemap.xml (Pending Phase 5)** |

### C. Private & Protected Routes (Configured with `noindex, nofollow`)
- `/admin` & `/admin/*` — Layout configured with `{ name: "robots", content: "noindex, nofollow" }`, no canonical link emitted.
- `/dashboard` & `/dashboard/*` — Layout configured with `{ name: "robots", content: "noindex, nofollow" }`, no canonical link emitted.
- `/login`, `/signup`, `/reset-password`, `/onboarding` — Direct routes configured with `{ name: "robots", content: "noindex, nofollow" }`.
- `/auth/callback` — OAuth handshake route configured with `{ name: "robots", content: "noindex, nofollow" }`.
- `/employees` — Internal employee directory configured with `{ name: "robots", content: "noindex, nofollow" }`.

---

## 6. SEO Implementation Roadmap
- **Phase 1 (Complete)**: Git Setup, Master Documentation, Complete SEO Audit & Google Search Console Ownership Verification
- **Phase 2 (Complete)**: Core HTML Head & Metadata Modernization (Fix missing `<title>`, repair UTF-8 mojibake, canonical URL tags, robots directives)
- **Phase 3 (Pending)**: Page-Wise Targeted Metadata Optimization & Social Previews
- **Phase 4 (Pending)**: Structured Data (Schema.org JSON-LD) Engine (Organization, WebSite, Course, BlogPosting, Event, BreadcrumbList)
- **Phase 5 (Pending)**: Sitemap & Robots Architecture Fix (Remove redirecting routes, add dynamic project slugs, update sitemap generator, add LLM discovery)
- **Phase 6 (Pending)**: Performance & Core Web Vitals Optimization (Font preloading, image optimization, LCP speed-up, bundle efficiency)
- **Phase 7 (Pending)**: Final Verification, Search Console Readiness & Production Merge Proposal

---

## 7. Phase-wise Progress Tracker
| Phase | Scope | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Git Setup + Master Docs + Full SEO Audit + GSC Verification | **Complete** | Git synced, audit completed, reports established, GSC ownership verified |
| **Phase 2** | Core Head, Canonical & Encoding Modernization | **Complete** | Standard `<title>`, canonicals, absolute OG/Twitter, robots directives implemented & SSR-verified |
| **Phase 3** | Page-Wise Metadata & Social Sharing Tags | Pending | Ready to begin upon Phase 2 review |
| **Phase 4** | Schema.org JSON-LD Structured Data Implementation | Pending | Dependent on Phase 3 |
| **Phase 5** | Dynamic Sitemap & Robots Pipeline Refinement | Pending | Dependent on Phase 4 |
| **Phase 6** | Performance & Core Web Vitals Optimization | Pending | Dependent on Phase 5 |
| **Phase 7** | Search Console Verification & Final Staging Verification | Pending | Final phase before PR |

---

## 8. Completed Tasks

### Phase 1 Tasks
- [x] Inspected working tree, branches, remotes, reflogs, and uncommitted changes.
- [x] Preserved uncommitted database migration SQL files safely without deletion or loss.
- [x] Fetched latest remote commits from `origin` and fast-forwarded local `main`.
- [x] Synchronized existing working branch (`fix/spin-otp-error-sanitization`) with `main`.
- [x] Created dedicated feature branch `feature/seo-optimization`.
- [x] Executed full headless Lighthouse audit on live production URL (`https://project.micrylisbiotech.com`).
- [x] Cataloged full inventory of 22 primary canonical public routes, 5 redirecting routes, and private spaces.
- [x] Established master documentation tracker (`docs/seo/SEO_MASTER_TRACKER.md`).
- [x] Established dedicated Google Search Console verification report (`docs/seo/GOOGLE_SEARCH_CONSOLE_VERIFICATION_REPORT.md`).
- [x] Deployed and verified official Google Search Console verification asset (`public/googlea1738a9f0280edb8.html`) via PR #22 into production.
- [x] Google Search Console property ownership auto-verified.
- [x] Preserved all verification files in production repository.

### Phase 2 Tasks
- [x] Audited TanStack Start head compilation mechanism: discovered TanStack Router parses `{ title: "..." }` in `meta` array into a standard HTML `<title>` tag, while `{ name: "title", content: "..." }` only emitted an invalid meta tag.
- [x] Created centralized, type-safe SEO helper utility `src/lib/seo-metadata.ts` (`createSeoHead`, `buildCanonicalUrl`, `buildAbsoluteImageUrl`).
- [x] Modernized `src/routes/__root.tsx` with standard `{ title: "..." }` fallback and absolute Open Graph / Twitter image URLs (`https://project.micrylisbiotech.com/logo.png`).
- [x] Implemented standard HTML `<title>`, tailored description, and canonical link on homepage (`src/routes/index.tsx`).
- [x] Implemented standard HTML `<title>`, descriptions, and self-referential canonical URLs across all static public routes (`/about`, `/projects`, `/ielts`, `/blog`, `/community`, `/community/*`, `/events`, `/tools/colony-counter`, `/spin`, `/webinars`, `/privacy-policy`, `/refund-policy`, `/return-policy`, `/disclaimer`).
- [x] Implemented data-driven dynamic `<title>`, description, canonical URL, and OG image for `/projects/$slug`, `/blog/$slug`, `/events/$id`, and `/opportunities/$slug`.
- [x] Tightened robots directives to `{ name: "robots", content: "noindex, nofollow" }` on protected routes (`/admin/*`, `/dashboard/*`, `/login`, `/signup`, `/reset-password`, `/onboarding`, `/auth/callback`, `/employees`) and ensured zero canonical tags are emitted for them.
- [x] Ensured em-dash (`—`) and punctuation strings use clean UTF-8 encoding across all route metadata without mojibake.
- [x] Executed TypeScript type-check (`npx tsc --noEmit`) — exited with code 0 (zero errors).
- [x] Executed ESLint check on `src/lib/seo-metadata.ts` — exited with code 0 (zero errors).
- [x] Executed full production build (`npm run build`) — completed in 12.51s with zero errors.
- [x] Verified SSR HTML output using programmatically executed Nitro handler for 20 representative public and protected routes.
- [x] Confirmed zero duplicate canonical tags (exactly 1 canonical tag per public route, 0 for protected routes).
- [x] Confirmed all three Google verification HTML files (`google2217dd6b41f733b3.html`, `googlee4c634efcfa8054e.html`, `googlea1738a9f0280edb8.html`) remain present in `.vercel/output/static/`.

---

## 9. Pending Tasks (Future Phases)
- [ ] Implement page-specific SEO keyword enhancements and rich OpenGraph visual cards for all 22+ public routes (Phase 3).
- [ ] Build Schema.org JSON-LD structured data generators for Organization, WebSite, Course, BlogPosting, Event, and BreadcrumbList (Phase 4).
- [ ] Fix `scripts/generate-sitemap.mjs` to purge redirecting routes (`/courses`, `/webinar`, `/community/events`, `/community/webinars`) (Phase 5).
- [ ] Update `scripts/generate-sitemap.mjs` to fetch and include `/projects/$slug` canonical URLs (Phase 5).
- [ ] Deploy `llms.txt` and `public/robots.txt` AI agent directives (Phase 5).
- [ ] Optimize font loading, image formats, and reduce render-blocking JavaScript to improve LCP and TBT (Phase 6).
- [ ] Submit sitemap in Google Search Console once Phase 5 is deployed to production (Phase 7).

---

## 10. Manual Tasks Required (User Action)
- [x] **Google Search Console Ownership Verification**: **COMPLETED**. Official verification file `public/googlea1738a9f0280edb8.html` deployed to production; property ownership auto-verified by Google.
- [ ] **Google Search Console Sitemap Submission**: After Phase 5 sitemap overhaul is deployed to production, submit `https://project.micrylisbiotech.com/sitemap.xml` in GSC.
- [ ] **Bing Webmaster Tools**: Import verified Google Search Console property into Bing Webmaster Tools.
- [ ] **Google Analytics 4 (GA4)**: Verify if GA4 measurement ID (`G-XXXXXXXXXX`) is to be connected for organic traffic and engagement tracking.

---

## 11. Files Created
- `docs/seo/SEO_MASTER_TRACKER.md` (Permanent source of truth tracker)
- `docs/seo/SEO_AUDIT_REPORT.md` (Comprehensive initial technical audit report)
- `docs/seo/GOOGLE_SEARCH_CONSOLE_VERIFICATION_REPORT.md` (Google Search Console verification report)
- `public/googlee4c634efcfa8054e.html` (First GSC verification token file)
- `public/googlea1738a9f0280edb8.html` (Official live GSC auto-verified token file on production)
- `src/lib/seo-metadata.ts` (Centralized SEO metadata & canonical URL generation utility)

---

## 12. Files Modified (Phase 2)
- `src/routes/__root.tsx` (Replaced invalid title meta tag with standard `{ title: "..." }`, converted relative OG/Twitter images to absolute URLs)
- `src/routes/index.tsx` (Added `createSeoHead` with standard `<title>`, description, canonical `https://project.micrylisbiotech.com`, OG & Twitter)
- `src/routes/about.tsx` (Integrated `createSeoHead` with canonical `/about` and absolute social tags)
- `src/routes/projects/index.tsx` (Integrated `createSeoHead` with canonical `/projects` and tailored description)
- `src/routes/projects/$slug.tsx` (Integrated dynamic `createSeoHead` with canonical `/projects/{slug}`, course title & image)
- `src/routes/ielts.tsx` (Integrated `createSeoHead` with canonical `/ielts` and absolute social tags)
- `src/routes/blog/index.tsx` (Integrated `createSeoHead` with canonical `/blog` and tailored description)
- `src/routes/blog/$slug.tsx` (Integrated dynamic `createSeoHead` with canonical `/blog/{slug}`, article title, excerpt & image)
- `src/routes/community/index.tsx` (Integrated `createSeoHead` with canonical `/community` and tailored description)
- `src/routes/community/competitions.tsx` (Integrated `createSeoHead` with canonical `/community/competitions`)
- `src/routes/community/conferences.tsx` (Integrated `createSeoHead` with canonical `/community/conferences`)
- `src/routes/community/national-bio-challenge.tsx` (Integrated `createSeoHead` with canonical `/community/national-bio-challenge`)
- `src/routes/community/workshops.tsx` (Integrated `createSeoHead` with canonical `/community/workshops`)
- `src/routes/events/index.tsx` (Integrated `createSeoHead` with canonical `/events` and tailored description)
- `src/routes/events/$id.tsx` (Added loader and dynamic `createSeoHead` with canonical `/events/{id}`)
- `src/routes/tools/colony-counter.tsx` (Integrated `createSeoHead` with canonical `/tools/colony-counter`)
- `src/routes/spin.tsx` (Integrated `createSeoHead` with canonical `/spin`)
- `src/routes/webinars.tsx` (Integrated `createSeoHead` with canonical `/webinars`)
- `src/routes/privacy-policy.tsx` (Integrated `createSeoHead` with canonical `/privacy-policy`)
- `src/routes/refund-policy.tsx` (Integrated `createSeoHead` with canonical `/refund-policy`)
- `src/routes/return-policy.tsx` (Integrated `createSeoHead` with canonical `/return-policy`)
- `src/routes/disclaimer.tsx` (Integrated `createSeoHead` with canonical `/disclaimer`)
- `src/routes/opportunities/index.tsx` (Integrated `createSeoHead` with canonical `/opportunities`)
- `src/routes/opportunities/$slug.tsx` (Integrated `createSeoHead` with canonical `/opportunities/{slug}`)
- `src/routes/admin.tsx` (Added parent layout head with `{ name: "robots", content: "noindex, nofollow" }`)
- `src/routes/admin/login.tsx` (Tightened to `noindex, nofollow`)
- `src/routes/admin/opportunities.tsx` (Tightened to `noindex, nofollow`)
- `src/routes/dashboard.tsx` (Added parent layout head with `{ name: "robots", content: "noindex, nofollow" }`)
- `src/routes/login.tsx` (Tightened to `noindex, nofollow`)
- `src/routes/signup.tsx` (Tightened to `noindex, nofollow`)
- `src/routes/reset-password.tsx` (Tightened to `noindex, nofollow`)
- `src/routes/onboarding.tsx` (Tightened to `noindex, nofollow`)
- `src/routes/auth.callback.tsx` (Added head with `noindex, nofollow`)
- `src/routes/employees.tsx` (Added head with `noindex, nofollow`)
- `src/routeTree.gen.ts` (Auto-regenerated by TanStack Router compiler during build)

---

## 13. Technical Decisions
- **Standard `<title>` Tag via TanStack Router**: TanStack Router's `buildTagsFromMatches` extracts `{ title: "..." }` in `meta` and renders standard HTML `<title>` tags through `Asset.tsx`. Route-level titles cleanly override the root fallback.
- **Centralized Helper Architecture**: `createSeoHead()` encapsulates metadata defaults, canonical sanitization, and social tags, avoiding code duplication across 30+ route files.
- **Strict Canonical URL Sanitization**: All canonical URLs are guaranteed to be absolute on `https://project.micrylisbiotech.com`, stripped of query strings, hashes, and trailing slashes.
- **Clean Separation of Indexable vs Private Routes**: Protected routes explicitly emit `noindex, nofollow` and completely omit canonical tags.
- **Zero Additional Runtime Dependencies**: The implementation strictly leverages the existing TanStack Router, React 19, and Vite architecture without adding new npm packages.

---

## 14. Testing and Verification Results
- **TypeScript Compilation (`tsc --noEmit`)**: **PASSED** (Exit code 0, zero compilation errors).
- **ESLint Validation (`npx eslint src/lib/seo-metadata.ts`)**: **PASSED** (Exit code 0, zero errors).
- **Production Build Packaging (`npm run build`)**: **PASSED** (`✓ built in 12.51s`, Nitro Vercel server function & static assets packaged cleanly).
- **Google Verification Files in Output**: **PASSED** (`google2217dd6b41f733b3.html`, `googlee4c634efcfa8054e.html`, `googlea1738a9f0280edb8.html` verified in `.vercel/output/static/`).
- **SSR HTML Render Inspection**: Programmatically executed Nitro server function `handler.fetch(new Request(...))` for 20 representative routes:
  - `/` $\to$ `<title>` present, canonical `https://project.micrylisbiotech.com` (count: 1), absolute `og:image`.
  - `/about` $\to$ `<title>` present, canonical `https://project.micrylisbiotech.com/about` (count: 1).
  - `/projects` $\to$ `<title>` present, canonical `https://project.micrylisbiotech.com/projects` (count: 1).
  - `/ielts` $\to$ `<title>` present, canonical `https://project.micrylisbiotech.com/ielts` (count: 1).
  - `/blog` $\to$ `<title>` present, canonical `https://project.micrylisbiotech.com/blog` (count: 1).
  - `/community/*` $\to$ `<title>` present, distinct canonicals (count: 1 each).
  - `/events` $\to$ `<title>` present, canonical `https://project.micrylisbiotech.com/events` (count: 1).
  - `/tools/colony-counter` $\to$ `<title>` present, canonical `https://project.micrylisbiotech.com/tools/colony-counter` (count: 1).
  - `/spin` $\to$ `<title>` present, canonical `https://project.micrylisbiotech.com/spin` (count: 1).
  - `/webinars` $\to$ `<title>` present, canonical `https://project.micrylisbiotech.com/webinars` (count: 1).
  - Legal routes (`/privacy-policy`, `/refund-policy`, `/return-policy`, `/disclaimer`) $\to$ `<title>` present, unique canonicals (count: 1 each).
  - Protected routes (`/login`, `/admin/login`, `/dashboard`, `/employees`) $\to$ `robots: noindex, nofollow`, canonical count: 0.

---

## 15. Remaining Issues & Next Phase Scope
1. **Redirecting Routes in Sitemap (Phase 5)**: `public/sitemap.xml` still lists `/courses`, `/webinar`, `/community/events`, `/community/webinars`. To be cleaned up in Phase 5 sitemap overhaul.
2. **Dynamic Project Slugs in Sitemap (Phase 5)**: Canonical project URLs (`/projects/bioplastic-innovation`, etc.) need automated sitemap generation in Phase 5.
3. **Structured Data JSON-LD (Phase 4)**: Rich snippets (`Organization`, `WebSite`, `Course`, `BlogPosting`, `Event`) to be implemented in Phase 4.

---

## 16. Issues Resolved
- **Critical — Missing HTML `<title>` Tag**: Fully resolved across all public routes.
- **Critical — Absence of Canonical URL Tags**: Fully resolved with self-referential absolute URLs on `https://project.micrylisbiotech.com`.
- **Critical — Character Encoding Mojibake**: Cleaned up and verified pure UTF-8 formatting.
- **High — Relative OpenGraph Image URLs**: Fully resolved to absolute production URLs (`https://project.micrylisbiotech.com/...`).
- **Medium — Missing Metadata on Legal Pages**: Fully resolved with dedicated titles and descriptions.
- **Medium — Protected Route Search Indexing Exposure**: Fully resolved with explicit `noindex, nofollow`.

---

## 17. Git Branch Information
- **Original Branch**: `fix/spin-otp-error-sanitization`
- **Active SEO Feature Branch**: `feature/seo-optimization`
- **Base Commit**: `1bf1616f30158d506b96a3f9b8d35871d3ed2eaa`
- **Remote Origin**: `https://github.com/Professional-Home/pathfinder-forge-52.git`

---

## 18. Commit History (SEO Feature Branch)
- `b964337 docs(seo): establish SEO master tracker` (Initial master documentation setup)
- `310d123 docs(seo): add initial technical audit report` (Comprehensive technical SEO, routes, and performance audit)
- `ac168b9 chore(seo): record audit commit milestones in tracker` (Final master tracker update for Phase 1)
- `4c0e587 fix(seo): add exact Google Search Console verification file` (Added initial GSC HTML verification asset and verification report)
- `1af2669 docs(seo): record successful Google Search Console ownership verification` (Recorded verified ownership status and diagnostics)
- `84eaad5 feat(seo): implement core HTML head, metadata, and canonical URLs` (Phase 2 implementation milestone)

---

## 19. Current Project Status
- **Phase**: Phase 2 — Complete (Core HTML Head, Metadata, Canonical URLs & Protected Routes Implemented)
- **Readiness**: All public routes render standard `<title>` and canonical tags. Protected routes secured with `noindex, nofollow`. Build and SSR tests verified. Phase 3 awaiting user approval.

---

## 20. Next Recommended Phase
- **Phase 3 — Page-Wise Targeted Metadata Optimization & Dynamic Previews**:
  1. Optimize keyword density and CTR targeting for page titles and snippets.
  2. Implement custom dynamic OpenGraph social card previews.

---

## 21. Change History
- **2026-11-14**: Phase 1 initiated. Safe Git synchronization completed. Created `feature/seo-optimization` branch. Executed full technical SEO and Lighthouse audit. Initialized `SEO_MASTER_TRACKER.md` and `SEO_AUDIT_REPORT.md`.
- **2026-11-14**: GSC Ownership Auto-Verified. Deployed `public/googlea1738a9f0280edb8.html` to production via PR #22. Google Search Console confirmed "Ownership auto verified". Updated master tracker and verification report.
- **2026-11-14**: Phase 2 completed. Created centralized SEO metadata helper (`src/lib/seo-metadata.ts`). Modernized `__root.tsx`, homepage, and all 22+ public routes with standard HTML `<title>`, descriptions, and canonical URLs. Configured `noindex, nofollow` on protected spaces. Verified SSR rendering and build output.
