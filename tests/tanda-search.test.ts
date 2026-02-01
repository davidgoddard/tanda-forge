import { describe, expect, it } from "vitest";
import { buildTandaSearchWhere } from "../app/src/main/library/tandas";

describe("tanda search helpers", () => {
  it("returns empty where when no filters", () => {
    const result = buildTandaSearchWhere({ query: "", styles: [] });
    expect(result.whereSql).toBe("");
    expect(result.values).toEqual([]);
  });

  it("builds where for query and styles", () => {
    const result = buildTandaSearchWhere({
      query: "troilo",
      styles: ["Tango", "Vals"],
    });
    expect(result.whereSql).toContain("tandas.name like ?");
    expect(result.whereSql).toContain("style_name in (?, ?)");
    const likeCount = result.values.filter(
      (value) => value === "%troilo%",
    ).length;
    expect(likeCount).toBe(9);
    expect(result.values.slice(-2)).toEqual(["Tango", "Vals"]);
  });
});
