import { describe, expect, it } from "vitest";
import { buildTandaSearchWhere } from "../app/src/main/library/tandas";

describe("tanda search helpers", () => {
  it("returns the baseline valid-tanda filter when no filters", () => {
    const result = buildTandaSearchWhere({ query: "", styles: [], size: null });
    expect(result.whereSql).toContain("where coalesce(tandas.invalid, 0) = 0");
    expect(result.whereSql).toContain("deleted_t.deleted_at is not null");
    expect(result.values).toEqual([]);
  });

  it("builds where for query and styles using per-track token matching", () => {
    const result = buildTandaSearchWhere({
      query: "troilo 1937 64",
      styles: ["Tango", "Vals"],
      size: null,
    });
    expect(result.whereSql).toContain("lower(coalesce(tandas.name, '')) like ?");
    expect(result.whereSql).toContain("exists (");
    expect(result.whereSql).toContain("join tracks t on t.id = tt.track_id");
    expect(result.whereSql).toContain("cast(round(t.bpm) as text) like ?");
    expect(result.whereSql).toContain("and (");
    expect(result.whereSql).toContain("style_name in (?, ?)");
    const likeCount = result.values.filter(
      (value) => value === "%troilo%",
    ).length;
    expect(likeCount).toBe(10);
    const yearLikeCount = result.values.filter(
      (value) => value === "%1937%",
    ).length;
    expect(yearLikeCount).toBe(10);
    const bpmLikeCount = result.values.filter(
      (value) => value === "%64%",
    ).length;
    expect(bpmLikeCount).toBe(10);
    expect(result.values.slice(-2)).toEqual(["Tango", "Vals"]);
  });

  it("matches tanda name tokens in unscoped searches", () => {
    const result = buildTandaSearchWhere({
      query: "Tango Trio",
      styles: [],
      size: null,
    });
    expect(result.whereSql).toContain("lower(coalesce(tandas.name, '')) like ?");
    expect(result.values).toContain("%tango%");
    expect(result.values).toContain("%trio%");
  });

  it("builds artist-scoped query against track artist fields only", () => {
    const result = buildTandaSearchWhere({
      query: "artist: Juan Maglio",
      styles: [],
      size: null,
    });
    expect(result.whereSql).toContain("join tracks t on t.id = tt.track_id");
    expect(result.whereSql).toContain("t.artist_summary");
    expect(result.whereSql).toContain("t.artist");
    expect(result.whereSql).not.toContain("t.title like");
    expect(result.values.length).toBeGreaterThanOrEqual(2);
  });

  it("filters out invalid tandas and matches requested actual track count", () => {
    const result = buildTandaSearchWhere({
      query: "",
      styles: [],
      size: 4,
    });
    expect(result.whereSql).toContain("coalesce(tandas.invalid, 0) = 0");
    expect(result.whereSql).toContain("select count(*) from tanda_tracks tt");
    expect(result.whereSql).toContain("join tracks t on t.id = tt.track_id");
    expect(result.values).toEqual([4]);
  });
});
