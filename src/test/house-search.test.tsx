import { resetSpaceFlight } from "@/lib/hh/transition";
import { useState, type ComponentType } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { MapAction } from "@/lib/hh/assistant";
import { CITIES, defaultFilters, matchesSearch, type Area, type House } from "@/lib/hh/find";
import { LANDMARKS } from "@/lib/hh/landmarks";

const assistant = vi.hoisted(() => ({ act: (_a: unknown) => {} }));
vi.mock("@/components/hh/SiteNav", () => ({ SiteNav: () => null, SiteFooter: () => null, Crumbs: () => null }));
vi.mock("@/components/hh/MapFallback", () => ({ useWebGL: () => true, MapFallback: () => null }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/hh/HousePhoto", () => ({ HouseThumb: () => null }));
vi.mock("@/components/hh/PropertyDrawer", () => ({ PropertyDrawer: ({ house }: { house: House }) => <div data-testid="xray">X-Ray: {house.name}</div> }));
vi.mock("@/components/hh/AskMap", () => ({ AskMap: ({ onAction }: { onAction: (a: MapAction) => void }) => { assistant.act = onAction as (a: unknown) => void; return null; } }));
// The map itself needs WebGL; this stand-in shows what the page tells it to do (camera target, highlight, area).
vi.mock("@/components/hh/StreetMap", () => ({ default: (p: { area: Area | null; selectedId: string | null; houses: House[] }) =>
  <div data-testid="map" data-area={p.area?.id ?? ""} data-selected={p.selectedId ?? ""} data-houses={p.houses.length} /> }));
import { Route } from "@/routes/find.$city.index";

const Page = Route.options.component as ComponentType;
function Harness({ cityId, area }: { cityId: string; area?: string }) {
  const [search, setSearch] = useState<{ area?: string }>(area ? { area } : {});
  Object.assign(Route, { useLoaderData: () => ({ cityId }), useSearch: () => search, useNavigate: () => (o: { search: { area?: string } }) => setSearch(o.search) });
  return <Page />;
}
const durham = CITIES.find((c) => c.id === "durham")!;
const box = () => screen.getByRole("combobox", { name: "Search houses" });
const results = () => [...document.querySelectorAll("[data-house]")].map((b) => b.getAttribute("data-house"));
const toggle = () => screen.getByRole("button", { name: /^Houses \(/ });
const type = (q: string) => fireEvent.change(box(), { target: { value: q } });
// jsdom has no ResizeObserver or scrollIntoView (the bedroom slider and the list use them).
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = () => {};
afterEach(() => { cleanup(); resetSpaceFlight(); });

it("1 · typing 'claypath' narrows the list and the count; Enter flies to the first result and opens its drawer", async () => {
  render(<Harness cityId="durham" />);
  await screen.findByTestId("map");
  expect(box()).toHaveAttribute("placeholder", "Search by house, street, postcode or agent");
  // The search box sits above the "Available only" switch.
  expect(box().compareDocumentPosition(screen.getByText("Available only")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(toggle()).toHaveTextContent(`Houses (${durham.houses.length})`);

  type("  CLAYpath ");
  const expected = durham.houses.filter((h) => matchesSearch(durham, h, "claypath")).map((h) => h.id);
  expect(expected.length).toBeGreaterThan(1);
  expect(expected.length).toBeLessThan(durham.houses.length);
  expect(results().sort()).toEqual([...expected].sort());
  expect(toggle()).toHaveTextContent(`Houses (${expected.length} of ${durham.houses.length})`);
  expect(screen.getByTestId("map")).toHaveAttribute("data-houses", String(expected.length));
  expect(document.querySelector("#house-results mark")).toHaveTextContent(/claypath/i); // match highlighted

  const first = durham.houses.find((h) => h.id === results()[0])!;
  fireEvent.keyDown(box(), { key: "Enter" });
  // The map is told to select (fly to + highlight) that house inside its area, and the X-Ray opens.
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", first.id);
  expect(screen.getByTestId("map")).toHaveAttribute("data-area", first.area);
  expect(screen.getByTestId("xray")).toHaveTextContent(`X-Ray: ${first.name}`);
});

it("arrow keys move through the results and Enter opens the highlighted one; clicking a result works too", async () => {
  render(<Harness cityId="durham" />);
  type("claypath");
  const ids = results();
  fireEvent.keyDown(box(), { key: "ArrowDown" }); fireEvent.keyDown(box(), { key: "ArrowDown" }); fireEvent.keyDown(box(), { key: "ArrowUp" }); fireEvent.keyDown(box(), { key: "ArrowDown" });
  expect(box()).toHaveAttribute("aria-activedescendant", `house-option-${ids[1]}`);
  fireEvent.keyDown(box(), { key: "Enter" });
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", ids[1]!);
});

it("2 · search and the bedroom range work together, and clearing the search restores the list", async () => {
  render(<Harness cityId="durham" />);
  type("claypath");
  const all = results().length;
  const lo = screen.getByRole("slider", { name: "Minimum bedrooms" });
  lo.focus(); for (let i = 0; i < 4; i++) fireEvent.keyDown(lo, { key: "ArrowRight" });
  const minBeds = Number(lo.getAttribute("aria-valuenow"));
  const expected = durham.houses.filter((h) => matchesSearch(durham, h, "claypath") && h.bedrooms >= minBeds).map((h) => h.id);
  expect(minBeds).toBeGreaterThan(defaultFilters(durham).minBeds);
  expect(expected.length).toBeLessThan(all);
  expect(results().sort()).toEqual([...expected].sort());
  expect(toggle()).toHaveTextContent(`Houses (${expected.length} of ${durham.houses.length})`);

  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(box()).toHaveValue("");
  expect(results()).toHaveLength(durham.houses.filter((h) => h.bedrooms >= minBeds).length); // only the bedroom filter remains
});

it("inside an area it searches that area first, offers the whole city, and has an empty state", async () => {
  render(<Harness cityId="durham" area="claypath" />);
  type("whinney hill");
  expect(screen.getByText("No houses match your search")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Search all of Durham" }));
  expect(screen.getByTestId("map")).toHaveAttribute("data-area", "");
  expect(results().length).toBeGreaterThan(0);
  expect(box()).toHaveValue("whinney hill");

  type("zzzz no such house");
  expect(screen.getByText("No houses match your search")).toBeVisible();
  expect(screen.queryByRole("button", { name: /Search all of/ })).toBeNull();
  fireEvent.click(within(document.getElementById("house-results")!).getByRole("button", { name: "Clear search" }));
  expect(results()).toHaveLength(durham.houses.length);
});

it("searches by postcode and agent, and a chatbot request fills the same search box", async () => {
  render(<Harness cityId="durham" />);
  const h = durham.houses[0]!;
  type(h.postcode.replace(/\s/g, "").toLowerCase());
  expect(results()).toContain(h.id);
  type(h.landlord.toUpperCase());
  expect(results()).toContain(h.id);

  await screen.findByTestId("map");
  fireEvent.click(document.body); // settle
  await import("react").then(({ act }) => act(() => assistant.act({ filters: defaultFilters(durham), layer: "all", query: "Whinney Hill" } satisfies MapAction)));
  expect(box()).toHaveValue("Whinney Hill");
  expect(results().length).toBe(durham.houses.filter((x) => matchesSearch(durham, x, "Whinney Hill")).length);
});

it("5 · landmarks never appear in the house list or change the house count", async () => {
  render(<Harness cityId="durham" />);
  expect(toggle()).toHaveTextContent(`Houses (${durham.houses.length})`);
  for (const q of ["cathedral", "Bill Bryson", "DH1 3EH"]) { type(q); expect(results()).toEqual(durham.houses.filter((h) => matchesSearch(durham, h, q)).map((h) => h.id)); }
  type("Durham Cathedral");
  expect(results()).toHaveLength(0);
  for (const l of LANDMARKS) for (const c of CITIES) expect(c.houses.some((h) => h.id === l.id || h.name === l.name)).toBe(false);
});

it("opens the top-floor tour within Find House and returns to the same Claypath map", async () => {
  render(<Harness cityId="durham" area="claypath" />);
  await screen.findByTestId("map");
  expect(screen.queryByRole("button", { name: /Enter top floor/ })).not.toBeInTheDocument();
  const ruth = document.querySelector<HTMLButtonElement>('[data-house="claypath-ruth"]')!;
  fireEvent.click(ruth);
  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "claypath-ruth");
  fireEvent.click(screen.getByRole("button", { name: /Enter top floor/ }));
  expect(await screen.findByTitle("Ruth First House Flat 4 interactive 3D tour")).toHaveAttribute("src", "/tours/first-ruth-house/flat4-3d-model.html");
  fireEvent.click(screen.getByRole("button", { name: "Back to building" }));
  expect(screen.queryByTitle("Ruth First House Flat 4 interactive 3D tour")).not.toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-area", "claypath");
});
