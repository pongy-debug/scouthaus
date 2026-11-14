import maplibregl, { type ExpressionSpecification, type GeoJSONSource, type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { AVAIL_LABEL, advertUrl, areaCircle, areaStats, riskLabel, riskOf, type Area, type Availability, type City, type House, type Risk, type RiskLayer } from "@/lib/hh/find";

// MapLibre paint needs concrete colours (mirrors design tokens)
export const AVAIL_COLOR: Record<Availability, string> = { available: "#10B981", "under-offer": "#F59E0B", let: "#64748B" };
export const RISK_COLOR: Record<Risk, string> = { low: "#10B981", med: "#F59E0B", high: "#EF4444", unknown: "#64748B" };
const INDIGO = "#6366F1";
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

function addBuildings(map: maplibregl.Map) {
  const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  map.addLayer({
    id: "hh-buildings", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 13,
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
  const { city, area, houses, layer, selectedId, hoverId } = props;
  const houseKey = houses.map((h) => h.id).join();
  const fid = (id: string | null) => (id ? city.houses.findIndex((h) => h.id === id) : -1);

  // Listings are drawn from the start as small blocks, then snapped to their OSM footprint once those tiles render.
  function syncHouses(map: maplibregl.Map) {
    const src = map.getSource("hh-houses") as GeoJSONSource | undefined; if (!src) return;
    const P = propsRef.current;
    const feats = P.houses.map((h) => {
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
      if (h.approximateLocation || footprints.current.has(h.id) || !bounds.contains([h.lng, h.lat])) continue;
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

    map.on("load", () => {
      addBuildings(map);
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
      syncHouses(map);
      map.on("idle", () => matchFootprints(map));
      el.current?.closest("[data-scene-root]")?.setAttribute("data-scene-ready", "1");
      setLoaded(true);
    });

    map.on("mousemove", (e) => {
      if (!map.getLayer("hh-houses")) return;
      const P = propsRef.current;
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
          <div className="font-semibold">{h.name}</div><div className="text-muted-foreground">{h.landlord} — {h.address}</div>
          <div className="mt-1 flex justify-between gap-3"><span style={{ color: AVAIL_COLOR[h.availability] }}>● {AVAIL_LABEL[h.availability]}</span><span>£{h.rent} pppw · {h.bedrooms} bed</span></div>
          <div style={{ color: RISK_COLOR[riskOf(h, P.layer)] }}>{riskLabel(h, P.layer)}</div>
          {h.approximateLocation && <div>Approximate location · postcode centre</div>}
          <div className="text-primary">Click for more info →</div></> });
      } else setTip(null);
    });
    map.on("click", (e) => {
      if (!map.getLayer("hh-houses")) return;
      const P = propsRef.current, hit = areaAt(e.point);
      if (hit) { if (hit.a.active) { setTip(null); setAreaHover(null); P.onPickArea(hit.a.id); } return; }
      const h = houseAt(e.point); if (h) { setTip(null); P.onOpen(h); }
    });
    const leave = () => { setTip(null); setAreaHover(null); hover(null); };
    map.getCanvasContainer().addEventListener("mouseleave", leave);
    return () => { selMarker.current = null; labels.current = []; map.remove(); mapRef.current = null; setLoaded(false); };
  }, [city.id]);

  // Redraw listings when the filters or the risk layer change.
  useEffect(() => { const m = mapRef.current; if (m && loaded) syncHouses(m); }, [loaded, houseKey, layer]);

  // Entering an area hides the circles and their labels so they can't block the buildings.
  useEffect(() => {
    const m = mapRef.current; if (!m || !loaded) return;
    for (const id of ["hh-areas-fill", "hh-areas-line"]) m.setLayoutProperty(id, "visibility", area ? "none" : "visible");
    for (const l of labels.current) l.style.display = area ? "none" : "";
  }, [loaded, area?.id]);

  // Camera: fly to a newly selected house, otherwise to the area that was just entered (or back out).
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    const prev = flown.current; flown.current = { area: area?.id ?? null, sel: selectedId };
    const sel = selectedId ? city.houses.find((h) => h.id === selectedId) : undefined;
    const areaChanged = (area?.id ?? null) !== prev.area;
    if (sel && (selectedId !== prev.sel || areaChanged)) m.flyTo({ center: [sel.lng, sel.lat], zoom: Math.max(m.getZoom(), 17), ...VIEW, duration: 1400 });
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
    tag.textContent = `${h.name} · £${h.rent} pppw · ${h.bedrooms} bed · ${AVAIL_LABEL[h.availability]}`;
    if (h.approximateLocation) tag.textContent += " · Approximate location";
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
    </div>
  );
}
