import { describe, expect, it } from "vitest";
import { applySearchSortDefaults } from "../app/src/shared/search-sort";

describe("applySearchSortDefaults", () => {
  it("defaults to score desc when query is non-empty", () => {
    const next = applySearchSortDefaults("francisco", {
      sortBy: "title",
      sortDir: "asc",
      sortMode: "auto",
      lastQuery: "",
    });
    expect(next.sortBy).toBe("score");
    expect(next.sortDir).toBe("desc");
  });

  it("defaults to title asc when query is empty", () => {
    const next = applySearchSortDefaults("", {
      sortBy: "score",
      sortDir: "desc",
      sortMode: "auto",
      lastQuery: "francisco",
    });
    expect(next.sortBy).toBe("title");
    expect(next.sortDir).toBe("asc");
  });

  it("resets to auto when query changes", () => {
    const next = applySearchSortDefaults("nuevo", {
      sortBy: "artist",
      sortDir: "asc",
      sortMode: "manual",
      lastQuery: "tango",
    });
    expect(next.sortMode).toBe("auto");
    expect(next.sortBy).toBe("score");
  });
});
