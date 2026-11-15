import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Download, Images, ExternalLink } from "lucide-react";
import { SiteNav } from "@/components/hh/SiteNav";
import { Button } from "@/components/ui/button";
import { useWebGL } from "@/components/hh/MapFallback";

const MODEL = "/tours/first-ruth-house/flat4-3d-model.html";
const PHOTOS = [
  { file: "kitchen.jpg", label: "Kitchen", detail: "Cabinets, worktops and window" },
  { file: "cooker.jpg", label: "Cooker", detail: "Oven and extractor" },
  { file: "connecting-space.jpg", label: "Connecting space", detail: "Kitchen opening into the lounge" },
  { file: "living-room.jpg", label: "Living room", detail: "Sofa, windows and TV unit" },
];
function Photos({ selected, onSelect }: { selected: number; onSelect: (i: number) => void }) {
  const photo = PHOTOS[selected]!;
  return <div className="flex h-full min-h-0 flex-col gap-3 p-4">
    <img src={`/tours/first-ruth-house/${photo.file}`} alt={`First Ruth House: ${photo.detail}`} className="min-h-0 w-full flex-1 rounded-lg object-contain" />
    <div className="flex justify-center gap-2">{PHOTOS.map((p, i) => <button key={p.file} aria-label={`View ${p.label} photo`} aria-pressed={i === selected} onClick={() => onSelect(i)} className={`overflow-hidden rounded-lg border-2 ${i === selected ? "border-primary" : "border-transparent opacity-70"}`}><img src={`/tours/first-ruth-house/${p.file}`} alt="" className="h-14 w-14 object-cover" /></button>)}</div>
    <p className="text-center text-xs text-muted-foreground">{photo.label} · Original user-supplied photo</p>
  </div>;
}

export const Route = createFileRoute("/tour/first-ruth-house")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ruth First House - Flat 4 virtual tour | Scouthaus" }] }),
  component: RuthTour,
});

function RuthTour() {
  const [photos, setPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const gl = useWebGL();
  return <div className="min-h-screen space-y-5 p-3 sm:p-5">
    <SiteNav />
    <main className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/find/$city" params={{ city: "durham" }} search={{ area: "claypath" }} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="size-3" /> Back to Claypath</Link>
          <h1 className="text-3xl font-bold tracking-tight">Ruth First House</h1>
          <p className="mt-2 text-sm text-muted-foreground">Flat 4 virtual tour - three-bedroom apartment</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><a href={MODEL} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open full-screen tour</a></Button>
          <Button asChild variant="outline"><a href={MODEL} download><Download /> Download interactive tour</a></Button>
        </div>
      </header>
      <section aria-label="Virtual tour viewer" className="glass overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
          <h2 className="text-sm font-semibold">{photos || gl === false ? "Original photos" : "Explore Flat 4"}</h2>
          {gl !== false && <Button size="sm" variant="outline" onClick={() => setPhotos((p) => !p)}><Images />{photos ? "Back to 3D" : "View original photos"}</Button>}
        </div>
        {gl === false && <p role="status" className="px-4 pt-4 text-sm">3D is unavailable on this device. You can still explore all four photos.</p>}
        <div className="h-[75vh] min-h-145">
          {photos || gl === false ? <Photos selected={selectedPhoto} onSelect={setSelectedPhoto} /> : gl ?
            <iframe title="Ruth First House Flat 4 interactive 3D tour" src={MODEL} sandbox="allow-scripts" allow="fullscreen" allowFullScreen className="h-full w-full border-0" /> :
            <p role="status" className="p-6 text-sm">Checking 3D support...</p>}
        </div>
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">User-supplied Flat 4 model, based on a letting floor plan. Dimensions and furnishings are illustrative, not a measured survey. Other flats may differ. The interactive tour requires WebGL and an internet connection to load its 3D library.</p>
    </main>
  </div>;
}
