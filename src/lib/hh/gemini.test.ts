import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }),
}));

import { analyseContract } from "./gemini";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function mockAnswer(score: unknown) {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, status: 200,
    text: async () => JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({
      address: "", clauses: 12, score, scoreReason: "Limited financial exposure from an ambiguous charge.",
      flags: [{ clause: "3", label: "UNFAIR TERM", severity: "amber", text: "A charge may apply.", statute: "", explain: "An unclear charge.", ask: "clarify the charge", fee: 20, unenforceable: false }],
    }) }] } }] }),
  }));
}

describe("Gemini contract scoring", () => {
  it.each([0, 18, 47, 73, 100])("preserves Gemini's score of %s and explanation", async (score) => {
    mockAnswer(score);
    const response = await analyseContract({ data: { text: "Tenancy agreement" } });
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.score).toBe(score);
      expect(response.result.scoreReason).toContain("Limited financial exposure");
      expect(response.result.illegalFees).toBe(20);
      expect(response.result.flags).toHaveLength(1);
    }
  });

  it.each([undefined, -1, 101, 25.5, "47"])("rejects invalid score %s so local fallback can run", async (score) => {
    mockAnswer(score);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await analyseContract({ data: { text: "Tenancy agreement" } })).toMatchObject({ ok: false, reason: "failed" });
  });

  it("keeps the no-key fallback available", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(await analyseContract({ data: { text: "Tenancy agreement" } })).toMatchObject({ ok: false, reason: "no-key" });
  });
});
