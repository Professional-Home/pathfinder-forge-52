import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/webinar")({
  beforeLoad: () => {
    throw redirect({
      to: "/webinars",
    });
  },
});
