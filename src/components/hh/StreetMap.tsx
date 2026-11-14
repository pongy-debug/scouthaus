import maplibregl, { type GeoJSONSource, type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { areaStats, type Area, type Availability, type City, type House } from "@/lib/hh/find";

// MapLibre paint needs concrete colours (mirrors design tokens)
export const AVAIL_COLOR: Record<Availability, string> = { available: "#10B981", "under-offer": "#F59E0B", let: "#64748B" };
const AVAIL_LABEL: Record<Availability, string> = { available: "Available", "under-offer": "Under offer", let: "Let" };
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const PICK_PX = 15;

type Poly = number[][][];
function square(lng: number, lat: number, m: number): Poly {
  const dLat = m / 111320, dLng = m / (111320 * Math.cos((lat * Math.PI) / 180));
  return [[[lng - dLng, lat - dLat], [lng + dLng, lat - dLat], [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]]];
}
function hexagon(lng: number, lat: number, m: number): Poly {
  const dLat = m / 111320, dLng = m / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: 7 }, (_, i) => { const a = (i % 6) * (Math.PI / 3); return [lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat]; });
  return [ring];
}
function pointIn(pt: [number, number], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi! > pt[1] !== yj! > pt[1] && pt[0] < ((xj! - xi!) * (pt[1] - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}

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

export default function StreetMap(props:
  | { mode: "overview"; city: City; onPick: (areaId: string) => void }
  | { mode: "detail"; city: City; area: Area; houses: House[]; onOpen: (h: House) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const [tip, setTip] = useState<Tip>(null);
  const houseKey = props.mode === "detail" ? props.houses.map((h) => h.id).join() : "";

  useEffect(() => {
    const p = propsRef.current;
    const center: [number, number] = p.mode === "detail" ? [p.area.lng, p.area.lat] : [p.city.center.lng, p.city.center.lat];
    const map = new maplibregl.Map({
      container: el.current!, style: STYLE, center, zoom: p.mode === "detail" ? 16.6 : 13.6, pitch: 58, bearing: -20,
      maxPitch: 70, attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: "© OpenStreetMap contributors" }), "bottom-right");
    let hoverId: number | null = null;
    const setHover = (src: string, id: number | null) => {
      if (hoverId !== null) map.setFeatureState({ source: src, id: hoverId }, { hover: false });
      hoverId = id; if (id !== null) map.setFeatureState({ source: src, id }, { hover: true });
      map.getCanvas().style.cursor = id !== null ? "pointer" : "";
    };
    const nearest = (pt: maplibregl.Point, layer: string): MapGeoJSONFeature | undefined => {
      const fs = map.queryRenderedFeatures([[pt.x - PICK_PX, pt.y - PICK_PX], [pt.x + PICK_PX, pt.y + PICK_PX]], { layers: [layer] });
      let best: MapGeoJSONFeature | undefined, bd = Infinity;
      for (const f of fs) {
        const c = map.project([f.properties["lng"] as number, f.properties["lat"] as number]);
        const d = Math.hypot(c.x - pt.x, c.y - pt.y); if (d < bd) { bd = d; best = f; }
      }
      return best;
    };

    map.on("load", () => {
      addBuildings(map);
      el.current?.closest("[data-scene-root]")?.setAttribute("data-scene-ready", "1");
      if (p.mode === "overview") setupOverview(); else setupDetail();
    });

    function setupOverview() {
      const P = propsRef.current as Extract<typeof p, { mode: "overview" }>;
      const feats = P.city.areas.map((a, i) => {
        const s = areaStats(P.city, a.id);
        return { type: "Feature" as const, id: i, properties: { id: a.id, active: a.active, lat: a.lat, lng: a.lng, h: a.active ? 40 + s.total * 8 : 20 },
          geometry: { type: "Polygon" as const, coordinates: hexagon(a.lng, a.lat, 260) } };
      });
      map.addSource("hh-areas", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
      map.addLayer({ id: "hh-areas", type: "fill-extrusion", source: "hh-areas", paint: {
        "fill-extrusion-color": ["case", ["boolean", ["feature-state", "hover"], false], "#6366F1", ["get", "active"], "#06B6D4", "#94a3b8"],
        "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.45,
      } });
      for (const a of P.city.areas) {
        const lab = document.createElement("div");
        lab.className = "pointer-events-none whitespace-nowrap rounded-md border border-border bg-card/90 px-2 py-0.5 text-[11px] font-semibold text-card-foreground shadow";
        lab.textContent = `${a.name} · ${a.postcode}${a.active ? "" : " (soon)"}`;
        if (!a.active) lab.style.opacity = "0.6";
        new maplibregl.Marker({ element: lab, anchor: "bottom", offset: [0, -30] }).setLngLat([a.lng, a.lat]).addTo(map);
      }
      map.on("mousemove", (e) => {
        const f = nearest(e.point, "hh-areas");
        setHover("hh-areas", f ? (f.id as number) : null);
        const a = f && P.city.areas.find((x) => x.id === f.properties["id"]);
        if (!a) return setTip(null);
        const s = areaStats(P.city, a.id);
        setTip({ x: e.point.x, y: e.point.y, html: a.active
          ? <><div className="font-semibold">{a.name} · {a.postcode}</div><div>{s.count} available / {s.total} houses</div><div>Avg rent £{s.avgRent} pppw</div><div className="text-primary">Click to fly in →</div></>
          : <><div className="font-semibold">{a.name}</div><div className="text-muted-foreground">Coming soon{a.note ? ` · ${a.note}` : ""}</div></> });
      });
      map.on("click", (e) => {
        const f = nearest(e.point, "hh-areas"); const a = f && P.city.areas.find((x) => x.id === f.properties["id"]);
        if (!a?.active) return;
        setTip(null);
        map.flyTo({ center: [a.lng, a.lat], zoom: 16.6, pitch: 58, duration: 1600 });
        map.once("moveend", () => propsRef.current.mode === "overview" && propsRef.current.onPick(a.id));
      });
    }

    function setupDetail() {
      map.addSource("hh-houses", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "hh-houses", type: "fill-extrusion", source: "hh-houses", paint: {
        "fill-extrusion-color": ["case", ["boolean", ["feature-state", "hover"], false], "#6366F1", ["get", "color"]],
        "fill-extrusion-height": ["+", ["get", "h"], ["case", ["boolean", ["feature-state", "hover"], false], 4, 0]],
        "fill-extrusion-opacity": 0.95,
      } });
      map.addLayer({ id: "hh-houses-outline", type: "line", source: "hh-houses", paint: { "line-color": ["get", "color"], "line-width": 3 } });
      const sync = () => syncHouses(map);
      map.once("idle", sync);
      map.on("mousemove", (e) => {
        const f = nearest(e.point, "hh-houses");
        setHover("hh-houses", f ? (f.id as number) : null);
        const P = propsRef.current; if (P.mode !== "detail") return;
        const h = f && P.houses.find((x) => x.id === f.properties["id"]);
        if (!h) return setTip(null);
        setTip({ x: e.point.x, y: e.point.y, html: <>
          <div className="font-semibold">{h.name}</div><div className="text-muted-foreground">{h.landlord} — {h.address}</div>
          <div className="mt-1 flex justify-between gap-3"><span style={{ color: AVAIL_COLOR[h.availability] }}>● {AVAIL_LABEL[h.availability]}</span><span>£{h.rent} pppw · {h.bedrooms} bed</span></div>
          <div className="text-primary">Click for X-Ray →</div></> });
      });
      map.on("click", (e) => {
        const f = nearest(e.point, "hh-houses"); const P = propsRef.current;
        const h = f && P.mode === "detail" && P.houses.find((x) => x.id === f.properties["id"]);
        if (h && P.mode === "detail") P.onOpen(h);
      });
    }
    map.getCanvasContainer().addEventListener("mouseleave", () => setTip(null));
    return () => { map.remove(); mapRef.current = null; };
  }, [props.mode, props.mode === "detail" ? props.area.id : props.city.id]);

  // Match each listing to its OSM footprint (fallback: small block), coloured by availability
  function syncHouses(map: maplibregl.Map) {
    const P = propsRef.current; if (P.mode !== "detail" || !map.getSource("hh-houses")) return;
    const feats = P.houses.map((h, i) => {
      const pt = map.project([h.lng, h.lat]);
      const hits = map.queryRenderedFeatures([[pt.x - 6, pt.y - 6], [pt.x + 6, pt.y + 6]], { layers: ["hh-buildings"] });
      const hit = hits.find((f) => f.geometry.type === "Polygon" && pointIn([h.lng, h.lat], (f.geometry as { coordinates: number[][][] }).coordinates[0]!))
        ?? hits.find((f) => f.geometry.type === "Polygon");
      const base = Number(hit?.properties["render_height"] ?? 7) || 7;
      return { type: "Feature" as const, id: i, properties: { id: h.id, color: AVAIL_COLOR[h.availability], h: base + 3, lat: h.lat, lng: h.lng },
        geometry: { type: "Polygon" as const, coordinates: hit ? (hit.geometry as { coordinates: number[][][] }).coordinates : square(h.lng, h.lat, 6) } };
    });
    (map.getSource("hh-houses") as GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
  }
  useEffect(() => { const m = mapRef.current; if (m?.isStyleLoaded()) syncHouses(m); }, [houseKey]);

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
