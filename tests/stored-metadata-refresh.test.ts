import { describe, expect, it } from "vitest";
import { refreshStoredTrackMetadata } from "../app/src/main/library/stored-metadata-refresh";

describe("stored metadata refresh", () => {
  it("rebuilds title, artist summary, and singer from stored tags", () => {
    expect(
      refreshStoredTrackMetadata({
        title: "Old Title",
        artist: "Old Artist",
        singer: "",
        tag_json: JSON.stringify({
          title: "Vida mia",
          artist: "Orquesta Tipica Andariega feat. Marisol Martinez",
        }),
      }),
    ).toEqual({
      title: "Vida mia",
      artist: "Orquesta Tipica Andariega feat. Marisol Martinez",
      artistSummary: "Andariega",
      singer: "Marisol Martinez",
    });
  });

  it("falls back to current row values when tag json is missing", () => {
    expect(
      refreshStoredTrackMetadata({
        title: "Mala Suerte (Canta ERNESTO FAMA)",
        artist: "Carlos Di Sarli",
        singer: "",
        tag_json: null,
      }),
    ).toEqual({
      title: "Mala Suerte (Canta ERNESTO FAMA)",
      artist: "Carlos Di Sarli",
      artistSummary: "Carlos Di Sarli",
      singer: "Ernesto Fama",
    });
  });
});
