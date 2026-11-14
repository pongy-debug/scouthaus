import { useSpacePhase } from "@/lib/hh/transition";

/**
 * Full-screen black overlay for the Home → Find House transition. It lives in the root layout, so it stays mounted while
 * the route underneath changes. Renders nothing when no transition is running.
 */
export function SpaceTransition() {
  const phase = useSpacePhase();
  if (phase === "idle" || phase === "shrink") return null;
  return <div className={`space-fx space-${phase}`} aria-hidden="true" />;
}
