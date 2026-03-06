import { describe, expect, it } from "vitest";
import {
  findPlaylistPositionForTrack,
  resolveContinuationIndexAfterEndCortina,
  shouldContinueAfterEndCortina,
  shouldInsertCortinaBeforeTanda,
  shouldSkipLeadInCortinaForSelectedStart,
  shouldStopAfterMarkedLastTanda,
  shouldTreatClickStartAsIdle,
} from "../app/src/shared/playlist-flow.js";

describe("shouldContinueAfterEndCortina", () => {
  it("returns true when new items were appended after the end cortina", () => {
    expect(shouldContinueAfterEndCortina(3, 4)).toBe(true);
  });

  it("returns false when still at the end of the playlist", () => {
    expect(shouldContinueAfterEndCortina(3, 3)).toBe(false);
  });

  it("returns false when trailing appended slots are not playable", () => {
    expect(shouldContinueAfterEndCortina(1, 3, [true, false, false])).toBe(false);
  });
});

describe("shouldInsertCortinaBeforeTanda", () => {
  it("returns false when continuing from a terminal cortina into newly appended tanda", () => {
    expect(shouldInsertCortinaBeforeTanda(true, 3, 0, false, true)).toBe(false);
  });

  it("returns true for normal tanda transitions with cortinas enabled", () => {
    expect(shouldInsertCortinaBeforeTanda(true, 2, 0, false, false)).toBe(true);
  });
});

describe("shouldSkipLeadInCortinaForSelectedStart", () => {
  it("skips selected-start lead-in only in preparation mode", () => {
    expect(
      shouldSkipLeadInCortinaForSelectedStart(true, true, true, 2, 0, 2),
    ).toBe(true);
    expect(
      shouldSkipLeadInCortinaForSelectedStart(false, true, true, 2, 0, 2),
    ).toBe(false);
  });

  it("does not skip when start is not from selected first track", () => {
    expect(
      shouldSkipLeadInCortinaForSelectedStart(true, true, true, 2, 1, 2),
    ).toBe(false);
    expect(
      shouldSkipLeadInCortinaForSelectedStart(true, true, true, 3, 0, 2),
    ).toBe(false);
    expect(
      shouldSkipLeadInCortinaForSelectedStart(true, false, true, 2, 0, 2),
    ).toBe(false);
  });
});

describe("shouldTreatClickStartAsIdle", () => {
  it("treats paused state with no active main playback as idle", () => {
    expect(shouldTreatClickStartAsIdle("paused", false)).toBe(true);
  });

  it("does not treat active playback as idle", () => {
    expect(shouldTreatClickStartAsIdle("playing", true)).toBe(false);
    expect(shouldTreatClickStartAsIdle("paused", true)).toBe(false);
  });
});

describe("shouldStopAfterMarkedLastTanda", () => {
  it("stops after tanda when marked as last", () => {
    expect(shouldStopAfterMarkedLastTanda("tanda", true)).toBe(true);
  });

  it("does not stop for tracks or when not marked", () => {
    expect(shouldStopAfterMarkedLastTanda("track", true)).toBe(false);
    expect(shouldStopAfterMarkedLastTanda("tanda", false)).toBe(false);
  });
});

describe("resolveContinuationIndexAfterEndCortina", () => {
  it("continues at first unplayed playable tanda after appending during end cortina", () => {
    expect(resolveContinuationIndexAfterEndCortina(2, 0, [true, true, false])).toBe(1);
  });

  it("falls back to current index when nothing playable was appended", () => {
    expect(resolveContinuationIndexAfterEndCortina(3, 2, [true, true, true, false])).toBe(3);
  });
});

describe("findPlaylistPositionForTrack", () => {
  it("finds a direct playlist track row", () => {
    const position = findPlaylistPositionForTrack(
      [
        { kind: "track", trackId: "track-1" },
        { kind: "tanda", trackIds: ["track-2", "track-3"] },
      ],
      "track-1",
    );
    expect(position).toEqual({ itemIndex: 0, trackIndex: 0 });
  });

  it("finds a track inside a tanda", () => {
    const position = findPlaylistPositionForTrack(
      [
        { kind: "track", trackId: "track-1" },
        { kind: "tanda", trackIds: ["track-2", "track-3"] },
      ],
      "track-3",
    );
    expect(position).toEqual({ itemIndex: 1, trackIndex: 1 });
  });

  it("returns null when the track is not present", () => {
    const position = findPlaylistPositionForTrack(
      [{ kind: "tanda", trackIds: ["track-2", "track-3"] }],
      "track-9",
    );
    expect(position).toBeNull();
  });
});
