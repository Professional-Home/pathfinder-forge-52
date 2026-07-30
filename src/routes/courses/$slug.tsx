import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/courses/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/projects/$slug", params: { slug: params.slug } });
  },
});
