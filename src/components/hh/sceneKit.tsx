import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

// Scene palette (three.js needs concrete colours; mirrors design tokens)
export const P = { bg: "#0B0F19", ground: "#101727", street: "#24304a", river: "#0e4d63", cyan: "#06B6D4", indigo: "#6366F1", green: "#10B981", amber: "#F59E0B", slate: "#64748B", block: "#283247", dim: "#1c2436" };

export function streetTexture(size = 1024, step = 48) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const g = cv.getContext("2d")!;
  g.fillStyle = P.ground; g.fillRect(0, 0, size, size);
  g.strokeStyle = P.street; g.lineWidth = 3;
  for (let i = 0; i < size; i += step) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 80, size); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(size, i - 50); g.stroke(); }
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; g.fillRect(Math.random() * size, Math.random() * size, 2, 2); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Lights() {
  return <>
    <ambientLight intensity={0.45} />
    <directionalLight position={[8, 14, 6]} intensity={1.3} />
    <Environment resolution={64}>
      <Lightformer intensity={1.5} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
      <Lightformer intensity={0.8} color={P.indigo} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
    </Environment>
  </>;
}

export function markReady(el: HTMLCanvasElement) { el.closest("[data-scene-root]")?.setAttribute("data-scene-ready", "1"); }
