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

it("embeds the supplied Flat 4 tour and offers its download instead of the old model", () => {
  render(<Tour />);
  const frame = screen.getByTitle("Ruth First House Flat 4 interactive 3D tour");
  expect(frame).toHaveAttribute("src", "/tours/first-ruth-house/flat4-3d-model.html");
  expect(frame).toHaveAttribute("sandbox", "allow-scripts");
  expect(screen.getByRole("link", { name: "Download interactive tour" })).toHaveAttribute("href", "/tours/first-ruth-house/flat4-3d-model.html");
  fireEvent.click(screen.getByRole("button", { name: "View original photos" }));
  expect(screen.getByAltText(/First Ruth House: Cabinets/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View Living room photo" }));
  expect(screen.getByAltText(/First Ruth House: Sofa/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to 3D" }));
  expect(screen.getByTitle("Ruth First House Flat 4 interactive 3D tour")).toBeInTheDocument();
});
it("keeps the photos accessible when WebGL is unavailable", () => {
  webgl.enabled = false;
  render(<Tour />);
  expect(screen.getByRole("status")).toHaveTextContent("3D is unavailable");
  expect(screen.getByAltText(/First Ruth House: Cabinets/)).toBeInTheDocument();
  expect(screen.getByText(/User-supplied Flat 4 model/)).toBeInTheDocument();
});
