/** Public site navigation — simplified to Home, About Us, Projects, Blog. */
export const HOME_SECTIONS = ["top"] as const;
export type HomeSectionId = (typeof HOME_SECTIONS)[number];

export const PUBLIC_NAV_LINKS = [
  { name: "Home", href: "/", isRoute: true as const, matchPath: "/" },
  { name: "About Us", href: "/about", isRoute: true as const, matchPath: "/about" },
  {
    name: "Projects",
    href: "/projects",
    isRoute: true as const,
    matchPath: "/projects",
  },
  { name: "Webinar", href: "/webinars", isRoute: true as const, matchPath: "/webinars" },
  { name: "Blog", href: "/blog", isRoute: true as const, matchPath: "/blog" },
] as const;

export const PUBLIC_EXPLORE_LINKS = [
  { name: "Home", href: "/", isRoute: true as const, matchPath: "/" },
  { name: "About Us", href: "/about", isRoute: true as const, matchPath: "/about" },
  {
    name: "Projects",
    href: "/projects",
    isRoute: true as const,
    matchPath: "/projects",
  },
  { name: "Webinar", href: "/webinars", isRoute: true as const, matchPath: "/webinars" },
  { name: "Blog", href: "/blog", isRoute: true as const, matchPath: "/blog" },
] as const;

export const SCROLL_SPY_OFFSET = 120;
