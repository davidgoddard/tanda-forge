import { describe, expect, it } from "vitest";
import { buildSearchWhere } from "../app/src/main/library/search";

describe("library search helpers", () => {
  it("builds empty filter when no search criteria", () => {
    const result = buildSearchWhere({ query: "", styles: [] });
    expect(result.whereSql).toBe("");
    expect(result.values).toEqual([]);
  });

  it("builds query filter with wildcards", () => {
    const result = buildSearchWhere({ query: "carlos", styles: [] });
    expect(result.whereSql).toContain("title like ?");
    expect(result.values).toEqual(["%carlos%", "%carlos%", "%carlos%"]);
  });

  it("builds style filter with placeholders", () => {
    const result = buildSearchWhere({ query: "", styles: ["Tango", "Vals"] });
    expect(result.whereSql).toContain("genre in (?, ?)");
    expect(result.values).toEqual(["Tango", "Vals"]);
  });

  it("combines query and styles", () => {
    const result = buildSearchWhere({ query: "roberto", styles: ["Tango"] });
    expect(result.whereSql).toContain("title like ?");
    expect(result.whereSql).toContain("genre in (?)");
    expect(result.values).toEqual(["%roberto%", "%roberto%", "%roberto%", "Tango"]);
  });
});
