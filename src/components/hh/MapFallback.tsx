import { useEffect, useState } from "react";

export function useWebGL() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => { const c = document.createElement("canvas"); setOk(!!(c.getContext("webgl2") || c.getContext("webgl"))); }, []);
  return ok;
}

export interface FallbackPoint { id: string; x: number; z: number; label: string; tone: "primary" | "success" | "warning" | "muted"; onClick?: (() => void) | undefined }
const fill = { primary: "fill-primary", success: "fill-success", warning: "fill-warning", muted: "fill-muted-foreground" };

/** 2D top-down fallback when WebGL is unavailable. */
export function MapFallback({ points }: { points: FallbackPoint[] }) {
  const xs = points.map((p) => p.x), zs = points.map((p) => p.z);
  const minX = Math.min(...xs) - 2, maxX = Math.max(...xs) + 2, minZ = Math.min(...zs) - 2, maxZ = Math.max(...zs) + 2;
  return (
    <svg viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`} className="h-full w-full">
      {points.map((p) => (
        <g key={p.id} onClick={p.onClick} className="cursor-pointer">
          <circle cx={p.x} cy={p.z} r={(maxX - minX) / 60} className={fill[p.tone]} />
          <text x={p.x} y={p.z - (maxX - minX) / 40} textAnchor="middle" fontSize={(maxX - minX) / 55} className="fill-foreground">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}
