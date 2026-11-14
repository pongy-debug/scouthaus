import { createFileRoute, Link } from "@tanstack/react-router";
import { Box, FileSearch, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteNav } from "@/components/hh/SiteNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HouseHunt — See the true cost of a student house before you sign" },
      { name: "description", content: "Explore Durham student houses in 3D, X-ray energy bills and damp risk, and scan tenancy contracts for illegal clauses." },
      { property: "og:title", content: "HouseHunt — Student house hunting, X-rayed" },
      { property: "og:description", content: "3D area explorer, EPC & damp X-ray and a contract red-flag scanner for Durham students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { to: "/find" as const, icon: Box, title: "Find House", body: "Fly over Durham in 3D, click an area and X-ray every listed house: true monthly cost, EPC, HMO licensing and noise, with side-by-side compare." },
  { to: "/scanner" as const, icon: FileSearch, title: "Contract Scanner", body: "Paste or drop your tenancy — illegal fees and unfair clauses flagged locally, with a ready email." },
];

function Landing() {
  return (
    <div className="flex min-h-screen flex-col gap-3 p-3">
      <SiteNav />
      <main className="flex flex-1 flex-col gap-6">
        <section className="glass relative overflow-hidden px-6 py-16 text-center md:py-24">
          <div className="mx-auto max-w-2xl">
            <div className="font-mono text-xs uppercase tracking-widest text-primary">Durham · DH1 · Student lets</div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">House<span className="text-primary">Hunt</span></h1>
            <p className="mt-4 text-lg text-muted-foreground">See the true cost and risks of a student house before you sign.</p>
            <Button asChild size="lg" className="glow mt-8 font-semibold"><Link to="/find"><Search /> Find House</Link></Button>
          </div>
        </section>
        <section className="grid gap-3 md:grid-cols-2">
          {FEATURES.map((f) => (
            <Link key={f.title} to={f.to} className="glass group p-5 transition hover:border-primary">
              <f.icon className="size-6 text-primary" />
              <h2 className="mt-3 font-bold group-hover:text-primary">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </Link>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
