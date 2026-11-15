// Page-to-page transition. One small store drives the phases so routes and the root-level black overlay
// (which survives the route change) follow the same clock.
//
//   fade     150ms    the screen fades to black (no zoom); the overlay is opaque from here on
//   (navigate — hidden behind the black overlay)
//   fadein   2000ms   the next page fades in from black
// Reduced motion: the same, with a 150ms fade back in (fadeout) instead of the 2s one.
import { useSyncExternalStore } from "react";

export type SpacePhase = "idle" | "fadein" | "fade" | "fadeout";
export const SPACE_MS = { fadeOut: 150, fadeIn: 2000, reducedIn: 150 } as const;

let phase: SpacePhase = "idle";
let targetPath: string | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];
const listeners = new Set<() => void>();

function set(next: SpacePhase) {
  phase = next;
  if (next === "idle") targetPath = null;
  if (typeof document !== "undefined") document.documentElement.classList.toggle("space-lock", next !== "idle");
  listeners.forEach((l) => l());
}
const later = (ms: number, fn: () => void) => { timers.push(setTimeout(fn, ms)); };

/** Start the transition. `navigate` performs the route change once the screen is black. False if one is already running. */
export function startSpaceFlight({ reduced, navigate, target }: { reduced: boolean; navigate: () => Promise<unknown> | void; target?: string }): boolean {
  if (phase !== "idle") return false;
  targetPath = target ?? null;
  const [reveal, revealMs] = reduced ? (["fadeout", SPACE_MS.reducedIn] as const) : (["fadein", SPACE_MS.fadeIn] as const);
  set("fade");
  later(SPACE_MS.fadeOut, () => {
    void Promise.resolve(navigate()).catch(() => {}).then(() => {
      if (phase !== "fade") return;
      set(reveal);
      later(revealMs, () => set("idle"));
    });
  });
  return true;
}

/** Abort and return everything to normal (used when the home page is shown again, e.g. via the back button). */
export function resetSpaceFlight() {
  timers.forEach(clearTimeout);
  timers = [];
  targetPath = null;
  if (phase !== "idle") set("idle");
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useSpacePhase = () => useSyncExternalStore(subscribe, () => phase, () => "idle" as SpacePhase);
export const getSpaceTarget = () => targetPath;
