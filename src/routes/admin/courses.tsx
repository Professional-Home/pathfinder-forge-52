import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/courses")({
  component: AdminCoursesLayout,
});

function AdminCoursesLayout() {
  return <Outlet />;
}
