import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CITIES, type Area } from "@/lib/hh/find";

// Stand-in for MapLibre: records camera calls and paint changes, and lets the test end a flight ("moveend").
const gl = vi.hoisted(() => {
  const state = { created: 0, calls: [] as { type: string; o?: Record<string, unknown> }[], once: [] as (() => void)[], paint: new Map<string, unknown>(), layout: new Map<string, unknown>(), layers: new Set<string>(), container: null as HTMLElement | null, loaders: [] as (() => void)[] };
  class FakeMap {
    constructor(o: { container: HTMLElement }) { state.created++; state.container = o.container; state.calls = []; state.once = []; state.layers.clear(); state.loaders = []; queueMicrotask(() => state.loaders.forEach((f) => f())); }
    on(type: string, h: () => void) { if (type === "load") state.loaders.push(h); }
    once(_type: string, h: () => void) { state.once.push(h); }
    /** Ends the flight in progress, as MapLibre does when it finishes, is replaced or the user drags. */
    stop() { const hs = state.once; state.once = []; hs.forEach((h) => h()); state.calls.push({ type: "stop" }); }
    flyTo(o: Record<string, unknown>) { state.calls.push({ type: "flyTo", o }); }
    jumpTo(o: Record<string, unknown>) { state.calls.push({ type: "jumpTo", o }); }
    addControl() {} remove() {} setFeatureState() {} addSource() {}
    getSource() { return { setData() {} }; }
    getStyle() { return { layers: [] }; }
    getContainer() { return state.container!; } getCanvasContainer() { return state.container!; } getCanvas() { return state.container!; }
    getZoom() { return 13.6; } getBounds() { return { contains: () => false }; } project() { return { x: 0, y: 0 }; }
    addLayer(l: { id: string }) { state.layers.add(l.id); } getLayer(id: string) { return state.layers.has(id); }
    setPaintProperty(id: string, k: string, v: unknown) { state.paint.set(`${id}.${k}`, v); }
    setLayoutProperty(id: string, k: string, v: unknown) { state.layout.set(`${id}.${k}`, v); }
    queryRenderedFeatures() { return []; }
  }
  class Marker { el: HTMLElement; constructor(o: { element: HTMLElement }) { this.el = o.element; } setLngLat() { return this; } addTo() { state.container!.append(this.el); return this; } remove() { this.el.remove(); } }
  class Control {}
  return { state, lib: { Map: FakeMap, Marker, NavigationControl: Control, AttributionControl: Control } };
});
vi.mock("maplibre-gl", () => ({ default: gl.lib }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
import StreetMap, { AREA_FLIGHT } from "@/components/hh/StreetMap";

const onSettled = vi.fn();
let reduced = false, now = 0, frames: ((t: number) => void)[] = [];
/** Advance the hand-driven animation clock. */
const tick = (ms: number) => act(() => { for (let end = now + ms; now < end; ) { now = Math.min(end, now + 16); const due = frames; frames = []; due.forEach((f) => f(now)); } });
/** The map is created one frame and one timer tick after mount; wait for that and for its "load". */
const ready = () => act(async () => { const due = frames; frames = []; due.forEach((f) => f(now)); await new Promise((r) => setTimeout(r, 5)); await Promise.resolve(); });
const arrive = () => act(() => { const hs = gl.state.once; gl.state.once = []; hs.forEach((h) => h()); });
const flights = () => gl.state.calls.filter((c) => c.type === "flyTo");
const housesOpacity = () => gl.state.paint.get("hh-houses.fill-extrusion-opacity") as number;
const circleOpacity = () => (gl.state.paint.get("hh-areas-fill.fill-opacity") as unknown[]);
const circlesShown = () => gl.state.layout.get("hh-areas-fill.visibility");

function view(cityId: string) {
  const city = CITIES.find((c) => c.id === cityId)!;
  const ui = (area: Area | null) => <StreetMap city={city} area={area} houses={city.houses} layer="all" selectedId={null} hoverId={null} onPickArea={() => {}} onOpen={() => {}} onHover={() => {}} onSettled={onSettled} />;
  const area = (id: string) => city.areas.find((a) => a.id === id)!;
  return { city, ui, area };
}
beforeEach(() => {
  reduced = false; now = 0; frames = []; onSettled.mockClear(); gl.state.created = 0; gl.state.paint.clear(); gl.state.layout.clear();
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  vi.stubGlobal("requestAnimationFrame", (f: (t: number) => void) => { frames.push(f); return frames.length; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each([["durham", "claypath"], ["newcastle", "jesmond"]])("%s › %s: the camera flies in first, then the houses and the list appear — one click, same map", async (cityId, areaId) => {
  const { ui, area, city } = view(cityId);
  const r = render(ui(null));
  await ready();
  expect(circlesShown()).toBe("visible");

  r.rerender(ui(area(areaId))); // the single click: the URL now names the area
  // 1. The flight starts immediately: ~1.4 s, ease-in-out, pitch 58°, aimed at the area.
  expect(flights()).toHaveLength(1);
  const f = flights()[0]!.o!;
  expect(f["duration"]).toBe(1400);
  expect(f["pitch"]).toBe(58);
  const ease = f["easing"] as (t: number) => number;
  expect([ease(0), ease(0.25), ease(0.5), ease(0.75), ease(1)]).toEqual([0, 0.125, 0.5, 0.875, 1]);
  expect(f["zoom"] as number).toBeGreaterThanOrEqual(15);
  // …and nothing detailed has been shown yet.
  expect(onSettled).not.toHaveBeenCalled();

  // 2. During the flight the chosen circle fades out, the others dim, and the houses are faded down.
  await tick(AREA_FLIGHT.circlesOutMs);
  const idx = city.areas.findIndex((a) => a.id === areaId);
  expect(circleOpacity().slice(0, 3)).toEqual(["case", ["==", ["id"], idx], 0]);
  expect(circleOpacity()[6]).toBeCloseTo(0.2 * 0.3); // the other active circles, dimmed
  expect(housesOpacity()).toBe(0);
  expect(onSettled).not.toHaveBeenCalled();

  // 3. On arrival: circles gone, houses fade in, and the page is told to switch its list.
  await arrive();
  expect(onSettled).toHaveBeenCalledExactlyOnceWith(areaId);
  expect(circlesShown()).toBe("none");
  await tick(AREA_FLIGHT.detailInMs);
  expect(housesOpacity()).toBeCloseTo(0.95);
  expect(gl.state.created).toBe(1); // the map was never re-created

  // Back to all areas: the detail fades out first, then the camera flies up, then the circles fade back in.
  onSettled.mockClear();
  r.rerender(ui(null));
  expect(flights()).toHaveLength(1);
  await tick(AREA_FLIGHT.detailOutMs);
  expect(housesOpacity()).toBe(0);
  expect(flights()).toHaveLength(2);
  expect(flights()[1]!.o!["zoom"]).toBe(city.overviewZoom ?? 13.6);
  await arrive();
  expect(onSettled).toHaveBeenCalledExactlyOnceWith(null);
  await tick(AREA_FLIGHT.detailInMs);
  expect(circlesShown()).toBe("visible");
  expect(circleOpacity()[6]).toBeCloseTo(0.2);
  expect(housesOpacity()).toBeCloseTo(0.95);
  expect(gl.state.created).toBe(1);
});

it("opening an area directly shows the detailed view with no flight", async () => {
  const { ui, area } = view("durham");
  render(ui(area("claypath")));
  await ready();
  expect(flights()).toHaveLength(0);
  expect(circlesShown()).toBe("none");
});

it("a second area chosen mid-flight replaces the first cleanly; a drag mid-flight just ends it", async () => {
  const { ui, area } = view("durham");
  const r = render(ui(null));
  await ready();
  r.rerender(ui(area("claypath")));
  await tick(300);
  r.rerender(ui(area("elvet"))); // mid-flight
  expect(flights()).toHaveLength(2);
  expect(onSettled).not.toHaveBeenCalled(); // the abandoned flight never reports an arrival
  await arrive();
  expect(onSettled).toHaveBeenCalledExactlyOnceWith("elvet");
  await tick(AREA_FLIGHT.detailInMs);
  expect(housesOpacity()).toBeCloseTo(0.95);

  // Dragging during a flight makes MapLibre end it early; the area's detail still appears and nothing is stuck.
  onSettled.mockClear();
  r.rerender(ui(area("viaduct")));
  await tick(200);
  await arrive();
  expect(onSettled).toHaveBeenCalledExactlyOnceWith("viaduct");
  await tick(AREA_FLIGHT.detailInMs);
  expect(housesOpacity()).toBeCloseTo(0.95);
  expect(gl.state.created).toBe(1);
});

it("clicking the city breadcrumb with a house open zooms back out to the original city view", async () => {
  const city = CITIES.find((c) => c.id === "durham")!;
  const house = city.houses.find((h) => h.area === "claypath")!, claypath = city.areas.find((a) => a.id === "claypath")!;
  const ui = (area: Area | null, selectedId: string | null) => <StreetMap city={city} area={area} houses={city.houses} layer="all" selectedId={selectedId} hoverId={null} onPickArea={() => {}} onOpen={() => {}} onHover={() => {}} onSettled={onSettled} />;
  const r = render(ui(claypath, null));
  await ready();
  r.rerender(ui(claypath, house.id)); // click a house: the camera zooms in on it
  expect(flights()[0]!.o!["center"]).toEqual([house.lng, house.lat]);
  // Click "Durham" in the breadcrumb: the area is left while the house is still selected for one render…
  r.rerender(ui(null, house.id));
  await tick(AREA_FLIGHT.detailOutMs);
  r.rerender(ui(null, null)); // …then the page clears the selection
  const last = flights()[flights().length - 1]!.o!;
  expect(last["center"]).toEqual([city.center.lng, city.center.lat]);
  expect(last["zoom"]).toBe(city.overviewZoom ?? 13.6);
  expect(last["pitch"]).toBe(58);
  await arrive();
  expect(onSettled).toHaveBeenLastCalledWith(null);
});

it("flies even when the device asks for reduced motion", async () => {
  reduced = true;
  const { ui, area } = view("durham");
  const r = render(ui(null));
  await ready();
  r.rerender(ui(area("claypath")));
  expect(flights()).toHaveLength(1);
  expect(flights()[0]!.o!["essential"]).toBe(true); // tells MapLibre not to skip the animation
  expect(gl.state.calls.filter((c) => c.type === "jumpTo")).toHaveLength(0);
});
