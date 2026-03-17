import { describe, expect, it } from "vitest";
import {
  collectStoredPlaylistTrackIds,
  parseStoredPlaylistState,
  serializeStoredPlaylistState,
  type StoredCortinaAssignment,
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

  it("collects cortina override track ids from stored playlist state", () => {
    const items: StoredPlaylistItem[] = [
      { kind: "track", id: "track-a" },
      null,
    ];
    const cortinaAssignments: StoredCortinaAssignment[] = [
      { index: 1, trackId: "cortina-b" },
      { index: 4, trackId: "cortina-c" },
    ];

    expect(
      collectStoredPlaylistTrackIds({
        version: 2,
        items,
        cortinaSet: "default",
        cortinaAssignments,
      }).sort(),
    ).toEqual(["cortina-b", "cortina-c", "track-a"]);
  });
});

describe("playlist storage parsing", () => {
  it("parses legacy item-array payloads", () => {
    const legacy = JSON.stringify([{ kind: "track", id: "track-a" }, null] satisfies StoredPlaylistItem[]);

    expect(parseStoredPlaylistState(legacy)).toEqual({
      version: 2,
      items: [{ kind: "track", id: "track-a" }, null],
      cortinaAssignments: [],
    });
  });

  it("round-trips structured playlist state with cortina assignments", () => {
    const raw = serializeStoredPlaylistState({
      version: 2,
      items: [{ kind: "track", id: "track-a" }],
      cortinaSet: "classic",
      cortinaAssignments: [{ index: 2, trackId: "cortina-a" }],
    });

    expect(parseStoredPlaylistState(raw)).toEqual({
      version: 2,
      items: [{ kind: "track", id: "track-a" }],
      cortinaSet: "classic",
      cortinaAssignments: [{ index: 2, trackId: "cortina-a" }],
    });
  });

  it("accepts older structured payloads that used cortinaOverrides", () => {
    const raw = JSON.stringify({
      version: 2,
      items: [{ kind: "track", id: "track-a" }],
      cortinaSet: "classic",
      cortinaOverrides: [{ index: 2, trackId: "cortina-a" }],
    });

    expect(parseStoredPlaylistState(raw)).toEqual({
      version: 2,
      items: [{ kind: "track", id: "track-a" }],
      cortinaSet: "classic",
      cortinaAssignments: [{ index: 2, trackId: "cortina-a" }],
    });
  });
});
