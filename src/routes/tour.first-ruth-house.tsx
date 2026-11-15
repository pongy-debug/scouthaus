import { createFileRoute, Link } from "@tanstack/react-router";
import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { ArrowLeft, Download, Images, RotateCcw, Box, ChevronRight } from "lucide-react";
import { SiteNav } from "@/components/hh/SiteNav";
import { Button } from "@/components/ui/button";
import { useWebGL } from "@/components/hh/MapFallback";
import type { TourView } from "@/components/hh/RuthTourScene";

const Scene = lazy(() => import("@/components/hh/RuthTourScene"));
const PHOTOS = [
  { file: "kitchen.jpg", label: "Kitchen", detail: "Cabinets, worktops and window" },
  { file: "cooker.jpg", label: "Cooker", detail: "Oven and extractor" },
  { file: "connecting-space.jpg", label: "Connecting space", detail: "Kitchen opening into the lounge" },
  { file: "living-room.jpg", label: "Living room", detail: "Sofa, windows and TV unit" },
];
const STOPS: { id: TourView; label: string; detail: string }[] = [
  { id: "overview", label: "Whole space", detail: "Rotate the cutaway model" },
  { id: "kitchen", label: "Kitchen", detail: "Start by the cooker" },
  { id: "window", label: "Kitchen window", detail: "Look across the worktop" },
  { id: "connection", label: "Through to the lounge", detail: "See how the spaces connect" },
  { id: "lounge", label: "Living room", detail: "Look around the seating area" },
];
function Photos({ selected, onSelect }: { selected: number; onSelect: (i: number) => void }) {
  const photo = PHOTOS[selected]!;
  return <div className="flex h-full min-h-0 flex-col gap-3 p-4">
    <img src={`/tours/first-ruth-house/${photo.file}`} alt={`First Ruth House: ${photo.detail}`} className="min-h-0 w-full flex-1 rounded-lg object-contain" />
    <div className="flex justify-center gap-2">{PHOTOS.map((p, i) => <button key={p.file} aria-label={`View ${p.label} photo`} aria-pressed={i === selected} onClick={() => onSelect(i)} className={`overflow-hidden rounded-lg border-2 ${i === selected ? "border-primary" : "border-transparent opacity-70"}`}><img src={`/tours/first-ruth-house/${p.file}`} alt="" className="h-14 w-14 object-cover" /></button>)}</div>
    <p className="text-center text-xs text-muted-foreground">{photo.label} · Original user-supplied photo</p>
  </div>;
}
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export const Route = createFileRoute("/tour/first-ruth-house")({
  ssr: false,
  head: () => ({ meta: [{ title: "First Ruth House virtual tour | Scouthaus" }, { name: "description", content: "Explore a photo-informed 3D reconstruction of First Ruth House's kitchen and living room." }] }),
  component: RuthTour,
});
function RuthTour() {
  const [view, setView] = useState<TourView>("overview");
  const [reset, setReset] = useState(0);
  const [photos, setPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const gl = useWebGL();
  const stop = STOPS.findIndex((s) => s.id === view);
  const choose = (id: TourView) => { setView(id); setPhotos(false); setReset((n) => n + 1); };
  const fallback = <div className="flex h-full flex-col"><p role="status" className="px-4 pt-4 text-sm">3D is unavailable on this device. You can still explore all four photos.</p><div className="min-h-0 flex-1"><Photos selected={selectedPhoto} onSelect={setSelectedPhoto} /></div></div>;
  return <div className="min-h-screen space-y-5 p-3 sm:p-5">
    <SiteNav />
    <main className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><Link to="/find" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="size-3" /> Back to Find House</Link><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Step inside</p><h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Ruth First House</h1><p className="mt-2 text-sm text-muted-foreground">Kitchen & living room · A tour built from your photos</p></div>
        <Button asChild variant="outline"><a href="/tours/first-ruth-house/first-ruth-house.glb" download><Download /> Download 3D model</a></Button>
      </header>
      <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="glass flex flex-col gap-5 p-4">
          <div><h2 className="font-semibold">Explore the space</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Choose a viewpoint, then drag to look around.</p></div>
          <nav aria-label="Tour viewpoints" className="grid grid-cols-2 gap-2 lg:grid-cols-1">{STOPS.map((s, i) => <button key={s.id} onClick={() => choose(s.id)} aria-pressed={!photos && view === s.id} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${!photos && view === s.id ? "border-primary/60 bg-primary/10" : "border-border hover:bg-accent"}`}><span className="font-mono text-xs text-primary">0{i + 1}</span><span><span className="block text-sm font-medium">{s.label}</span><span className="mt-1 hidden text-xs text-muted-foreground lg:block">{s.detail}</span></span></button>)}</nav>
          <div className="mt-auto rounded-xl border border-border p-3 text-xs leading-relaxed text-muted-foreground"><span className="mb-1 block font-semibold text-foreground">Approximate reconstruction</span>Based on four photos; the flat number has not been confirmed. Dimensions, hidden surfaces and the connection between rooms are inferred. Bedrooms and other unseen rooms are not included.</div>
        </aside>
        <section aria-label="Virtual tour viewer" className="glass overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3"><span className="flex items-center gap-2 text-sm font-semibold">{photos ? <Images className="size-4" /> : <Box className="size-4" />}{photos ? "Original photos" : STOPS[stop]!.label}</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setPhotos((p) => !p)}><Images />{photos ? "Back to 3D" : "Compare with photos"}</Button>{!photos && <Button size="sm" variant="ghost" aria-label="Reset viewpoint" onClick={() => setReset((n) => n + 1)}><RotateCcw /></Button>}</div></div>
          <div className="h-[55vh] min-h-[350px] lg:h-[65vh] lg:min-h-[520px]">
            {photos ? <Photos selected={selectedPhoto} onSelect={setSelectedPhoto} /> : gl === false ? fallback : gl ? <SceneBoundary fallback={fallback}><Suspense fallback={<p role="status" className="p-6 text-sm">Preparing your 3D tour…</p>}><Scene view={view} reset={reset} /></Suspense></SceneBoundary> : <p role="status" className="p-6 text-sm">Checking 3D support…</p>}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border p-3"><p className="text-xs text-muted-foreground">{photos ? "Compare the model against the original views." : view === "overview" ? "Drag to rotate · Scroll or pinch to zoom" : "Drag to look around · Choose a viewpoint to move"}</p><Button size="sm" onClick={() => choose(STOPS[(stop + 1) % STOPS.length]!.id)}>{stop === STOPS.length - 1 ? "Back to overview" : "Next viewpoint"}<ChevronRight /></Button></div>
        </section>
      </div>
    </main>
  </div>;
}
