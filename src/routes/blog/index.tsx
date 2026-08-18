import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BookOpen, Calendar, Clock, Search, User, ArrowRight, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchBlogs } from "@/lib/blogs/store";
import { getOptimizedImageUrl } from "@/utils/cloudinary";

export const Route = createFileRoute("/blog/")({
  component: PublicBlogPage,
  head: () => ({
    meta: [
      { title: "Biotech Blog & Insights — Micrylis Biotech" },
      {
        name: "description",
        content: "Explore the latest insights, research trends, and career guides in Biotechnology, AI Drug Discovery, and Life Sciences.",
      },
    ],
  }),
});

function PublicBlogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: blogs = [], isLoading } = useQuery({
    queryKey: ["public-blogs"],
    queryFn: () => fetchBlogs(false),
    staleTime: 1000 * 60 * 5,
  });

  const categories = useMemo(() => {
    const set = new Set(blogs.map((b) => b.category));
    return ["All", ...Array.from(set)];
  }, [blogs]);

  const filteredBlogs = useMemo(() => {
    return blogs.filter((post) => {
      const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [blogs, selectedCategory, searchQuery]);

  const featuredPost = useMemo(() => {
    return blogs.find((b) => b.featured) || blogs[0];
  }, [blogs]);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background pt-28 pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          
          {/* Header Banner */}
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Micrylis Insights</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              Biotech Research & Career Insights
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Discover articles on AI drug discovery, bioplastics, career mentorship, and breakthrough research in life sciences.
            </p>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10 pb-6 border-b border-border">
            {/* Categories */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                    selectedCategory === cat
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-surface-elevated text-muted-foreground hover:bg-accent hover:text-foreground border border-border"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-border bg-surface-elevated pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 py-12">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-80 rounded-xl border border-border bg-surface-elevated animate-pulse" />
              ))}
            </div>
          ) : filteredBlogs.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold">No articles found</h3>
              <p className="text-xs text-muted-foreground">Try adjusting your search query or category filter.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {/* Featured Hero Banner if available and no filter applied */}
              {featuredPost && selectedCategory === "All" && !searchQuery && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-md grid md:grid-cols-12 gap-0"
                >
                  <div className="md:col-span-7 aspect-[16/10] md:aspect-auto overflow-hidden relative">
                    <img
                      src={getOptimizedImageUrl(featuredPost.coverImage, { width: 800, height: 500 })}
                      alt={featuredPost.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden" />
                  </div>
                  <div className="md:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                          Featured
                        </span>
                        <span className="text-xs text-muted-foreground">{featuredPost.category}</span>
                      </div>
                      <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-snug">
                        <Link to="/blog/$slug" params={{ slug: featuredPost.slug }} className="hover:text-primary transition-colors">
                          {featuredPost.title}
                        </Link>
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        {featuredPost.excerpt}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5" />
                        <span>{featuredPost.author}</span>
                      </div>
                      <Link
                        to="/blog/$slug"
                        params={{ slug: featuredPost.slug }}
                        className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        Read Article <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Grid of Articles */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredBlogs.map((post, idx) => (
                  <motion.article
                    key={post.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="aspect-[16/9] overflow-hidden relative bg-muted">
                      <img
                        src={getOptimizedImageUrl(post.coverImage, { width: 600, height: 340 })}
                        alt={post.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <span className="absolute top-3 left-3 rounded-full bg-background/90 backdrop-blur border border-border px-2.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
                        {post.category}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-5 space-y-3">
                      <h3 className="font-display text-lg font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        <Link to="/blog/$slug" params={{ slug: post.slug }}>
                          {post.title}
                        </Link>
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed flex-1">
                        {post.excerpt}
                      </p>

                      <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          <span className="truncate max-w-[110px]">{post.author}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{post.readTime}</span>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
