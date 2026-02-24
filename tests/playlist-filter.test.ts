import { describe, expect, it } from "vitest";
import { computeAutoClearRemainingMs } from "../app/src/shared/playlist-filter";

describe("computeAutoClearRemainingMs", () => {
  it("returns full idle window when there is no elapsed time", () => {
    expect(
      computeAutoClearRemainingMs({
        lastInteractionAt: 1000,
        now: 1000,
        idleMs: 30_000,
      }),
    ).toBe(30_000);
  });

  it("returns remaining time when user has been idle for part of the window", () => {
    expect(
      computeAutoClearRemainingMs({
        lastInteractionAt: 1000,
        now: 20_000,
        idleMs: 30_000,
      }),
    ).toBe(11_000);
  });

  it("returns zero when idle duration has elapsed", () => {
    expect(
      computeAutoClearRemainingMs({
        lastInteractionAt: 1000,
        now: 40_000,
        idleMs: 30_000,
      }),
    ).toBe(0);
  });

  it("treats negative elapsed time defensively as zero", () => {
    expect(
      computeAutoClearRemainingMs({
        lastInteractionAt: 20_000,
        now: 10_000,
        idleMs: 30_000,
      }),
    ).toBe(30_000);
  });
});
