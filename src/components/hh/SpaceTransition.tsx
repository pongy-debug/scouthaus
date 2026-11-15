import { useLayoutEffect, useState } from "react";
import { Starfield } from "@/components/hh/Starfield";
import { useSpacePhase } from "@/lib/hh/transition";

/**
 * Full-screen starry overlay for page-to-page transitions. It lives in the root layout, so it stays mounted while the
 * route underneath changes. Renders nothing when no transition is running.
 */
export function SpaceTransition() {
  const phase = useSpacePhase();
  const [starTop, setStarTop] = useState(120);
  useLayoutEffect(() => {
    if (phase === "idle") return;
    const align = () => {
      const panel = document.querySelector(".city-picker");
      setStarTop(panel ? Math.max(0, panel.getBoundingClientRect().top) : 120);
    };
    align();
    window.addEventListener("resize", align);
    return () => window.removeEventListener("resize", align);
  }, [phase]);
  if (phase === "idle") return null;
  return <div className={`space-fx space-${phase}`} aria-hidden="true">
    <div className="space-curtain" />
    <div className="space-star-window" style={{ clipPath: `inset(${starTop}px 0 0)` }}><Starfield className="space-stars" /></div>
  </div>;
}
