/** Public site navigation — hash targets map to homepage section IDs. */
export const HOME_SECTIONS = ["top", "lanes", "how", "preview"] as const;
export type HomeSectionId = (typeof HOME_SECTIONS)[number];

export const PUBLIC_NAV_LINKS = [
  { name: "For you", href: "#top", sectionId: "top" as const },
  { name: "How it works", href: "#lanes", sectionId: "lanes" as const },
  { name: "Platform", href: "#how", sectionId: "how" as const },
  { name: "Products", href: "#preview", sectionId: "preview" as const },
  {
    name: "Projects",
    href: "/projects",
    isRoute: true as const,
    matchPath: "/projects",
  },
] as const;

export const PUBLIC_EXPLORE_LINKS = [
  { name: "For you", href: "/#top", sectionId: "top" as const },
  { name: "How it works", href: "/#lanes", sectionId: "lanes" as const },
  { name: "Platform", href: "/#how", sectionId: "how" as const },
  { name: "Products", href: "/#preview", sectionId: "preview" as const },
  {
    name: "Projects",
    href: "/projects",
    isRoute: true as const,
    matchPath: "/projects",
  },
] as const;

export const SCROLL_SPY_OFFSET = 120;
