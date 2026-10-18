import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/community/webinars")({
  beforeLoad: () => {
    throw redirect({
      to: "/webinars",
    });
  },
});
