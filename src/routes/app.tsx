import { createFileRoute, redirect } from "@tanstack/react-router";

// The old X-Ray Neighborhood Map lived here; it is now part of Find House.
export const Route = createFileRoute("/app")({
  beforeLoad: () => { throw redirect({ to: "/find/$city", params: { city: "durham" }, replace: true }); },
});
