import { useEffect } from "react";
import { useBlocker, useRouter } from "@tanstack/react-router";
import { resetSpaceFlight, startSpaceFlight } from "@/lib/hh/transition";

/** Delay pathname changes until black, then reveal after the router has committed the destination. */
export function PageTransitions() {
  const router = useRouter();
  useEffect(() => () => resetSpaceFlight(), []);
  useBlocker({
    enableBeforeUnload: false,
    shouldBlockFn: ({ current, next }) => {
      if ([current.pathname, next.pathname].some((path) => path.replace(/\/$/, "") === "/scanner") || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        resetSpaceFlight();
        return false;
      }
      if (current.pathname.replace(/\/$/, "") === next.pathname.replace(/\/$/, "")) return false;
      return new Promise<boolean>((proceed) => {
        const started = startSpaceFlight({ reduced: false, navigate: () => new Promise<void>((revealed) => {
          // Subscribe before allowing navigation so even cached destinations are covered.
          const done = () => { unsubscribe(); clearTimeout(timeout); revealed(); };
          const unsubscribe = router.subscribe("onResolved", done);
          // A cancelled navigation or failed loader must never leave the screen locked.
          const timeout = setTimeout(done, 15_000);
          proceed(false);
        }) });
        if (!started) proceed(true);
      });
    },
  });
  return null;
}
