import type { ComponentType } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const globe = vi.hoisted(() => ({ supported: false as boolean | null, suspend: false, attempted: false, pending: new Promise<void>(() => {}) }));
const navigate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@tanstack/react-router", async (original) => ({
  ...await original<typeof import("@tanstack/react-router")>(), useNavigate: () => navigate,
}));
vi.mock("@/components/hh/SiteNav", () => ({ SiteNav: () => null, SiteFooter: () => null, Crumbs: () => null }));
vi.mock("@/components/hh/MapFallback", () => ({ useWebGL: () => globe.supported }));
vi.mock("@/components/hh/CityGlobe", () => ({ default: () => {
  globe.attempted = true;
  if (globe.suspend) throw globe.pending;
  return <div data-testid="designed-globe" />;
} }));
import { Route } from "@/routes/find.index";
const CityPicker = Route.options.component as ComponentType;

afterEach(() => { globe.supported = false; globe.suspend = false; globe.attempted = false; cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); navigate.mockClear(); });

it.each([false, true])("opens Durham after the transition (reduced motion: %s)", async (reduced) => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<CityPicker />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "du" } });
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
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "du" } });
  fireEvent.click(screen.getByRole("button", { name: /Durham/ }));
  view.unmount();
  await vi.advanceTimersByTimeAsync(3000);
  expect(navigate).not.toHaveBeenCalled();
});

it("accepts Newcastle upon Tyne and flies into Newcastle", async () => {
  vi.useFakeTimers();
  render(<CityPicker />);
  fireEvent.change(screen.getByRole("combobox", { name: "Search for a city" }), { target: { value: "Newcastle upon Tyne" } });
  fireEvent.click(screen.getByRole("button", { name: /Newcastle/ }));
  expect(screen.getByRole("status")).toHaveTextContent("Flying into Newcastle");
  await act(async () => { await vi.advanceTimersByTimeAsync(2200); });
  expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/find/$city", params: { city: "newcastle" } });
});

it("shows the city suggestion only while the typed text matches, and Enter picks it", () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<CityPicker />);
  const input = screen.getByRole("combobox");
  expect(screen.queryByRole("button", { name: /Durham/ })).toBeNull();
  fireEvent.change(input, { target: { value: "x" } });
  expect(screen.queryByRole("button", { name: /Durham/ })).toBeNull();
  fireEvent.change(input, { target: { value: "D" } });
  expect(screen.getByRole("button", { name: /Durham/ })).toHaveTextContent(/\d+ areas · \d+ houses/);
  fireEvent.submit(input.closest("form")!);
  expect(screen.getByRole("status")).toHaveTextContent("Flying into Durham");
});

it("does not show the alternative globe while checking WebGL or loading the designed globe", async () => {
  globe.supported = null;
  const view = render(<CityPicker />);
  expect(view.container.querySelector(".city-globe-fallback")).toBeNull();
  globe.supported = true;
  globe.suspend = true;
  view.rerender(<CityPicker />);
  await waitFor(() => expect(globe.attempted).toBe(true));
  expect(view.container.querySelector(".city-globe-fallback")).toBeNull();
  expect(view.container.querySelector(".city-picker-stars")).not.toBeNull();
  globe.suspend = false;
  view.rerender(<CityPicker />);
  expect(await screen.findByTestId("designed-globe")).toBeInTheDocument();
  expect(view.container.querySelector(".city-globe-fallback")).toBeNull();
});

it("retains the alternative globe when WebGL is unavailable", () => {
  const { container } = render(<CityPicker />);
  expect(container.querySelector(".city-globe-fallback")).not.toBeNull();
});
