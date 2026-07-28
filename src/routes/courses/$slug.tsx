import { createFileRoute, notFound } from "@tanstack/react-router";
import { CourseDetailTemplate } from "@/components/courses/CourseDetailTemplate";
import { getAllCourses, getCourseBySlug, initializeCourseStore } from "@/lib/courses/store";

export const Route = createFileRoute("/courses/$slug")({
  component: CourseDetailPage,
  loader: ({ params }) => {
    initializeCourseStore();
    const course = getCourseBySlug(params.slug);
    if (!course || course.status !== "published") {
      throw notFound();
    }
    return { course };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.course.seoTitle ?? "Course — Micrylis" },
      {
        name: "description",
        content: loaderData?.course.seoDescription ?? "",
      },
    ],
  }),
});

function CourseDetailPage() {
  const { course } = Route.useLoaderData();
  return <CourseDetailTemplate course={course} />;
}
