import { describe, expect, it } from "vitest";
import {
  resolveCurrentProgressText,
  resolveNextTandaLabel,
  resolveNextTandaStyle,
} from "../app/src/renderer/modules/display-view";

describe("display view helpers", () => {
  it("builds progress text for tanda playback", () => {
    const text = resolveCurrentProgressText({
      playbackStatus: "playing",
      currentIndex: 0,
      currentTrackIndex: 1,
      playlistItems: [{ kind: "tanda", tandaId: "td1" }],
      resolveTandaTrackCount: () => 3,
      translatePlayingTrack: (idx, count) => `${idx}/${count}`,
    });
    expect(text).toBe("2/3");
  });

  it("resolves next tanda style/label", () => {
    const style = resolveNextTandaStyle({
      isMarkedLast: false,
      playbackStatus: "playing",
      resumeItemIndex: null,
      currentIndex: 0,
      playlistItems: [
        { kind: "track" },
        { kind: "tanda", tandaId: "td2" },
      ],
      resolveTandaStyle: () => "tango",
      shouldShowDisplayNextTanda: () => true,
    });
    expect(style).toBe("Tango");

    const label = resolveNextTandaLabel({
      isMarkedLast: false,
      nextStyle: style,
      translateLast: () => "LAST",
      translateNext: (s) => `Next ${s}`,
    });
    expect(label).toBe("Next Tango");
  });
});
