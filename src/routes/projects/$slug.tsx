import { createFileRoute, notFound } from "@tanstack/react-router";
import { CourseDetailTemplate } from "@/components/courses/CourseDetailTemplate";
import { fetchCourseBySlug } from "@/lib/courses/store";
import { createSeoHead } from "@/lib/seo-metadata";

export const Route = createFileRoute("/projects/$slug")({
  component: ProjectDetailPage,
  loader: async ({ params }) => {
    // Fetch fresh course data by slug directly from Supabase (falls back to store if needed)
    const project = (await fetchCourseBySlug(params.slug)) ?? undefined;
    if (!project || project.status !== "published") {
      throw notFound();
    }
    return { project };
  },
  head: ({ loaderData, params }) => {
    const rawTitle = loaderData?.project.seoTitle?.replace("Course", "Project") || loaderData?.project.name;
    const title = rawTitle ? (rawTitle.includes("Micrylis") ? rawTitle : `${rawTitle} — Micrylis Biotech`) : "Project — Micrylis Biotech";
    const description =
      loaderData?.project.seoDescription ||
      loaderData?.project.shortDescription ||
      loaderData?.project.fullDescription?.slice(0, 160) ||
      "Explore intensive biotechnology research projects and internships at Micrylis Biotech.";
    const ogImage = loaderData?.project.coverImage || undefined;

    return createSeoHead({
      title,
      description,
      path: `/projects/${params.slug}`,
      ogImage,
    });
  },
});

function ProjectDetailPage() {
  const { project } = Route.useLoaderData();
  return <CourseDetailTemplate course={project} />;
}
