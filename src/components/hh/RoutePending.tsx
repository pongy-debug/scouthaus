import { useRouterState } from "@tanstack/react-router";
import { ContractScanner } from "./ContractScanner";

export function RoutePending() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const title = path.includes("newcastle") ? "Newcastle houses" : path.includes("durham") ? "Durham houses" : path.startsWith("/find") ? "Find House" : "Scouthaus";
  return <div className="min-h-screen bg-background p-4" aria-busy="true">
    {path === "/scanner" ? <div className="mx-auto max-w-5xl"><ContractScanner /></div> : <div role="status" className="mx-auto max-w-5xl space-y-4"><h1 className="text-3xl font-bold">{title}</h1><p>Loading page...</p><div className="h-10 rounded bg-muted" /><div className="h-[60vh] rounded bg-muted" /></div>}
  </div>;
}
