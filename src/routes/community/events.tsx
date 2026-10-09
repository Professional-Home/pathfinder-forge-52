import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/community/events")({
  beforeLoad: () => {
    throw redirect({
      to: "/events",
    });
  },
});
