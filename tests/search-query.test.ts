import { describe, expect, it } from "vitest";
import { buildTrackSearchQuery } from "../app/src/shared/search-query";

describe("buildTrackSearchQuery", () => {
  it("includes key metadata fields", () => {
    const query = buildTrackSearchQuery({
      title: "Todo Corazon",
      artist: "Julio De Caro",
      artist_summary: "Julio De Caro",
      singer: "Carlos Gardel",
      album: "Golden Years",
      album_artist: "Julio De Caro",
      year: "1932",
      genre: "Tango",
      bpm: 99,
      notes: "test note",
    });
    expect(query).toContain("Julio De Caro");
    expect(query).toContain("Todo Corazon");
    expect(query).toContain("Carlos Gardel");
    expect(query).toContain("Golden Years");
    expect(query).toContain("1932");
    expect(query).toContain("Tango");
    expect(query).toContain("99");
    expect(query).toContain("test note");
  });
});
