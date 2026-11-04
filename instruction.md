# PATHFINDER — PERMANENT DEVELOPMENT RULES, WORKFLOWS, & TOOL INSTRUCTIONS

This document serves as the permanent, authoritative development guide for the **PathFinder** project within Google Antigravity on Windows. All future agent sessions must refer to and strictly adhere to these rules, workflows, constraints, and instructions.

---

## A. Mandatory Development Workflow

Every engineering task must follow this exact sequential loop. Never skip any step:

```
[User Requirement] 
       ↓
[ChatGPT Architectural Analysis] 
       ↓
[ChatGPT Antigravity Prompt] 
       ↓
[Antigravity Audit & Surgical Implementation] 
       ↓
[Antigravity Comprehensive Execution Report] 
       ↓
[ChatGPT Review & Verification] 
       ↓
[Next Prompt / Task]
```

1. **Requirement Definition**: The user provides a feature requirement, bug report, UI enhancement, or improvement goal.
2. **ChatGPT Analysis**: ChatGPT analyzes the requirement against PathFinder's existing architecture, dependencies, and database schemas.
3. **Structured Prompt**: ChatGPT formulates an exact, contextual Antigravity implementation prompt.
4. **Agent Ingestion**: The prompt is submitted to Google Antigravity.
5. **Audit & Implementation**: Antigravity audits existing code, applies the smallest surgical repairs/features under strict safety guidelines.
6. **Execution Report Generation**: Antigravity produces a comprehensive execution report detailing all inspected/edited files, build results, test outputs, and pending manual steps.
7. **Handoff & Review**: The user shares the report back with ChatGPT.
8. **ChatGPT Verification**: ChatGPT reviews the outcome, verifying error handling, missing requirements, and edge cases.
9. **Follow-Up Iteration**: ChatGPT designs the next prompt once the prior task is verified.

> **CRITICAL RULE**: Never assume work is completed before the execution report has been reviewed and verified by ChatGPT and the user.

---

## B. Architecture Preservation

PathFinder is built upon a modern, integrated full-stack web stack:
- **Core Framework**: React 19, TypeScript 5.8+, Vite
- **Styling**: Tailwind CSS v4, Lucide React, Framer Motion
- **Routing**: TanStack Router / TanStack Start
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, Storage)
- **Authentication**: Supabase Auth (session management, RLS-bound queries)
- **Server Execution**: Vercel server functions & Nitro

### Absolute Preservation Principles:
1. **Preserve Application Functionality**: Never break, degrade, or deprecate existing features or pages.
2. **Preserve Authentication**: Supabase Auth is the single source of truth for authentication. **Never introduce Clerk or any second authentication provider.**
3. **Preserve Backend & API Contracts**: Maintain existing database table schemas, column types, foreign keys, and RPC functions.
4. **Preserve Route Structures**: Do not rename, remove, or restructure routes under `src/routes/` without explicit authorization.
5. **Preserve Coding Conventions**: Adhere strictly to existing component patterns, naming styles, and state management conventions.
6. **No Unnecessary Rewrites**: Never rewrite functional code for speculative or stylistic reasons.

---

## C. Development Tools and Their Responsibilities

All tools must be used purposefully and selectively. Avoid redundant activations and never install duplicate dependencies.

| Tool | Category / Scope | Purpose & Responsibilities | Automatic Activation Condition |
| :--- | :--- | :--- | :--- |
| **`unslop`** | Global Skill | AI text humanizer, fluff eliminator, and surgical code precision engine. | All software development tasks (coding, refactoring, debugging, cleanup, commit messages). |
| **`ui-ux-pro-max`** | Global Skill | UI/UX design intelligence (79 styles, 192 palettes, 119 guidelines, WCAG AA standards). | Frontend interface design, layouts, component styling, animations, responsive design. |
| **`Impeccable`** | Global Skill | Craft director, UI audits, visual refinement, and design system governance (`DESIGN.md`). | Design critiques, UI audits, visual polishing, micro-interactions, aesthetic refinement. |
| **`Watermelon UI`** | Global Skill & MCP | Source-backed React/Tailwind/Radix component registry (800+ blocks and components). | Discovering and implementing reusable UI components and landing page blocks. |
| **`claude-seo`** | Global Skill | Technical SEO audit, Schema.org JSON-LD, XML sitemaps, robots.txt, E-E-A-T, and GEO. | Public routes, landing pages, metadata, OpenGraph/Twitter cards, and indexing. |
| **`agentic-awesome-skills`** | Global Skill & Repo | Catalog of 2,824+ specialized runbooks for full-stack, DevOps, database, and cloud patterns. | Specialized technical workflows, third-party library integrations, and niche domain recipes. |
| **`skillx`** | Global Skill | Universal skill catalog search, vetting, and execution platform. | Skill discovery, benchmarking, and external capability vetting. |
| **`Graphify`** | Global Skill & Tool | Codebase architecture intelligence, AST dependency mapping, and topological clustering. | Architecture analysis, dependency mapping, complex refactoring, and code relationship queries. |
| **`TypeScript`** | Project & Global CLI | Strict static typing, interface contracts, and compilation verification (`tsc`). | All TypeScript implementations, type contracts, and compile-time type validation. |
| **`Playwright`** | Global CLI | End-to-end browser automation, user flow verification, and visual regression testing. | E2E browser workflows, auth flow verification, and functional regression checks. |
| **`Lighthouse`** | Global CLI | Audits for performance, accessibility, SEO, best practices, and Core Web Vitals. | Performance profiling, accessibility audits, and Core Web Vitals validation. |
| **`Supabase CLI`** | Global CLI | Local Supabase emulator, schema migrations, RLS testing, and database types generation. | Supabase backend operations, database migrations, and RLS policy management. |
| **`Bundlephobia`** | Global CLI | Package size analysis and dependency impact evaluation (`bundle-phobia-cli`). | Evaluating npm package weight and impact before adding dependencies. |
| **`Sentry`** | Global CLI & Service | Production error tracking, performance monitoring, and crash reporting (`@sentry/cli`). | Error debugging and production monitoring when credentials and DSN are configured. |

---

## D. UI/UX Development Rules

1. **Audit First**: Inspect the existing design system and styling tokens before introducing changes.
2. **Leverage Design Skills**: Combine `Impeccable` for craft audit/refinement and `ui-ux-pro-max` for design tokens and accessibility guidelines.
3. **Component Reusability**: Use `Watermelon UI` (`https://mcp.watermelon.sh/mcp`) to retrieve tested Radix/Tailwind component patterns before writing complex components from scratch.
4. **Accessibility (WCAG AA)**: Ensure minimum 4.5:1 color contrast, visible focus rings, 44×44px touch targets, and proper aria labels.
5. **Responsive & Fluid**: Support mobile, tablet, and desktop viewports seamlessly. Eliminate horizontal scrolling and Cumulative Layout Shift (CLS).
6. **Restraint in Motion**: Use purposeful, context-aware micro-interactions. Avoid overwhelming or gratuitous animations.
7. **No Template Replacement**: Never replace functional, branded pages with cookie-cutter generic templates.

---

## E. Code Quality Rules

1. **Apply `unslop` Standards**: Write mechanism-driven, clean, and concise code.
2. **Smallest Surgical Repair**: Touch only defective or feature-specific lines. Keep surrounding code, comments, assertions, and contracts byte-for-byte intact.
3. **No Boilerplate Fluff**: Eliminate generic conversational AI comments, throat-clearing, and redundant docstrings.
4. **Type Safety**: Avoid unnecessary `any` or loose type assertions. Define explicit TypeScript interfaces and types.
5. **DRY & Modular**: Eliminate duplicated logic and adhere to single-responsibility modules.
6. **Scanner Verification**: Run relevant syntax, type check (`tsc --noEmit`), and lint commands before concluding.

---

## F. SEO & Search Engine Optimization Rules

1. **Semantic HTML**: Maintain valid heading hierarchies (single `<h1>`, logical `<h2>`–`<h6>`) and descriptive alt tags on all media.
2. **Metadata Integrity**: Every public route must feature title, description, canonical link, and OpenGraph/Twitter card tags.
3. **Structured Data**: Implement valid Schema.org JSON-LD (e.g., Organization, Course, SoftwareApplication, WebSite).
4. **Robots & Sitemaps**: Maintain up-to-date `sitemap.xml` and `robots.txt` reflecting public vs. private routes.
5. **No Hallucinated Rankings**: Never fabricate SEO ranking success or claim search engine indexing without concrete search console evidence.

---

## G. Testing, Auditing & Quality Assurance

1. **Type Checking**: Run `npx tsc --noEmit` on every code modification.
2. **Unit / Integration Tests**: Run `npm test` (`vitest run`) to verify local logic.
3. **End-to-End Workflows**: Use Playwright (`npx playwright test`) for critical user paths (auth, tool usage, navigation).
4. **Quality Auditing**: Use Lighthouse (`lighthouse <url> --output=json`) to audit performance, accessibility, and SEO.
5. **Architectural Assessment**: Use Graphify (`/graphify query`) to examine dependency ripple effects during major refactoring.
6. **Dependency Weight**: Use Bundlephobia (`bundle-phobia <package>`) prior to adding third-party packages.
7. **Truth in Reporting**: Never report that a test or build passed unless it actually ran with an exit code of 0. Never equate a local build success to full production readiness.

---

## H. Git, Branching & Safety Rules

1. **Branch Awareness**: Verify the active branch (`git status`, `git branch --show-current`) before writing any code.
2. **Branch Protection**: Never switch branches or checkout a different branch without user consent.
3. **Respect Lovable Git Constraints**: This project syncs with Lovable.
   - **Never rewrite published Git history.**
   - **Never rebase, force-push (`git push -f`), or squash commits that have already been pushed.**
   - **Never merge into `main` without explicit approval.**
   - **Never create a Pull Request unless explicitly requested.**
4. **Atomic Commits**: Commit distinct, verified milestones using Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).

---

## I. Security & Compliance Rules

1. **Client-Side Secrets**: Never expose service role keys, private API keys, or database credentials in client code or `.env` files committed to Git.
2. **Supabase RLS**: All Supabase database tables must enforce Row Level Security (RLS) policies.
3. **Input Sanitization**: Validate all client inputs via Zod schemas and sanitize rich text / Markdown to prevent XSS.
4. **JWT & Session Security**: Validate authentication tokens server-side for all protected API routes and server functions.
5. **Security Non-Negotiable**: Never disable security measures, bypass permissions, or loosen RLS policies to make a feature work.

---

## J. Documentation & Knowledge Maintenance

1. **Maintain `skills.md`**: Tracks the external skills, plugins, CLI tools, and repositories configured in the environment.
2. **Maintain `instruction.md`**: Remains the permanent development policy and architectural rules document.
3. **Documentation on New Tools**: Whenever a new tool, skill, or service is added:
   - Update `skills.md` with repository, version, scope, commands, activation rules, and verification status.
   - Update `instruction.md` with relevant architectural guidelines and workflow responsibilities.

---

## K. Antigravity Execution Report Standard

Every development task must conclude with a comprehensive execution report formatted as follows:

```markdown
# 📋 Antigravity Execution Report

**Task**: [Task Name]
**Branch**: [Current Branch]
**Status**: [COMPLETED | PARTIALLY COMPLETED | FAILED | REQUIRES VERIFICATION | CONFIGURATION REQUIRED]

### 1. Executive Summary
[Brief high-level summary of what was accomplished]

### 2. Files Inspected
- `path/to/file`

### 3. Files Created or Modified
- `path/to/file`: [Specific changes made]

### 4. Architecture & Design Decisions
[Key technical and architectural decisions made]

### 5. Dependencies Installed or Removed
[Any package additions or removals with justification]

### 6. Features Implemented
[Detailed list of features and functional improvements]

### 7. Security Considerations
[RLS policies, input validation, secret hygiene, auth checks]

### 8. Verification & Tests Executed
- Type Check: [Result & Output]
- Test Suite: [Result & Output]
- Playwright / E2E: [Result & Output]
- Build Verification: [Result & Output]

### 9. Warnings & Unresolved Issues
[Any remaining warnings, risks, or edge cases]

### 10. Git Status & Commits
[Commit hashes, messages, and working tree state]

### 11. OUTSIDE MANUAL STEPS REQUIRED
[Detailed manual actions needed outside Antigravity]
```

---

## L. OUTSIDE MANUAL STEPS REQUIRED

When tasks involve external services, dashboards, or secret keys that cannot be completed within Antigravity, document them using this exact format:

1. **What to do**: Exact action required (e.g., generate API key, add DNS record).
2. **Where to do it**: Exact service, dashboard, or URL (e.g., Supabase Dashboard -> Authentication -> Providers).
3. **Exact configuration / value**: The specific key, setting, or configuration string.
4. **Why it is necessary**: Technical rationale for the requirement.
5. **How to verify**: Actionable steps to verify that the configuration is working.

