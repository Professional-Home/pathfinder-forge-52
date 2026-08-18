import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  X,
} from "lucide-react";
import { AdminGreeting, AdminCard } from "@/components/admin/admin-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CloudinaryUpload } from "@/components/admin/CloudinaryUpload";
import { fetchBlogs, saveBlog, deleteBlog } from "@/lib/blogs/store";
import type { BlogPost, BlogFormData, BlogStatus } from "@/lib/blogs/types";

export const Route = createFileRoute("/admin/blogs")({
  component: AdminBlogsPage,
});

const emptyBlogForm: BlogFormData = {
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  category: "Biotechnology",
  author: "Micrylis Biotech Team",
  readTime: "5 min read",
  status: "published",
  featured: false,
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function AdminBlogsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState<BlogFormData>(emptyBlogForm);

  const { data: blogs = [], isLoading } = useQuery({
    queryKey: ["admin-blogs"],
    queryFn: () => fetchBlogs(true),
  });

  const saveMutation = useMutation({
    mutationFn: (id?: string) => saveBlog(formData, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
      queryClient.invalidateQueries({ queryKey: ["public-blogs"] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBlog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
      queryClient.invalidateQueries({ queryKey: ["public-blogs"] });
    },
  });

  const resetForm = () => {
    setEditingBlog(null);
    setFormData(emptyBlogForm);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (blog: BlogPost) => {
    setEditingBlog(blog);
    setFormData({
      slug: blog.slug,
      title: blog.title,
      excerpt: blog.excerpt,
      content: blog.content,
      coverImage: blog.coverImage,
      category: blog.category,
      author: blog.author,
      readTime: blog.readTime,
      status: blog.status,
      featured: blog.featured,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleTitleChange = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: prev.slug || slugify(title),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    saveMutation.mutate(editingBlog?.id);
  };

  const filteredBlogs = blogs.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <AdminGreeting
        title="Blog & Content Management"
        sub="Create, edit, publish, and manage biotech articles for your readers."
      />

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search articles by title, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <Button onClick={handleOpenCreate} className="w-full sm:w-auto gap-2 text-xs">
          <Plus className="h-4 w-4" /> Create New Article
        </Button>
      </div>

      {/* Blogs Table */}
      <AdminCard title="All Articles" hint={`${filteredBlogs.length} total articles`}>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading articles...</div>
        ) : filteredBlogs.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No articles found. Click "Create New Article" to add one!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Article</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Author</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Read Time</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredBlogs.map((blog) => (
                  <tr key={blog.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {blog.coverImage && (
                          <img
                            src={blog.coverImage}
                            alt={blog.title}
                            className="h-10 w-14 rounded object-cover border border-border shrink-0"
                          />
                        )}
                        <div>
                          <div className="font-semibold text-foreground line-clamp-1">{blog.title}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">/blog/{blog.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{blog.category}</td>
                    <td className="py-3 px-4 text-muted-foreground">{blog.author}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          blog.status === "published"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        }`}
                      >
                        {blog.status === "published" ? "Published" : "Draft"}
                      </span>
                      {blog.featured && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Featured
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{blog.readTime}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(blog)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                          title="Edit Article"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(blog.id, blog.title)}
                          className="rounded p-1.5 text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition"
                          title="Delete Article"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Form Dialog Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-surface-elevated p-6 shadow-xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h2 className="font-display text-xl font-bold">
                {editingBlog ? "Edit Article" : "Create New Article"}
              </h2>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="title">Article Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Advancements in Synthetic Biology"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="slug">Slug (URL)</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: slugify(e.target.value) })}
                    placeholder="advancements-in-synthetic-biology"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Biotechnology"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="author">Author Name</Label>
                  <Input
                    id="author"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    placeholder="Dr. Jane Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="readTime">Read Time</Label>
                  <Input
                    id="readTime"
                    value={formData.readTime}
                    onChange={(e) => setFormData({ ...formData, readTime: e.target.value })}
                    placeholder="5 min read"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="excerpt">Excerpt / Summary</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  rows={2}
                  placeholder="Brief summary of the article..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coverImage">Cover Image</Label>
                <Input
                  id="coverImage"
                  value={formData.coverImage}
                  onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                  placeholder="https://..."
                />
                <CloudinaryUpload
                  label="Upload Cover Image via Cloudinary"
                  value={formData.coverImage}
                  onUploadSuccess={(url) => setFormData({ ...formData, coverImage: url })}
                  onRemove={() => setFormData({ ...formData, coverImage: "" })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="content">Full Article Content (Markdown format supported)</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={8}
                  placeholder="# Article Title&#10;&#10;Write your article paragraphs here..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v as BlogStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3 mt-4">
                  <div>
                    <Label htmlFor="featured">Featured Article</Label>
                    <p className="text-[10px] text-muted-foreground">Highlight on top of blog page</p>
                  </div>
                  <Switch
                    id="featured"
                    checked={formData.featured}
                    onCheckedChange={(checked) => setFormData({ ...formData, featured: checked })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editingBlog ? "Update Article" : "Create Article"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
