import { describe, expect, it } from "vitest";
import {
  collectStoredPlaylistTrackIds,
  type StoredPlaylistItem,
} from "../app/src/shared/playlist-storage";

describe("collectStoredPlaylistTrackIds", () => {
  it("collects track ids from track rows and tanda snapshots", () => {
    const items: StoredPlaylistItem[] = [
      { kind: "track", id: "track-a" },
      {
        kind: "tanda",
        id: "tanda-1",
        snapshot: {
          id: "tanda-1",
          name: "Draft tanda",
          styles: ["Tango"],
          rating: 0,
          trackSlots: ["track-b", null, "track-c", "track-a"],
        },
      },
      null,
    ];

    expect(collectStoredPlaylistTrackIds(items).sort()).toEqual([
      "track-a",
      "track-b",
      "track-c",
    ]);
  });
});
