import { describe, expect, it } from "vitest";

import {
  createLegacyPathResolver,
  mapLegacyPathToRelative,
  normalizeLegacyRelativeForMatch,
  resolveLegacyPathMatch,
} from "../app/src/shared/legacy-path";

describe("legacy path matching", () => {
  it("normalizes relative paths for matching", () => {
    expect(
      normalizeLegacyRelativeForMatch(
        "/music/Tango 2023/ROBERTO FIRPO/Tangazos de  Antan\u0303o/Track.FLAC",
      ),
    ).toBe(
      "music/tango 2023/roberto firpo/tangazos de  antaño/track.flac",
    );
  });

  it("maps legacy roots to relative paths", () => {
    expect(
      mapLegacyPathToRelative(
        "music/tango 2023/set/song.flac",
        "/Users/david/Downloads/OneDrive/music",
      ),
    ).toBe("tango 2023/set/song.flac");
  });

  it("matches legacy entries to actual filesystem relative paths despite case and unicode differences", () => {
    const match = resolveLegacyPathMatch(
      "music/tango 2023/CD rip 2024/Roberto Firpo/Tangazos de  Antan\u0303o (Reliquias 541727) FLAC/02 Roberto Firpo - Fuegos Artificiales 1938.flac",
      "/Users/david/Downloads/OneDrive/music",
      [
        "Tango 2023/CD Rip 2024/Roberto Firpo/Tangazos de  Antaño (Reliquias 541727) FLAC/02 Roberto Firpo - Fuegos Artificiales 1938.flac",
      ],
    );

    expect(match).toBe(
      "Tango 2023/CD Rip 2024/Roberto Firpo/Tangazos de  Antaño (Reliquias 541727) FLAC/02 Roberto Firpo - Fuegos Artificiales 1938.flac",
    );
  });
});

it("indexed resolver preserves direct, suffix, Unicode and ambiguous matches", () => {
  const inventories = [
    ["Album/Song.mp3", "Other/Song.mp3", "Solo.mp3", "Café/Title.mp3"],
    ["a.mp3", "A.mp3", "x/a.mp3"],
    ["a/b/c.mp3", "b/c.mp3", "c.mp3"],
    [],
  ];
  for (const paths of inventories) {
    const resolve = createLegacyPathResolver(paths);
    for (const candidate of [...paths, "Song.mp3", "music/Album/Song.mp3", "old/Solo.mp3", "café/title.mp3", "missing.mp3", "old/a/b/c.mp3", ""]) {
      expect(resolve(candidate, "/new/music")).toBe(resolveLegacyPathMatch(candidate, "/new/music", paths));
    }
  }
});
