# Installed & Referenced Skills, Tools & Repositories

This document tracks all external skills, plugins, CLI tools, MCP integrations, and GitHub repositories installed, configured, or referenced in this project and environment.

---

## Skills & Tools Catalog

| Tool / Skill | Repository / Source | Type | Scope / Location | Purpose & Capabilities | Auto-Activation Trigger | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **unslop** | [OPSHARP/unslop](https://github.com/OPSHARP/unslop.git) | Agent Skill | Global (`~/.gemini/config/skills/unslop`) | AI text humanizer, fluff eliminator, and pattern auditor. | All software development tasks (coding, refactoring, debugging, docstrings, commits) | INSTALLED AND VERIFIED |
| **ui-ux-pro-max** | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git) | Agent Skill Suite | Global (`~/.gemini/config/skills/ui-ux-pro-max`) | UI/UX design intelligence: 79 styles, 192 palettes, 119 UX guidelines, WCAG AA standards. | UI/UX design, layouts, styling, responsive interfaces | INSTALLED AND VERIFIED |
| **claude-seo** | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo.git) | Agent Skill Suite | Global (`~/.gemini/config/skills/seo` & 26 subskills) | Enterprise SEO engine: technical audits, sitemaps, robots.txt, Schema.org JSON-LD, Core Web Vitals, GEO. | Public routes, landing pages, metadata, schema, sitemaps, indexing | INSTALLED AND VERIFIED |
| **skillx** | [nextlevelbuilder/skillx](https://github.com/nextlevelbuilder/skillx.git) | Agent Skill Suite | Global (`~/.gemini/config/skills/skillx`) | Universal AI skill search, vetting, and execution platform. | Skill creation, evaluation, and specialized skill management | INSTALLED AND VERIFIED |
| **agentic-awesome-skills** | [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills.git) | Agent Skill & Repo | Global (`~/.gemini/config/skills/agentic-awesome-skills`) | Offline library of 2,824+ specialized agent runbooks across tech stacks. | Specialized technical workflows, DevOps, third-party library integrations | INSTALLED AND VERIFIED |
| **Graphify** | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify.git) | Agent Skill & Tool | Global (`~/.gemini/config/skills/graphify`) | Codebase architecture intelligence, AST dependency mapping, topological clustering, `GRAPH_REPORT.md`. | Architecture analysis, dependency mapping, major refactoring | INSTALLED AND VERIFIED |
| **Impeccable** | [pbakaus/impeccable](https://github.com/pbakaus/impeccable.git) | Agent Skill | Global (`~/.gemini/config/skills/impeccable`) | Design craft director, UI audits, visual polishing, micro-interactions, `DESIGN.md`. | UI audits, visual refinement, accessibility, design planning | INSTALLED AND VERIFIED |
| **Watermelon UI** | [WatermelonCorp/watermelon-platform](https://github.com/WatermelonCorp/watermelon-platform.git) | Agent Skill & MCP | Global Skill (`~/.gemini/config/skills/watermelon-ui`) & MCP (`https://mcp.watermelon.sh/mcp`) | 800+ source-backed React, Radix UI, and Tailwind CSS components and blocks. | Component discovery, landing page blocks, reusable UI development | INSTALLED AND VERIFIED |
| **TypeScript** | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) | CLI & Language Compiler | Global CLI (`tsc`) & Project `devDependencies` | Static type checking, interface contracts, and compile-time validation. | Type-safe implementation, type checking (`tsc --noEmit`), build verification | INSTALLED AND VERIFIED |
| **Playwright** | [microsoft/playwright](https://github.com/microsoft/playwright) | CLI & E2E Test Suite | Global CLI (`playwright` v1.64.1) | Headless and visual browser automation, auth flows, and user journey testing. | Browser testing, user workflow verification, regression testing | INSTALLED AND VERIFIED |
| **Lighthouse** | [GoogleChrome/lighthouse](https://github.com/GoogleChrome/lighthouse) | CLI Audit Engine | Global CLI (`lighthouse` v13.6.0) | Auditing performance, accessibility, SEO, best practices, and Core Web Vitals. | Performance audits, SEO audits, accessibility compliance | INSTALLED AND VERIFIED |
| **Supabase CLI** | [supabase/cli](https://github.com/supabase/cli) | CLI Tool | Global CLI (`supabase` v3.0.0) | Local Supabase emulation, database migrations, RLS policy verification, type generation. | Supabase development, database migrations, RLS operations | INSTALLED AND VERIFIED |
| **Bundlephobia** | [pastelsky/bundle-phobia-cli](https://github.com/pastelsky/bundle-phobia-cli) | CLI Tool | Global CLI (`bundle-phobia` v0.15.0) | Inspecting npm dependency size, export weight, and tree-shaking characteristics. | Prior to introducing significant npm dependencies | INSTALLED AND VERIFIED |
| **Sentry CLI** | [getsentry/sentry-cli](https://github.com/getsentry/sentry-cli) | CLI & Monitoring Service | Global CLI (`sentry-cli` v3.8.2) | Production crash reporting, release tracking, sourcemaps upload, error diagnosis. | Production error investigation and monitoring (when credentials configured) | CONFIGURATION REQUIRED |

---

## Automatic Activation Directives (Global)

All tools and skills are configured to activate automatically based on intent and task domain without requiring manual invocation of slash commands:

1. **`unslop`**:
   - Automatically activates for all software development tasks.
   - Enforces surgical, smallest-repair edits; keeps existing code and types byte-for-byte intact.
   - Strips boilerplate fluff, empty commentary, and conversational AI filler from code and documentation.

2. **`ui-ux-pro-max`, `Impeccable`, & `Watermelon UI`**:
   - Automatically activate for any UI/UX or styling prompt (React components, Tailwind classes, colors, spacing, layout, fonts, animations, forms, mobile responsiveness, touch targets, accessibility).
   - Enforce WCAG AA contrast (≥ 4.5:1), visible focus rings, 44×44px touch targets, CLS prevention, and semantic tokens.
   - Retrieve tested component patterns from Watermelon UI MCP before writing complex components from scratch.

3. **`claude-seo` & `Lighthouse`**:
   - Automatically activate for SEO-sensitive code (meta headers, OpenGraph, Twitter cards, JSON-LD Schema markup, XML sitemaps, indexing directives, page performance).
   - Run technical audits and validate Core Web Vitals.

4. **`Graphify`**:
   - Automatically activates for codebase orientation, understanding relationships between modules, mapping god nodes, and evaluating refactoring impact across files.

5. **`TypeScript` (`tsc`)**:
   - Automatically validates types (`tsc --noEmit`) after all TypeScript modifications.

6. **`Supabase CLI`**:
   - Automatically activates when managing Supabase migrations, reviewing schema changes, or checking database policies.

7. **`Bundlephobia`**:
   - Automatically validates bundle weight before introducing external npm dependencies.

8. **`agentic-awesome-skills` & `skillx`**:
   - Automatically search and activate relevant domain runbooks from the local library of 2,824+ skills whenever a specialized procedure or third-party library recipe is needed.

---

## Detailed Tool & Skill Specifications

### 1. `unslop`
- **Repository**: [https://github.com/OPSHARP/unslop.git](https://github.com/OPSHARP/unslop.git) (v2.3.0)
- **Global Paths**: `~/.gemini/config/skills/unslop` and `~/.agents/skills/unslop`
- **Key Capabilities**: Phrase Layer (`banned_phrase_scan.py`), Structure Layer (`structure_scan.py`), Silhouette Layer (`silhouette_scan.py`).

### 2. `ui-ux-pro-max` Suite
- **Repository**: [https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git)
- **Repo Storage**: `C:\Users\91979\.gemini\config\repositories\ui-ux-pro-max-skill`
- **Installed Skills**: `ui-ux-pro-max`, `ui-styling`, `design`, `design-system`, `brand`, `banner-design`, `slides`.

### 3. `claude-seo` Suite
- **Repository**: [https://github.com/AgriciDaniel/claude-seo.git](https://github.com/AgriciDaniel/claude-seo.git) (v2.5.0)
- **Repo Storage**: `C:\Users\91979\.gemini\config\repositories\claude-seo`
- **Installed Skills**: `seo` (hub) and 26 specialized skills (`seo-audit`, `seo-technical`, `seo-schema`, `seo-sitemap`, `seo-geo`, etc.).

### 4. `skillx` Suite
- **Repository**: [https://github.com/nextlevelbuilder/skillx.git](https://github.com/nextlevelbuilder/skillx.git)
- **Repo Storage**: `C:\Users\91979\.gemini\config\repositories\skillx`
- **Installed Skills**: `skillx`, `skill-creator`, `marketing-mindset`, `hol-guard`.

### 5. `agentic-awesome-skills`
- **Repository**: [https://github.com/sickn33/agentic-awesome-skills.git](https://github.com/sickn33/agentic-awesome-skills.git)
- **Repo Storage**: `C:\Users\91979\.gemini\config\repositories\agentic-awesome-skills`
- **Catalog Size**: 2,824+ curated agent skills
- **Search Script**: `C:\Users\91979\.gemini\config\skills\agentic-awesome-skills\scripts\search_skills.py`

### 6. `Graphify`
- **Repository**: [https://github.com/Graphify-Labs/graphify.git](https://github.com/Graphify-Labs/graphify.git)
- **Scope**: Global Skill (`~/.gemini/config/skills/graphify`) & CLI
- **Capabilities**: Tree-sitter AST parsing, Leiden clustering, god node detection, BFS/DFS traversal, `GRAPH_REPORT.md`, `graph.json`, and interactive visualizer.

### 7. `Impeccable`
- **Repository**: [https://github.com/pbakaus/impeccable.git](https://github.com/pbakaus/impeccable.git) (v4.8.0)
- **Scope**: Global Skill (`~/.gemini/config/skills/impeccable`)
- **Capabilities**: Visual critique, craft floor checks, accessibility audits, anti-pattern detection, design system generation (`DESIGN.md`).

### 8. `Watermelon UI`
- **Repository**: [https://github.com/WatermelonCorp/watermelon-platform.git](https://github.com/WatermelonCorp/watermelon-platform.git)
- **Scope**: Global Skill (`~/.gemini/config/skills/watermelon-ui`) & MCP Server
- **MCP Endpoint**: `https://mcp.watermelon.sh/mcp` (Streamable HTTP in `~/.gemini/config/mcp_config.json`)
- **Capabilities**: Source-backed search and retrieval of Radix UI, Tailwind CSS, and shadcn-compatible components, interactive blocks, and templates.

### 9. `TypeScript`
- **Package**: `typescript` (v5.8.3 local, v5.9+ global)
- **Scope**: Global CLI (`tsc`) & Project `devDependencies`
- **Verification**: `tsc -v` -> Operational.

### 10. `Playwright`
- **Package**: `playwright`, `@playwright/test` (v1.64.1)
- **Scope**: Global CLI (`playwright`)
- **Verification**: `playwright -V` -> Version 1.64.1.

### 11. `Lighthouse`
- **Package**: `lighthouse` (v13.6.0)
- **Scope**: Global CLI (`lighthouse`)
- **Verification**: `lighthouse --version` -> 13.6.0.

### 12. `Supabase CLI`
- **Package**: `supabase` (v3.0.0)
- **Scope**: Global CLI (`supabase`)
- **Verification**: `supabase -v` -> 3.0.0.

### 13. `Bundlephobia`
- **Package**: `bundle-phobia-cli` (v0.15.0)
- **Scope**: Global CLI (`bundle-phobia`)
- **Verification**: Executed successfully against local dependencies.

### 14. `Sentry CLI`
- **Package**: `@sentry/cli` (v3.8.2)
- **Scope**: Global CLI (`sentry-cli`)
- **Verification**: `sentry-cli -V` -> sentry-cli 3.8.2.
- **External Configuration Required**: Sentry DSN, Auth Token, Organization, and Project Slugs for live production error streaming.
