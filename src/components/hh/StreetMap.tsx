import maplibregl, { type ExpressionSpecification, type GeoJSONSource, type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AVAIL_LABEL, advertUrl, areaCircle, areaStats, bedsOf, rentOf, riskLabel, riskOf, estimatedWalkMinutes, type Area, type Availability, type City, type House, type Risk, type RiskLayer } from "@/lib/hh/find";
import { landmarksFor, type Landmark } from "@/lib/hh/landmarks";

// MapLibre paint needs concrete colours (mirrors design tokens)
export const AVAIL_COLOR: Record<Availability, string> = { available: "#10B981", "under-offer": "#F59E0B", let: "#64748B" };
export const RISK_COLOR: Record<Risk, string> = { low: "#10B981", med: "#F59E0B", high: "#EF4444", unknown: "#64748B" };
const INDIGO = "#6366F1";
/** Reserved for landmarks under the cursor — never used for availability or risk colours. */
export const LANDMARK_CYAN = "#22D3EE";
const LANDMARK_REST = "#e3e6eb";
const LANDMARK_LABEL_ZOOM = 14.5;
const lmLayer = (id: string) => `hh-landmark-${id}`;
/** OpenFreeMap building features carry the OSM id as id × 10 + element type, which lets a landmark's own footprints be hidden from the base layer. */
const tileId = (ref: string) => { const [type, id] = ref.split("/"); return Number(id) * 10 + (type === "relation" ? 3 : type === "way" ? 2 : 1); };
/** Footprints as GeoJSON, a hair larger and taller than the OSM shape so they always cover the base building beneath. */
function landmarkFeatures(l: Landmark) {
  const grow = ([lng, lat]: number[]) => [l.lng + (lng! - l.lng) * 1.012, l.lat + (lat! - l.lat) * 1.012];
  return l.footprints.map((f) => ({ type: "Feature" as const, properties: { lm: l.id, h: f.h + 0.6, base: f.base ?? 0 }, geometry: { type: "Polygon" as const, coordinates: f.rings.map((r) => r.map(grow)) } }));
}
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const PICK_PX = 15;
const OVERVIEW_ZOOM = 13.6;
const VIEW = { pitch: 58, bearing: -20 };

type Poly = number[][][];
const metres = (lat: number, m: number) => ({ dLat: m / 111320, dLng: m / (111320 * Math.cos((lat * Math.PI) / 180)) });
function square(lng: number, lat: number, m: number): Poly {
  const { dLat, dLng } = metres(lat, m);
  return [[[lng - dLng, lat - dLat], [lng + dLng, lat - dLat], [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]]];
}
function circle(lng: number, lat: number, m: number): Poly {
  const { dLat, dLng } = metres(lat, m);
  return [Array.from({ length: 65 }, (_, i) => { const a = ((i % 64) / 64) * Math.PI * 2; return [lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat]; })];
}
function pointIn(pt: [number, number], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi! > pt[1] !== yj! > pt[1] && pt[0] < ((xj! - xi!) * (pt[1] - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}
/** Zoom that fits an area circle of radius `r` metres. */
const areaZoom = (r: number) => Math.max(15, Math.min(16.8, 16.6 - Math.log2(r / 200)));

function addBuildings(map: maplibregl.Map, landmarks: Landmark[]) {
  const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  map.addLayer({
    id: "hh-buildings", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 13,
    // Landmarks are drawn by their own layers, so their footprints are left out here.
    filter: ["!", ["in", ["id"], ["literal", landmarks.flatMap((l) => l.osmIds.map(tileId))]]],
    paint: {
      "fill-extrusion-color": "#eef0f3",
      // OSM height / building:levels (render_height); otherwise 7 m
      "fill-extrusion-height": ["coalesce", ["get", "render_height"], 7],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": 0.92,
      "fill-extrusion-vertical-gradient": true,
    },
  }, firstSymbol);
}

type Tip = { x: number; y: number; html: React.ReactNode } | null;
export interface StreetMapProps {
  city: City;
  /** Area the user has entered, or null on the overview. */
  area: Area | null;
  /** Listed houses to draw (already filtered), across every area. */
  houses: House[];
  layer: RiskLayer;
  selectedId: string | null;
  hoverId: string | null;
  onTour?: () => void;
  onPickArea: (areaId: string) => void;
  onOpen: (h: House) => void;
  onHover: (houseId: string | null) => void;
}

/** The single Scouthaus map: area circles on the overview, extruded OSM buildings and risk-coloured listings everywhere. */
export default function StreetMap(props: StreetMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const footprints = useRef(new Map<string, { coords: Poly; h: number }>());
  const labels = useRef<HTMLElement[]>([]);
  const selMarker = useRef<maplibregl.Marker | null>(null);
  const flown = useRef({ area: props.area?.id ?? null, sel: props.selectedId });
  const [loaded, setLoaded] = useState(false);
  const [tip, setTip] = useState<Tip>(null);
  // Landmark under the cursor (or tapped): its building turns cyan and its card opens, anchored to the building.
  const [lmId, setLmId] = useState<string | null>(null);
  const [cardEl] = useState(() => {
    const d = document.createElement("div"); d.style.zIndex = "6";
    // The card sits inside the map container: keep its clicks and taps from reaching the map underneath.
    for (const type of ["click", "dblclick", "mousedown", "touchstart"]) d.addEventListener(type, (e) => e.stopPropagation());
    return d;
  });
  const lmClose = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overCard = useRef(false);
  const showLandmark = (id: string) => { if (lmClose.current) { clearTimeout(lmClose.current); lmClose.current = null; } setLmId(id); };
  const hideLandmark = (now = false) => {
    if (lmClose.current) clearTimeout(lmClose.current);
    if (now) { lmClose.current = null; setLmId(null); } else lmClose.current = setTimeout(() => { lmClose.current = null; setLmId(null); }, 250);
  };
  const lmApi = useRef({ showLandmark, hideLandmark }); lmApi.current = { showLandmark, hideLandmark };
  const { city, area, houses, layer, selectedId, hoverId } = props;
  const houseKey = houses.map((h) => h.id).join();
  const fid = (id: string | null) => (id ? city.houses.findIndex((h) => h.id === id) : -1);

  // Listings are drawn from the start as small blocks, then snapped to their OSM footprint once those tiles render.
  function syncHouses(map: maplibregl.Map) {
    const src = map.getSource("hh-houses") as GeoJSONSource | undefined; if (!src) return;
    const P = propsRef.current;
    const feats = P.houses.filter((h) => !(P.selectedId === "claypath-ruth" && h.id === "claypath-ruth")).map((h) => {
      const fp = footprints.current.get(h.id);
      return { type: "Feature" as const, id: fid(h.id), properties: { id: h.id, color: RISK_COLOR[riskOf(h, P.layer)], h: (fp?.h ?? 7) + 3, lat: h.lat, lng: h.lng },
        geometry: { type: "Polygon" as const, coordinates: fp?.coords ?? square(h.lng, h.lat, 6) } };
    });
    src.setData({ type: "FeatureCollection", features: feats });
  }
  function matchFootprints(map: maplibregl.Map) {
    if (map.getZoom() < 15 || !map.getLayer("hh-buildings")) return;
    const bounds = map.getBounds(); let found = false;
    for (const h of propsRef.current.city.houses) {
      if (h.approximateLocation || h.approximate || footprints.current.has(h.id) || !bounds.contains([h.lng, h.lat])) continue;
      const pt = map.project([h.lng, h.lat]);
      const hits = map.queryRenderedFeatures([[pt.x - 6, pt.y - 6], [pt.x + 6, pt.y + 6]], { layers: ["hh-buildings"] }).filter((f) => f.geometry.type === "Polygon");
      const hit = hits.find((f) => pointIn([h.lng, h.lat], (f.geometry as { coordinates: Poly }).coordinates[0]!)) ?? hits[0];
      if (!hit) continue;
      footprints.current.set(h.id, { coords: (hit.geometry as { coordinates: Poly }).coordinates, h: Number(hit.properties["render_height"] ?? 7) || 7 });
      found = true;
    }
    if (found) syncHouses(map);
  }

  useEffect(() => {
    const p = propsRef.current;
    const start = p.area ? areaCircle(p.city, p.area) : null;
    const map = new maplibregl.Map({
      container: el.current!, style: STYLE, ...VIEW, maxPitch: 70, attributionControl: false,
      center: start ? [start.lng, start.lat] : [p.city.center.lng, p.city.center.lat], zoom: start ? areaZoom(start.r) : (p.city.overviewZoom ?? OVERVIEW_ZOOM),
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
    // Leave the bottom-left corner free for the Ask-the-map bubble.
    const corner = map.getContainer().querySelector<HTMLElement>(".maplibregl-ctrl-bottom-left"); if (corner) corner.style.bottom = "52px";
    map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: "© OpenStreetMap contributors" }), "bottom-right");
    const lmLabels: HTMLElement[] = [];
    let areaHover: number | null = null;
    const setAreaHover = (id: number | null) => {
      if (id === areaHover) return;
      if (areaHover !== null) map.setFeatureState({ source: "hh-areas", id: areaHover }, { hover: false });
      areaHover = id; if (id !== null) map.setFeatureState({ source: "hh-areas", id }, { hover: true });
    };
    const hover = (id: string | null) => { if (id !== propsRef.current.hoverId) propsRef.current.onHover(id); };
    const houseAt = (pt: maplibregl.Point): House | undefined => {
      const fs = map.queryRenderedFeatures([[pt.x - PICK_PX, pt.y - PICK_PX], [pt.x + PICK_PX, pt.y + PICK_PX]], { layers: ["hh-houses"] });
      let best: MapGeoJSONFeature | undefined, bd = Infinity;
      for (const f of fs) {
        const c = map.project([f.properties["lng"] as number, f.properties["lat"] as number]);
        const d = Math.hypot(c.x - pt.x, c.y - pt.y); if (d < bd) { bd = d; best = f; }
      }
      return best && propsRef.current.houses.find((h) => h.id === best.properties["id"]);
    };
    // Area circles only exist (and only take clicks) on the overview.
    const areaAt = (pt: maplibregl.Point): { a: Area; i: number } | undefined => {
      const P = propsRef.current; if (P.area) return;
      let best: { a: Area; i: number } | undefined, bd = Infinity;
      for (const f of map.queryRenderedFeatures(pt, { layers: ["hh-areas-fill"] })) {
        const i = f.id as number, a = P.city.areas[i]; if (!a) continue;
        const c = map.project([f.properties["lng"] as number, f.properties["lat"] as number]);
        const d = Math.hypot(c.x - pt.x, c.y - pt.y); if (d < bd) { bd = d; best = { a, i }; }
      }
      return best;
    };

    const landmarks = landmarksFor(p.city.id);
    const landmarkAt = (pt: maplibregl.Point): string | undefined => {
      const layers = landmarks.map((l) => lmLayer(l.id)).filter((id) => map.getLayer(id));
      return layers.length ? (map.queryRenderedFeatures(pt, { layers })[0]?.properties["lm"] as string | undefined) : undefined;
    };
    let lmHover: string | null = null;
    map.on("load", () => {
      addBuildings(map, landmarks);
      for (const l of landmarks) {
        map.addSource(lmLayer(l.id), { type: "geojson", data: { type: "FeatureCollection", features: landmarkFeatures(l) } });
        // One layer per landmark with a plain colour, so the change to cyan and back is a real 150 ms transition.
        map.addLayer({ id: lmLayer(l.id), type: "fill-extrusion", source: lmLayer(l.id), paint: {
          "fill-extrusion-color": LANDMARK_REST, "fill-extrusion-color-transition": { duration: 150, delay: 0 },
          "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-opacity": 0.96, "fill-extrusion-vertical-gradient": true,
        } });
        const lab = document.createElement("div");
        lab.className = "pointer-events-none whitespace-nowrap rounded-full border border-cyan-400/60 bg-card/90 px-2 py-0.5 text-[10px] font-medium text-card-foreground shadow";
        lab.textContent = l.name; lab.dataset["landmarkLabel"] = l.id;
        new maplibregl.Marker({ element: lab, anchor: "bottom", offset: [0, -14] }).setLngLat([l.lng, l.lat]).addTo(map);
        lmLabels.push(lab);
      }
      const showLabels = () => { for (const lab of lmLabels) lab.style.display = map.getZoom() >= LANDMARK_LABEL_ZOOM ? "" : "none"; };
      map.on("zoom", showLabels); showLabels();
      const feats = p.city.areas.map((a, i) => {
        const c = areaCircle(p.city, a);
        return { type: "Feature" as const, id: i, properties: { active: a.active, lat: c.lat, lng: c.lng }, geometry: { type: "Polygon" as const, coordinates: circle(c.lng, c.lat, c.r) } };
      });
      map.addSource("hh-areas", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
      const hov: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
      map.addLayer({ id: "hh-areas-fill", type: "fill", source: "hh-areas", paint: {
        "fill-color": ["case", ["get", "active"], INDIGO, "#94a3b8"], "fill-opacity": ["case", hov, 0.42, ["get", "active"], 0.2, 0.12],
      } });
      map.addLayer({ id: "hh-areas-line", type: "line", source: "hh-areas", paint: {
        "line-color": ["case", ["get", "active"], INDIGO, "#94a3b8"], "line-width": ["case", hov, 4, 2],
      } });
      labels.current = p.city.areas.map((a) => {
        const c = areaCircle(p.city, a);
        const lab = document.createElement("div");
        lab.className = "pointer-events-none whitespace-nowrap rounded-md border border-border bg-card/90 px-2 py-0.5 text-[11px] font-semibold text-card-foreground shadow";
        lab.textContent = `${a.name} · ${a.postcode}${a.active ? "" : " (soon)"}`;
        if (!a.active) lab.style.opacity = "0.6";
        new maplibregl.Marker({ element: lab, anchor: "bottom", offset: [0, -8] }).setLngLat([c.lng, c.lat]).addTo(map);
        return lab;
      });

      map.addSource("hh-houses", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      const lit: ExpressionSpecification = ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "selected"], false]];
      map.addLayer({ id: "hh-houses", type: "fill-extrusion", source: "hh-houses", paint: {
        "fill-extrusion-color": ["case", lit, INDIGO, ["get", "color"]],
        "fill-extrusion-height": ["+", ["get", "h"], ["case", lit, 4, 0]],
        "fill-extrusion-opacity": 0.95,
      } });
      map.addLayer({ id: "hh-houses-outline", type: "line", source: "hh-houses", paint: { "line-color": ["case", lit, INDIGO, ["get", "color"]], "line-width": 3 } });
      const ruth = p.city.houses.find((h) => h.id === "claypath-ruth");
      if (ruth) {
        // Schematic four-storey preview at the listing's approximate pin, not an OSM footprint.
        map.addSource("hh-ruth-floors", { type: "geojson", data: { type: "FeatureCollection", features: [0, 1, 2, 3].map((floor) => ({
          type: "Feature" as const, properties: { floor, base: floor * 3.2, height: floor * 3.2 + 3, color: floor === 3 ? "#10b981" : "#64748b" },
          geometry: { type: "Polygon" as const, coordinates: square(ruth.lng, ruth.lat, 8) },
        })) } });
        map.addLayer({ id: "hh-ruth-floors", type: "fill-extrusion", source: "hh-ruth-floors", layout: { visibility: p.selectedId === "claypath-ruth" ? "visible" : "none" }, paint: {
          "fill-extrusion-color": ["get", "color"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "height"], "fill-extrusion-opacity": 1,
        } });
        if (p.selectedId === "claypath-ruth") map.flyTo({ center: [ruth.lng, ruth.lat], zoom: 19, pitch: 65, bearing: -25, duration: 1800 });
      }
      syncHouses(map);
      map.on("idle", () => matchFootprints(map));
      el.current?.closest("[data-scene-root]")?.setAttribute("data-scene-ready", "1");
      setLoaded(true);
    });

    map.on("mousemove", (e) => {
      if (!map.getLayer("hh-houses")) return;
      const P = propsRef.current;
      if (overCard.current) return; // the cursor is on the landmark card, which sits above the map
      if (P.selectedId === "claypath-ruth" && map.getLayer("hh-ruth-floors")) {
        const floor = map.queryRenderedFeatures(e.point, { layers: ["hh-ruth-floors"] })[0];
        if (floor) {
          const top = floor.properties["floor"] === 3;
          hover(null); setAreaHover(null); map.getCanvas().style.cursor = top ? "pointer" : "";
          setTip({ x: e.point.x, y: e.point.y, html: <><b>Ruth First House</b><div>{top ? "Top floor - Click to enter Flat 4 tour" : "No tour available for this floor"}</div><div>Illustrative building and floor placement</div></> });
          return;
        }
      }
      const lm = landmarkAt(e.point);
      if (lm) {
        // A landmark is not a listing: no house hover, no area hover, no tooltip — just its own card.
        lmHover = lm; lmApi.current.showLandmark(lm); setAreaHover(null); hover(null); setTip(null);
        map.getCanvas().style.cursor = "pointer";
        return;
      }
      if (lmHover) { lmHover = null; lmApi.current.hideLandmark(); }
      const hit = areaAt(e.point), h = hit ? undefined : houseAt(e.point);
      setAreaHover(hit ? hit.i : null); hover(h ? h.id : null);
      map.getCanvas().style.cursor = h || hit?.a.active ? "pointer" : "";
      if (hit) {
        const s = areaStats(P.city, hit.a.id);
        setTip({ x: e.point.x, y: e.point.y, html: hit.a.active
          ? <><div className="font-semibold">{hit.a.name} · {hit.a.postcode}</div><div>{s.count} available / {s.total} houses</div><div>Avg rent £{s.avgRent} pppw</div><div className="text-primary">Click to fly in →</div></>
          : <><div className="font-semibold">{hit.a.name}</div><div className="text-muted-foreground">Coming soon{hit.a.note ? ` · ${hit.a.note}` : ""}</div></> });
      } else if (h) {
        setTip({ x: e.point.x, y: e.point.y, html: <>
          <div className="font-semibold">{h.name}</div><div className="text-muted-foreground">{h.landlord} — {h.address}{h.approximate && " · approximate location"}</div>
          <div className="mt-1 flex justify-between gap-3"><span style={{ color: AVAIL_COLOR[h.availability] }}>● {AVAIL_LABEL[h.availability]}</span><span>{rentOf(h)} · {bedsOf(h)}</span></div>
          <div style={{ color: RISK_COLOR[riskOf(h, P.layer)] }}>{riskLabel(h, P.layer)}</div>
          {h.approximateLocation && <div>Approximate location · postcode centre</div>}
          <div className="text-primary">Click for more info →</div></> });
      } else setTip(null);
    });
    map.on("click", (e) => {
      if (!map.getLayer("hh-houses")) return;
      if (propsRef.current.selectedId === "claypath-ruth" && map.getLayer("hh-ruth-floors")) {
        const floor = map.queryRenderedFeatures(e.point, { layers: ["hh-ruth-floors"] })[0];
        if (floor) { if (floor.properties["floor"] === 3) { setTip(null); propsRef.current.onTour?.(); } return; }
      }
      // Tapping a landmark opens its card (never the Property X-Ray); tapping anywhere else closes it.
      const lm = landmarkAt(e.point);
      if (lm) { setTip(null); lmHover = lm; lmApi.current.showLandmark(lm); return; }
      lmHover = null; lmApi.current.hideLandmark(true);
      const P = propsRef.current, hit = areaAt(e.point);
      if (hit) { if (hit.a.active) { setTip(null); setAreaHover(null); P.onPickArea(hit.a.id); } return; }
      const h = houseAt(e.point); if (h) { setTip(null); P.onOpen(h); }
    });
    const leave = () => { setTip(null); setAreaHover(null); hover(null); if (lmHover) { lmHover = null; lmApi.current.hideLandmark(); } };
    map.getCanvasContainer().addEventListener("mouseleave", leave);
    return () => { selMarker.current = null; labels.current = []; map.remove(); mapRef.current = null; setLoaded(false); };
  }, [city.id]);

  // The hovered landmark's whole building turns cyan; every other landmark returns to its normal colour.
  useEffect(() => {
    const m = mapRef.current; if (!m || !loaded) return;
    for (const l of landmarksFor(city.id)) if (m.getLayer(lmLayer(l.id))) m.setPaintProperty(lmLayer(l.id), "fill-extrusion-color", l.id === lmId ? LANDMARK_CYAN : LANDMARK_REST);
    const l = landmarksFor(city.id).find((x) => x.id === lmId);
    if (!l) return;
    const marker = new maplibregl.Marker({ element: cardEl, anchor: "bottom", offset: [0, -18] }).setLngLat([l.lng, l.lat]).addTo(m);
    return () => { marker.remove(); overCard.current = false; };
  }, [loaded, lmId]);
  useEffect(() => () => { if (lmClose.current) clearTimeout(lmClose.current); }, []);

  // Redraw listings when the filters or the risk layer change.
  useEffect(() => { const m = mapRef.current; if (m && loaded) syncHouses(m); }, [loaded, houseKey, layer]);

  // Entering an area hides the circles and their labels so they can't block the buildings.
  useEffect(() => {
    const m = mapRef.current; if (!m || !loaded) return;
    for (const id of ["hh-areas-fill", "hh-areas-line"]) m.setLayoutProperty(id, "visibility", area ? "none" : "visible");
    for (const l of labels.current) l.style.display = area ? "none" : "";
    if (m.getLayer("hh-ruth-floors")) m.setLayoutProperty("hh-ruth-floors", "visibility", selectedId === "claypath-ruth" ? "visible" : "none");
    syncHouses(m);
  }, [loaded, area?.id, selectedId]);

  // Camera: fly to a newly selected house, otherwise to the area that was just entered (or back out).
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    const prev = flown.current; flown.current = { area: area?.id ?? null, sel: selectedId };
    const sel = selectedId ? city.houses.find((h) => h.id === selectedId) : undefined;
    const areaChanged = (area?.id ?? null) !== prev.area;
    if (sel && (selectedId !== prev.sel || areaChanged)) m.flyTo({ center: [sel.lng, sel.lat], zoom: sel.id === "claypath-ruth" ? 19 : Math.max(m.getZoom(), 17), ...VIEW, duration: 1400 });
    else if (areaChanged) {
      if (area) { const c = areaCircle(city, area); m.flyTo({ center: [c.lng, c.lat], zoom: areaZoom(c.r), ...VIEW, duration: 1600 }); }
      else m.flyTo({ center: [city.center.lng, city.center.lat], zoom: city.overviewZoom ?? OVERVIEW_ZOOM, ...VIEW, duration: 1400 });
    }
  }, [area?.id, selectedId]);

  // Highlight the hovered and the selected listing; the selected one keeps a tooltip pinned above it.
  useEffect(() => {
    const m = mapRef.current; if (!m || !loaded) return;
    const ids = [fid(hoverId), fid(selectedId)].filter((i) => i >= 0);
    for (const id of ids) m.setFeatureState({ source: "hh-houses", id }, id === fid(selectedId) ? { selected: true } : { hover: true });
    return () => { if (mapRef.current === m) for (const id of ids) m.setFeatureState({ source: "hh-houses", id }, { hover: false, selected: false }); };
  }, [loaded, hoverId, selectedId]);
  useEffect(() => {
    const m = mapRef.current, h = selectedId ? city.houses.find((x) => x.id === selectedId) : undefined;
    if (!m || !loaded || !h) return;
    const tag = document.createElement("div");
    tag.className = "pointer-events-none whitespace-nowrap rounded-md border border-primary bg-popover px-2 py-1 font-mono text-[11px] text-popover-foreground shadow-lg";
    tag.textContent = `${h.name} · ${rentOf(h)} · ${bedsOf(h)} · ${AVAIL_LABEL[h.availability]}`;
    if (h.approximateLocation || h.approximate) tag.textContent += " · Approximate location";
    const url = advertUrl(h);
    if (url) {
      // Only listings with a real advert get a link; the tooltip becomes clickable for it.
      const link = Object.assign(document.createElement("a"), { href: url, target: "_blank", rel: "noopener noreferrer", textContent: "View original advert ↗" });
      link.className = "ml-2 text-primary underline";
      tag.append(link); tag.classList.remove("pointer-events-none");
    }
    const marker = new maplibregl.Marker({ element: tag, anchor: "bottom", offset: [0, -34] }).setLngLat([h.lng, h.lat]).addTo(m);
    selMarker.current = marker;
    return () => { if (selMarker.current === marker) { marker.remove(); selMarker.current = null; } };
  }, [loaded, selectedId]);

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="h-full w-full" />
      {tip && (
        <div className="pointer-events-none absolute z-10 w-56 rounded-md border border-border bg-popover p-2 font-mono text-[11px] text-popover-foreground shadow-lg"
          style={{ left: tip.x + 14, top: tip.y + 14 }}>{tip.html}</div>
      )}
      {(() => {
        const l = landmarksFor(city.id).find((x) => x.id === lmId);
        const from = selectedId ? city.houses.find((h) => h.id === selectedId) : undefined;
        return l ? createPortal(<LandmarkCard landmark={l} from={from}
          onEnter={() => { overCard.current = true; showLandmark(l.id); }} onLeave={() => { overCard.current = false; hideLandmark(); }} />, cardEl) : null;
      })()}
    </div>
  );
}

/** Popup for a landmark: photo with its Wikimedia Commons credit, name, type, postcode and the walk from the selected house. */
export function LandmarkCard({ landmark: l, from, onEnter, onLeave }: { landmark: Landmark; from?: House | undefined; onEnter?: () => void; onLeave?: () => void }) {
  return (
    <div role="dialog" aria-label={l.name} onMouseEnter={onEnter} onMouseLeave={onLeave}
      className="w-60 cursor-default overflow-hidden rounded-lg border border-cyan-400/60 bg-popover text-left text-popover-foreground shadow-xl">
      {l.photo && <img src={l.photo.url} alt={l.name} width={400} loading="lazy" referrerPolicy="no-referrer" className="h-32 w-full object-cover" />}
      <div className="space-y-0.5 p-2.5">
        <p className="text-sm font-semibold leading-tight">{l.name}</p>
        <p className="text-xs text-muted-foreground">{l.type} · <span className="font-mono">{l.postcode}</span></p>
        {from && <p className="text-xs">About {estimatedWalkMinutes(from, l)} min walk from {from.name}</p>}
        {l.photo && <p className="pt-1 text-[10px] leading-snug text-muted-foreground">Photo: {l.photo.author}, {l.photo.licence}, via <a href={l.photo.page} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Wikimedia Commons</a></p>}
      </div>
    </div>
  );
}
