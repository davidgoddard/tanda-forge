import { describe, expect, it } from "vitest";
import {
  mapLegacyPathToRelative,
  normalizeLegacyPath,
} from "../app/src/shared/legacy-path.js";

describe("normalizeLegacyPath", () => {
  it("normalizes slashes and trims leading separators", () => {
    expect(normalizeLegacyPath("\\music\\set\\track.m4a")).toBe(
      "music/set/track.m4a",
    );
    expect(normalizeLegacyPath("/music/track.m4a")).toBe("music/track.m4a");
  });
});

describe("mapLegacyPathToRelative", () => {
  it("strips music prefix when root is a music folder", () => {
    expect(mapLegacyPathToRelative("music/DTOTY/track.m4a", "/Volumes/USB/music")).toBe(
      "DTOTY/track.m4a",
    );
  });

  it("strips root basename prefix when it matches", () => {
    expect(mapLegacyPathToRelative("cortinas/Dance/01.m4a", "/Volumes/USB/cortinas")).toBe(
      "Dance/01.m4a",
    );
  });

  it("maps cortina/cortinas singular-plural prefixes for cortina roots", () => {
    expect(mapLegacyPathToRelative("cortinas/Dance/01.m4a", "/Volumes/USB/cortina")).toBe(
      "Dance/01.m4a",
    );
    expect(mapLegacyPathToRelative("cortina/Dance/01.m4a", "/Volumes/USB/cortinas")).toBe(
      "Dance/01.m4a",
    );
  });

  it("returns normalized path when no prefix matches", () => {
    expect(mapLegacyPathToRelative("set/track.m4a", "/Volumes/USB/music")).toBe(
      "set/track.m4a",
    );
  });
});
