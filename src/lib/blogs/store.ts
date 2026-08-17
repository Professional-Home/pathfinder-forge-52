import { supabase } from "@/utils/supabase";
import type { BlogPost, BlogFormData } from "./types";

const STORAGE_KEY = "micrylis-blog-posts";

export const INITIAL_BLOG_POSTS: BlogPost[] = [
  {
    id: "blog-1",
    slug: "ai-in-drug-discovery-2026",
    title: "How AI is Revolutionizing Modern Drug Discovery",
    excerpt: "Explore how machine learning algorithms and molecular dynamics simulations are shrinking drug design timelines from years to months.",
    content: `
# How AI is Revolutionizing Modern Drug Discovery

The landscape of pharmaceutical research is undergoing a seismic shift. For decades, discovering a single new therapeutic drug took upwards of **10 to 15 years** and cost over **$2 billion**. Today, artificial intelligence is rewriting those rules.

---

## 1. De Novo Molecular Design
Traditional high-throughput screening tests millions of known chemical compounds against target proteins. AI generative models, such as variational autoencoders (VAEs) and generative adversarial networks (GANs), take a fundamentally different approach: **they generate brand-new molecular structures from scratch** designed specifically to bind to target active sites.

### Key Advantages:
* **Target Specificity:** Reduces off-target toxicity early in lead optimization.
* **Property Optimization:** Simultaneously optimizes binding affinity, solubility, and bioavailability.

---

## 2. Predicting Protein Structures
With breakthroughs like AlphaFold and ESMFold, researchers can now predict 3D protein structures with atomic accuracy in seconds. This has unlocked thousands of previously "undruggable" disease targets in oncology, neurology, and rare genetic disorders.

---

## 3. What This Means for Future Bio-Scientists
Students and researchers equipped with computational biology skills and machine learning expertise are positioned at the forefront of modern medicine. Learning Python, PyTorch, and molecular docking frameworks is becoming as fundamental to biology as pipetting.
    `,
    coverImage: "/Photos/ai-drug-discovery-hero.jpg",
    category: "Drug Discovery",
    author: "Dr. Elena Rostova",
    readTime: "6 min read",
    status: "published",
    featured: true,
    createdAt: "2026-08-01T10:00:00Z",
    updatedAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "blog-2",
    slug: "bioplastics-sustainable-future",
    title: "Innovations in Bioplastics and Sustainable Biomaterials",
    excerpt: "How microbial fermentation and algae-based polymers are creating biodegradable alternatives to single-use petroleum plastics.",
    content: `
# Innovations in Bioplastics and Sustainable Biomaterials

Petroleum-derived plastics pose one of the greatest environmental challenges of our generation. Biotechnology offers a natural, circular solution: **bioplastics engineered from renewable biological sources**.

---

## Microbial Polyhydroxyalkanoates (PHAs)
Certain bacterial strains naturally synthesize PHAs as energy storage granules when grown under nutrient-limited conditions. When extracted, these polymers exhibit mechanical properties remarkably similar to polypropylene, yet **completely biodegrade in soil or marine environments within months**.

---

## Algae-Based Biopolymers
Macroalgae (seaweed) grows rapidly without requiring freshwater or synthetic fertilizers. Extracting alginate and carrageenan yields edible, transparent packaging films ideal for single-use food wraps and bio-based cutlery.

---

## The Path to Industrial Scale
Scaling up upstream fermentation and downstream extraction remains the central challenge for synthetic biologists. Innovations in bioreactor automation and genetic strain engineering are rapidly driving down production costs.
    `,
    coverImage: "/Photos/bioplastic-hero.jpg",
    category: "Biotechnology",
    author: "Prof. Marcus Vance",
    readTime: "5 min read",
    status: "published",
    featured: false,
    createdAt: "2026-08-05T12:00:00Z",
    updatedAt: "2026-08-05T12:00:00Z",
  },
  {
    id: "blog-3",
    slug: "securing-biotech-research-internships",
    title: "A Student’s Guide to Securing Top Biotech Research Fellowships",
    excerpt: "Step-by-step strategies for undergraduates to build a standout research portfolio and connect with leading mentors.",
    content: `
# A Student’s Guide to Securing Top Biotech Research Fellowships

Landing your first competitive research internship or lab position can feel daunting. Here is a practical roadmap to stand out to principal investigators and lab directors.

---

## 1. Focus on Practical Project Proof
Instead of listing textbook knowledge on your CV, highlight **hands-on projects**. PIs want to see that you understand wet-lab protocols or dry-lab bioinformatics tools (like BLAST, AutoDock, PyMOL, and R/Bioconductor).

---

## 2. Craft Personalized Cold Emails
Generic template emails get ignored. When reaching out to researchers:
* Read 1-2 of their recent publications.
* Specificity matters: Mention a specific figure or hypothesis from their paper.
* State clearly what skills you bring (e.g. PCR experience, Python data analysis).

---

## 3. Leverage Mentorship Networks
Joining structured mentorship initiatives like Micrylis Biotech gives you direct access to experienced researchers who can review your proposal, refine your CV, and introduce you to institutional opportunities.
    `,
    coverImage: "/Photos/ai-drug-discovery-card.jpg",
    category: "Careers & Research",
    author: "Sarah Lin, M.Sc.",
    readTime: "4 min read",
    status: "published",
    featured: false,
    createdAt: "2026-08-10T14:30:00Z",
    updatedAt: "2026-08-10T14:30:00Z",
  },
];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function readLocalBlogs(): BlogPost[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export function writeLocalBlogs(blogs: BlogPost[]) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blogs));
  } catch (err) {
    console.error("[Blog Store] Error writing to localStorage:", err);
  }
}

function mapDbToBlog(db: any): BlogPost {
  return {
    id: String(db.id || db.slug),
    slug: db.slug || "post-slug",
    title: db.title || "Untitled Article",
    excerpt: db.excerpt || "",
    content: db.content || "",
    coverImage: db.cover_image || db.coverImage || "/Photos/ai-drug-discovery-hero.jpg",
    category: db.category || "Biotechnology",
    author: db.author || "Micrylis Biotech Team",
    readTime: db.read_time || db.readTime || "5 min read",
    status: db.status || "published",
    featured: db.featured ?? false,
    createdAt: db.created_at || new Date().toISOString(),
    updatedAt: db.updated_at || new Date().toISOString(),
  };
}

export async function fetchBlogs(includeDrafts = false): Promise<BlogPost[]> {
  try {
    let query = supabase.from("blogs").select("*").order("created_at", { ascending: false });
    if (!includeDrafts) {
      query = query.eq("status", "published");
    }

    const { data, error } = await query;
    if (!error && data) {
      const blogs = data.map(mapDbToBlog);
      writeLocalBlogs(blogs);
      return blogs;
    }
  } catch (e) {
    console.warn("[Blog Store] Fetch error from Supabase, using local fallback:", e);
  }

  const local = readLocalBlogs();
  return includeDrafts ? local : local.filter((b) => b.status === "published");
}

export async function fetchBlogBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const { data, error } = await supabase
      .from("blogs")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (!error && data) {
      return mapDbToBlog(data);
    }
  } catch (e) {
    console.warn("[Blog Store] Error fetching blog by slug:", e);
  }

  const local = readLocalBlogs();
  return local.find((b) => b.slug === slug) || null;
}

export async function saveBlog(data: BlogFormData, existingId?: string): Promise<BlogPost> {
  const local = readLocalBlogs();
  const now = new Date().toISOString();
  const id = existingId || `blog-${Date.now()}`;

  const blogRecord: BlogPost = {
    id,
    slug: data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: data.title,
    excerpt: data.excerpt,
    content: data.content,
    coverImage: data.coverImage || "/Photos/ai-drug-discovery-hero.jpg",
    category: data.category || "Biotechnology",
    author: data.author || "Micrylis Biotech Team",
    readTime: data.readTime || "5 min read",
    status: data.status,
    featured: data.featured,
    createdAt: now,
    updatedAt: now,
  };

  // Update local cache
  const idx = local.findIndex((b) => b.id === id || b.slug === blogRecord.slug);
  if (idx >= 0) {
    local[idx] = { ...local[idx], ...blogRecord, updatedAt: now };
  } else {
    local.unshift(blogRecord);
  }
  writeLocalBlogs(local);

  // Sync to Supabase
  try {
    await supabase.from("blogs").upsert(
      {
        slug: blogRecord.slug,
        title: blogRecord.title,
        excerpt: blogRecord.excerpt,
        content: blogRecord.content,
        cover_image: blogRecord.coverImage,
        category: blogRecord.category,
        author: blogRecord.author,
        read_time: blogRecord.readTime,
        status: blogRecord.status,
        featured: blogRecord.featured,
        updated_at: now,
      },
      { onConflict: "slug" }
    );
  } catch (err) {
    console.error("[Blog Store] Supabase sync failed:", err);
  }

  return blogRecord;
}

export function clearLocalBlogs() {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
}

export async function deleteBlog(idOrSlug: string): Promise<boolean> {
  let local = readLocalBlogs();
  const target = local.find((b) => b.id === idOrSlug || b.slug === idOrSlug);
  
  local = local.filter((b) => b.id !== idOrSlug && b.slug !== idOrSlug);
  writeLocalBlogs(local);

  try {
    if (target) {
      await supabase.from("blogs").delete().or(`id.eq.${idOrSlug},slug.eq.${target.slug}`);
    } else {
      await supabase.from("blogs").delete().eq("id", idOrSlug);
    }
  } catch (err) {
    console.error("[Blog Store] Supabase delete error:", err);
  }

  return true;
}
