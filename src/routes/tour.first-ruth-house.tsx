import { createFileRoute, redirect } from "@tanstack/react-router";

// Preserve existing bookmarks while keeping tours inside Find House.
export const Route = createFileRoute("/tour/first-ruth-house")({
  beforeLoad: () => { throw redirect({ to: "/find/$city", params: { city: "durham" }, search: { area: "claypath", tour: true } }); },
});
