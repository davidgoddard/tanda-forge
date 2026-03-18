import { describe, expect, it } from "vitest";
import {
  findPlaylistPositionForTrack,
  resolveContinuationIndexAfterEndCortina,
  resolveOverlapFadeMs,
  resolveScheduledTransitionTimeSeconds,
  shouldPauseAfterMarkedPerformanceStop,
  shouldPlayStandaloneTrackFromClick,
  shouldContinueAfterEndCortina,
  shouldEnablePlaylistStop,
  shouldInsertCortinaBeforeTanda,
  shouldSkipLeadInCortinaForSelectedStart,
  shouldStartPlaylistFromClick,
  shouldStopAfterMarkedLastTanda,
  shouldTreatClickStartAsIdle,
  shouldUseOverlapForGapMs,
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
      shouldSkipLeadInCortinaForSelectedStart(true, true, 2, 0, 2),
    ).toBe(true);
    expect(
      shouldSkipLeadInCortinaForSelectedStart(false, true, 2, 0, 2),
    ).toBe(false);
  });

  it("does not skip when start is not from selected first track", () => {
    expect(
      shouldSkipLeadInCortinaForSelectedStart(true, true, 2, 1, 2),
    ).toBe(false);
    expect(
      shouldSkipLeadInCortinaForSelectedStart(true, true, 3, 0, 2),
    ).toBe(false);
    expect(
      shouldSkipLeadInCortinaForSelectedStart(true, false, 2, 0, 2),
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

describe("shouldStartPlaylistFromClick", () => {
  it("allows preparation click-starts regardless of current main playback", () => {
    expect(shouldStartPlaylistFromClick("prep", false)).toBe(true);
    expect(shouldStartPlaylistFromClick("prep", true)).toBe(true);
  });

  it("allows live click-starts only when main playback is idle", () => {
    expect(shouldStartPlaylistFromClick("live", false)).toBe(true);
    expect(shouldStartPlaylistFromClick("live", true)).toBe(false);
  });

  it("blocks click-starts in edit mode", () => {
    expect(shouldStartPlaylistFromClick("edit", false)).toBe(false);
  });
});

describe("shouldPlayStandaloneTrackFromClick", () => {
  it("allows standalone track clicks only in live mode while main output is idle", () => {
    expect(shouldPlayStandaloneTrackFromClick("live", false)).toBe(true);
    expect(shouldPlayStandaloneTrackFromClick("live", true)).toBe(false);
    expect(shouldPlayStandaloneTrackFromClick("prep", false)).toBe(false);
    expect(shouldPlayStandaloneTrackFromClick("edit", false)).toBe(false);
  });
});

describe("shouldEnablePlaylistStop", () => {
  it("keeps stop enabled while playlist playback is active", () => {
    expect(shouldEnablePlaylistStop("playing", true)).toBe(true);
    expect(shouldEnablePlaylistStop("playing", false)).toBe(true);
  });

  it("keeps stop enabled for standalone main-output playback", () => {
    expect(shouldEnablePlaylistStop("idle", true)).toBe(true);
    expect(shouldEnablePlaylistStop("paused", true)).toBe(true);
  });

  it("disables stop only when nothing is actively playing", () => {
    expect(shouldEnablePlaylistStop("idle", false)).toBe(false);
    expect(shouldEnablePlaylistStop("paused", false)).toBe(false);
  });
});

describe("overlap helpers", () => {
  it("treats only negative gaps as overlap", () => {
    expect(shouldUseOverlapForGapMs(-1500)).toBe(true);
    expect(shouldUseOverlapForGapMs(0)).toBe(false);
    expect(shouldUseOverlapForGapMs(1200)).toBe(false);
  });

  it("derives overlap fade from the absolute negative gap", () => {
    expect(resolveOverlapFadeMs(-2200)).toBe(2200);
    expect(resolveOverlapFadeMs(0)).toBe(0);
  });

  it("schedules overlap start before playback end and never before playback start", () => {
    expect(resolveScheduledTransitionTimeSeconds(10, 0, -2_000)).toBe(8);
    expect(resolveScheduledTransitionTimeSeconds(10, 9.5, -2_000)).toBe(9.5);
    expect(resolveScheduledTransitionTimeSeconds(10, 0, 500)).toBeNull();
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

describe("shouldPauseAfterMarkedPerformanceStop", () => {
  it("pauses after tanda when marked for performance stop", () => {
    expect(shouldPauseAfterMarkedPerformanceStop("tanda", true)).toBe(true);
  });

  it("does not pause for tracks or when not marked", () => {
    expect(shouldPauseAfterMarkedPerformanceStop("track", true)).toBe(false);
    expect(shouldPauseAfterMarkedPerformanceStop("tanda", false)).toBe(false);
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
