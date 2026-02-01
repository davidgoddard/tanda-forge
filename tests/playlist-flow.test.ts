import { describe, expect, it } from "vitest";
import { shouldContinueAfterEndCortina } from "../app/src/shared/playlist-flow.js";

describe("shouldContinueAfterEndCortina", () => {
  it("returns true when new items were appended after the end cortina", () => {
    expect(shouldContinueAfterEndCortina(3, 4)).toBe(true);
  });

  it("returns false when still at the end of the playlist", () => {
    expect(shouldContinueAfterEndCortina(3, 3)).toBe(false);
  });
});
