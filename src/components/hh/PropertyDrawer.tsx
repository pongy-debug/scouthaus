import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, ExternalLink, GitCompareArrows, Star, X } from "lucide-react";
import { HouseGallery } from "@/components/hh/HousePhoto";
import { Button } from "@/components/ui/button";
import { AVAIL_LABEL, PROPERTY_TYPE_LABEL, advertUrl, bedsOf, rentOf, cityForHouse, estimatedWalkMinutes, hasTelemetry, needsHmoLicence, trueMonthlyCost, type House } from "@/lib/hh/find";
import { NationalPropertyData } from "./NationalPropertyData";

const EPCS = ["A", "B", "C", "D", "E", "F", "G"] as const;
const epcTone = (e: string) => (e <= "B" ? "bg-success" : e <= "D" ? "bg-warning" : "bg-destructive");
const tone = (v: number) => (v >= 70 ? "text-destructive" : v >= 40 ? "text-warning" : "text-primary");

/** Property X-Ray Drawer body: true cost, EPC, HMO licensing, noise, damp, rent benchmark, reviews and compare. */
export function PropertyDrawer({ house, pinned, onToggleCompare, onClose }: { house: House; pinned: boolean; onToggleCompare: () => void; onClose?: (() => void) | undefined }) {
  const p = house.xray;
  const diff = Math.round(((p.rent - p.median) / p.median) * 100);
  const cost = trueMonthlyCost(house);
  const hmo = needsHmoLicence(house);
  const advert = advertUrl(house);
  const known = hasTelemetry(house);
  const city = cityForHouse(house);
  return (
    <div className="grid gap-3">
      <HouseGallery house={house} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Property X-Ray</div>
          <h2 className="text-lg font-bold leading-tight">{house.name}</h2>
          <div className="font-mono text-xs text-muted-foreground">{p.address} <span className="text-primary">{p.postcode}</span></div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{house.landlord} · {bedsOf(house)} · {rentOf(house)} · {house.availabilityNote ?? AVAIL_LABEL[house.availability]}</div>
          {house.availableFrom && <p className="mt-1 text-xs text-primary">Available from {new Date(`${house.availableFrom}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</p>}
          {house.propertyType === "studio" && <p className="mt-1 text-xs font-semibold">{PROPERTY_TYPE_LABEL.studio}</p>}
          {!house.tourPath && house.rentNote && <p className="mt-1 text-xs text-muted-foreground">{house.rentNote}</p>}
          {!house.tourPath && house.locationNote && <p className="mt-1 text-xs text-muted-foreground">{house.locationNote}</p>}
          {!house.tourPath && house.approximate && !house.approximateLocation && <p className="mt-1 text-xs text-muted-foreground">Approximate location</p>}
          {!house.tourPath && house.approximateLocation && <p className="mt-1 text-xs text-muted-foreground">Approximate location · pin placed at the postcode centre, not a verified building</p>}
        </div>
        {onClose && <Button size="icon" variant="ghost" aria-label="Close X-Ray" onClick={onClose}><X /></Button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={pinned ? "default" : "outline"} onClick={onToggleCompare}><GitCompareArrows /> {pinned ? "Added to Compare" : "Add to Compare"}</Button>
        {advert && <Button asChild size="sm" variant="outline"><a href={advert} target="_blank" rel="noopener noreferrer"><ExternalLink /> View original advert</a></Button>}
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{p.area} · {p.tag}</span>
      </div>
      {house.tourPath && <Stat title="Virtual tour">
        <Button asChild size="sm"><Link to={house.tourPath}>Explore in 3D</Link></Button>
        <p className="mt-2 text-xs text-muted-foreground">Explore the supplied Flat 4 model, including three bedrooms, kitchen and living room. Illustrative layout; other flats may differ.</p>
      </Stat>}
      {advert && (
        <Stat title="Viewing">
          <p className="mb-2 text-xs text-muted-foreground">Viewings are arranged by the letting agent on their own advert page.</p>
          <Button asChild size="sm"><a href={advert} target="_blank" rel="noopener noreferrer"><CalendarCheck /> Book a viewing with {house.landlord}</a></Button>
        </Stat>
      )}
      <Stat title="Walk to university">
        {city.walkDestinations?.map((destination) => <div key={destination.name} className="mt-2 text-xs">
          <span className="font-semibold">About {estimatedWalkMinutes(house, destination)} min</span> · {destination.name}
          <a className="ml-2 text-primary underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${house.address}, ${house.postcode}`)}&destination=${encodeURIComponent(`${destination.name}, ${city.name}`)}&travelmode=walking`}>Walking route</a>
        </div>)}
        <p className="mt-2 text-xs text-muted-foreground">Estimates use straight-line distance plus 25% at 4.8 km/h, not a surveyed walking route. Check the route for crossings and access.</p>
      </Stat>
      {!known && <>
        <Stat title="Monthly rent"><div className="font-mono text-2xl font-semibold">{house.flatOptions ? "From " : ""}£{cost.rent}<span className="text-sm text-muted-foreground">/mo per person</span></div><p className="mt-1 text-xs text-muted-foreground">Rent only. Heating, bills, damp, noise and area rent benchmarks have not been verified.</p></Stat>
        <NationalPropertyData house={house} />
      </>}
      {known && <><Stat title="True monthly cost">
        <div className="font-mono text-2xl font-semibold">£{cost.total}<span className="text-sm text-muted-foreground">/mo per person</span></div>
        <p className="mt-1 text-xs text-muted-foreground">£{cost.rent} rent ({rentOf(house)} × 52 ÷ 12) + £{cost.energy} winter heating share (£{p.bill} ÷ {house.bedrooms} beds)</p>
      </Stat>
      <Stat title="EPC energy rating">
        <div className="font-mono text-2xl font-semibold">{p.epc} <span className="text-sm text-muted-foreground">({p.epcScore}/100)</span></div>
        <div className="mt-2 flex gap-0.5">
          {EPCS.map((e) => <div key={e} className={`flex h-5 flex-1 items-center justify-center rounded-sm font-mono text-[10px] ${e === p.epc ? `${epcTone(e)} text-background font-bold scale-y-125` : "bg-muted text-muted-foreground"}`}>{e}</div>)}
        </div>
      </Stat>
      <Stat title="Predicted winter heating bill">
        <div className={`font-mono text-2xl font-semibold ${tone((p.bill - 80) / 2.2)}`}>£{p.bill}<span className="text-sm text-muted-foreground">/mo</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{p.billFactors.join(" • ")}</p>
      </Stat>
      </>}
      {house.flatOptions ? <Stat title="HMO licence">
        <div className={`font-mono text-sm font-semibold ${hmo ? "text-warning" : "text-primary"}`}>{hmo ? "Mandatory licence needed for the larger flats" : "No mandatory licence"}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hmo ? "A flat shared by 5+ people from 2+ households must hold an HMO licence." : "Every advertised flat is below the 5-person threshold for mandatory HMO licensing."} {house.checked?.hmo ?? "Licence status has not been checked against the council's register; confirm the selected flat with the agent."}</p>
      </Stat> : <Stat title="HMO licence">
        <div className={`font-mono text-sm font-semibold ${hmo ? "text-warning" : "text-primary"}`}>{hmo ? "Mandatory licence needed" : "No mandatory licence"}</div>
        {city.id === "newcastle" && <p className="mt-1 text-xs text-muted-foreground">Whether this house holds its licence has not been checked against Newcastle City Council's HMO register.</p>}
        <p className="mt-1 text-xs text-muted-foreground">{hmo
          ? `${house.bedrooms} bedrooms: a house shared by 5+ people from 2+ households must hold an HMO licence. Licence status is not in the local dataset — ask the landlord for the licence number and check the council's public HMO register.`
          : `${house.bedrooms} bedrooms: below the 5-person threshold for mandatory HMO licensing. Councils can still require additional licensing, so ask the landlord.`}</p>
      </Stat>}
      {known && <><Stat title="Crime & noise">
        <div className={`font-mono text-2xl font-semibold ${tone(p.noise)}`}>{p.noise}/100 <span className="text-sm">{p.noise >= 70 ? "Loud at night" : p.noise >= 40 ? "Moderate" : "Quiet"}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">Late-night noise score. Street-level crime figures are not in the local dataset — look up {p.postcode} on police.uk before you sign.</p>
      </Stat>
      <Stat title="Damp & condensation risk">
        <div className={`font-mono text-2xl font-semibold ${tone(p.damp)}`}>{p.damp}/100 <span className="text-sm">{p.damp >= 70 ? "High" : p.damp >= 40 ? "Moderate" : "Low"}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{p.dampNote}</p>
      </Stat>
      <Stat title="Fair rent benchmark">
        <div className="font-mono text-sm">Advertised: <span className="text-lg font-semibold">£{p.rent}/wk</span></div>
        <div className="font-mono text-sm text-muted-foreground">{p.postcode.split(" ")[0]} median: £{p.median}/wk</div>
        <div className={`mt-1 font-mono text-sm font-semibold ${diff > 10 ? "text-destructive" : diff > 3 ? "text-warning" : "text-primary"}`}>{diff > 0 ? "+" : ""}{diff}% {diff > 10 ? "Overpriced" : diff > 3 ? "Slightly high" : "Fair"}</div>
      </Stat>
      </>}
      <Reviews houseId={house.id} />
    </div>
  );
}

function Stat({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-background/40 p-3"><div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>{children}</div>;
}

interface Review { stars: number; text: string; at: string }
const KEY = "hh-reviews";
function loadReviews(): Record<string, Review[]> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Review[]>; } catch { return {}; }
}

/** Tenant reviews are written by the user and kept in this browser only — none are seeded. */
function Reviews({ houseId }: { houseId: string }) {
  const [list, setList] = useState<Review[]>([]);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  useEffect(() => { setList(loadReviews()[houseId] ?? []); setStars(0); setText(""); }, [houseId]);
  const add = () => {
    const next = [{ stars, text: text.trim(), at: new Date().toISOString().slice(0, 10) }, ...list];
    try { localStorage.setItem(KEY, JSON.stringify({ ...loadReviews(), [houseId]: next })); } catch { /* storage unavailable: keep in memory */ }
    setList(next); setStars(0); setText("");
  };
  return (
    <Stat title={`Reviews (${list.length})`}>
      {list.length === 0 && <p className="text-xs text-muted-foreground">No reviews yet. Lived here? Add the first one — it is saved in this browser only.</p>}
      <ul className="space-y-2">
        {list.map((r, i) => (
          <li key={i} className="text-xs">
            <div className="flex items-center gap-1 text-warning" aria-label={`${r.stars} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`size-3 ${n <= r.stars ? "fill-current" : "opacity-30"}`} />)}<span className="ml-1 font-mono text-muted-foreground">{r.at}</span></div>
            <p className="mt-0.5">{r.text}</p>
          </li>
        ))}
      </ul>
      <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); if (stars && text.trim()) add(); }}>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setStars(n)} className="text-warning"><Star className={`size-4 ${n <= stars ? "fill-current" : "opacity-40"}`} /></button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="What was it like to live here?" aria-label="Your review"
          className="w-full rounded-md border border-input bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary" />
        <Button type="submit" size="sm" variant="outline" disabled={!stars || !text.trim()}>Post review</Button>
      </form>
    </Stat>
  );
}
