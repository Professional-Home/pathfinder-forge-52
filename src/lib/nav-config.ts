/** Public site navigation — Home, About, Projects, Community, Opportunities, Blog */
export const HOME_SECTIONS = ["top"] as const;
export type HomeSectionId = (typeof HOME_SECTIONS)[number];

export interface SubNavItem {
  name: string;
  href: string;
  description?: string;
  badge?: string;
}

export const COMMUNITY_DROPDOWN_ITEMS: SubNavItem[] = [
  {
    name: "Webinars",
    href: "/webinars",
    description: "Interactive masterclasses & research sessions",
  },
  {
    name: "National Bio Challenge",
    href: "/community/national-bio-challenge",
    description: "Annual nationwide biotechnology championship",
    badge: "Flagship",
  },
  {
    name: "Events",
    href: "/events",
    description: "Academic symposiums, panels & workshops",
  },
  {
    name: "Competitions",
    href: "/community/competitions",
    description: "Hackathons & scientific pitch contests",
  },
  {
    name: "Workshops",
    href: "/community/workshops",
    description: "Hands-on Nextflow, AlphaFold & lab bootcamps",
  },
  {
    name: "Conferences / Meetups",
    href: "/community/conferences",
    description: "Regional student hubs & virtual meetups",
  },
];

export const OPPORTUNITIES_DROPDOWN_ITEMS: SubNavItem[] = [
  {
    name: "Internships",
    href: "/opportunities?category=Internships",
    description: "Hands-on research & industry developer internships",
  },
  {
    name: "Research Opportunities",
    href: "/opportunities?category=Research Opportunities",
    description: "Computational genomics & wet lab research projects",
  },
];

export const PUBLIC_NAV_LINKS = [
  { name: "Home", href: "/", isRoute: true as const, matchPath: "/" },
  { name: "About", href: "/about", isRoute: true as const, matchPath: "/about" },
  { name: "Projects", href: "/projects", isRoute: true as const, matchPath: "/projects" },
  {
    name: "Community",
    href: "/community",
    isRoute: true as const,
    matchPath: "/community",
    isDropdown: true as const,
    items: COMMUNITY_DROPDOWN_ITEMS,
  },
  {
    name: "Opportunities",
    href: "/opportunities",
    isRoute: true as const,
    matchPath: "/opportunities",
    isDropdown: true as const,
    items: OPPORTUNITIES_DROPDOWN_ITEMS,
  },
  { name: "Blog", href: "/blog", isRoute: true as const, matchPath: "/blog" },
] as const;

export const SCROLL_SPY_OFFSET = 120;
