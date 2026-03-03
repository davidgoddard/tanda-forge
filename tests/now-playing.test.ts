import { describe, expect, it } from "vitest";
import {
  resolveBaseDurationSeconds,
  resolveClampedCurrentSeconds,
  resolveDisplayDurationSeconds,
  resolveEffectiveDurationSeconds,
  resolveProgressRatio,
  resolveWaveformSeekTargetSeconds,
  toDisplayStyleLabel,
} from "../app/src/shared/now-playing";

describe("now playing helpers", () => {
  it("resolves base/effective duration", () => {
    const base = resolveBaseDurationSeconds({
      audioDurationSeconds: 0,
      baseDurationMs: 200000,
    });
    expect(base).toBe(200);

    const effective = resolveEffectiveDurationSeconds({
      baseDurationSeconds: base,
      startOffsetMs: 5000,
      endTrimMs: 15000,
    });
    expect(effective).toBe(180);
  });

  it("applies cortina display capping only on main channel", () => {
    const main = resolveDisplayDurationSeconds({
      effectiveDurationSeconds: 120,
      cortinaPlaying: true,
      cortinaAllowFull: false,
      hasTrack: true,
      channel: "main",
      cortinaDurationSeconds: 30,
    });
    expect(main).toBe(30);

    const headphone = resolveDisplayDurationSeconds({
      effectiveDurationSeconds: 120,
      cortinaPlaying: true,
      cortinaAllowFull: false,
      hasTrack: true,
      channel: "headphone",
      cortinaDurationSeconds: 30,
    });
    expect(headphone).toBe(120);
  });

  it("computes clamped current and progress ratio", () => {
    expect(
      resolveClampedCurrentSeconds({
        currentTimeSeconds: 95,
        startOffsetMs: 5000,
        displayDurationSeconds: 80,
      }),
    ).toBe(80);

    expect(resolveProgressRatio({ currentTimeSeconds: 10, durationSeconds: 20 })).toBe(0.5);
  });

  it("resolves waveform seek target", () => {
    expect(
      resolveWaveformSeekTargetSeconds({
        ratio: 0.5,
        baseDurationMs: 100000,
        activeAudioDurationSeconds: 0,
      }),
    ).toBe(50);
  });

  it("normalizes style labels", () => {
    expect(toDisplayStyleLabel(" tango")).toBe("Tango");
    expect(toDisplayStyleLabel("")).toBe("");
  });
});
