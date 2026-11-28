import { describe, expect, it } from "vitest";
import {
  encodeResearchCsv, parseResearchCsv, researchBaseColumns,
} from "../app/src/main/library/metadata-research-csv";

describe("metadata research CSV", () => {
  it("round-trips 1,000 IDs and preserves accented, quoted and multiline values", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      id: `8f6667d1-2726-4554-b751-${String(i).padStart(12, "0")}`,
      title: 'Adiós, "muchachos"',
      artist: "Ángel\nD’Agostino",
      duration: 123456,
    }));
    const parsed = parseResearchCsv("\uFEFF" + encodeResearchCsv(researchBaseColumns, rows));
    expect(parsed[0].fields).toEqual(researchBaseColumns);
    expect(parsed.slice(1).map(({ fields }) => fields)).toEqual(rows.map((row) => [
      row.id, row.title, row.artist, "", "", "", "", "", String(row.duration),
    ]));
    expect(parsed.every((row) => !row.error)).toBe(true);
  });

  it("reports malformed records and retains subsequent valid records", () => {
    const parsed = parseResearchCsv('id,title\n1,"bad"x\n2,valid\n3,"incomplete');
    expect(parsed.map(({ line, error }) => [line, Boolean(error)]))
      .toEqual([[1, false], [2, true], [3, false], [4, true]]);
    expect(parsed[2].fields).toEqual(["2", "valid"]);
  });
});
