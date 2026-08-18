import { createFileRoute, notFound } from "@tanstack/react-router";
import { CourseDetailTemplate } from "@/components/courses/CourseDetailTemplate";
import { fetchCourseBySlug } from "@/lib/courses/store";

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
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.project.seoTitle?.replace("Course", "Project") ?? "Project — Micrylis",
      },
      {
        name: "description",
        content: loaderData?.project.seoDescription ?? "",
      },
    ],
  }),
});

function ProjectDetailPage() {
  const { project } = Route.useLoaderData();
  return <CourseDetailTemplate course={project} />;
}
