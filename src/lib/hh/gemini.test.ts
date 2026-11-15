import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }),
}));

import { analyseContract, draftEmail, reviseEmail, summariseContract } from "./gemini";

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
  it("uses 3.8 Flash by default without a second request when it succeeds", async () => {
    mockAnswer(18);
    vi.stubEnv("GEMINI_MODEL", "");
    expect(await analyseContract({ data: { text: "Tenancy agreement" } })).toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toContain("/gemini-3.8-flash:generateContent");
  });

  it.each([429, 404, 503])("falls back from 3.8 to 3.6 when the primary returns %s", async (status) => {
    mockAnswer(18);
    vi.stubEnv("GEMINI_MODEL", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status } as Response);
    expect(await analyseContract({ data: { text: "Tenancy agreement" } })).toMatchObject({ ok: true });
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    ]);
  });

  it("reports the fallback quota error if both models are exhausted", async () => {
    mockAnswer(18);
    vi.stubEnv("GEMINI_MODEL", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 429, text: async () => JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }) } as Response);
    expect(await analyseContract({ data: { text: "Tenancy agreement" } })).toMatchObject({
      ok: false, message: "Gemini (gemini-3.6-flash) returned 429 RESOURCE_EXHAUSTED",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

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

describe("Gemini email and summary routes", () => {
  const reply = (value: unknown) => {
    vi.stubEnv("GEMINI_API_KEY", "test-key"); vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }] }) });
    vi.stubGlobal("fetch", f);
    return f;
  };
  const draftInput = { flags: [{ clause: "3.2", label: "ILLEGAL FEE", severity: "red" as const, quote: "admin fee of £150", statute: "Tenant Fees Act 2019", explain: "Banned.", ask: "remove it" }], risk: "High risk" as const, tone: "firm" as const, parties: { tenants: ["[TENANT_1]"], recipients: [], property: "[PROPERTY_ADDRESS], Durham DH1" } };

  it("drafts the email with one Gemini request that carries exactly the input, with the key in a header", async () => {
    const fetch = reply({ subject: "Subject: Changes", body: "Dear Landlord / Letting Agent, …" });
    expect(await draftEmail({ data: draftInput })).toEqual({ ok: true, subject: "Changes", body: "Dear Landlord / Letting Agent, …" });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    expect(JSON.parse(JSON.parse(init.body).contents[0].parts[0].text)).toEqual(draftInput);
  });

  it("revises the current draft and reports failures instead of falling back", async () => {
    const fetch = reply({ subject: "S", body: "B plus one sentence." });
    expect(await reviseEmail({ data: { subject: "S", body: "B", instruction: "add one sentence" } })).toEqual({ ok: true, subject: "S", body: "B plus one sentence." });
    expect(JSON.parse(JSON.parse(fetch.mock.calls[0]![1].body).contents[0].parts[0].text)).toEqual({ subject: "S", body: "B", instruction: "add one sentence" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" })));
    expect(await reviseEmail({ data: { subject: "S", body: "B", instruction: "x" } })).toEqual({ ok: false, reason: "failed", message: "Gemini timed out" });
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(await draftEmail({ data: draftInput })).toMatchObject({ ok: false, reason: "no-key" });
  });

  it("summarises, turning 'not stated' answers into empty values", async () => {
    reply({ overview: "A tenancy.", keyTerms: [{ term: "rent", value: "£100 a week", clause: "2.1" }, { term: "bills", value: "Not stated in the contract", clause: "" }], tenantMust: [], landlordMust: [], fees: [] });
    const r = await summariseContract({ data: { text: "Tenancy agreement" } });
    expect(r).toMatchObject({ ok: true, summary: { keyTerms: [{ term: "rent", value: "£100 a week" }, { term: "bills", value: "" }] } });
  });
});
