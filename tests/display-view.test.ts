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
      isFinalCortinaPhase: false,
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

  it("keeps next-style label before final cortina even when marked-last is enabled", () => {
    const label = resolveNextTandaLabel({
      isMarkedLast: true,
      nextStyle: "Tango",
      translateLast: () => "LAST",
      translateNext: (s) => `Next ${s}`,
    });
    expect(label).toBe("Next Tango");
  });

  it("suppresses next-style lookup during final cortina phase when marked-last is enabled", () => {
    const style = resolveNextTandaStyle({
      isMarkedLast: true,
      isFinalCortinaPhase: true,
      playbackStatus: "playing",
      resumeItemIndex: null,
      currentIndex: 0,
      playlistItems: [{ kind: "tanda", tandaId: "td2" }],
      resolveTandaStyle: () => "tango",
      shouldShowDisplayNextTanda: () => true,
    });
    expect(style).toBe("");

    const label = resolveNextTandaLabel({
      isMarkedLast: true,
      nextStyle: style,
      translateLast: () => "LAST",
      translateNext: (s) => `Next ${s}`,
    });
    expect(label).toBe("LAST");
  });

  it("uses explicit last-tanda label override when requested", () => {
    const label = resolveNextTandaLabel({
      isMarkedLast: false,
      nextStyle: "Tango",
      forceLastLabel: true,
      translateLast: () => "LAST",
      translateNext: (s) => `Next ${s}`,
    });
    expect(label).toBe("LAST");
  });
});
