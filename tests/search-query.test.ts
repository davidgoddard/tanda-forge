import { describe, expect, it } from "vitest";
import {
  appendQueryTokens,
  buildTrackSimilarityQuery,
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

  it("orders generated query by similarity priority", () => {
    const query = buildTrackSearchQuery({
      title: "Recuerdo",
      artist: "Enrique Alessio",
      singer: "Alberto Castillo",
      year: "1937",
      genre: "Tango",
      bpm: 62,
      notes: "Session favorite",
    });
    expect(query).toBe(
      "Tango Enrique Alessio Alberto Castillo 62 1937 Session favorite Recuerdo",
    );
  });

  it("uses instrumental token when singer is missing", () => {
    const query = buildTrackSearchQuery({
      title: "La Cumparsita",
      artist: "Canaro",
      genre: "Tango",
      instrumental: true,
    });
    expect(query).toContain("instrumental");
  });
});

describe("buildTrackSimilarityQuery", () => {
  it("includes similarity metadata and excludes style/title/album/notes", () => {
    const query = buildTrackSimilarityQuery({
      title: "Todo Corazon",
      artist: "Julio De Caro",
      artist_summary: "Julio De Caro",
      singer: "Carlos Gardel",
      album: "Golden Years",
      year: "1932",
      genre: "Tango",
      bpm: 99,
      notes: "test note",
    });
    expect(query).toContain("Julio De Caro");
    expect(query).toContain("Carlos Gardel");
    expect(query).toContain("1932");
    expect(query).toContain("99");
    expect(query).not.toContain("test note");
    expect(query).not.toContain("Tango");
    expect(query).not.toContain("Todo Corazon");
    expect(query).not.toContain("Golden Years");
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

  it("normalizes diacritics before token de-duplication", () => {
    const query = dedupeQueryTokens("D\u00e9jame Dejame dejame");
    expect(query).toBe("D\u00e9jame");
  });

  it("normalizes diacritics and punctuation before token de-duplication", () => {
    const query = dedupeQueryTokens("D'Ar\u00edenzo Darienzo d\u00e1rienzo");
    expect(query).toBe("D'Ar\u00edenzo");
  });
});

describe("appendQueryTokens", () => {
  it("appends and de-duplicates new field fragments", () => {
    const next = appendQueryTokens("Canaro 1935", "1935 Canaro Alberto");
    expect(next).toBe("Canaro 1935 Alberto");
  });
});
