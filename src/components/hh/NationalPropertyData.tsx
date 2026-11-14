import { useQuery } from "@tanstack/react-query";
import { getPropertyInsights } from "@/lib/hh/propertyInsights";
import type { House } from "@/lib/hh/find";

export function NationalPropertyData({ house }: { house: House }) {
  const { data, isPending } = useQuery({ queryKey: ["property-insights", house.id], queryFn: () => getPropertyInsights({ data: { houseId: house.id } }), staleTime: 60 * 60 * 1000, retry: false });
  const checked = house.checked?.epc;
  return <section className="space-y-3 rounded-lg border border-border bg-background/40 p-3" aria-label="National property data">
    {isPending && <p role="status" className="text-xs text-muted-foreground">Checking national property data…</p>}
    <div><h3 className="text-xs font-semibold">EPC energy rating</h3>
      <p className="mt-1 text-sm">{data?.epc ? `${data.epc.band} · Certificate registered ${data.epc.date}` : checked ? `${checked.bands.length === 1 ? checked.bands[0] : `${checked.bands[0]}–${checked.bands[checked.bands.length - 1]}`} · National EPC register` : "Not checked yet"}</p>
      {!data?.epc && checked && <p className="mt-1 text-xs text-muted-foreground">{checked.source}</p>}
      {!data?.epc && !checked && <p className="mt-1 text-xs text-muted-foreground">{!/^\d+\b/.test(house.address) ? "A full property address is needed to match an EPC reliably." : "No verified certificate is available for this listing yet."}</p>}
      <a className="text-xs text-primary underline" href="https://www.gov.uk/find-energy-certificate" target="_blank" rel="noopener noreferrer">Check the national EPC register</a>
    </div>
    <div><h3 className="text-xs font-semibold">Recorded crime nearby</h3>
      <p className="mt-1 text-sm">{data?.crime ? `${data.crime.count} reports within 1 mile · ${data.crime.month}` : isPending ? "Checking…" : "Data unavailable"}</p>
      <p className="mt-1 text-xs text-muted-foreground">Area-level reports from data.police.uk, with anonymised locations. These are not incidents at this house or a noise score.</p>
      <a className="text-xs text-primary underline" href="https://data.police.uk/" target="_blank" rel="noopener noreferrer">Source: Police.uk</a>
    </div>
    <p className="text-xs text-muted-foreground">{house.postcode}{data?.postcode ? ` · ${data.postcode.district}` : ""} · Approximate postcode location. <a className="underline" href="https://postcodes.io/" target="_blank" rel="noopener noreferrer">Source: Postcodes.io</a></p>
  </section>;
}
