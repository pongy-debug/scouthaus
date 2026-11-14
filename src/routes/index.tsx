import { createFileRoute, Link } from "@tanstack/react-router";
import { FileSearch, House, Zap } from "lucide-react";
import { SiteLogo } from "@/components/hh/SiteNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scouthaus — See the true cost of a student house before you sign" },
      { name: "description", content: "Explore Durham student houses, understand energy bills and damp risk, and review your tenancy before you sign." },
      { property: "og:title", content: "Scouthaus — Student house hunting, X-rayed" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="scout-home min-h-screen">
      <header className="absolute inset-x-3 top-3 z-20 flex flex-wrap items-center gap-2 border border-transparent px-4 py-2.5">
        <SiteLogo />
      </header>

      <main>
        <section aria-labelledby="home-heading" className="home-intro text-center">
          <svg className="home-starlight" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
            {Array.from({ length: 52 }, (_, index) => {
              const x = (index * 233 + 71) % 1440;
              const y = (index * 137 + 43) % 900;
              return <circle key={index} className="home-star" cx={x} cy={y} r={index % 7 === 0 ? 2 : 0.8 + (index % 3) * 0.35} style={{ animationDelay: `${-(index % 11)}s`, animationDuration: `${5 + index % 5}s` }} />;
            })}
            {([[190, 250], [1205, 215], [1100, 655], [290, 710]] as const).map(([x, y], index) => <g key={index} className="home-star home-star-cross" style={{ animationDelay: `${-index * 2}s`, animationDuration: `${7 + index}s` }}><path d={`M${x} ${y - 7}Q${x} ${y} ${x + 7} ${y}Q${x} ${y} ${x} ${y + 7}Q${x} ${y} ${x - 7} ${y}Q${x} ${y} ${x} ${y - 7}Z`} /></g>)}
          </svg>
          <div className="home-eyebrow"><span className="size-1.5 rounded-full bg-[var(--home-blue)]" /> A clearer view of student living</div>
          <h1 id="home-heading" className="mt-6 text-[clamp(3.6rem,8vw,6rem)] font-extrabold leading-[0.98] tracking-[-0.075em]"><span className="text-[var(--home-ink)]">Scout</span><span className="text-[var(--home-blue)]">haus</span><span className="text-[var(--home-ink)]">.</span></h1>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Your next home. The full picture.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--home-muted)] sm:text-base">Look beyond the listing. Explore Durham, uncover hidden costs, and understand your contract before you sign.</p>
        <nav aria-label="Main navigation" className="mt-8 grid w-full max-w-[480px] grid-cols-2 items-center gap-3 sm:gap-4">
          <Link to="/find" className="home-action flex min-h-14 sm:min-h-16 items-center justify-center gap-2 rounded-full px-3 py-3 text-xs font-bold transition sm:px-6 sm:text-base focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><House className="size-4 sm:size-5" />Find House</Link>
          <Link to="/scanner" className="home-action flex min-h-14 sm:min-h-16 items-center justify-center gap-2 rounded-full px-3 py-3 text-xs font-bold transition sm:px-6 sm:text-base focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><FileSearch className="size-4 sm:size-5" />Contract Check</Link>
        </nav>

          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--home-muted)]">Your next home, with fewer surprises.</p>
          <a href="#neighbourhood" className="home-scroll-hint rounded-full px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Scroll to explore <span aria-hidden="true">↓</span></a>

        </section>

        <section id="neighbourhood" aria-label="Durham explorer preview" className="home-explorer relative overflow-hidden">
          <div className="home-explorer-inner">
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div><p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">A new perspective on your neighbourhood</p></div>
            <span className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1.5 font-mono text-[10px] text-sky-200">Illustrative preview · demo listings</span>
          </div>
          <div className="home-neighbourhood-grid relative grid items-center gap-6 md:grid-cols-[0.8fr_1.2fr]">
            <div className="relative z-10 order-2 max-w-sm space-y-3 pb-4 md:order-1">
              <h3 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl xl:text-5xl">Small details.<br /><span className="text-sky-300">Big differences.</span></h3>
              <p className="max-w-sm text-sm leading-relaxed text-slate-400">Understand the things a viewing can’t tell you.</p>
              {[
                { icon: Zap, title: "See the true cost", text: "Rent, energy ratings & estimated bills", color: "text-sky-300", surface: "border-sky-300/30 from-sky-400/10" },
                { icon: House, title: "Know your surroundings", text: "Neighbourhoods, damp risk & noise", color: "text-orange-300", surface: "border-orange-300/30 from-orange-400/10" },
              ].map(({ icon: Icon, title, text, color, surface }) => <div key={title} className={`rounded-xl border bg-gradient-to-br to-slate-950/70 p-5 ${surface}`}><div className="flex items-center gap-3"><Icon className={`size-5 shrink-0 ${color}`} /><h4 className="text-base font-bold text-slate-100">{title}</h4></div><p className="mt-3 text-xs leading-relaxed text-slate-400">{text}</p></div>)}
              <section aria-labelledby="home-scanner-heading" className="rounded-xl border border-violet-300/30 bg-gradient-to-br from-violet-400/10 to-slate-950/70 p-5">
                <div className="flex items-center gap-3"><FileSearch className="size-5 shrink-0 text-violet-300" /><h4 id="home-scanner-heading" className="text-base font-bold text-slate-100">Contract Check</h4></div>
                <p className="mt-3 text-sm font-semibold text-violet-100">Love the house? Check the contract.</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">Spot potential red flags, understand key terms, and prepare questions before you sign.</p>
                <p className="mt-3 text-[10px] leading-relaxed text-violet-200/80">Upload contract → Review clauses → Draft landlord questions</p>
              </section>
            </div>
            <div className="home-neighbourhood-art relative order-1 flex items-center justify-center md:order-2" aria-hidden="true">
              <div className="home-house-glow" />
              <svg viewBox="-90 -40 700 520" className="home-house relative h-full w-full max-w-[760px]" fill="none">
                <defs>
                  <linearGradient id="house-front" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#416b89" /><stop offset="1" stopColor="#16334f" /></linearGradient>
                  <linearGradient id="house-side" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#15344f" /><stop offset="1" stopColor="#091a2f" /></linearGradient>
                  <linearGradient id="house-roof" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#3f627f" /><stop offset="1" stopColor="#14283f" /></linearGradient>
                  <linearGradient id="house-window" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff2d0" /><stop offset="0.5" stopColor="#ffd193" /><stop offset="1" stopColor="#db8a50" /></linearGradient>
                  <radialGradient id="house-ground"><stop stopColor="#3386a9" stopOpacity="0.35" /><stop offset="1" stopColor="#102339" stopOpacity="0" /></radialGradient>
                  <pattern id="house-bricks" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 0h24M0 6h24M12 0v6M0 6v6M24 6v6" stroke="#a0c7df" strokeOpacity="0.12" strokeWidth="0.6" /></pattern>
                  <pattern id="house-slates" width="18" height="12" patternUnits="userSpaceOnUse"><path d="M0 0h18M0 12h18M9 0v12" stroke="#9ac2de" strokeOpacity="0.25" strokeWidth="0.6" /></pattern>
                  <filter id="house-soft-light"><feGaussianBlur stdDeviation="5" /></filter>
                  <radialGradient id="neighbourhood-fade"><stop offset="0.45" stopColor="white" /><stop offset="1" stopColor="black" /></radialGradient>
                  <mask id="neighbourhood-mask" maskUnits="userSpaceOnUse" x="-90" y="-40" width="700" height="520"><ellipse cx="260" cy="210" rx="360" ry="270" fill="url(#neighbourhood-fade)" /></mask>
                  <g id="neighbour-house" strokeLinejoin="round">
                    <path d="m-10 126 86-45 93 46-87 47Z" fill="#193849" stroke="#4c7a8c" strokeWidth="0.6" />
                    <path d="M14 55 79 79v72l-65-25Z" fill="#274b68" stroke="#6a9db8" />
                    <path d="m79 79 66-35v72l-66 35Z" fill="#112c45" stroke="#477f9f" />
                    <path d="m14 55 24-44 41 68Z" fill="#315a77" stroke="#75a6bd" />
                    <path d="m38 11 65-34 49 67-73 35Z" fill="#233f5a" stroke="#83afc7" />
                    <path d="m8 58 30-53 44 73m-44-73 65-34 55 74-76 39" stroke="#9dbdcf" strokeWidth="2" />
                    <path d="m119 6V-17l10-5v23m-10-18-9-4v21m0-21 10-5 9 5" fill="#294a62" stroke="#7b9cae" />
                    <g fill="url(#house-window)" stroke="#c7c5ad" strokeWidth="1.3"><path d="m25 70 15 6v20l-15-6Zm29 11 15 6v20l-15-6Zm38 7 14-7v20l-14 7Zm29-15 14-7v20l-14 7Z" /></g>
                    <path d="m25 108 15 6v17l-15-6Zm67 14 14-7v17l-14 7Z" fill="#638b96" stroke="#8eaaad" />
                    <path d="m53 141 0-24 17 6v24" fill="#0a2033" stroke="#7d9ba9" />
                    <path d="m15 99 64 24m0 0 65-34" stroke="#7f9aab" strokeOpacity="0.5" />
                    <path d="m25 75 15 6m21 4v19m38-19v20m29-35v20" stroke="#695c51" />
                  </g>
                </defs>
                <ellipse cx="269" cy="277" rx="238" ry="157" fill="url(#house-ground)" />
                <g mask="url(#neighbourhood-mask)">
                  <g stroke="#4f9cba" strokeOpacity="0.22" fill="none"><path d="M-90 232 355-5M-80 280 406 24M-70 386 565 51M73 477 631 184M-67 113l619 319M18 55l614 318" strokeWidth="14" /><path d="M-90 232 355-5M-70 386 565 51M73 477 631 184M-67 113l619 319M18 55l614 318" stroke="#9ac9df" strokeWidth="0.8" strokeDasharray="4 9" /></g>
                  <g opacity="0.28"><use href="#neighbour-house" transform="translate(71 37) scale(.68)" /><use href="#neighbour-house" transform="translate(190 -6) scale(.65)" /><use href="#neighbour-house" transform="translate(342 7) scale(.72)" /></g>
                  <g opacity="0.45"><use href="#neighbour-house" transform="translate(-47 132) scale(.85)" /><use href="#neighbour-house" transform="translate(430 101) scale(.9)" /><use href="#neighbour-house" transform="translate(474 229) scale(.75)" /></g>
                  <g opacity="0.3"><use href="#neighbour-house" transform="translate(-36 294) scale(.82)" /><use href="#neighbour-house" transform="translate(57 365) scale(.7)" /><use href="#neighbour-house" transform="translate(374 343) scale(.8)" /></g>
                </g>
                <g stroke="#65b8dd" strokeWidth="0.6" opacity="0.18"><path d="m26 293 261-137 213 113-261 137ZM55 309l261-137m-217 160 261-137m-217 160 261-137m-217 160 261-137M70 270l213 113M114 247l213 113M158 224l213 113M202 201l213 113" /></g>
                <path d="m64 304 210-111 196 101v14L260 421 64 318Z" fill="#071524" stroke="#356180" />
                <path d="m64 304 210-111 196 101-210 112Z" fill="#16354a" stroke="#5a92ad" strokeWidth="0.8" />
                <path d="m83 304 191-100 174 90-188 100Z" fill="#244c51" stroke="#54827b" strokeOpacity="0.5" />
                <path d="m138 327 90-47 126 65-91 48Z" fill="#173047" />
                <path d="m191 337 39-21 72 38-39 21Z" fill="#7b8e96" opacity="0.7" />
                <ellipse cx="267" cy="321" rx="132" ry="30" fill="#020914" opacity="0.55" />
                <g transform="matrix(1 .38 0 1 128 180)">
                  <path d="M0 0h155v126H0Z" fill="url(#house-front)" stroke="#79b8d9" />
                  <path d="M0 0h155v126H0Z" fill="url(#house-bricks)" />
                  <path d="M0 4h155M0 70h155M0 121h155" stroke="#9ab8c8" strokeWidth="3" />
                  {[18, 102].map((x) => <g key={x} transform={`translate(${x} 17)`}>
                    <rect x="-4" y="-5" width="39" height="43" fill="#092139" />
                    <rect width="31" height="33" fill="url(#house-window)" stroke="#e6d7b5" strokeWidth="2" />
                    <rect x="2" y="2" width="27" height="29" fill="#ffc176" opacity="0.45" filter="url(#house-soft-light)" />
                    <path d="M15.5 0v33M0 12h31" stroke="#7c6557" strokeWidth="2" />
                    <path d="M3 2v29M28 2v29" stroke="#fff0d2" strokeOpacity="0.5" strokeWidth="3" />
                    <path d="M-5 36h41" stroke="#b7c7ce" strokeWidth="4" />
                  </g>)}
                  <g transform="translate(17 83)"><path d="M-3-4h40v34H-3Z" fill="#091e30" /><path d="M0 0h34v25H0Z" fill="url(#house-window)" stroke="#d2d1bd" strokeWidth="2" /><path d="M17 0v25M0 9h34" stroke="#6d6057" strokeWidth="2" /><path d="M-5 28h44" stroke="#b7c7ce" strokeWidth="4" /></g>
                  <path d="M94 126V81q0-17 17-17t17 17v45" fill="#0b1c2b" stroke="#a7bfcc" strokeWidth="3" />
                  <path d="M99 126V82q0-12 12-12t12 12v44" fill="#1b4858" stroke="#5e8998" />
                  <path d="M102 84h18v12h-18Z" fill="url(#house-window)" /><path d="M103 103h16v15h-16Z" stroke="#72949b" /><circle cx="119" cy="101" r="1.7" fill="#f5d392" />
                  <path d="M0 126h155v6H0Z" fill="#10263b" stroke="#5f8ca9" />
                </g>
                <g transform="matrix(1 -.526 0 1 283 239)">
                  <path d="M0 0h114v126H0Z" fill="url(#house-side)" stroke="#518eaf" /><path d="M0 0h114v126H0Z" fill="url(#house-bricks)" />
                  <path d="M0 5h114M0 70h114M0 122h114" stroke="#39617b" strokeWidth="3" />
                  {[19, 72].map((x) => <g key={x} transform={`translate(${x} 19)`}><rect x="-3" y="-4" width="30" height="43" fill="#061426" /><rect width="24" height="33" fill="url(#house-window)" opacity="0.85" stroke="#a7b3b1" strokeWidth="2" /><path d="M12 0v33M0 12h24" stroke="#76665a" strokeWidth="2" /><path d="M-4 36h32" stroke="#72929f" strokeWidth="3" /><rect y="67" width="24" height="25" fill="#2b6683" stroke="#72929f" strokeWidth="2" /><path d="M12 67v25" stroke="#72929f" /></g>)}
                  <path d="M104 8v116" stroke="#091c2c" strokeWidth="4" />
                </g>
                <path d="m128 180 58-89 97 148Z" fill="#315b7b" stroke="#8bb7d0" /><path d="m128 180 58-89 97 148Z" fill="url(#house-bricks)" />
                <g transform="matrix(1 -.526 .808 1.283 186 91)"><path d="M0 0h114v120H0Z" fill="url(#house-roof)" stroke="#82b5d3" /><path d="M0 0h114v120H0Z" fill="url(#house-slates)" /></g>
                <path d="m118 183 67-103 103 158M185 80 300 20 410 180l-122 65" stroke="#a4d4e9" strokeWidth="3" strokeLinejoin="round" />
                <path d="m288 245 122-65" stroke="#06152a" strokeWidth="5" /><path d="m118 187 67-103 103 158" stroke="#416e8e" strokeWidth="3" />
                <g transform="matrix(1 .38 0 1 169 133)"><path d="M0 19V7a14 14 0 0 1 28 0v12Z" fill="#091c30" stroke="#9dbcc9" strokeWidth="2" /><path d="M5 17V8a9 9 0 0 1 18 0v9Z" fill="url(#house-window)" /><path d="M14 0v18M4 8h20" stroke="#7b6a5d" strokeWidth="2" /></g>
                <path d="m327 93 0-49 20-11 0 49Z" fill="#16334e" stroke="#8ba9b9" /><path d="m307 82 0-49 20 11v49Z" fill="#355976" stroke="#8ba9b9" /><path d="m303 32 23-13 25 13-24 13Z" fill="#7c96a3" stroke="#c1d3da" /><path d="m312 31 14-7 15 8-14 7Z" fill="#0c1c2b" />
                <path d="m217 343 38 14-10 6-38-15Z" fill="#a1b2b7" /><path d="m207 348 38 15v7l-38-15Z" fill="#607c8b" /><path d="m200 355 39 15-10 6-39-15Z" fill="#93a8b0" />
                <g stroke="#759ca2" strokeWidth="1.5"><path d="m93 304 0-30m0 10 9-10m-9 17-8-8M418 295v-32m0 13 10-11m-10 17-8-8" /></g>
                <g fill="#2e6866" stroke="#56958a"><path d="M76 278q-10-17 6-24-4-21 13-24 17 3 15 21 18 13 0 29Z" /><path d="M401 269q-9-17 6-23-2-20 13-22 17 4 13 23 17 14-1 26Z" /></g>
                <g fill="#407c70"><ellipse cx="123" cy="334" rx="15" ry="8" /><ellipse cx="146" cy="346" rx="12" ry="7" /><ellipse cx="375" cy="334" rx="20" ry="9" /></g>
                <g stroke="#76cfff" strokeWidth="1"><path d="M365 125h61V99" strokeDasharray="3 4" /><circle cx="365" cy="125" r="3" fill="#a8edff" /><path d="m153 280-49 26H67" strokeDasharray="3 4" /><circle cx="153" cy="280" r="3" fill="#a8edff" /></g>
                <rect x="365" y="65" width="116" height="33" rx="8" fill="#0a2036" stroke="#4386a9" /><circle cx="380" cy="81" r="3" fill="#8edbff" /><text x="391" y="85" fill="#d5efff" fontSize="10" fontFamily="monospace" letterSpacing="1">DURHAM</text>
                <rect x="19" y="293" width="99" height="29" rx="7" fill="#0a2036" stroke="#4386a9" /><text x="68" y="312" textAnchor="middle" fill="#8edbff" fontSize="9" fontFamily="monospace" letterSpacing="0.8">LOOK CLOSER</text>
              </svg>
            </div>
          </div>
          <div className="relative z-10 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400"><span>Explore areas. Compare houses. Read the fine print.</span><span className="text-sky-300">Built for better decisions ↗</span></div>
          </div>
        </section>
      </main>
      <footer className="home-footer flex flex-wrap justify-between gap-3 border-t border-white/10 px-5 py-6 text-[10px] leading-relaxed text-slate-400 sm:px-8"><span>Scouthaus · A little more clarity before you get the keys.</span><span>Fictional demo listings · Educational guidance, not legal advice.</span></footer>
    </div>
  );
}
