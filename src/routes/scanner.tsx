import { createFileRoute } from "@tanstack/react-router";
import { ContractScanner } from "@/components/hh/ContractScanner";
import { SiteFooter, SiteNav } from "@/components/hh/SiteNav";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Contract Scanner — HouseHunt" },
      { name: "description", content: "Paste or drop your tenancy contract — illegal fees and unfair clauses are flagged locally, with a ready-to-send email." },
      { property: "og:title", content: "HouseHunt — Contract Scanner" },
      { property: "og:description", content: "Spot illegal fees and unfair clauses in a tenancy contract before you sign." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Scanner,
});

function Scanner() {
  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 lg:h-screen">
      <SiteNav />
      <main className="mx-auto min-h-[600px] w-full max-w-4xl flex-1 lg:min-h-0"><ContractScanner /></main>
      <SiteFooter />
    </div>
  );
}
