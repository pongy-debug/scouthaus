import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { IMAGE_SOURCE } from "@/lib/hh/config";
import { advertUrl, photosOf, type House } from "@/lib/hh/find";

/** One advert photo, lazy-loaded. A missing or broken image becomes a neutral placeholder — never a stock or generated picture. */
function Photo({ src, alt, compact, className }: { src: string | undefined; alt: string; compact?: boolean; className: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (!src || broken) {
    return (
      <div role="img" aria-label="No photo available" title="No photo available" className={`flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground ${className}`}>
        <Building2 className={compact ? "size-4" : "size-7"} />
        {!compact && <span className="text-xs">No photo available</span>}
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`bg-muted object-cover ${className}`} />;
}

/** Small thumbnail for a house list row. */
export function HouseThumb({ house }: { house: House }) {
  if (IMAGE_SOURCE === "none") return null;
  return <Photo src={photosOf(house)[0]} alt="" compact className="size-10 shrink-0 rounded-md" />;
}

/** Banner photo with a simple gallery and a credit linking to the original advert. */
export function HouseGallery({ house }: { house: House }) {
  const photos = photosOf(house);
  const url = advertUrl(house);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [house.id]);
  if (IMAGE_SOURCE === "none") return null;
  return (
    <figure className="space-y-1.5">
      <Photo src={photos[i]} alt={`${house.name} — photo ${i + 1} of ${photos.length}`} className={`w-full rounded-lg border border-border ${photos.length ? "h-40" : "h-24"}`} />
      {photos.length > 1 && (
        <div className="flex gap-1.5" role="group" aria-label="Photos">
          {photos.map((p, n) => (
            <button key={p} type="button" aria-label={`Show photo ${n + 1}`} aria-pressed={n === i} onClick={() => setI(n)}
              className={`overflow-hidden rounded-md border-2 ${n === i ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}>
              <Photo src={p} alt="" compact className="h-10 w-14" />
            </button>
          ))}
        </div>
      )}
      {photos.length > 0 && (
        <figcaption className="text-[10px] text-muted-foreground">
          {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Photo: {house.photoCredit ?? house.landlord}</a> : `Photo: ${house.photoCredit ?? house.landlord}`}
        </figcaption>
      )}
    </figure>
  );
}
