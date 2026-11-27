import { describe, expect, it } from "vitest";
import {
  getTandaCompletionAnchors,
  tandaCompletionCombinationKey,
} from "../app/src/shared/tanda-completion";

describe("tanda completion state", () => {
  it("treats tried generated combinations as unordered sets", () => {
    expect(tandaCompletionCombinationKey(["b", "a"]))
      .toBe(tandaCompletionCombinationKey(["a", "b"]));
    expect(tandaCompletionCombinationKey(["a", "c"]))
      .not.toBe(tandaCompletionCombinationKey(["a", "b"]));
  });

  it("offers completion for a populated tanda below the preferred size", () => {
    expect(getTandaCompletionAnchors({
      trackSlots: ["anchor", null, null],
      preferredSize: 3,
    })).toEqual(["anchor"]);
    expect(getTandaCompletionAnchors({
      trackSlots: [null, null, null],
      preferredSize: 3,
    })).toEqual([]);
    expect(getTandaCompletionAnchors({
      trackSlots: ["anchor", "a", "b"],
      manualTrackIds: ["anchor"],
      preferredSize: 3,
    })).toEqual([]);
  });

  it("keeps anchors and allows generated suggestions to be cycled", () => {
    expect(getTandaCompletionAnchors({
      trackSlots: ["anchor", "suggestion", "other"],
      manualTrackIds: ["anchor"],
      generatedTrackIds: ["suggestion"],
      preferredSize: 3,
    })).toEqual(["anchor", "other"]);
  });
});
