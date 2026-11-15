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
import { resetSpaceFlight, startSpaceFlight } from "@/lib/hh/transition";
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

  it("preserves an active page fade when navigating back home", () => {
    vi.useFakeTimers();
    startSpaceFlight({ reduced: false, navigate });
    render(<><Home /><SpaceTransition /></>);
    expect(document.documentElement).toHaveClass("space-lock");
    expect(screen.getByRole("link", { name: "Find House" })).toHaveAttribute("aria-disabled", "true");
  });
});
