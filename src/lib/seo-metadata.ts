/**
 * Centralized SEO Metadata & Canonical URL Utility for Micrylis Biotech
 *
 * Provides standard, framework-compliant head configuration for TanStack Start & TanStack Router.
 * Generates valid standard HTML <title> elements, meta descriptions, canonical URLs,
 * OpenGraph, Twitter Cards, and robots directives.
 */

export const PRODUCTION_DOMAIN = "https://project.micrylisbiotech.com";
export const DEFAULT_OG_IMAGE = `${PRODUCTION_DOMAIN}/logo.png`;

export interface SeoMetadataOptions {
  /** Full, professional page title */
  title: string;
  /** Accurate, concise description for search snippets */
  description: string;
  /** Canonical path relative to domain root, e.g. "/", "/about", "/projects/bioplastic-innovation" */
  path?: string;
  /** Custom Open Graph image URL (absolute or root-relative) */
  ogImage?: string;
  /** Open Graph type: defaults to "website", or "article" for blog posts */
  ogType?: "website" | "article";
  /** When true, emits "noindex, nofollow" and omits canonical link */
  noIndex?: boolean;
}

export interface MetaTag {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
  charSet?: string;
  httpEquiv?: string;
  [key: string]: unknown;
}

export interface LinkTag {
  rel: string;
  href: string;
  [key: string]: unknown;
}

/**
 * Builds an absolute canonical URL on the production domain.
 * Strips query parameters, trailing slashes (except root), and hash fragments.
 */
export function buildCanonicalUrl(path?: string): string {
  if (!path || path === "/" || path === "") {
    return PRODUCTION_DOMAIN;
  }
  const cleanPath = path.split("?")[0].split("#")[0];
  const normalized = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  return `${PRODUCTION_DOMAIN}${normalized.replace(/\/$/, "")}`;
}

/**
 * Resolves an absolute image URL for Open Graph and Twitter Card tags.
 */
export function buildAbsoluteImageUrl(image?: string): string {
  if (!image) return DEFAULT_OG_IMAGE;
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  const clean = image.startsWith("/") ? image : `/${image}`;
  return `${PRODUCTION_DOMAIN}${clean}`;
}

/**
 * Creates head configuration compatible with TanStack Router route head functions.
 * Emits { title } which TanStack Router transforms into a real <title> tag.
 */
export function createSeoHead({
  title,
  description,
  path,
  ogImage,
  ogType = "website",
  noIndex = false,
}: SeoMetadataOptions): { meta: MetaTag[]; links: LinkTag[] } {
  const canonicalUrl = buildCanonicalUrl(path);
  const absoluteImage = buildAbsoluteImageUrl(ogImage);

  const meta: MetaTag[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: ogType },
    { property: "og:image", content: absoluteImage },
    { property: "og:image:alt", content: title },
    { property: "og:site_name", content: "Micrylis Biotech" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: absoluteImage },
  ];

  if (noIndex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  } else {
    meta.push({ property: "og:url", content: canonicalUrl });
  }

  const links: LinkTag[] = [];
  if (!noIndex && path !== undefined) {
    links.push({ rel: "canonical", href: canonicalUrl });
  }

  return { meta, links };
}
