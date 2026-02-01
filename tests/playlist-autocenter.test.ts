import { describe, expect, it } from "vitest";
import { shouldAutoCenterPlaylist } from "../app/src/shared/playlist-autocenter";

describe("playlist auto-center", () => {
  it("returns false when not playing", () => {
    expect(
      shouldAutoCenterPlaylist({
        lastInteractionAt: 0,
        now: 10000,
        idleMs: 1000,
        playbackStatus: "paused",
        activeTab: "playlist-tab",
      }),
    ).toBe(false);
  });

  it("returns false when playlist tab not active", () => {
    expect(
      shouldAutoCenterPlaylist({
        lastInteractionAt: 0,
        now: 10000,
        idleMs: 1000,
        playbackStatus: "playing",
        activeTab: "tanda-designer-tab",
      }),
    ).toBe(false);
  });

  it("returns false when idle time not reached", () => {
    expect(
      shouldAutoCenterPlaylist({
        lastInteractionAt: 9000,
        now: 10000,
        idleMs: 2000,
        playbackStatus: "playing",
        activeTab: "playlist-tab",
      }),
    ).toBe(false);
  });

  it("returns true when idle time is reached", () => {
    expect(
      shouldAutoCenterPlaylist({
        lastInteractionAt: 0,
        now: 5000,
        idleMs: 2000,
        playbackStatus: "playing",
        activeTab: "playlist-tab",
      }),
    ).toBe(true);
  });
});
