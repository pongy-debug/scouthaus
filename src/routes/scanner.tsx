import { createFileRoute } from "@tanstack/react-router";
import { ContractScanner } from "@/components/hh/ContractScanner";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Contract Check — Scouthaus" },
      { name: "description", content: "Paste or drop your tenancy contract — review unfair terms and unexpected fees, with a clear risk score and an editable email." },
      { property: "og:title", content: "Scouthaus — Contract Check" },
      { property: "og:description", content: "Spot illegal fees and unfair clauses in a tenancy contract before you sign." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Scanner,
  pendingComponent: Scanner,
  pendingMs: 0,
  pendingMinMs: 0,
});

function Scanner() {
  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 ">
      <main className="mx-auto w-full max-w-5xl flex-1 px-1 sm:px-4"><ContractScanner /></main>
    </div>
  );
}
