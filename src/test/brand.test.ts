import { describe, expect, it } from "vitest";

import { Route as Home } from "@/routes/index";
import { Route as FindCity } from "@/routes/find.index";
import { Route as FindMap } from "@/routes/find.$city.index";
import { Route as Scanner } from "@/routes/scanner";

// The product is named Scouthaus: every page title must carry it and none may carry the old name.
const titlesOf = (head: unknown, arg: unknown) =>
  ((head as (a: unknown) => { meta?: Record<string, string>[] })?.(arg)?.meta ?? [])
    .map((m) => `${m.title ?? ""} ${m.content ?? ""}`)
    .join(" | ");

describe("Brand naming", () => {
  it("titles every page as Scouthaus and never as HouseHunt", () => {
    const heads: [string, string][] = [
      ["home", titlesOf(Home.options.head, undefined)],
      ["find city", titlesOf(FindCity.options.head, undefined)],
      ["find map", titlesOf(FindMap.options.head, { loaderData: { cityId: "durham" } })],
      ["scanner", titlesOf(Scanner.options.head, undefined)],
    ];

    for (const [name, titles] of heads) {
      expect(titles, `${name} page titles`).toContain("Scouthaus");
      expect(titles, `${name} page titles`).not.toContain("HouseHunt");
    }
  });

  it("names the Durham map page after the city and Scouthaus", () => {
    expect(titlesOf(FindMap.options.head, { loaderData: { cityId: "durham" } })).toContain("Durham student houses in 3D | Scouthaus");
  });
});
