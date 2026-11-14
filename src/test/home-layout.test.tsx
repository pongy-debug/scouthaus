import type { ComponentType, PropsWithChildren } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const original = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...original,
    Link: ({ to, children, ...props }: PropsWithChildren<{ to: string }>) => <a href={to} {...props}>{children}</a>,
  };
});
import { Route } from "@/routes/index";
const Home = Route.options.component as ComponentType;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("home layout", () => {
  it("keeps both main actions together beneath the opening headline without duplicates", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const find = screen.getByRole("link", { name: "Find House" });
    const scanner = screen.getByRole("link", { name: "Contract Scanner" });
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
  it("starts the story and magnifier together when the second screen enters view", () => {
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
  it("shows static content without the scan when reduced motion is requested", () => {
    const observer = vi.fn();
    vi.stubGlobal("IntersectionObserver", observer);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(<Home />);
    expect(screen.getByRole("region", { name: "Durham explorer preview" })).toHaveAttribute("data-reveal", "static");
    expect(observer).not.toHaveBeenCalled();
  });

});
