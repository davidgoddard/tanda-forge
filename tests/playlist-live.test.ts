import { describe, expect, it } from "vitest";
import {
  computeCortinaStartOffsetMs,
  computeElapsedMsForEntry,
  computeTimelineTotalMs,
  isPlaylistIndexLockedDuringLive,
  isPlaylistTandaSlotLockedDuringLive,
  shouldShowDisplayNextTanda,
} from "../app/src/shared/playlist-live";

describe("playlist live timing helpers", () => {
  it("computes elapsed time within an entry", () => {
    const elapsed = computeElapsedMsForEntry({
      offsetMs: 0,
      trackDurationsMs: [180000, 120000, 180000],
      trackIndex: 1,
      gapBetweenTracksMs: 2000,
      progressMs: 30000,
    });
    expect(elapsed).toBe(180000 + 2000 + 30000);
  });

  it("computes cortina start offsets", () => {
    const offset = computeCortinaStartOffsetMs(100000, 4000, 2000, 40000, 2000);
    expect(offset).toBe(100000 - 48000);
  });

  it("computes total timeline duration", () => {
    const total = computeTimelineTotalMs(
      [0, 64000],
      [
        { index: 0, durationMs: 60000, trackDurationsMs: [60000] },
        { index: 1, durationMs: 60000, trackDurationsMs: [60000] },
      ],
    );
    expect(total).toBe(124000);
  });

  it("shows next tanda label only during active playlist playback", () => {
    expect(shouldShowDisplayNextTanda("playing")).toBe(true);
    expect(shouldShowDisplayNextTanda("paused")).toBe(false);
    expect(shouldShowDisplayNextTanda("idle")).toBe(false);
  });

  it("locks only played and current playlist items during live playback", () => {
    const context = {
      liveMode: true,
      playbackStatus: "playing" as const,
      playedThroughIndex: 1,
      currentIndex: 2,
    };
    expect(isPlaylistIndexLockedDuringLive(context, 1)).toBe(true);
    expect(isPlaylistIndexLockedDuringLive(context, 2)).toBe(true);
    expect(isPlaylistIndexLockedDuringLive(context, 3)).toBe(false);
  });

  it("locks only past/current tracks within the current tanda during live playback", () => {
    const context = {
      liveMode: true,
      playbackStatus: "playing" as const,
      playedThroughIndex: 0,
      currentIndex: 1,
      currentTrackIndex: 1,
    };
    expect(isPlaylistTandaSlotLockedDuringLive(context, 1, 0)).toBe(true);
    expect(isPlaylistTandaSlotLockedDuringLive(context, 1, 1)).toBe(true);
    expect(isPlaylistTandaSlotLockedDuringLive(context, 1, 2)).toBe(false);
    expect(isPlaylistTandaSlotLockedDuringLive(context, 2, 0)).toBe(false);
  });
});
