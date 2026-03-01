import { describe, expect, it } from "vitest";
import {
  computeDynamicsFrame,
  computeParallelMixGains,
  computeTrackLevelerFrame,
  computeUpwardLiftDb,
  depthPercentToMix,
  dbToLinear,
  linearToDb,
  shouldShowDynamicsOverlay,
  summarizeWaveform,
  smoothToward,
  updateWaveformTimelinePeak,
} from "../app/src/shared/audio-dynamics";

describe("audio dynamics helpers", () => {
  it("computes upward lift only below lift threshold and above gate", () => {
    expect(
      computeUpwardLiftDb(-45, {
        liftThresholdDb: -35,
        maxLiftDb: 12,
        upwardRatio: 3,
        gateThresholdDb: -55,
      }),
    ).toBeCloseTo(6.666, 2);
    expect(
      computeUpwardLiftDb(-30, {
        liftThresholdDb: -35,
        maxLiftDb: 12,
        upwardRatio: 3,
        gateThresholdDb: -55,
      }),
    ).toBe(0);
    expect(
      computeUpwardLiftDb(-70, {
        liftThresholdDb: -35,
        maxLiftDb: 12,
        upwardRatio: 3,
        gateThresholdDb: -55,
      }),
    ).toBe(0);
  });

  it("caps lift at maxLiftDb", () => {
    expect(
      computeUpwardLiftDb(-80, {
        liftThresholdDb: -35,
        maxLiftDb: 8,
        upwardRatio: 6,
        gateThresholdDb: -120,
      }),
    ).toBe(8);
  });

  it("supports high upward ratios and lift caps", () => {
    const boosted = computeUpwardLiftDb(-80, {
      liftThresholdDb: -35,
      maxLiftDb: 55,
      upwardRatio: 24,
      gateThresholdDb: -120,
    });
    expect(boosted).toBeGreaterThan(40);
    expect(boosted).toBeLessThanOrEqual(55);
  });

  it("smooths with faster attack and slower release", () => {
    const up = smoothToward(0, 10, 20, 300, 16);
    const down = smoothToward(10, 0, 20, 300, 16);
    expect(up).toBeGreaterThan(0);
    expect(up).toBeGreaterThan(3);
    expect(down).toBeLessThan(10);
    expect(down).toBeGreaterThan(9);
  });

  it("converts dB and linear consistently", () => {
    const linear = dbToLinear(-6);
    expect(linear).toBeCloseTo(0.501, 2);
    expect(linearToDb(linear)).toBeCloseTo(-6, 1);
  });

  it("maps depth percent with usable low-end response", () => {
    expect(depthPercentToMix(0)).toBe(0);
    expect(depthPercentToMix(5)).toBeGreaterThan(0.1);
    expect(depthPercentToMix(10)).toBeGreaterThan(depthPercentToMix(5));
    expect(depthPercentToMix(100)).toBeCloseTo(1, 6);
  });

  it("uses predictable crossfade gains and wet rises monotonically", () => {
    const low = computeParallelMixGains({ enabled: true, depthPercent: 10 });
    const high = computeParallelMixGains({ enabled: true, depthPercent: 100 });
    expect(low.wet).toBeGreaterThan(0);
    expect(high.wet).toBeGreaterThan(low.wet);
    expect(low.dry).toBeCloseTo(1 - low.wet, 6);
    expect(high.dry).toBeCloseTo(0, 6);
    expect(low.dry + low.wet).toBeCloseTo(1, 6);
    expect(high.dry + high.wet).toBeCloseTo(1, 6);
  });

  it("shows overlay only when dynamics are enabled and depth is above zero", () => {
    expect(shouldShowDynamicsOverlay(false, 100)).toBe(false);
    expect(shouldShowDynamicsOverlay(true, 0)).toBe(false);
    expect(shouldShowDynamicsOverlay(true, 1)).toBe(true);
  });

  it("boosts quiet program more than loud program in synthetic frames", () => {
    let state = { detectorDb: -120, peakDb: -120, liftDb: 0 };
    const frameMs = 16;
    const config = {
      liftThresholdDb: -12,
      maxLiftDb: 40,
      upwardRatio: 16,
      gateThresholdDb: -45,
      attackMs: 25,
      releaseMs: 250,
    };
    const quietLift: number[] = [];
    const loudLift: number[] = [];

    for (let i = 0; i < 180; i += 1) {
      state = computeDynamicsFrame(state, -6, frameMs, config);
      loudLift.push(state.liftDb);
    }
    for (let i = 0; i < 180; i += 1) {
      state = computeDynamicsFrame(state, -34, frameMs, config);
      quietLift.push(state.liftDb);
    }

    const loudAvg = loudLift.slice(-60).reduce((sum, value) => sum + value, 0) / 60;
    const quietAvg = quietLift.slice(-60).reduce((sum, value) => sum + value, 0) / 60;

    expect(quietAvg).toBeGreaterThan(10);
    expect(loudAvg).toBeLessThan(1.5);
  });

  it("holds peak anchor through quieter passages to avoid fast level collapse", () => {
    let state = { detectorDb: -120, peakDb: -120, liftDb: 0 };
    const frameMs = 20;
    const config = {
      liftThresholdDb: -40,
      maxLiftDb: 50,
      upwardRatio: 20,
      gateThresholdDb: -70,
      attackMs: 10,
      releaseMs: 1000,
    };
    for (let i = 0; i < 150; i += 1) {
      state = computeDynamicsFrame(state, -6, frameMs, config);
    }
    const peakAfterLoud = state.peakDb;
    for (let i = 0; i < 150; i += 1) {
      state = computeDynamicsFrame(state, -32, frameMs, config);
    }
    expect(state.peakDb).toBeGreaterThan(peakAfterLoud - 7);
  });

  it("summarizes waveform peaks into fixed bar counts", () => {
    const samples = new Float32Array([0, 0.1, -0.4, 0.2, -0.8, 0.3, 0.05, -0.6]);
    const bars = summarizeWaveform(samples, 4);
    expect(bars).toHaveLength(4);
    expect(bars[0]).toBeCloseTo(0.1, 6);
    expect(bars[1]).toBeCloseTo(0.4, 6);
    expect(bars[2]).toBeCloseTo(0.8, 6);
    expect(bars[3]).toBeCloseTo(0.6, 6);
  });

  it("returns empty bars for empty inputs", () => {
    expect(summarizeWaveform(new Float32Array([]), 16)).toHaveLength(16);
    expect(summarizeWaveform(new Float32Array([]), 0)).toHaveLength(0);
  });

  it("updates timeline bins by progress and keeps max peak", () => {
    const bins = new Float32Array(4);
    expect(updateWaveformTimelinePeak(bins, 0.0, 0.2)).toBe(0);
    expect(updateWaveformTimelinePeak(bins, 0.24, 0.8)).toBe(0);
    expect(updateWaveformTimelinePeak(bins, 0.25, 0.3)).toBe(1);
    expect(updateWaveformTimelinePeak(bins, 1.0, 0.6)).toBe(3);
    expect(bins[0]).toBeCloseTo(0.8, 6);
    expect(bins[1]).toBeCloseTo(0.3, 6);
    expect(bins[3]).toBeCloseTo(0.6, 6);
  });

  it("track leveler lifts quiet content toward track mean", () => {
    let state = { detectorDb: -120, peakDb: -120, meanDb: -120, liftDb: 0 };
    const frameMs = 20;
    const config = {
      maxLiftDb: 50,
      upwardRatio: 20,
      gateThresholdDb: -70,
      limiterCeilingDb: -1,
      attackMs: 10,
      releaseMs: 1200,
    };
    for (let i = 0; i < 200; i += 1) {
      state = computeTrackLevelerFrame(state, -12, frameMs, config);
    }
    const loudLift = state.liftDb;
    expect(loudLift).toBeLessThan(1.5);
    for (let i = 0; i < 200; i += 1) {
      state = computeTrackLevelerFrame(state, -34, frameMs, config);
    }
    expect(state.liftDb).toBeGreaterThan(loudLift + 2.5);
    expect(state.liftDb).toBeLessThanOrEqual(config.maxLiftDb);
  });

  it("track leveler damps lift on high-crest transients", () => {
    const frameMs = 20;
    const config = {
      maxLiftDb: 50,
      upwardRatio: 20,
      gateThresholdDb: -70,
      limiterCeilingDb: -1,
      attackMs: 1,
      releaseMs: 100,
    };
    const steady = computeTrackLevelerFrame(
      { detectorDb: -35, peakDb: -35, meanDb: -20, liftDb: 8 },
      -35,
      frameMs,
      config,
    );
    const transient = computeTrackLevelerFrame(
      { detectorDb: -35, peakDb: -18, meanDb: -20, liftDb: 8 },
      -35,
      frameMs,
      config,
    );
    expect(transient.liftDb).toBeLessThan(steady.liftDb);
  });

  it("track leveler enforces headroom cap from recent peak", () => {
    const frameMs = 20;
    const state = { detectorDb: -30, peakDb: -3, meanDb: -12, liftDb: 0 };
    const config = {
      maxLiftDb: 50,
      upwardRatio: 20,
      gateThresholdDb: -70,
      limiterCeilingDb: -1,
      attackMs: 20,
      releaseMs: 1000,
    };
    const next = computeTrackLevelerFrame(state, -30, frameMs, config);
    // peak at -3 with -1 ceiling and 1 dB reserve => max ~1 dB lift.
    expect(next.liftDb).toBeLessThanOrEqual(1.2);
  });
});
