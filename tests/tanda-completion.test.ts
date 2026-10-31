import { describe, expect, it } from "vitest";
import {
  isUserStartedIncompleteTanda,
  tandaCompletionCombinationKey,
} from "../app/src/shared/tanda-completion";

describe("tanda completion state", () => {
  it("treats tried generated combinations as unordered sets", () => {
    expect(tandaCompletionCombinationKey(["b", "a"]))
      .toBe(tandaCompletionCombinationKey(["a", "b"]));
    expect(tandaCompletionCombinationKey(["a", "c"]))
      .not.toBe(tandaCompletionCombinationKey(["a", "b"]));
  });

  it("only offers completion for a user-started incomplete tanda", () => {
    expect(isUserStartedIncompleteTanda({
      trackSlots: ["anchor", null, null],
      manualTrackIds: ["anchor"],
      preferredSize: 3,
    })).toBe(true);
    expect(isUserStartedIncompleteTanda({
      trackSlots: [null, null, null],
      manualTrackIds: [],
      preferredSize: 3,
    })).toBe(false);
    expect(isUserStartedIncompleteTanda({
      trackSlots: ["anchor", "a", "b"],
      manualTrackIds: ["anchor"],
      preferredSize: 3,
    })).toBe(false);
  });
});
