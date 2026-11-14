import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { LANDMARKS, project, WEAR, type Area, type Availability, type House } from "@/lib/hh/find";
import { Lights, P, markReady, streetTexture } from "./sceneKit";

export const PER_KM = 40; // 100 m = 4 units
export const AVAIL: Record<Availability, { label: string; color: string }> = {
  available: { label: "Available", color: P.green },
  "under-offer": { label: "Under offer", color: P.amber },
  let: { label: "Let", color: P.slate },
};

function rng(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

function Filler({ avoid, seed }: { avoid: [number, number][]; seed: number }) {
  const geo = useMemo(() => {
    const r = rng(seed); const boxes: THREE.BoxGeometry[] = [];
    for (let i = 0; i < 160; i++) {
      const x = (r() - 0.5) * 34, z = (r() - 0.5) * 34;
      if (avoid.some(([ax, az]) => Math.hypot(ax - x, az - z) < 1.6)) continue;
      const hh = 0.4 + r() * 1.4, b = new THREE.BoxGeometry(0.6 + r() * 0.8, hh, 0.6 + r() * 0.8);
      b.translate(x, hh / 2, z); boxes.push(b);
    }
    // merge into one draw call
    const pos: number[] = [], nor: number[] = [], idx: number[] = []; let o = 0;
    for (const b of boxes) { const p = b.attributes["position"]!, n = b.attributes["normal"]!; pos.push(...(p.array as Float32Array)); nor.push(...(n.array as Float32Array)); idx.push(...Array.from(b.index!.array).map((v) => v + o)); o += p.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    return g;
  }, [avoid, seed]);
  return <mesh geometry={geo}><meshStandardMaterial color={P.block} roughness={0.8} /></mesh>;
}

export default function AreaDetailScene({ area, houses, hovered, setHovered, onOpen }: {
  area: Area; houses: House[]; hovered: string | null; setHovered: (id: string | null) => void; onOpen: (h: House) => void;
}) {
  const origin = { lat: area.lat, lng: area.lng };
  const tex = useMemo(() => { const t = streetTexture(1024, 64); t.repeat.set(2, 2); return t; }, []);
  const pts = useMemo(() => houses.map((h) => project(h.lat, h.lng, origin, PER_KM)), [houses, area.id]);
  const river = useMemo(() => {
    const v = WEAR.map(([la, ln]) => { const [x, z] = project(la, ln, origin, PER_KM); return new THREE.Vector3(x, 0.03, z); });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v), 200, 0.9, 8, false);
  }, [area.id]);
  const marks = LANDMARKS.map((l) => ({ ...l, p: project(l.lat, l.lng, origin, PER_KM) })).filter((l) => Math.hypot(...l.p) < 20);
  const seed = [...area.id].reduce((s, c) => s + c.charCodeAt(0), 1);

  return (
    <Canvas camera={{ position: [0, 14, 16], fov: 42 }} dpr={[1, 2]} onCreated={({ gl }) => markReady(gl.domElement)} onPointerMissed={() => setHovered(null)}>
      <color attach="background" args={[P.bg]} />
      <fog attach="fog" args={[P.bg, 24, 50]} />
      <Lights />
      <mesh rotation-x={-Math.PI / 2}><planeGeometry args={[40, 40]} /><meshStandardMaterial map={tex} roughness={0.9} /></mesh>
      <mesh geometry={river} scale={[1, 0.06, 1]}><meshStandardMaterial color={P.river} emissive={P.cyan} emissiveIntensity={0.3} /></mesh>
      <Html><span /></Html>
      <Filler avoid={[...pts, ...marks.map((m) => m.p)]} seed={seed} />
      {marks.map((m) => (
        <group key={m.name} position={[m.p[0], 0, m.p[1]]}>
          {m.kind === "viaduct" ? (
            Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[(i - 3) * 0.9, 0.8, 0]}><boxGeometry args={[0.3, 1.6, 0.4]} /><meshStandardMaterial color="#3a4560" /></mesh>)
          ) : (
            <>
              <mesh position={[0, 0.7, 0]}><boxGeometry args={[m.kind === "cathedral" ? 3 : 1.8, 1.4, 1]} /><meshStandardMaterial color="#3a4560" /></mesh>
              <mesh position={[0.3, 1.9, 0]}><boxGeometry args={[0.7, 2.4, 0.7]} /><meshStandardMaterial color="#44506b" /></mesh>
            </>
          )}
          {m.kind === "viaduct" && <mesh position={[0, 1.65, 0]}><boxGeometry args={[6.6, 0.2, 0.5]} /><meshStandardMaterial color="#44506b" /></mesh>}
          <Html position={[0, 3.6, 0]} center distanceFactor={14}><span className="pointer-events-none whitespace-nowrap font-mono text-[10px] text-muted-foreground">{m.name}</span></Html>
        </group>
      ))}
      {houses.map((h, i) => {
        const [x, z] = pts[i]!; const on = hovered === h.id; const c = AVAIL[h.availability];
        const hgt = 0.8 + h.bedrooms * 0.25;
        return (
          <group key={h.id} position={[x, 0, z]}>
            <mesh position={[0, hgt / 2, 0]} scale={on ? 1.12 : 1}>
              <boxGeometry args={[1.1, hgt, 1.1]} />
              <meshStandardMaterial color={c.color} emissive={on ? P.indigo : c.color} emissiveIntensity={on ? 0.9 : 0.35} />
            </mesh>
            <mesh position={[0, hgt + 0.25, 0]} rotation-y={Math.PI / 4}><coneGeometry args={[0.85, 0.5, 4]} /><meshStandardMaterial color={c.color} /></mesh>
            {/* generous invisible hover radius */}
            <mesh position={[0, 1, 0]} visible={false}
              onPointerOver={(e) => { e.stopPropagation(); setHovered(h.id); document.body.style.cursor = "pointer"; }}
              onPointerOut={() => { document.body.style.cursor = "default"; }}
              onClick={(e) => { e.stopPropagation(); if ((e.nativeEvent as PointerEvent).pointerType === "touch" && hovered !== h.id) setHovered(h.id); else onOpen(h); }}>
              <cylinderGeometry args={[1.9, 1.9, 3, 12]} />
            </mesh>
            {on && (
              <Html position={[0, hgt + 1.2, 0]} center distanceFactor={14} zIndexRange={[20, 0]}>
                <div className="glass pointer-events-none w-52 p-2 text-xs">
                  <div className="font-semibold">{h.name}</div>
                  <div className="text-muted-foreground">{h.landlord} — {h.address}</div>
                  <div className="mt-1 flex items-center justify-between font-mono text-[11px]">
                    <span style={{ color: c.color }}>● {c.label}</span><span>£{h.rent} pppw · {h.bedrooms} bed</span>
                  </div>
                  <div className="mt-1 text-[10px] text-primary">Click (or tap again) for X-Ray →</div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
      <OrbitControls makeDefault enableDamping maxPolarAngle={1.3} minDistance={5} maxDistance={32} />
    </Canvas>
  );
}
