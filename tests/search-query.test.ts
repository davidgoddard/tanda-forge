import { describe, expect, it } from "vitest";
import {
  buildTrackSearchQuery,
  dedupeQueryTokens,
} from "../app/src/shared/search-query";

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

describe("dedupeQueryTokens", () => {
  it("removes repeated tokens while preserving first-seen order", () => {
    const query = dedupeQueryTokens(
      "Francisco Canaro Francisco 1935 canaro 1935",
    );
    expect(query).toBe("Francisco Canaro 1935");
  });

  it("treats punctuation variants as the same token", () => {
    const query = dedupeQueryTokens("Canaro, Canaro canaro.");
    expect(query).toBe("Canaro,");
  });
});
