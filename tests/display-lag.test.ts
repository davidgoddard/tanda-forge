import { describe, expect, it, vi } from "vitest";
import {
  clampDisplayLagSeconds,
  createDisplayLagScheduler,
} from "../app/src/renderer/modules/display-lag";

describe("display lag scheduler", () => {
  it("delays updates in order by the configured AV lag", () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const scheduler = createDisplayLagScheduler<string>((value) => sent.push(value), 2);

    scheduler.schedule("track");
    vi.advanceTimersByTime(500);
    scheduler.schedule("cortina");
    vi.advanceTimersByTime(1499);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual(["track"]);
    vi.advanceTimersByTime(500);
    expect(sent).toEqual(["track", "cortina"]);
    vi.useRealTimers();
  });

  it("clears stale queued updates when the lag changes", () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const scheduler = createDisplayLagScheduler<string>((value) => sent.push(value), 4);
    scheduler.schedule("stale");
    scheduler.setDelaySeconds(0);
    scheduler.schedule("current");
    vi.runAllTimers();
    expect(sent).toEqual(["current"]);
    vi.useRealTimers();
  });

  it("clamps invalid lag values to the supported range", () => {
    expect(clampDisplayLagSeconds(-1)).toBe(0);
    expect(clampDisplayLagSeconds(2.345)).toBe(2.345);
    expect(clampDisplayLagSeconds(10)).toBe(4);
    expect(clampDisplayLagSeconds(Number.NaN)).toBe(0);
  });
});
