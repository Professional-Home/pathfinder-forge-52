export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  author: string;
  readTime: string;
  status: BlogStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlogFormData {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  author: string;
  readTime: string;
  status: BlogStatus;
  featured: boolean;
}
