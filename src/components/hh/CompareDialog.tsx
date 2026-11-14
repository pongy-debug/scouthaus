import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AVAIL_LABEL, hasTelemetry, needsHmoLicence, riskLabel, trueMonthlyCost, type Area, type House } from "@/lib/hh/find";

export const MAX_COMPARE = 3;

/** Side-by-side table for up to three pinned houses. */
export function CompareDialog({ open, onOpenChange, houses, areas, onRemove }: {
  open: boolean; onOpenChange: (o: boolean) => void; houses: House[]; areas: Area[]; onRemove: (id: string) => void;
}) {
  const rows: [string, (h: House) => React.ReactNode][] = [
    ["Area", (h) => areas.find((a) => a.id === h.area)?.name ?? h.area],
    ["Availability", (h) => AVAIL_LABEL[h.availability]],
    ["Rent", (h) => `£${h.rent} pppw`],
    ["True monthly cost", (h) => `£${trueMonthlyCost(h).total}/mo pp`],
    ["Bedrooms", (h) => h.bedroomsNote ?? h.bedrooms],
    ["EPC", (h) => `${h.xray.epc} (${h.xray.epcScore}/100)`],
    ["Winter heating bill", (h) => `£${h.xray.bill}/mo`],
    ["HMO licence", (h) => (needsHmoLicence(h) ? "Mandatory licence needed" : "No mandatory licence")],
    ["Noise", (h) => `${h.xray.noise}/100`],
    ["Damp risk", (h) => `${h.xray.damp}/100`],
    ["Rent vs area median", (h) => { const d = Math.round(((h.xray.rent - h.xray.median) / h.xray.median) * 100); return `${d > 0 ? "+" : ""}${d}%`; }],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare houses</DialogTitle>
          <DialogDescription>Up to {MAX_COMPARE} pinned houses side by side. Pin a house with “Add to Compare” in its X-Ray.</DialogDescription>
        </DialogHeader>
        {houses.length === 0 ? <p className="text-sm text-muted-foreground">Nothing pinned yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">House</th>
                  {houses.map((h) => (
                    <th key={h.id} className="py-2 pr-3 align-top font-semibold">
                      <span className="flex items-start justify-between gap-2">{h.name}
                        <button type="button" aria-label={`Remove ${h.name} from compare`} onClick={() => onRemove(h.id)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, cell]) => (
                  <tr key={label} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</td>
                    {houses.map((h) => <td key={h.id} className="py-2 pr-3 font-mono text-xs">{hasTelemetry(h) ? cell(h) : label === "EPC" ? riskLabel(h, "epc") : label === "Noise" ? riskLabel(h, "crime") : ["True monthly cost", "Winter heating bill", "Damp risk", "Rent vs area median"].includes(label) ? "Not checked yet" : cell(h)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
