import { describe, expect, it } from "vitest";
import { buildTrackLabel, getNowPlayingState } from "../app/src/renderer/modules/playback-view";

describe("playback view helpers", () => {
  it("builds artist-title label", () => {
    expect(
      buildTrackLabel({ artist: "D'Arienzo", title: "La Cumparsita" }, "Unknown"),
    ).toBe("D'Arienzo — La Cumparsita");
  });

  it("returns fallback label when track is missing", () => {
    expect(buildTrackLabel(undefined, "Unknown")).toBe("Unknown");
  });

  it("prefers headphone state if both channels are active", () => {
    const result = getNowPlayingState({
      headphone: { active: { paused: false }, track: { title: "H" } },
      main: { active: { paused: false }, track: { title: "M" } },
    });
    expect(result?.channel).toBe("headphone");
    expect(result?.state.track?.title).toBe("H");
  });
});
