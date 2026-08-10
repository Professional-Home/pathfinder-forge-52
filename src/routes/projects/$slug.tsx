import { createFileRoute, notFound } from "@tanstack/react-router";
import { CourseDetailTemplate } from "@/components/courses/CourseDetailTemplate";
import { fetchCoursesFromSupabase, getCourseBySlug } from "@/lib/courses/store";

export const Route = createFileRoute("/projects/$slug")({
  component: ProjectDetailPage,
  loader: async ({ params }) => {
    let project = getCourseBySlug(params.slug);
    if (!project) {
      const all = await fetchCoursesFromSupabase();
      project = all.find((c) => c.slug === params.slug);
    }
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
