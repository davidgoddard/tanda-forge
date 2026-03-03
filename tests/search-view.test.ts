import { describe, expect, it } from "vitest";
import { setSearchUiState } from "../app/src/renderer/modules/search-view";

type FakeEl = {
  dataset: Record<string, string>;
};

describe("search view state markers", () => {
  it("sets loading and token/count attributes", () => {
    const body: FakeEl = { dataset: {} };
    const tracks: FakeEl = { dataset: {} };

    setSearchUiState({
      searchListBody: body as unknown as HTMLDivElement,
      searchTracksEl: tracks as unknown as HTMLDivElement,
      state: "loading",
      token: 3,
      count: 11,
    });

    expect(body.dataset.state).toBe("loading");
    expect(tracks.dataset.refreshToken).toBe("3");
    expect(tracks.dataset.count).toBe("11");
  });

  it("sets ready token on idle", () => {
    const tracks: FakeEl = { dataset: {} };
    setSearchUiState({
      searchListBody: null,
      searchTracksEl: tracks as unknown as HTMLDivElement,
      state: "idle",
      token: 9,
    });
    expect(tracks.dataset.readyToken).toBe("9");
  });
});
