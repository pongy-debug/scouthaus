import type { ComponentType } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-router", async (original) => ({ ...await original<typeof import("@tanstack/react-router")>(), Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/hh/SiteNav", () => ({ SiteNav: () => null }));
const webgl = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/components/hh/MapFallback", () => ({ useWebGL: () => webgl.enabled }));
vi.mock("@/components/hh/RuthTourScene", () => ({ default: ({ view }: { view: string }) => <div data-testid="scene">{view}</div> }));
import { Route } from "@/routes/tour.first-ruth-house";
const Tour = Route.options.component as ComponentType;
afterEach(() => { cleanup(); webgl.enabled = true; });

it("navigates viewpoints and compares the original photos", async () => {
  render(<Tour />);
  expect(await screen.findByTestId("scene")).toHaveTextContent("overview");
  fireEvent.click(screen.getByRole("button", { name: "Next viewpoint" }));
  expect(screen.getByTestId("scene")).toHaveTextContent("kitchen");
  fireEvent.click(screen.getByRole("button", { name: "Compare with photos" }));
  expect(screen.getByAltText(/First Ruth House: Cabinets/)).toHaveAttribute("src", "/tours/first-ruth-house/kitchen.jpg");
  fireEvent.click(screen.getByRole("button", { name: "View Living room photo" }));
  expect(screen.getByAltText(/First Ruth House: Sofa/)).toHaveAttribute("src", "/tours/first-ruth-house/living-room.jpg");
  fireEvent.click(screen.getByRole("button", { name: "Back to 3D" }));
  expect(await screen.findByTestId("scene")).toHaveTextContent("kitchen");
  expect(screen.getByRole("link", { name: "Download 3D model" })).toHaveAttribute("href", "/tours/first-ruth-house/first-ruth-house.glb");
});
it("keeps the photos accessible when WebGL is unavailable", () => {
  webgl.enabled = false;
  render(<Tour />);
  expect(screen.getByRole("status")).toHaveTextContent("3D is unavailable");
  expect(screen.getByAltText(/First Ruth House: Cabinets/)).toBeInTheDocument();
  expect(screen.getByText("Approximate reconstruction")).toBeInTheDocument();
});
