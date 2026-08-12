import { createFileRoute, notFound } from "@tanstack/react-router";
import { CourseDetailTemplate } from "@/components/courses/CourseDetailTemplate";
import { fetchCourseBySlug, getCourseBySlug } from "@/lib/courses/store";

export const Route = createFileRoute("/projects/$slug")({
  component: ProjectDetailPage,
  loader: async ({ params }) => {
    // Try localStorage cache first for instant navigation
    let project = getCourseBySlug(params.slug);
    if (!project) {
      // Fetch just this one course by slug — NOT all courses
      project = (await fetchCourseBySlug(params.slug)) ?? undefined;
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
