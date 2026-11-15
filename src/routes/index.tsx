import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { FileSearch, House, Zap } from "lucide-react";
import { Starfield } from "@/components/hh/Starfield";
import { SiteLogo } from "@/components/hh/SiteNav";
import { resetSpaceFlight, startSpaceFlight, useSpacePhase } from "@/lib/hh/transition";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scouthaus — A little more clarity before you get the keys" },
      { name: "description", content: "Look beyond the listing, explore your housing options, uncover hidden costs, understand your contract before signing it." },
      { property: "og:title", content: "Scouthaus — Student house hunting, X-rayed" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function HomeCity({ side }: { side: "left" | "right" }) {
  return <div className={`home-city home-city--${side}`} aria-hidden="true" />;
}

function Landing() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const explorerRef = useRef<HTMLElement>(null);
  const [reveal, setReveal] = useState<"static" | "waiting" | "playing">("static");

  useEffect(() => {
    const section = explorerRef.current;
    if (!section || typeof window.IntersectionObserver !== "function") return;
    setReveal("waiting");
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setReveal("playing");
        observer.disconnect();
      }
    }, { root: scrollRef.current, threshold: 0.25 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const nav = useNavigate();
  const router = useRouter();
  const leaving = useSpacePhase() !== "idle";
  useEffect(() => {
    // Showing the home page (first visit or back button) always starts from the normal state.
    resetSpaceFlight();
    // Get the Find House page and its 3D Earth ready before the click, so the fly-out never waits on the network.
    void router?.preloadRoute?.({ to: "/find" })?.catch(() => { });
    void import("@/components/hh/CityGlobe").catch(() => { });
    for (const src of ["/textures/earth-day.jpg", "/textures/earth-clouds.png"]) new Image().src = src;
  }, [router]);
  /** Find House: fade through black instead of switching pages abruptly. Modified clicks (new tab etc.) keep their normal behaviour. */
  const flyToFind = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    startSpaceFlight({ reduced: false, navigate: () => nav({ to: "/find" }) });
  };
  const block = (e: MouseEvent<HTMLAnchorElement>) => { if (leaving) e.preventDefault(); };
  const off = leaving ? { "aria-disabled": true, tabIndex: -1 } : {};
  return (
    <div ref={scrollRef} data-leaving={leaving} className="scout-home min-h-screen">
      <header className="absolute inset-x-3 top-3 z-20 flex flex-wrap items-center gap-2 border border-transparent px-4 py-2.5">
        <SiteLogo />
      </header>

      <main>
        <section aria-labelledby="home-heading" className="home-intro text-center">
          <Starfield />
          <HomeCity side="left" />
          <HomeCity side="right" />
          <div className="home-intro-content">
            <h1 id="home-heading" aria-label="Scouthaus" className="mt-6 text-[clamp(3.6rem,8vw,6rem)] font-extrabold leading-[0.98] tracking-[-0.075em]">
              <span aria-hidden="true">{Array.from("Scouthaus").map((letter, index) => <span key={index} className={`home-title-letter ${index >= 5 ? "text-(--home-blue)" : "text-(--home-ink)"}`} style={{ animationDelay: `calc(var(--home-letter-start) + ${index} * var(--home-letter-step))` }}>{letter}</span>)}<span className="home-title-dot"><span className="home-title-dot-rest">.</span><svg className="home-title-star" viewBox="-50 -50 100 100" focusable="false"><defs><linearGradient id="home-title-star-fill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f4fbff" /><stop offset="0.55" stopColor="#cae9f6" /><stop offset="1" stopColor="#7dbdd8" /></linearGradient></defs><path d="M0-47 11-15 45-15 18 6 28 39 0 20-28 39-18 6-45-15-11-15Z" fill="url(#home-title-star-fill)" stroke="#e4f7ff" strokeWidth="0.8" /></svg></span></span>
            </h1>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">A little more clarity before you get the key.</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-(--home-muted) sm:text-base">Look beyond the listing&nbsp;&nbsp;&bull;&nbsp;&nbsp;Explore your student housing options&nbsp;&nbsp;&bull;&nbsp;&nbsp;Uncover hidden costs&nbsp;&nbsp;&bull;&nbsp;&nbsp;Understand your contract before signing it</p>
            <nav aria-label="Main navigation" className="mt-8 grid w-full max-w-120 grid-cols-2 items-center gap-3 sm:gap-4">
              <Link to="/find" onClick={flyToFind} {...off} className="home-action flex min-h-14 sm:min-h-16 items-center justify-center gap-2 rounded-full px-3 py-3 text-xs font-bold transition sm:px-6 sm:text-base focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><House className="size-4 sm:size-5" />Find House</Link>
              <Link to="/scanner" onClick={block} {...off} className="home-action flex min-h-14 sm:min-h-16 items-center justify-center gap-2 rounded-full px-3 py-3 text-xs font-bold transition sm:px-6 sm:text-base focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><FileSearch className="size-4 sm:size-5" />Contract Check</Link>
            </nav>

            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-(--home-muted)">Your next home. The full picture. With fewer surprises.</p>
          </div>
          <a href="#neighbourhood" className="home-scroll-hint rounded-full px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Scroll to explore <span aria-hidden="true">↓</span></a>

        </section>

        <section id="neighbourhood" ref={explorerRef} data-reveal={reveal} aria-label="Durham explorer preview" className="home-explorer relative overflow-hidden">
          <div className="home-explorer-inner">
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
              <div><p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">A new perspective on your neighbourhood</p></div>
              <span className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1.5 font-mono text-[10px] text-sky-200">Illustrative preview · real adverts, modelled risk</span>
            </div>
            <div className="home-neighbourhood-grid relative grid items-center gap-6 md:grid-cols-[0.95fr_1.05fr]">
              <div className="home-story relative z-10 order-2 w-full max-w-115 space-y-3 pb-4 md:order-1">
                <h3 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl xl:text-5xl">Small details.<br /><span className="text-sky-300">Big differences.</span></h3>
                <p className="max-w-sm text-sm leading-relaxed text-slate-400">Understand the things a viewing can’t tell you.</p>
                {[
                  { icon: Zap, title: "See the true cost", text: "Rent, energy ratings & estimated bills", color: "text-sky-300", surface: "border-sky-300/30 from-sky-400/10" },
                  { icon: House, title: "Know your surroundings", text: "Neighbourhoods, damp risk & noise", color: "text-orange-300", surface: "border-orange-300/30 from-orange-400/10" },
                ].map(({ icon: Icon, title, text, color, surface }) => <div key={title} className={`rounded-3xl border bg-linear-to-br to-slate-950/70 p-5 ${surface}`}><div className="flex items-center gap-3"><Icon className={`size-5 shrink-0 ${color}`} /><h4 className="text-base font-bold text-slate-100">{title}</h4></div><p className="mt-3 text-xs leading-relaxed text-slate-400">{text}</p></div>)}
                <section aria-labelledby="home-scanner-heading" className="rounded-3xl border border-violet-300/30 bg-linear-to-br from-violet-400/10 to-slate-950/70 p-5">
                  <div className="flex items-center gap-3"><FileSearch className="size-5 shrink-0 text-violet-300" /><h4 id="home-scanner-heading" className="text-base font-bold text-slate-100">Contract Check</h4></div>
                  <p className="mt-3 text-sm font-semibold text-violet-100">Love the house? Check the contract.</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">Spot potential red flags, understand key terms, and prepare questions before you sign.</p>
                  <p className="mt-3 text-[10px] leading-relaxed text-violet-200/80">Upload contract → Review clauses → Draft landlord questions</p>
                </section>
              </div>
              <div className="home-neighbourhood-art relative order-1 flex items-center justify-center md:order-2" aria-hidden="true">
                <div className="home-house-glow" />
                <svg viewBox="-90 -40 700 520" className="home-house relative h-full w-full max-w-190" fill="none">
                  <defs>
                    <mask id="home-main-house-silhouette" maskUnits="userSpaceOnUse" x="-90" y="-40" width="700" height="520" style={{ maskType: "alpha" }}><image href="/images/house-simplified-original-blue-v8.png" x="-90" y="-40" width="700" height="520" preserveAspectRatio="xMidYMid meet" /></mask>
                    <g id="home-detailed-house" mask="url(#home-main-house-silhouette)"><image href="/images/house-transparent-selected-v5.png" x="-90" y="-40" width="700" height="520" preserveAspectRatio="xMidYMid meet" /></g>
                    <clipPath id="home-lens-clip"><circle r="72" /></clipPath>
                    <filter id="home-house-saturation" colorInterpolationFilters="sRGB"><feColorMatrix type="saturate" values="0.86" /></filter>
                    <filter id="home-house-blue-filter" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -6 0 6 0 -1.2" /></filter>
                    <mask id="home-house-blue-mask" maskUnits="userSpaceOnUse" x="-90" y="-40" width="700" height="520"><use href="#home-detailed-house" filter="url(#home-house-blue-filter)" /></mask>
                    <filter id="home-window-saturation" colorInterpolationFilters="sRGB"><feColorMatrix type="saturate" values="0.8" /></filter>
                    <filter id="home-warm-window-filter" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  7 0 -7 0 -0.8" /></filter>
                    <mask id="home-warm-window-mask" maskUnits="userSpaceOnUse" x="-90" y="-40" width="700" height="520"><use href="#home-detailed-house" filter="url(#home-warm-window-filter)" /></mask>
                    <radialGradient id="home-window-amber"><stop stopColor="#e7ac7c" stopOpacity="0.45" /><stop offset="0.5" stopColor="#eed2b3" stopOpacity="0.2" /><stop offset="1" stopColor="#eed2b3" stopOpacity="0" /></radialGradient>
                    <radialGradient id="home-window-apricot"><stop stopColor="#efd0ba" stopOpacity="0.3" /><stop offset="1" stopColor="#efd0ba" stopOpacity="0" /></radialGradient>
                    <linearGradient id="home-lens-rim" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#aac8d3" /><stop offset="0.4" stopColor="#5c8398" /><stop offset="0.75" stopColor="#29465d" /><stop offset="1" stopColor="#718f9f" /></linearGradient>
                    <linearGradient id="home-lens-handle" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#66889c" /><stop offset="0.5" stopColor="#35566e" /><stop offset="1" stopColor="#1c334a" /></linearGradient>
                    <linearGradient id="home-lens-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d9f1fa" stopOpacity="0.06" /><stop offset="0.5" stopColor="#d9f1fa" stopOpacity="0" /><stop offset="1" stopColor="#082036" stopOpacity="0.04" /></linearGradient>
                    <filter id="home-lens-shadow" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB"><feDropShadow dx="2" dy="5" stdDeviation="4" floodColor="#020b16" floodOpacity="0.35" /></filter>
                  </defs>
                  <g id="home-house-artwork">
                    <image href="/images/house-transparent-selected-v5.png" x="-90" y="-40" width="700" height="520" preserveAspectRatio="xMidYMid meet" opacity="0.18" />
                    <use href="#home-detailed-house" />
                    <g mask="url(#home-house-blue-mask)">
                      <use href="#home-detailed-house" filter="url(#home-house-saturation)" />
                      <rect x="-90" y="-40" width="700" height="520" fill="#4963b8" opacity="0.18" />
                      <rect x="-90" y="-40" width="700" height="520" fill="#0754b7" opacity="0.5" />
                      <rect x="-90" y="-40" width="700" height="520" fill="#06162f" opacity="0.25" />
                    </g>
                    <g className="home-window-light" mask="url(#home-warm-window-mask)" pointerEvents="none">
                      <use href="#home-detailed-house" filter="url(#home-window-saturation)" />
                      <rect x="-90" y="-40" width="700" height="520" fill="#e9c6a3" opacity="0.13" />
                      <ellipse className="home-window-wash" rx="105" ry="140" fill="url(#home-window-amber)" />
                      <ellipse className="home-window-wash home-window-wash-secondary" rx="85" ry="110" fill="url(#home-window-apricot)" />
                    </g>
                  </g>
                  <g className="home-scan-lens" pointerEvents="none" filter="url(#home-lens-shadow)">
                    <path d="m55 55 53 53" stroke="url(#home-lens-handle)" strokeWidth="11" strokeLinecap="round" />
                    <path d="m58 55 50 50" stroke="#a7c6d3" strokeOpacity="0.3" strokeWidth="1.2" strokeLinecap="round" />
                    <g clipPath="url(#home-lens-clip)">
                      <circle r="72" fill="#0c233b" />
                      <g className="home-lens-sample"><use href="#home-house-artwork" transform="scale(1.8)" /></g>
                    </g>
                    <circle r="71.5" fill="url(#home-lens-glass)" />
                    <circle r="74" stroke="url(#home-lens-rim)" strokeWidth="3.5" />
                    <circle r="76" stroke="#88a8b9" strokeOpacity="0.25" strokeWidth="0.7" />
                    <circle r="72" stroke="#bdd8e5" strokeOpacity="0.2" strokeWidth="0.7" />
                    <path d="M-50-24a55 55 0 0 1 52-31" stroke="#e2f3f9" strokeOpacity="0.28" strokeWidth="1.5" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
            </div>
            <div className="relative z-10 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400"><span>Explore areas. Compare houses. Read the fine print.</span><span className="text-sky-300">Built for better decisions ↗</span></div>
          </div>
          <footer className="home-footer flex flex-wrap justify-between gap-3 border-t border-white/10 px-5 py-6 text-[10px] leading-relaxed text-slate-400 sm:px-8"><span>Scouthaus · A little more clarity before you get the keys.</span><span>Listings from letting agents’ adverts · Risk figures are modelled · Educational guidance, not legal advice.</span></footer>
        </section>
      </main>
    </div>
  );
}
