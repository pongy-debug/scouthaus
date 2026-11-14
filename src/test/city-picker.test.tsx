import type { ComponentType } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@tanstack/react-router", async (original) => ({
  ...await original<typeof import("@tanstack/react-router")>(), useNavigate: () => navigate,
}));
vi.mock("@/components/hh/SiteNav", () => ({ SiteNav: () => null, SiteFooter: () => null, Crumbs: () => null }));
vi.mock("@/components/hh/MapFallback", () => ({ useWebGL: () => false }));
import { Route } from "@/routes/find.index";
const CityPicker = Route.options.component as ComponentType;

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); navigate.mockClear(); });

it.each([false, true])("opens Durham after the transition (reduced motion: %s)", async (reduced) => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<CityPicker />);
  fireEvent.click(screen.getByRole("button", { name: /Durham/ }));
  expect(screen.getByRole("status")).toHaveTextContent("Flying into Durham");
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(2199); });
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/find/$city", params: { city: "durham" } });
});

it("cancels pending navigation when the picker is unmounted", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const view = render(<CityPicker />);
  fireEvent.click(screen.getByRole("button", { name: /Durham/ }));
  view.unmount();
  await vi.advanceTimersByTimeAsync(3000);
  expect(navigate).not.toHaveBeenCalled();
});
