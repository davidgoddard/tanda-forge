import { describe, expect, it } from "vitest";
import {
  resolveCurrentProgressText,
  resolveLastTandaCountdownText,
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
      translatePlayingTrack: (idx, count) => `Playing ${idx}/${count}`,
    });
    expect(text).toBe("Playing 2/3");
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
      nextArtist: "Di Sarli",
      translateLast: () => "LAST",
      translateNext: (s, a) => `Next: ${s}\n${a}`,
    });
    expect(label).toBe("Next: Tango\nDi Sarli");
  });

  it("keeps next-style label before final cortina even when marked-last is enabled", () => {
    const label = resolveNextTandaLabel({
      isMarkedLast: true,
      nextStyle: "Tango",
      nextArtist: "Various artists",
      translateLast: () => "LAST",
      translateNext: (s, a) => `Next: ${s}\n${a}`,
    });
    expect(label).toBe("Next: Tango\nVarious artists");
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
      translateNext: (s, a) => `Next: ${s}\n${a}`,
    });
    expect(label).toBe("LAST");
  });

  it("uses the current tanda style during a lead-in cortina", () => {
    const style = resolveNextTandaStyle({
      isMarkedLast: false,
      isFinalCortinaPhase: false,
      useCurrentIndexAsNext: true,
      playbackStatus: "playing",
      resumeItemIndex: null,
      currentIndex: 1,
      playlistItems: [
        { kind: "tanda", tandaId: "td1" },
        { kind: "tanda", tandaId: "td2" },
        { kind: "tanda", tandaId: "td3" },
      ],
      resolveTandaStyle: (id) =>
        id === "td2" ? "milonga" : id === "td3" ? "waltz" : "tango",
      shouldShowDisplayNextTanda: () => true,
    });
    expect(style).toBe("Milonga");

    const label = resolveNextTandaLabel({
      isMarkedLast: false,
      nextStyle: style,
      useCurrentLabel: true,
      translateLast: () => "LAST",
      translateCurrent: (s) => `Now: ${s}`,
      translateNext: (s, a) => `Next: ${s}\n${a}`,
    });
    expect(label).toBe("Now: Milonga");
  });

  it("uses explicit last-tanda label override when requested", () => {
    const label = resolveNextTandaLabel({
      isMarkedLast: false,
      nextStyle: "Tango",
      forceLastLabel: true,
      translateLast: () => "LAST",
      translateNext: (s, a) => `Next ${s} from ${a}`,
    });
    expect(label).toBe("LAST");
  });

  it("builds the countdown label for the last tanda window", () => {
    expect(
      resolveLastTandaCountdownText({
        remainingTandas: 2,
        translateCount: (count) => `Last ${count}`,
      }),
    ).toBe("Last 2");

    expect(
      resolveLastTandaCountdownText({
        remainingTandas: 1,
        translateCount: (count) => `Last ${count}`,
      }),
    ).toBe("");

    expect(
      resolveLastTandaCountdownText({
        remainingTandas: 0,
        translateCount: (count) => `Last ${count}`,
      }),
    ).toBe("");
  });
});
