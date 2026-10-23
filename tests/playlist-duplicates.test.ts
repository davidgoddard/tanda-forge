import { describe, expect, it } from "vitest";
import {
  buildPlaylistDuplicateIndex,
  getDuplicateStatusForTanda,
  getDuplicateStatusForTrack,
} from "../app/src/shared/playlist-duplicates";

describe("playlist duplicates", () => {
  it("detects duplicate tracks", () => {
    const index = buildPlaylistDuplicateIndex([
      { kind: "track", trackId: "track-a" },
      { kind: "tanda", trackIds: ["track-b", "track-c"] },
    ]);
    expect(getDuplicateStatusForTrack("track-a", index)).toBe("full");
    expect(getDuplicateStatusForTrack("track-b", index)).toBe("full");
    expect(getDuplicateStatusForTrack("track-x", index)).toBeNull();
  });

  it("detects full and partial tanda overlap", () => {
    const index = buildPlaylistDuplicateIndex([
      { kind: "tanda", trackIds: ["track-a", "track-b", "track-c"] },
      { kind: "track", trackId: "track-x" },
    ]);
    expect(
      getDuplicateStatusForTanda(["track-b", "track-c", "track-a"], index),
    ).toBe("full");
    expect(getDuplicateStatusForTanda(["track-b", "track-z"], index)).toBe(
      "partial",
    );
    expect(getDuplicateStatusForTanda(["track-y"], index)).toBeNull();
  });

  it("treats every member of a confirmed similarity group as equivalent", () => {
    const equivalents = new Map<string, ReadonlySet<string>>();
    const group = new Set(["version-a", "version-b", "version-c"]);
    group.forEach((trackId) => equivalents.set(trackId, group));
    const index = buildPlaylistDuplicateIndex(
      [{ kind: "track", trackId: "version-a" }],
      equivalents,
    );
    expect(getDuplicateStatusForTrack("version-b", index)).toBe("full");
    expect(getDuplicateStatusForTanda(["version-c", "unrelated"], index)).toBe("partial");
  });
});
