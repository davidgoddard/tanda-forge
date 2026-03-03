import { describe, expect, it } from "vitest";
import {
  createRendererUiStore,
  reduceRendererUiState,
  type RendererUiState,
} from "../app/src/shared/state/renderer-ui-store";

const initialState: RendererUiState = {
  appMode: "prep",
  activeRightTab: "playlist-tab",
  activeSearchTab: "search-tracks",
  playlistFilterText: "",
  clipboardFilterText: "",
  search: {
    items: [],
    total: 0,
    offsetStart: 0,
    sortBy: "title",
    sortDir: "asc",
    isLoading: false,
    sortMode: "auto",
    lastQuery: "",
  },
};

describe("renderer ui store", () => {
  it("reduces top-level tab/mode transitions", () => {
    const next = reduceRendererUiState(initialState, {
      type: "set_app_mode",
      appMode: "live",
    });
    expect(next.appMode).toBe("live");

    const withRightTab = reduceRendererUiState(next, {
      type: "set_right_tab",
      tab: "tanda-designer-tab",
    });
    expect(withRightTab.activeRightTab).toBe("tanda-designer-tab");

    const withSearchTab = reduceRendererUiState(withRightTab, {
      type: "set_search_tab",
      tab: "search-tandas",
    });
    expect(withSearchTab.activeSearchTab).toBe("search-tandas");
  });

  it("patches search state without mutating prior object", () => {
    const next = reduceRendererUiState(initialState, {
      type: "patch_search",
      patch: { total: 42, isLoading: true },
    });
    expect(next.search.total).toBe(42);
    expect(next.search.isLoading).toBe(true);
    expect(initialState.search.total).toBe(0);
    expect(next.search).not.toBe(initialState.search);
  });

  it("notifies subscribers on dispatch", () => {
    const store = createRendererUiStore(initialState);
    let observed: RendererUiState | null = null;
    const unsub = store.subscribe((next) => {
      observed = next;
    });

    store.dispatch({ type: "set_playlist_filter", value: "Biagi" });
    expect(observed?.playlistFilterText).toBe("Biagi");

    unsub();
  });
});
