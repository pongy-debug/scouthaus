import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CITIES } from "./find";
import type { EvaluatedHouse } from "./timing-types";

export type TimingAssessment = { ok: true; house: EvaluatedHouse; checkedAt: string; sources: { title: string; url: string }[]; searchHtml: string } | { ok: false; message: string };
export const assessHouseTiming = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ propertyId: z.string().max(100) }).strict().parse(input))
  .handler(async ({ data }): Promise<TimingAssessment> => {
    const house = CITIES.flatMap((city) => city.houses).find((h) => h.id === data.propertyId);
    if (!house) return { ok: false, message: "Property not found." };
    const { assessPublishedListing } = await import("./timingResearch.server");
    return assessPublishedListing(house);
  });
