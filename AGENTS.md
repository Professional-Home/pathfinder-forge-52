<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Development Standards & Automatic Tool Activation
Automatically activate globally installed skills and tools when relevant to tasks, without requiring explicit skill names or slash commands:

1. **Code Quality & Precision (`unslop`, `TypeScript`)**: Apply smallest surgical repair, keep surrounding code byte-for-byte intact, validate types via `tsc --noEmit`, and keep comments and commit messages concrete, factual, and free of conversational AI filler.
2. **UI/UX Design Intelligence (`ui-ux-pro-max`, `Impeccable`, `Watermelon UI`)**: Apply WCAG AA accessibility (≥ 4.5:1 contrast, 44×44px touch targets), cohesive design tokens, responsive layouts, motion restraint, and source-backed reusable Radix/Tailwind components.
3. **SEO & Discoverability (`claude-seo`, `Lighthouse`)**: Ensure semantic HTML, meta OpenGraph tags, JSON-LD Schema markup, Core Web Vitals optimizations, and AI discoverability.
4. **Architecture & Dependency Mapping (`Graphify`)**: Query codebase dependency graphs before major structural refactoring.
5. **Backend & Supabase Operations (`Supabase CLI`)**: Manage database migrations, local testing, and RLS policy verification.
6. **Package Decisions (`Bundlephobia`)**: Verify bundle weight and tree-shaking before adding new dependencies.
7. **Specialized Skills & Runbooks (`agentic-awesome-skills`, `skillx`)**: Leverage tested domain runbooks from the global library when addressing specialized architectural or third-party integrations.
8. **Permanent Reference**: Always consult and follow [`instruction.md`](./instruction.md) and [`skills.md`](./skills.md) at the repository root.
