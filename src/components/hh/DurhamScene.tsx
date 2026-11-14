import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AREAS, PROPERTIES, makeBlocks, riverPoints, type Layer, type Block } from "@/lib/hh/data";

// Scene palette (three.js needs concrete colours; mirrors design tokens)
const C = { ground: "#101727", street: "#1b2538", river: "#0e4d63", cyan: "#06B6D4", amber: "#F59E0B", red: "#EF4444", green: "#10B981", block: "#283247" };

function ramp(t: number) { // 0 good → 1 bad
  const c = new THREE.Color();
  if (t < 0.5) c.lerpColors(new THREE.Color(C.green), new THREE.Color(C.amber), t * 2);
  else c.lerpColors(new THREE.Color(C.amber), new THREE.Color(C.red), (t - 0.5) * 2);
  return c;
}
function metric(b: { epc: number; damp: number; noise: number; bill: number }, l: Layer) {
  if (l === "thermal") return 1 - b.epc / 100;
  if (l === "damp") return b.damp / 100;
  if (l === "noise") return b.noise / 100;
  return Math.max(0, Math.min(1, (b.bill - 80) / 220));
}

function groundTexture() {
  const s = 1024, cv = document.createElement("canvas"); cv.width = cv.height = s;
  const g = cv.getContext("2d")!;
  g.fillStyle = C.ground; g.fillRect(0, 0, s, s);
  g.strokeStyle = C.street; g.lineWidth = 2;
  for (let i = 0; i < s; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 60, s); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(s, i - 40); g.stroke(); }
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function River() {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(riverPoints().map(([x, z]) => new THREE.Vector3(x, 0.02, z)));
    return new THREE.TubeGeometry(curve, 200, 0.42, 8, false);
  }, []);
  return <mesh geometry={geo} scale={[1, 0.08, 1]}><meshStandardMaterial color={C.river} emissive={C.cyan} emissiveIntensity={0.25} roughness={0.15} metalness={0.4} /></mesh>;
}

function Blocks({ blocks, layer, xray, onArea }: { blocks: Block[]; layer: Layer; xray: boolean; onArea: (a: string) => void }) {
  return <>{blocks.map((b, i) => {
    const col = xray ? ramp(metric(b, layer)) : new THREE.Color(C.block);
    return <mesh key={i} position={[b.x, b.h / 2, b.z]} castShadow onClick={(e) => { e.stopPropagation(); onArea(b.area); }}>
      <boxGeometry args={[b.w, b.h, b.d]} />
      <meshStandardMaterial color={col} emissive={xray ? col : C.block} emissiveIntensity={xray ? 0.55 : 0.05} transparent={xray} opacity={xray ? 0.82 : 1} roughness={0.6} />
    </mesh>;
  })}</>;
}

function Pin({ p, active, layer, onSelect }: { p: (typeof PROPERTIES)[number]; active: boolean; layer: Layer; onSelect: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const h = p.floors * 0.45;
  const col = ramp(metric({ epc: p.epcScore, damp: p.damp, noise: p.noise, bill: p.bill }, layer));
  useFrame((s) => { if (ref.current) ref.current.position.y = h + 0.8 + Math.sin(s.clock.elapsedTime * 2) * 0.08; });
  const label = layer === "bill" ? `£${p.bill}/mo` : layer === "damp" ? `Damp ${p.damp}` : layer === "noise" ? `Noise ${p.noise}` : `EPC ${p.epc}`;
  return <group position={[p.pos[0], 0, p.pos[1]]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
    <mesh position={[0, h / 2, 0]}><boxGeometry args={[0.7, h, 0.7]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={active ? 1 : 0.5} /></mesh>
    <mesh ref={ref}><octahedronGeometry args={[0.22]} /><meshStandardMaterial color={C.cyan} emissive={C.cyan} emissiveIntensity={active ? 2.5 : 1.2} /></mesh>
    <Html position={[0, h + 1.3, 0]} center distanceFactor={7} zIndexRange={[10, 0]}>
      <button onClick={onSelect} className={`whitespace-nowrap rounded-md border px-2 py-1 font-mono text-[11px] backdrop-blur ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/80 text-foreground"}`}>
        {p.postcode} · {label}
      </button>
    </Html>
  </group>;
}

function Rig({ target }: { target: [number, number] | null }) {
  const { controls } = useThree() as unknown as { controls: { target: THREE.Vector3; update: () => void } | null };
  const { camera } = useThree();
  const goal = useRef<THREE.Vector3 | null>(null);
  useEffect(() => { goal.current = target ? new THREE.Vector3(target[0], 0, target[1]) : null; }, [target]);
  useFrame((_, d) => {
    if (!goal.current || !controls) return;
    const k = 1 - Math.exp(-4 * Math.min(d, 0.05));
    const off = camera.position.clone().sub(controls.target);
    const desiredOff = off.clone().setLength(THREE.MathUtils.lerp(off.length(), 13, k));
    controls.target.lerp(goal.current, k);
    camera.position.copy(controls.target).add(desiredOff);
    controls.update();
    if (controls.target.distanceTo(goal.current) < 0.02) goal.current = null;
  });
  return null;
}

export default function DurhamScene({ layer, xray, selected, onSelect }: { layer: Layer; xray: boolean; selected: string; onSelect: (id: string) => void }) {
  const blocks = useMemo(() => makeBlocks(), []);
  const tex = useMemo(() => groundTexture(), []);
  const sel = PROPERTIES.find((p) => p.id === selected);
  const ready = useRef(false);
  return (
    <Canvas shadows="percentage" camera={{ position: [6, 13, 16], fov: 42 }} dpr={[1, 2]} onCreated={({ gl }) => { if (!ready.current) { ready.current = true; gl.domElement.parentElement?.parentElement?.setAttribute("data-scene-ready", "1"); } }}>
      <color attach="background" args={["#0B0F19"]} />
      <fog attach="fog" args={["#0B0F19", 22, 45]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[8, 14, 6]} intensity={1.2} castShadow />
      <pointLight position={[0, 4, 1]} color={C.cyan} intensity={8} distance={12} />
      <Environment resolution={64}>
        <Lightformer intensity={1.5} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={0.8} color="#06B6D4" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} receiveShadow onClick={() => {}}><planeGeometry args={[40, 40]} /><meshStandardMaterial map={tex} roughness={0.9} /></mesh>
      {/* Peninsula plateau */}
      <mesh position={[0.2, 0.06, 0.9]}><cylinderGeometry args={[2.4, 2.8, 0.12, 40]} /><meshStandardMaterial color="#1a2234" /></mesh>
      {/* Cathedral */}
      <group position={[-0.6, 0, 1.9]}>
        <mesh position={[0, 0.5, 0]}><boxGeometry args={[2, 1, 0.6]} /><meshStandardMaterial color={xray ? "#3a4560" : "#2f3a52"} /></mesh>
        <mesh position={[0.2, 1.3, 0]}><boxGeometry args={[0.5, 1.6, 0.5]} /><meshStandardMaterial color="#38445e" /></mesh>
        <Html position={[0, 2.5, 0]} center distanceFactor={8}><span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">Durham Cathedral</span></Html>
      </group>
      <River />
      <Blocks blocks={blocks} layer={layer} xray={xray} onArea={(a) => { const p = PROPERTIES.find((x) => x.area === a); if (p) onSelect(p.id); }} />
      {AREAS.map((a) => <Html key={a.name} position={[a.center[0], 0.1, a.center[1] + 2.6]} center distanceFactor={9}><span className="whitespace-nowrap text-xs font-semibold uppercase tracking-widest text-muted-foreground">{a.name}</span></Html>)}
      {PROPERTIES.map((p) => <Pin key={p.id} p={p} layer={layer} active={p.id === selected} onSelect={() => onSelect(p.id)} />)}
      <OrbitControls makeDefault enableDamping maxPolarAngle={1.35} minDistance={4} maxDistance={30} />
      <Rig target={sel ? sel.pos : null} />
    </Canvas>
  );
}
