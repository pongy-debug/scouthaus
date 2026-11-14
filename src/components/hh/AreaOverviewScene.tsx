import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { areaStats, project, WEAR, type Area, type City } from "@/lib/hh/find";
import { OVERVIEW_PER_KM, overviewPos } from "./overviewPos";
import { Lights, P, markReady, streetTexture } from "./sceneKit";

const PER_KM = OVERVIEW_PER_KM;

function Flyer({ goal, onArrive }: { goal: THREE.Vector3 | null; onArrive: () => void }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: { target: THREE.Vector3; update: () => void } | null };
  const done = useRef(false);
  useFrame((_, d) => {
    if (!goal || !controls || done.current) return;
    const k = 1 - Math.exp(-5 * Math.min(d, 0.05));
    controls.target.lerp(goal, k);
    camera.position.lerp(goal.clone().add(new THREE.Vector3(0, 3, 3.5)), k);
    controls.update();
    if (camera.position.distanceTo(goal) < 5.2) { done.current = true; onArrive(); }
  });
  return null;
}

function River({ city }: { city: City }) {
  const geo = useMemo(() => {
    const pts = WEAR.map(([la, ln]) => { const [x, z] = project(la, ln, city.center, PER_KM); return new THREE.Vector3(x, 0.02, z); });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.22, 8, false);
  }, [city]);
  return <mesh geometry={geo} scale={[1, 0.1, 1]}><meshStandardMaterial color={P.river} emissive={P.cyan} emissiveIntensity={0.3} /></mesh>;
}

function Region({ city, a, hovered, setHovered, onPick }: { city: City; a: Area; hovered: boolean; setHovered: (id: string | null) => void; onPick: () => void }) {
  const [x, z] = overviewPos(city, a);
  const s = areaStats(city, a.id);
  const hgt = a.active ? 0.4 + s.total * 0.12 : 0.25;
  const col = !a.active ? P.dim : hovered ? P.indigo : P.block;
  return (
    <group position={[x, 0, z]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(a.id); document.body.style.cursor = a.active ? "pointer" : "default"; }}
      onPointerOut={() => { setHovered(null); document.body.style.cursor = "default"; }}
      onClick={(e) => { e.stopPropagation(); if (a.active) onPick(); }}>
      <mesh position={[0, hgt / 2, 0]}>
        <cylinderGeometry args={[1.15, 1.25, hgt, 6]} />
        <meshStandardMaterial color={col} emissive={hovered && a.active ? P.indigo : "#000"} emissiveIntensity={0.5} transparent opacity={a.active ? 1 : 0.6} roughness={0.6} />
      </mesh>
      <Html position={[0, hgt + 0.6, 0]} center distanceFactor={12} zIndexRange={[10, 0]}>
        <div className="pointer-events-none whitespace-nowrap text-center">
          <div className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold backdrop-blur ${hovered && a.active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/80 text-foreground"} ${a.active ? "" : "opacity-60"}`}>{a.name} · {a.postcode}</div>
          {!a.active && <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">Coming soon{a.note ? ` · ${a.note}` : ""}</div>}
          {hovered && a.active && (
            <div className="glass mt-1 px-2 py-1 text-left font-mono text-[10px] text-foreground">
              <div>{s.count} available / {s.total} houses</div>
              <div>Avg rent £{s.avgRent} pppw</div>
              <div className="text-primary">Click to explore →</div>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

export default function AreaOverviewScene({ city, onPick }: { city: City; onPick: (areaId: string) => void }) {
  const tex = useMemo(() => { const t = streetTexture(); t.repeat.set(3, 3); return t; }, []);
  const [hovered, setHovered] = useState<string | null>(null);
  const [fly, setFly] = useState<{ id: string; goal: THREE.Vector3 } | null>(null);
  return (
    <Canvas camera={{ position: [0, 16, 18], fov: 42 }} dpr={[1, 2]} onCreated={({ gl }) => markReady(gl.domElement)}>
      <color attach="background" args={[P.bg]} />
      <fog attach="fog" args={[P.bg, 26, 55]} />
      <Lights />
      <mesh rotation-x={-Math.PI / 2}><planeGeometry args={[60, 60]} /><meshStandardMaterial map={tex} roughness={0.9} /></mesh>
      <River city={city} />
      <Html><span /></Html>{/* first Html can mount before the canvas wrapper exists; keep a throwaway one */}
      {city.areas.map((a) => (
        <Region key={a.id} city={city} a={a} hovered={hovered === a.id} setHovered={setHovered}
          onPick={() => { const [x, z] = overviewPos(city, a); setFly({ id: a.id, goal: new THREE.Vector3(x, 0, z) }); }} />
      ))}
      <OrbitControls makeDefault enableDamping maxPolarAngle={1.3} minDistance={5} maxDistance={40} />
      <Flyer key={fly?.id ?? "none"} goal={fly?.goal ?? null} onArrive={() => fly && onPick(fly.id)} />
    </Canvas>
  );
}
