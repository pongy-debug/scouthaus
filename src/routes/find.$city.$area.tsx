import { createFileRoute, redirect } from "@tanstack/react-router";

// Areas now open inside the single Find House map; old deep links land there with the area pre-selected.
export const Route = createFileRoute("/find/$city/$area")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/find/$city", params: { city: params.city }, search: { area: params.area }, replace: true }); },
});
