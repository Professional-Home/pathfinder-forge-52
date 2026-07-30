import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/courses/")({
  beforeLoad: () => {
    throw redirect({ to: "/projects" });
  },
});
