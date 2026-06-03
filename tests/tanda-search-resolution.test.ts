import { describe, expect, it } from "vitest";
import { resolveSearchResultTanda } from "../app/src/shared/tanda-search-resolution";

describe("resolveSearchResultTanda", () => {
  it("prefers canonical cached tandas over stale same-id drafts", () => {
    const cached = { id: "t1", trackSlots: ["a", "b", "c"] };
    const draft = { id: "t1", trackSlots: [null, null, null] };

    expect(
      resolveSearchResultTanda({
        cached,
        clipboard: null,
        draft,
      }),
    ).toBe(cached);
  });

  it("falls back to clipboard and then draft when no cached tanda exists", () => {
    const clipboard = { id: "t1", trackSlots: ["a", "b"] };
    const draft = { id: "t1", trackSlots: [null, null] };

    expect(
      resolveSearchResultTanda({
        cached: null,
        clipboard,
        draft,
      }),
    ).toBe(clipboard);

    expect(
      resolveSearchResultTanda({
        cached: null,
        clipboard: null,
        draft,
      }),
    ).toBe(draft);
  });
});
