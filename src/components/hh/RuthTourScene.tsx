import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as Controls } from "three-stdlib";
import { Vector3 } from "three";
import { buildRuthHouse } from "@/lib/hh/ruthModel";

export type TourView = "overview" | "kitchen" | "window" | "connection" | "lounge";
const VIEWS: Record<TourView, { eye: [number, number, number]; look: [number, number, number] }> = {
  overview: { eye: [9, 10, 13], look: [0, 0.8, 2.5] },
  kitchen: { eye: [0, 1.6, 0.9], look: [-0.7, 1.35, -1.8] },
  window: { eye: [-0.3, 1.6, -0.5], look: [1.5, 1.3, 0.55] },
  connection: { eye: [0, 1.6, 0.6], look: [0, 1.5, 5.7] },
  lounge: { eye: [0.15, 1.6, 3.05], look: [-0.2, 1.4, 6.6] },
};

function Model({ view, reset }: { view: TourView; reset: number }) {
  const { root, shell } = useMemo(buildRuthHouse, []);
  const controls = useRef<Controls>(null);
  const flying = useRef(true);
  const target = useMemo(() => {
    const eye = new Vector3(...VIEWS[view].eye), look = new Vector3(...VIEWS[view].look);
    // A near-eye orbit pivot lets drag gestures look around from a fixed room viewpoint.
    if (view !== "overview") look.sub(eye).normalize().multiplyScalar(0.025).add(eye);
    return { eye, look };
  }, [view]);
  useEffect(() => { shell.visible = view !== "overview"; flying.current = true; }, [view, reset, shell]);
  useEffect(() => () => {
    root.traverse((object) => {
      const mesh = object as import("three").Mesh;
      if (mesh.isMesh) { mesh.geometry.dispose(); const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; mats.forEach((m) => m.dispose()); }
    });
  }, [root]);
  useFrame(({ camera }, delta) => {
    if (!controls.current || !flying.current) return;
    // Disable the controller while travelling so its radius limits don't interrupt the flight.
    controls.current.enabled = false;
    const blend = 1 - Math.exp(-Math.min(delta, 0.05) * 5);
    camera.position.lerp(target.eye, blend);
    controls.current.target.lerp(target.look, blend);
    camera.lookAt(controls.current.target);
    if (camera.position.distanceTo(target.eye) < 0.01 && controls.current.target.distanceTo(target.look) < 0.01) {
      camera.position.copy(target.eye); controls.current.target.copy(target.look);
      controls.current.enabled = true; flying.current = false; controls.current.update();
    }
  });
  return <>
    <primitive object={root} />
    <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12}
      enablePan={false} enableZoom={view === "overview"} minDistance={view === "overview" ? 5 : 0.025}
      maxDistance={view === "overview" ? 23 : 0.025} minPolarAngle={0.15} maxPolarAngle={view === "overview" ? Math.PI / 2.1 : Math.PI - 0.2}
      rotateSpeed={view === "overview" ? 0.65 : -0.45} />
  </>;
}

export default function RuthTourScene({ view, reset }: { view: TourView; reset: number }) {
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [9, 10, 13], fov: 58, near: 0.01, far: 80 }} gl={{ antialias: true }}>
    <color attach="background" args={["#dcded9"]} />
    <ambientLight intensity={1.2} />
    <hemisphereLight args={["#eaf4ff", "#b59b77", 1.4]} />
    <directionalLight position={[4, 8, 4]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={10} shadow-camera-bottom={-7} shadow-bias={-0.0005} />
    <pointLight position={[0, 2.35, -0.2]} intensity={10} distance={6} color="#fff1d4" />
    <pointLight position={[0, 2.2, 5]} intensity={10} distance={7} color="#fff1d4" />
    <Model view={view} reset={reset} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 2.5]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#d0d2cb" /></mesh>
  </Canvas>;
}
