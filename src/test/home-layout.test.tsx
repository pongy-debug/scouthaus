import type { ComponentType, PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const original = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...original,
    useNavigate: () => navigate,
    Link: ({ to, children, ...props }: PropsWithChildren<{ to: string }>) => <a href={to} {...props}>{children}</a>,
  };
});
vi.mock("@/components/hh/CityGlobe", () => ({ default: () => null }));
import { Route } from "@/routes/index";
import { SpaceTransition } from "@/components/hh/SpaceTransition";
import { resetSpaceFlight } from "@/lib/hh/transition";
const Home = Route.options.component as ComponentType;
afterEach(() => { cleanup(); resetSpaceFlight(); vi.useRealTimers(); vi.unstubAllGlobals(); navigate.mockClear(); });

describe("home layout", () => {
  it("keeps both main actions together beneath the opening headline without duplicates", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const find = screen.getByRole("link", { name: "Find House" });
    const scanner = screen.getByRole("link", { name: "Contract Check" });
    expect(screen.getByRole("heading", { level: 1 }).closest("section")).toContainElement(nav);
    expect(nav).toContainElement(find);
    expect(nav).toContainElement(scanner);
    expect(find).toHaveAttribute("href", "/find");
    expect(scanner).toHaveAttribute("href", "/scanner");
  });
  it("links the opening screen to the neighbourhood screen", () => {
    render(<Home />);
    expect(screen.getByRole("region", { name: "Durham explorer preview" })).toBeVisible();
    expect(document.querySelector(".home-reveal")).toBeNull();
    expect(screen.queryByText("Durham, United Kingdom")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Scroll to explore/ })).toHaveAttribute("href", "#neighbourhood");
  });
  it.each([false, true])("starts the story and magnifier together even with reduced motion: %s", (reduced) => {
    vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
    let notify: IntersectionObserverCallback = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    const { container } = render(<Home />);
    const section = screen.getByRole("region", { name: "Durham explorer preview" });
    expect(section).toHaveAttribute("data-reveal", "waiting");
    expect(observe).toHaveBeenCalledWith(section);
    act(() => notify([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
    expect(section).toHaveAttribute("data-reveal", "playing");
    expect(disconnect).toHaveBeenCalledOnce();
    const zoomedArt = container.querySelector(".home-lens-sample use");
    expect(zoomedArt).toHaveAttribute("href", "#home-house-artwork");
    expect(zoomedArt).toHaveAttribute("transform", "scale(1.8)");
  });

  it.each([[false, 1500], [true, 1500]])("shrinks to black and only then opens Find House (reduced motion: %s)", async (reduced, ms) => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const view = render(<><Home /><SpaceTransition /></>);
    const find = screen.getByRole("link", { name: "Find House" });
    fireEvent.click(find);
    fireEvent.click(find);
    expect(!!view.container.querySelector(".home-leaving")).toBe(true);
    expect(document.documentElement).toHaveClass("space-lock");
    expect(find).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Contract Check" })).toHaveAttribute("aria-disabled", "true");
    await act(async () => { await vi.advanceTimersByTimeAsync(ms - 1); });
    expect(navigate).not.toHaveBeenCalled();
    // The black overlay is already up before the route changes…
    expect(document.querySelector(".space-fx")).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/find" });
    // …stays up across it while the next page fades in, and everything returns to normal afterwards.
    expect(document.querySelector(".space-fadein")).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(document.querySelector(".space-fx")).toBeNull();
    expect(document.documentElement).not.toHaveClass("space-lock");
  });
  it("shows the home page in its normal state when it is opened again mid-flight (back button)", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const first = render(<Home />);
    fireEvent.click(screen.getByRole("link", { name: "Find House" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    first.unmount();
    const again = render(<Home />);
    expect(again.container.querySelector(".home-leaving")).toBeNull();
    expect(screen.getByRole("link", { name: "Find House" })).not.toHaveAttribute("aria-disabled");
    expect(document.documentElement).not.toHaveClass("space-lock");
  });
});
