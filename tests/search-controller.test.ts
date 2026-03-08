import { describe, expect, it } from "vitest";
import { createSearchController, type SearchState } from "../app/src/renderer/controllers/search-controller";

type Track = { id: string };

const baseState = (): SearchState<Track> => ({
  items: [],
  total: 0,
  offsetStart: 0,
  sortBy: "title",
  sortDir: "asc",
  isLoading: false,
  sortMode: "auto",
  lastQuery: "",
});

describe("search controller", () => {
  it("loads first page and updates items", async () => {
    let state = baseState();
    const controller = createSearchController<Track>({
      searchPageSize: 2,
      getWindowApi: () => ({
        searchTracks: async () => [{ id: "a" }, { id: "b" }],
        searchTrackCount: async () => 2,
        searchJumpIndex: async () => [],
        searchJumpToPrefix: async () => ({ offset: 0 }),
      }),
      getState: () => state,
      setState: (next) => {
        state = next;
      },
      patchState: (patch) => {
        state = { ...state, ...patch };
      },
      getSearchParams: () => ({ query: "" }),
      applySearchUiState: () => {},
      getRefreshVersion: () => 1,
      incrementRefreshVersion: () => 1,
      setTrackInCache: () => {},
      renderSearchResults: () => {},
      updateSearchSortDefaults: () => {},
      updateTabCount: () => {},
      updateJumpIndex: async () => {},
      loadTandaSearchResults: async () => {},
      getActiveSearchTab: () => "search-tracks",
      getSearchListBody: () => null,
      getSearchListMetrics: () => null,
      setSearchListScrollTop: () => {},
    });

    await controller.loadSearchPage(0, "replace");
    expect(state.items.map((row) => row.id)).toEqual(["a", "b"]);
    expect(state.offsetStart).toBe(0);
  });

  it("preserves the active search tab when no override is provided", () => {
    let state = baseState();
    let activatedTab: "search-tracks" | "search-tandas" | null = null;
    let scheduled = false;
    const controller = createSearchController<Track>({
      searchPageSize: 2,
      getWindowApi: () => null,
      getState: () => state,
      setState: (next) => {
        state = next;
      },
      patchState: (patch) => {
        state = { ...state, ...patch };
      },
      getSearchParams: () => ({ query: "Trio" }),
      applySearchUiState: () => {},
      getRefreshVersion: () => 1,
      incrementRefreshVersion: () => 1,
      setTrackInCache: () => {},
      renderSearchResults: () => {},
      updateSearchSortDefaults: () => {},
      updateTabCount: () => {},
      updateJumpIndex: async () => {},
      loadTandaSearchResults: async () => {},
      getActiveSearchTab: () => "search-tandas",
      getSearchListBody: () => null,
      getSearchListMetrics: () => null,
      setSearchListScrollTop: () => {},
    });

    controller.runSearchQuery(
      "Trio",
      true,
      {
        setInputValue: () => {},
        schedule: () => {
          scheduled = true;
        },
        setActiveSearchTab: (tab) => {
          activatedTab = tab;
        },
      },
    );

    expect(activatedTab).toBe("search-tandas");
    expect(scheduled).toBe(true);
  });

  it("uses an explicit tab override for programmatic searches", () => {
    let state = baseState();
    let activatedTab: "search-tracks" | "search-tandas" | null = null;
    const controller = createSearchController<Track>({
      searchPageSize: 2,
      getWindowApi: () => null,
      getState: () => state,
      setState: (next) => {
        state = next;
      },
      patchState: (patch) => {
        state = { ...state, ...patch };
      },
      getSearchParams: () => ({ query: "Trio" }),
      applySearchUiState: () => {},
      getRefreshVersion: () => 1,
      incrementRefreshVersion: () => 1,
      setTrackInCache: () => {},
      renderSearchResults: () => {},
      updateSearchSortDefaults: () => {},
      updateTabCount: () => {},
      updateJumpIndex: async () => {},
      loadTandaSearchResults: async () => {},
      getActiveSearchTab: () => "search-tandas",
      getSearchListBody: () => null,
      getSearchListMetrics: () => null,
      setSearchListScrollTop: () => {},
    });

    controller.runSearchQuery(
      "Busqueda Artistica",
      true,
      {
        setInputValue: () => {},
        schedule: () => {},
        setActiveSearchTab: (tab) => {
          activatedTab = tab;
        },
      },
      "search-tracks",
    );

    expect(activatedTab).toBe("search-tracks");
  });
});
