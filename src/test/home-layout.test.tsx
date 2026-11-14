import type { ComponentType, PropsWithChildren } from "react";
import { cleanup, render, screen } from "@testing-library/react";
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
});

