import { useMemo } from "react";
import { normalizeArticleContent } from "@/lib/blogs/content-utils";

interface ArticleContentRendererProps {
  content: string;
  className?: string;
}

export function ArticleContentRenderer({ content, className = "" }: ArticleContentRendererProps) {
  // Convert markdown if legacy article, or use rich HTML as-is
  const renderedHtml = useMemo(() => {
    return normalizeArticleContent(content || "");
  }, [content]);

  if (!content) {
    return null;
  }

  return (
    <div
      className={`article-rich-content prose prose-slate dark:prose-invert max-w-none text-foreground text-sm sm:text-base leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
