import * as Slider from "@radix-ui/react-slider";
import { bedsLabel } from "@/lib/hh/find";

const thumb = "block size-4 rounded-full border border-primary/60 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Dual-handle bedroom filter: minimum and maximum bedrooms, bounded by the loaded listings. */
export function BedRange({ min, max, value, onChange }: { min: number; max: number; value: [number, number]; onChange: (v: [number, number]) => void }) {
  const any = value[0] <= min && value[1] >= max;
  return (
    <div className="flex items-center gap-2">
      <span id="bed-range-label">Bedrooms: <span className="inline-block min-w-8 font-mono text-foreground">{bedsLabel({ minBeds: value[0], maxBeds: value[1] }, { min, max })}</span></span>
      <Slider.Root min={min} max={max} step={1} minStepsBetweenThumbs={0} value={value} aria-labelledby="bed-range-label"
        onValueChange={(v) => onChange([v[0] ?? min, v[1] ?? max])} className="relative flex h-4 w-28 touch-none select-none items-center">
        <Slider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20"><Slider.Range className="absolute h-full bg-primary" /></Slider.Track>
        <Slider.Thumb aria-label="Minimum bedrooms" className={thumb} />
        <Slider.Thumb aria-label="Maximum bedrooms" className={thumb} />
      </Slider.Root>
      <button type="button" onClick={() => onChange([min, max])} disabled={any} className="text-[11px] underline underline-offset-2 hover:text-foreground disabled:no-underline disabled:opacity-40">Reset</button>
    </div>
  );
}
