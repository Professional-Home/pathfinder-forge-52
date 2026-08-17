import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock, User, Calendar, Share2, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchBlogBySlug } from "@/lib/blogs/store";
import { getOptimizedImageUrl } from "@/utils/cloudinary";

export const Route = createFileRoute("/blog/$slug")({
  component: SingleBlogPage,
  loader: async ({ params }) => {
    const post = await fetchBlogBySlug(params.slug);
    if (!post || post.status !== "published") {
      throw notFound();
    }
    return { post };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.post.title ?? "Blog Article"} — Micrylis Biotech` },
      { name: "description", content: loaderData?.post.excerpt ?? "" },
    ],
  }),
});

function SingleBlogPage() {
  const { post } = Route.useLoaderData();

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: post.title,
        text: post.excerpt,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Article link copied to clipboard!");
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background pt-28 pb-20">
        <article className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
          
          {/* Back Navigation */}
          <div>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to all articles
            </Link>
          </div>

          {/* Article Header */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-xs font-semibold text-primary">
                {post.category}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {post.readTime}
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
              {post.title}
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              {post.excerpt}
            </p>

            {/* Author & Share bar */}
            <div className="flex items-center justify-between pt-4 border-t border-border text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center font-bold">
                  {post.author[0]}
                </div>
                <div>
                  <span className="font-semibold text-foreground block">{post.author}</span>
                  <span className="text-[11px] text-muted-foreground">Author</span>
                </div>
              </div>

              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
            </div>
          </div>

          {/* Cover Image */}
          {post.coverImage && (
            <div className="aspect-[16/9] overflow-hidden rounded-2xl border border-border shadow-md">
              <img
                src={getOptimizedImageUrl(post.coverImage, { width: 1200, height: 675 })}
                alt={post.title}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Article Body */}
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-foreground text-sm sm:text-base leading-relaxed pt-4">
            {post.content.split("\n\n").map((paragraph, idx) => {
              if (paragraph.startsWith("# ")) {
                return (
                  <h1 key={idx} className="font-display text-2xl sm:text-3xl font-bold mt-8 mb-4 text-foreground">
                    {paragraph.replace("# ", "")}
                  </h1>
                );
              }
              if (paragraph.startsWith("## ")) {
                return (
                  <h2 key={idx} className="font-display text-xl sm:text-2xl font-bold mt-6 mb-3 text-foreground">
                    {paragraph.replace("## ", "")}
                  </h2>
                );
              }
              if (paragraph.startsWith("### ")) {
                return (
                  <h3 key={idx} className="font-display text-lg font-bold mt-4 mb-2 text-foreground">
                    {paragraph.replace("### ", "")}
                  </h3>
                );
              }
              return (
                <p key={idx} className="text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              );
            })}
          </div>

          {/* Footer Callout */}
          <div className="mt-12 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 text-center space-y-4">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <h3 className="font-display text-xl font-bold text-foreground">
              Interested in Hands-On Research Projects?
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto">
              Work alongside experienced mentors in AI Drug Discovery, Bioplastics, and Computational Biology.
            </p>
            <Link
              to="/projects"
              className="inline-block rounded-full bg-foreground px-6 py-2.5 text-xs font-semibold text-background hover:opacity-90 transition"
            >
              Explore Research Projects
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
