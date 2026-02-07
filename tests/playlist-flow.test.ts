import { describe, expect, it } from "vitest";
import {
  resolveContinuationIndexAfterEndCortina,
  shouldContinueAfterEndCortina,
  shouldInsertCortinaBeforeTanda,
} from "../app/src/shared/playlist-flow.js";

describe("shouldContinueAfterEndCortina", () => {
  it("returns true when new items were appended after the end cortina", () => {
    expect(shouldContinueAfterEndCortina(3, 4)).toBe(true);
  });

  it("returns false when still at the end of the playlist", () => {
    expect(shouldContinueAfterEndCortina(3, 3)).toBe(false);
  });
});

describe("shouldInsertCortinaBeforeTanda", () => {
  it("returns false when continuing from a terminal cortina into newly appended tanda", () => {
    expect(shouldInsertCortinaBeforeTanda(true, 3, 0, false, true)).toBe(false);
  });

  it("returns true for normal tanda transitions with cortinas enabled", () => {
    expect(shouldInsertCortinaBeforeTanda(true, 2, 0, false, false)).toBe(true);
  });
});

describe("resolveContinuationIndexAfterEndCortina", () => {
  it("continues at first unplayed playable tanda after appending during end cortina", () => {
    expect(resolveContinuationIndexAfterEndCortina(2, 0, [true, true, false])).toBe(1);
  });

  it("falls back to current index when nothing playable was appended", () => {
    expect(resolveContinuationIndexAfterEndCortina(3, 2, [true, true, true, false])).toBe(3);
  });
});
