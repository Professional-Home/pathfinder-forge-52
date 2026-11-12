/**
 * generate-sitemap.mjs
 * 
 * Dynamic sitemap.xml generator for Micrylis Biotech (Vite + TanStack Start).
 * 
 * Features:
 * - Dynamic domain detection (localhost, Vercel preview, Vercel production, custom domain)
 * - Static public routes from routeTree.gen.ts
 * - Dynamic routes from Supabase (blogs, courses, opportunities, events)
 * - Robots.txt generation with sitemap reference
 * - Runs as postbuild step via `npm run build`
 * 
 * Usage:
 *   node scripts/generate-sitemap.mjs
 *   # Or automatically via npm run build (postbuild hook)
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/**
 * Resolve the canonical site URL with dynamic domain detection.
 * 
 * Priority:
 *  1. VITE_SITE_URL environment variable (explicitly set in .env / Vercel)
 *  2. VERCEL_URL (auto-set by Vercel for preview and production deployments)
 *  3. Default to localhost:8080 (project's dev server port)
 * 
 * Never hardcodes a domain. Never forces localhost in production.
 */
function getSiteUrl() {
  const explicit = process.env.VITE_SITE_URL;
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return 'http://localhost:8080';
}

/**
 * Escape XML special characters.
 */
function xmlEscape(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Normalize a URL path: ensure leading slash, remove trailing slash.
 */
function normalizePath(path) {
  let p = path.startsWith('/') ? path : `/${path}`;
  p = p.replace(/\/+$/, '') || '/';
  return p;
}

/**
 * Build a sitemap URL entry.
 */
function buildUrlEntry(loc, { lastmod, changefreq, priority }) {
  const lines = [`  <url>`, `    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) lines.push(`    <lastmod>${xmlEscape(lastmod)}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${xmlEscape(changefreq)}</changefreq>`);
  if (priority !== undefined) lines.push(`    <priority>${priority.toFixed(1)}</priority>`);
  lines.push(`  </url>`);
  return lines.join('\n');
}

/**
 * Static public routes (non-dynamic, always included).
 * Excludes: /admin/*, /login, /signup, /reset-password, /auth/callback,
 *           /dashboard/*, /onboarding
 */
const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/about', changefreq: 'monthly', priority: 0.8 },
  { path: '/projects', changefreq: 'weekly', priority: 0.9 },
  { path: '/community', changefreq: 'weekly', priority: 0.8 },
  { path: '/community/competitions', changefreq: 'monthly', priority: 0.7 },
  { path: '/community/conferences', changefreq: 'monthly', priority: 0.7 },
  { path: '/community/events', changefreq: 'monthly', priority: 0.7 },
  { path: '/community/national-bio-challenge', changefreq: 'monthly', priority: 0.7 },
  { path: '/community/webinars', changefreq: 'monthly', priority: 0.7 },
  { path: '/community/workshops', changefreq: 'monthly', priority: 0.7 },
  { path: '/blog', changefreq: 'weekly', priority: 0.9 },
  { path: '/opportunities', changefreq: 'weekly', priority: 0.9 },
  { path: '/courses', changefreq: 'weekly', priority: 0.9 },
  { path: '/events', changefreq: 'monthly', priority: 0.8 },
  { path: '/tools/colony-counter', changefreq: 'monthly', priority: 0.6 },
  { path: '/webinars', changefreq: 'monthly', priority: 0.7 },
  { path: '/webinar', changefreq: 'monthly', priority: 0.6 },
  { path: '/ielts', changefreq: 'weekly', priority: 0.8 },
  { path: '/spin', changefreq: 'monthly', priority: 0.5 },
  { path: '/disclaimer', changefreq: 'yearly', priority: 0.3 },
  { path: '/employees', changefreq: 'monthly', priority: 0.4 },
  { path: '/privacy-policy', changefreq: 'yearly', priority: 0.3 },
  { path: '/refund-policy', changefreq: 'yearly', priority: 0.3 },
  { path: '/return-policy', changefreq: 'yearly', priority: 0.3 },
];

// Routes that are private/admin/auth — never included
const EXCLUDED_PATH_PREFIXES = [
  '/admin',
  '/dashboard',
  '/login',
  '/signup',
  '/reset-password',
  '/auth/callback',
  '/onboarding',
];

function isExcluded(path) {
  return EXCLUDED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}

/**
 * Fetch published blog posts from Supabase with local fallback.
 * Returns array of { slug, updatedAt }.
 */
async function fetchPublishedBlogs(supabase) {
  try {
    const { data, error } = await supabase
      .from('blogs')
      .select('slug, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      return data.map((b) => ({
        slug: b.slug,
        updatedAt: b.updated_at || new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.warn('[Sitemap] Supabase blogs fetch failed:', err.message);
  }

  // Fallback: seed data from blogs/store.ts
  const seedBlogs = [
    { slug: 'ai-in-drug-discovery-2026', updatedAt: '2026-08-01T10:00:00Z' },
    { slug: 'bioplastics-sustainable-future', updatedAt: '2026-08-05T12:00:00Z' },
    { slug: 'securing-biotech-research-internships', updatedAt: '2026-08-10T14:30:00Z' },
  ];
  return seedBlogs;
}

/**
 * Fetch published courses from Supabase with local fallback.
 * Returns array of { slug, updatedAt }.
 */
async function fetchPublishedCourses(supabase) {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('slug, updated_at')
      .or("status.eq.published,status.is.null")
      .order('updated_at', { ascending: false });

    if (!error && data) {
      return data.map((c) => ({
        slug: c.slug,
        updatedAt: c.updated_at || new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.warn('[Sitemap] Supabase courses fetch failed:', err.message);
  }

  // Fallback: known published course slugs from seed data
  const seedCourses = [
    { slug: 'bioplastic-innovation', updatedAt: new Date().toISOString() },
    { slug: 'ai-in-drug-discovery', updatedAt: new Date().toISOString() },
    { slug: 'bioinformatics', updatedAt: new Date().toISOString() },
  ];
  return seedCourses;
}

/**
 * Fetch published opportunities from Supabase with fallback.
 * Returns array of { slug, updatedAt }.
 */
async function fetchPublishedOpportunities(supabase) {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select('slug, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      return data.map((o) => ({
        slug: o.slug,
        updatedAt: o.updated_at || new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.warn('[Sitemap] Supabase opportunities fetch failed:', err.message);
  }

  return [];
}

/**
 * Fetch published events from Supabase with fallback.
 * Returns array of { id, updatedAt }.
 */
async function fetchPublishedEvents(supabase) {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      return data.map((e) => ({
        id: String(e.id),
        updatedAt: e.updated_at || new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.warn('[Sitemap] Supabase events fetch failed:', err.message);
  }

  return [];
}

/**
 * Generate the XML sitemap string.
 */
function generateSitemapXml(urlEntries) {
  // Deduplicate by URL path
  const seen = new Set();
  const unique = urlEntries.filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });

  // Sort: static root first, then alphabetical for stability
  unique.sort((a, b) => {
    if (a.path === '/') return -1;
    if (b.path === '/') return 1;
    return a.path.localeCompare(b.path);
  });

  const urlLines = unique.map((entry) => buildUrlEntry(entry.loc, entry));

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urlLines.join('\n')}
</urlset>
`;
}

/**
 * Generate robots.txt content with dynamic sitemap reference.
 */
function generateRobotsTxt(siteUrl) {
  return `# Micrylis Biotech - robots.txt
# Generated automatically. Do not edit manually.

User-agent: *
Allow: /

# Disallow private and admin areas
Disallow: /admin/
Disallow: /dashboard/
Disallow: /login
Disallow: /signup
Disallow: /reset-password
Disallow: /auth/callback
Disallow: /onboarding

# Sitemap location (dynamic domain)
Sitemap: ${siteUrl}/sitemap.xml
`;
}

/**
 * Main entry point.
 */
async function main() {
  const siteUrl = getSiteUrl();
  console.log(`[Sitemap] Generating sitemap for domain: ${siteUrl}`);

  // Initialize Supabase client for server-side fetching (using service role key)
  let supabase = null;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    try {
      supabase = createClient(supabaseUrl, serviceRoleKey);
      console.log('[Sitemap] Supabase client initialized for dynamic content fetching.');
    } catch (err) {
      console.warn('[Sitemap] Failed to initialize Supabase client:', err.message);
    }
  } else {
    console.warn('[Sitemap] Supabase credentials not found. Using static routes and seed data only.');
  }

  // Fetch dynamic content
  const [blogs, courses, opportunities, events] = await Promise.all([
    supabase ? fetchPublishedBlogs(supabase) : [],
    supabase ? fetchPublishedCourses(supabase) : [],
    supabase ? fetchPublishedOpportunities(supabase) : [],
    supabase ? fetchPublishedEvents(supabase) : [],
  ]);

  console.log(`[Sitemap] Fetched ${blogs.length} blogs, ${courses.length} courses, ${opportunities.length} opportunities, ${events.length} events.`);

  // Build URL entries
  const entries = [];

  // Static routes
  for (const route of STATIC_ROUTES) {
    if (isExcluded(route.path)) continue;
    entries.push({
      path: route.path,
      loc: `${siteUrl}${route.path}`,
      lastmod: new Date().toISOString(),
      changefreq: route.changefreq,
      priority: route.priority,
    });
  }

  // Dynamic blog posts: /blog/$slug
  for (const blog of blogs) {
    const path = `/blog/${blog.slug}`;
    if (isExcluded(path)) continue;
    entries.push({
      path,
      loc: `${siteUrl}${path}`,
      lastmod: blog.updatedAt,
      changefreq: 'monthly',
      priority: 0.7,
    });
  }

  // Dynamic courses: /courses/$slug
  for (const course of courses) {
    const path = `/courses/${course.slug}`;
    if (isExcluded(path)) continue;
    entries.push({
      path,
      loc: `${siteUrl}${path}`,
      lastmod: course.updatedAt,
      changefreq: 'monthly',
      priority: 0.8,
    });
  }

  // Dynamic opportunities: /opportunities/$slug
  for (const opp of opportunities) {
    const path = `/opportunities/${opp.slug}`;
    if (isExcluded(path)) continue;
    entries.push({
      path,
      loc: `${siteUrl}${path}`,
      lastmod: opp.updatedAt,
      changefreq: 'monthly',
      priority: 0.7,
    });
  }

  // Dynamic events: /events/$id
  for (const event of events) {
    const path = `/events/${event.id}`;
    if (isExcluded(path)) continue;
    entries.push({
      path,
      loc: `${siteUrl}${path}`,
      lastmod: event.updatedAt,
      changefreq: 'monthly',
      priority: 0.6,
    });
  }

  // Generate XML
  const xml = generateSitemapXml(entries);

  // Write sitemap.xml to public/
  const publicDir = 'public';
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }
  writeFileSync(`${publicDir}/sitemap.xml`, xml, 'utf8');

  // Generate and write robots.txt
  const robotsTxt = generateRobotsTxt(siteUrl);
  writeFileSync(`${publicDir}/robots.txt`, robotsTxt, 'utf8');

  console.log(`[Sitemap] Generated ${entries.length} URL entries.`);
  console.log(`[Sitemap] Written to ${publicDir}/sitemap.xml`);
  console.log(`[Sitemap] Written to ${publicDir}/robots.txt`);
  console.log(`[Sitemap] Site URL: ${siteUrl}`);
}

main().catch((err) => {
  console.error('[Sitemap] Fatal error:', err);
  process.exit(1);
});
