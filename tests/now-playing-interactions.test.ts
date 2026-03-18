import { describe, expect, it } from "vitest";
import { shouldIgnoreNowPlayingSectionClick } from "../app/src/renderer/modules/now-playing-interactions";

const createTarget = (matchingSelectors: string[]) =>
  ({
    closest: (selector: string) => (matchingSelectors.includes(selector) ? {} : null),
  }) as EventTarget;

describe("now playing interaction guards", () => {
  it("ignores clicks on cortina controls and waveform surfaces", () => {
    expect(shouldIgnoreNowPlayingSectionClick(createTarget(["button"]))).toBe(true);
    expect(shouldIgnoreNowPlayingSectionClick(createTarget([".now-playing-boost"]))).toBe(true);
    expect(shouldIgnoreNowPlayingSectionClick(createTarget(["#cortina-controls"]))).toBe(true);
    expect(shouldIgnoreNowPlayingSectionClick(createTarget(["#waveform-container"]))).toBe(true);
    expect(
      shouldIgnoreNowPlayingSectionClick(createTarget(["#track-editor-waveform-container"])),
    ).toBe(true);
  });

  it("does not ignore plain now-playing text clicks", () => {
    expect(shouldIgnoreNowPlayingSectionClick(createTarget([]))).toBe(false);
    expect(shouldIgnoreNowPlayingSectionClick(null)).toBe(false);
    expect(shouldIgnoreNowPlayingSectionClick({} as EventTarget)).toBe(false);
  });
});
