// Home → Find House transition. One small store drives the phases so the home page and the root-level black overlay
// (which survives the route change) follow the same clock.
//
//   shrink   1200ms   the whole home page shrinks to nothing; the page behind it is pure black
//   black    300ms    hold on a completely black screen; the overlay is opaque from here on
//   (navigate — hidden behind the black overlay)
//   fadein   2000ms   the Find House page fades in from black
// Reduced motion: fade (150ms to black) → navigate → fadeout (150ms from black).
import { useSyncExternalStore } from "react";

export type SpacePhase = "idle" | "shrink" | "black" | "fadein" | "fade" | "fadeout";
export const SPACE_MS = { shrink: 1200, hold: 300, fadeIn: 2000, reducedHalf: 150 } as const;

let phase: SpacePhase = "idle";
let timers: ReturnType<typeof setTimeout>[] = [];
const listeners = new Set<() => void>();

function set(next: SpacePhase) {
  phase = next;
  if (typeof document !== "undefined") document.documentElement.classList.toggle("space-lock", next !== "idle");
  listeners.forEach((l) => l());
}
const later = (ms: number, fn: () => void) => { timers.push(setTimeout(fn, ms)); };

/** Start the transition. `navigate` performs the route change once the screen is black. False if one is already running. */
export function startSpaceFlight({ reduced, navigate }: { reduced: boolean; navigate: () => Promise<unknown> | void }): boolean {
  if (phase !== "idle") return false;
  const [dark, reveal, revealMs] = reduced ? (["fade", "fadeout", SPACE_MS.reducedHalf] as const) : (["black", "fadein", SPACE_MS.fadeIn] as const);
  const go = () => {
    void Promise.resolve(navigate()).catch(() => {}).then(() => {
      if (phase !== dark) return;
      set(reveal);
      later(revealMs, () => set("idle"));
    });
  };
  if (reduced) { set("fade"); later(SPACE_MS.reducedHalf, go); return true; }
  set("shrink");
  later(SPACE_MS.shrink, () => set("black"));
  later(SPACE_MS.shrink + SPACE_MS.hold, go);
  return true;
}

/** Abort and return everything to normal (used when the home page is shown again, e.g. via the back button). */
export function resetSpaceFlight() {
  timers.forEach(clearTimeout);
  timers = [];
  if (phase !== "idle") set("idle");
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useSpacePhase = () => useSyncExternalStore(subscribe, () => phase, () => "idle" as SpacePhase);
