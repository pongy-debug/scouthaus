import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CITIES } from "@/lib/hh/find";
import { LANDMARKS, landmarksFor } from "@/lib/hh/landmarks";

// A stand-in for MapLibre (which needs WebGL): it records what the component draws and lets the test move the cursor.
const gl = vi.hoisted(() => {
  type Handler = (e: { point: { x: number; y: number } }) => void;
  const state = { handlers: new Map<string, Handler[]>(), layers: new Map<string, { paint: Record<string, unknown>; filter?: unknown }>(), sources: new Map<string, { data: { features: { properties: { lm: string } }[] } }>(), under: null as string | null, zoom: 13.6, container: null as HTMLElement | null };
  class FakeMap {
    constructor(o: { container: HTMLElement }) { state.container = o.container; state.handlers.clear(); state.layers.clear(); state.sources.clear(); queueMicrotask(() => this.fire("load")); }
    fire(type: string, e = { point: { x: 100, y: 100 } }) { for (const h of state.handlers.get(type) ?? []) h(e); }
    on(type: string, h: Handler) { state.handlers.set(type, [...(state.handlers.get(type) ?? []), h]); }
    addControl() {} remove() {} flyTo() {} jumpTo() {} stop() {} once() {} setLayoutProperty() {} setFeatureState() {}
    getStyle() { return { layers: [] }; }
    getContainer() { return state.container!; } getCanvasContainer() { return state.container!; }
    getCanvas() { return state.container!; }
    getZoom() { return state.zoom; }
    getBounds() { return { contains: () => false }; }
    project() { return { x: 0, y: 0 }; }
    addSource(id: string, s: never) { state.sources.set(id, s); }
    getSource(id: string) { return state.sources.has(id) ? { setData() {} } : undefined; }
    addLayer(l: { id: string; paint: Record<string, unknown>; filter?: unknown }) { state.layers.set(l.id, { paint: { ...l.paint }, filter: l.filter }); }
    getLayer(id: string) { return state.layers.get(id); }
    setPaintProperty(id: string, k: string, v: unknown) { state.layers.get(id)!.paint[k] = v; }
    queryRenderedFeatures(_pt: unknown, o: { layers: string[] }) { return state.under && o.layers.includes(`hh-landmark-${state.under}`) ? [{ properties: { lm: state.under } }] : []; }
  }
  class Marker {
    el: HTMLElement; constructor(o: { element: HTMLElement }) { this.el = o.element; }
    setLngLat() { return this; } addTo() { state.container!.append(this.el); return this; } remove() { this.el.remove(); }
  }
  class Control {}
  return { state, lib: { Map: FakeMap, Marker, NavigationControl: Control, AttributionControl: Control } };
});
vi.mock("maplibre-gl", () => ({ default: gl.lib }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
import StreetMap, { AVAIL_COLOR, LANDMARK_CYAN, RISK_COLOR } from "@/components/hh/StreetMap";

const city = (id: string) => CITIES.find((c) => c.id === id)!;
const onOpen = vi.fn(), onPickArea = vi.fn();
async function mount(cityId: string, selectedId: string | null = null) {
  const c = city(cityId);
  render(<div style={{ height: 400 }}><StreetMap city={c} area={null} houses={c.houses} layer="all" selectedId={selectedId} hoverId={null} onPickArea={onPickArea} onOpen={onOpen} onHover={() => {}} /></div>);
  await act(async () => { await vi.advanceTimersByTimeAsync(32); });
}
const fire = (type: string) => act(() => { for (const h of gl.state.handlers.get(type) ?? []) h({ point: { x: 100, y: 100 } }); });
const colour = (id: string) => gl.state.layers.get(`hh-landmark-${id}`)!.paint["fill-extrusion-color"];
const moveOnto = (id: string | null) => { gl.state.under = id; fire("mousemove"); };
beforeEach(() => { vi.useFakeTimers(); gl.state.under = null; gl.state.zoom = 13.6; onOpen.mockClear(); onPickArea.mockClear(); });
afterEach(() => { cleanup(); vi.runOnlyPendingTimers(); vi.useRealTimers(); });

it("data: three verified landmarks with OSM footprints and freely licensed, credited photos", () => {
  expect(LANDMARKS.map((l) => [l.name, l.type, l.city, l.postcode])).toEqual([
    ["Durham Cathedral", "Cathedral", "durham", "DH1 3EH"],
    ["Bill Bryson Library", "University library", "durham", "DH1 3LY"],
    ["Newcastle Central Station", "Railway station", "newcastle", "NE1 5DL"],
  ]);
  for (const l of LANDMARKS) {
    expect(l.osmIds.length).toBeGreaterThan(0);
    expect(l.footprints.length).toBeGreaterThan(0);
    expect(l.photo?.url).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//);
    expect(l.photo?.licence).toMatch(/^(CC BY(-SA)? \d|CC0|Public domain)/);
    expect(l.photo?.author).toBeTruthy();
    expect(l.photo?.page).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  }
  expect(LANDMARKS[0]!.osmIds.length).toBeGreaterThan(100); // the cathedral is made of many parts that react as one
  expect(LANDMARKS[2]!.osmIds.length).toBeGreaterThan(1);
});

it("cyan is reserved for landmarks", () => {
  expect(LANDMARK_CYAN).toBe("#22D3EE");
  expect([...Object.values(AVAIL_COLOR), ...Object.values(RISK_COLOR)].map((c) => c.toUpperCase())).not.toContain("#22D3EE");
});

it.each([["durham", "durham-cathedral", "Durham Cathedral", "DH1 3EH", "Cathedral", "mattbuck, CC BY-SA 4.0"],
  ["durham", "bill-bryson-library", "Bill Bryson Library", "DH1 3LY", "University library", "Gordon Griffiths, CC BY-SA 2.0"],
  ["newcastle", "newcastle-central-station", "Newcastle Central Station", "NE1 5DL", "Railway station", "Benjamin Smith, CC BY-SA 4.0"]])(
  "3/4/6 · %s: hovering %s turns the whole building cyan and shows its card; leaving restores it", async (cityId, id, name, postcode, type, credit) => {
  await mount(cityId);
  const l = LANDMARKS.find((x) => x.id === id)!;
  // Every footprint of the landmark is in its own layer, and left out of the base buildings.
  expect(gl.state.sources.get(`hh-landmark-${id}`)!.data.features).toHaveLength(l.footprints.length);
  expect(JSON.stringify(gl.state.layers.get("hh-buildings")!.filter)).toContain(String(Number(l.osmIds[0]!.split("/")[1]) * 10 + (l.osmIds[0]!.startsWith("relation") ? 3 : 2)));
  const paint = gl.state.layers.get(`hh-landmark-${id}`)!.paint;
  expect(paint["fill-extrusion-color-transition"]).toEqual({ duration: 150, delay: 0 });
  const rest = colour(id);
  expect(rest).not.toBe(LANDMARK_CYAN);

  moveOnto(id);
  expect(colour(id)).toBe("#22D3EE");
  expect(gl.state.container!.style.cursor).toBe("pointer");
  for (const other of landmarksFor(cityId).filter((x) => x.id !== id)) expect(colour(other.id)).toBe(rest);
  const card = screen.getByRole("dialog", { name });
  expect(within(card).getByRole("img", { name })).toHaveAttribute("src", l.photo!.url);
  expect(card).toHaveTextContent(`${type} · ${postcode}`);
  expect(card).toHaveTextContent(`Photo: ${credit}, via Wikimedia Commons`);
  expect(within(card).getByRole("link", { name: "Wikimedia Commons" })).toHaveAttribute("href", l.photo!.page);

  // Leaving: the card closes shortly after, and the colour returns.
  moveOnto(null);
  expect(screen.getByRole("dialog", { name })).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(300); });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(colour(id)).toBe(rest);
});

it("the card stays open while the cursor is on it, shows the walk from the selected house, and a click never opens the X-Ray", async () => {
  const house = city("durham").houses[0]!;
  await mount("durham", house.id);
  moveOnto("durham-cathedral");
  const card = screen.getByRole("dialog", { name: "Durham Cathedral" });
  expect(card).toHaveTextContent(new RegExp(`About \\d+ min walk from ${house.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  // Cursor moves from the building onto the card.
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.mouseEnter(card); gl.state.under = null; fire("mousemove");
  act(() => { vi.advanceTimersByTime(1000); });
  expect(screen.getByRole("dialog", { name: "Durham Cathedral" })).toBeInTheDocument();
  fireEvent.mouseLeave(card);
  act(() => { vi.advanceTimersByTime(300); });
  expect(screen.queryByRole("dialog")).toBeNull();

  // Touch: tap the landmark to open, tap elsewhere to close; neither opens a house or an area.
  gl.state.under = "bill-bryson-library"; fire("click");
  expect(screen.getByRole("dialog", { name: "Bill Bryson Library" })).toBeInTheDocument();
  gl.state.under = null; fire("click");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onOpen).not.toHaveBeenCalled();
});

it("labels are hidden on the overview and always on once zoomed in", async () => {
  await mount("durham");
  const labels = () => [...gl.state.container!.querySelectorAll<HTMLElement>("[data-landmark-label]")];
  expect(labels().map((l) => l.textContent)).toEqual(["Durham Cathedral", "Bill Bryson Library"]);
  expect(labels().every((l) => l.style.display === "none")).toBe(true);
  gl.state.zoom = 16; fire("zoom");
  expect(labels().every((l) => l.style.display === "")).toBe(true);
});
