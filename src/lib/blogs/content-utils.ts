/**
 * Utilities for content format detection and markdown-to-HTML conversion.
 * Ensures seamless backward compatibility with existing markdown articles.
 */

/**
 * Determines whether a given string is formatted as HTML.
 */
export function isHtmlContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  // Check for common HTML tags
  return /<\s*(?:p|h[1-6]|div|ul|ol|li|img|blockquote|hr|table|span|strong|em|a)[\s\S]*?>/i.test(
    trimmed,
  );
}

/**
 * Converts inline markdown patterns (bold, italic, links, images, code) to HTML.
 */
function parseInlineMarkdown(text: string): string {
  let res = text;

  // Images: ![alt](url)
  res = res.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Links: [text](url)
  res = res.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Bold + Italic: ***text*** or ___text___
  res = res.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");

  // Bold: **text**
  res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Italic: *text* (excluding already matched bold)
  res = res.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // Underline / Italic via underscore: _text_
  res = res.replace(/(?<!_)_(?!_)(.*?)(?<!_)_(?!_)/g, "<em>$1</em>");

  // Inline Code: `code`
  res = res.replace(/`([^`]+)`/g, "<code>$1</code>");

  return res;
}

/**
 * Converts a markdown document into clean semantic HTML.
 * Handles headings, lists, blockquotes, horizontal rules, images, and paragraphs.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";

  // If already HTML, return as-is
  if (isHtmlContent(markdown)) {
    return markdown;
  }

  const rawLines = markdown.split(/\r?\n/);
  const htmlBlocks: string[] = [];

  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join(" ").trim();
      if (pText) {
        htmlBlocks.push(`<p>${parseInlineMarkdown(pText)}</p>`);
      }
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      const tag = currentList.type;
      const itemsHtml = currentList.items
        .map((item) => `<li>${parseInlineMarkdown(item)}</li>`)
        .join("");
      htmlBlocks.push(`<${tag}>${itemsHtml}</${tag}>`);
      currentList = null;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const line = rawLine.trim();

    // Blank line -> flush active elements
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    // Horizontal Rule: --- or ***
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      flushList();
      htmlBlocks.push("<hr />");
      continue;
    }

    // Standalone Image: ![alt](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      flushParagraph();
      flushList();
      htmlBlocks.push(`<img src="${imgMatch[2]}" alt="${imgMatch[1]}" />`);
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const title = parseInlineMarkdown(headingMatch[2].trim());
      htmlBlocks.push(`<h${level}>${title}</h${level}>`);
      continue;
    }

    // Bullet List: * item or - item
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(bulletMatch[1].trim());
      continue;
    }

    // Ordered List: 1. item
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(orderedMatch[1].trim());
      continue;
    }

    // Blockquote: > text
    const quoteMatch = line.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      htmlBlocks.push(
        `<blockquote><p>${parseInlineMarkdown(quoteMatch[1].trim())}</p></blockquote>`,
      );
      continue;
    }

    // Regular line in paragraph
    if (currentList) {
      flushList();
    }
    currentParagraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return htmlBlocks.join("\n");
}

/**
 * Safely normalizes content for either editing or rendering.
 * If the input is markdown, converts it to HTML.
 * If already HTML, returns it unchanged.
 */
export function normalizeArticleContent(content: string): string {
  if (!content) return "";
  if (isHtmlContent(content)) {
    return content;
  }
  return markdownToHtml(content);
}
