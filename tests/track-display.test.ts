import { describe, expect, it } from "vitest";
import {
  buildTrackPrimaryLabel,
  buildTrackSecondaryLabel,
  displayTrackInfo,
} from "../app/src/renderer/modules/track-display";

describe("track display", () => {
  it("renders standalone question-mark metadata as missing", () => {
    expect(displayTrackInfo(" ? ")).toBe("");
    expect(buildTrackPrimaryLabel({ title: "La Cumparsita", artist: "?" })).toBe(
      "La Cumparsita",
    );
    expect(buildTrackSecondaryLabel(["1927", "?", "Tango", null])).toBe(
      "1927 · Tango",
    );
  });

  it("preserves question marks that are part of real metadata", () => {
    expect(displayTrackInfo("Why?")).toBe("Why?");
    expect(buildTrackPrimaryLabel({ title: "Why?", artist: "Osvaldo Pugliese" })).toBe(
      "Why? — Osvaldo Pugliese",
    );
  });
});
