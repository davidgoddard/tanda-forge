import { describe, expect, it, vi } from "vitest";
import {
  CALIBRATION_INTERVAL_MS,
  createCalibrationClickWav,
  createCalibrationPulseLoop,
} from "../app/src/renderer/modules/av-lag-calibration";

describe("AV lag calibration", () => {
  it("creates a playable mono PCM wave click", async () => {
    const blob = createCalibrationClickWav();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.type).toBe("audio/wav");
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
    expect(bytes.length).toBeGreaterThan(44);
  });

  it("pulses immediately and every five seconds until stopped", () => {
    vi.useFakeTimers();
    const pulse = vi.fn();
    const loop = createCalibrationPulseLoop(pulse);
    loop.start();
    expect(pulse).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(CALIBRATION_INTERVAL_MS * 2);
    expect(pulse).toHaveBeenCalledTimes(3);
    loop.stop();
    vi.advanceTimersByTime(CALIBRATION_INTERVAL_MS);
    expect(pulse).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("does not create duplicate timers when started twice", () => {
    vi.useFakeTimers();
    const pulse = vi.fn();
    const loop = createCalibrationPulseLoop(pulse);
    loop.start();
    loop.start();
    vi.advanceTimersByTime(CALIBRATION_INTERVAL_MS);
    expect(pulse).toHaveBeenCalledTimes(2);
    loop.stop();
    vi.useRealTimers();
  });
});
