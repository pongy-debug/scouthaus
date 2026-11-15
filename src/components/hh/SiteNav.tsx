import { Link } from "@tanstack/react-router";

export function SiteLogo() {
  return <Link to="/" aria-label="Scouthaus home" className="mr-2 text-xl font-extrabold tracking-tight text-foreground">Scout<span className="text-primary">haus</span></Link>;
}

export function SiteNav() {
  const cls = "rounded-md px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground";
  const active = { className: "rounded-md px-2.5 py-1 text-xs bg-primary/15 text-primary" };
  return (
    <header className="glass flex flex-wrap items-center gap-2 px-4 py-2.5">
      <SiteLogo />
      <nav className="flex flex-wrap gap-1">
        <Link to="/find" className={cls} activeProps={active}>Find House</Link>
        <Link to="/scanner" className={cls} activeProps={active}>Contract Check</Link>
        <Link to="/tour/first-ruth-house" className={cls} activeProps={active}>Virtual Tour</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return null;
}

export function Crumbs({ items, demo = false }: { items: { label: string; to?: "/" | "/find" | "/find/$city"; params?: { city: string } }[]; demo?: boolean }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 font-mono text-xs text-muted-foreground">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span>›</span>}
          {it.to ? <Link to={it.to} params={it.params as never} className="hover:text-foreground">{it.label}</Link> : <span className="text-foreground">{it.label}</span>}
        </span>
      ))}
      {demo && <span className="ml-2 rounded border border-warning/50 px-1.5 py-0.5 text-[10px] text-warning">Demo data</span>}
    </nav>
  );
}
