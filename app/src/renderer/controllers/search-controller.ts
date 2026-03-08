export type SearchState<TTrack> = {
  items: TTrack[];
  total: number;
  offsetStart: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  isLoading: boolean;
  sortMode: "auto" | "manual";
  lastQuery: string;
};

export type SearchControllerDeps<TTrack> = {
  searchPageSize: number;
  getWindowApi: () => {
    searchTracks: (params: any) => Promise<TTrack[]>;
    searchTrackCount: (params: any) => Promise<number>;
    searchJumpIndex: (params: any) => Promise<string[]>;
    searchJumpToPrefix: (params: any) => Promise<{ offset: number }>;
  } | null;
  getState: () => SearchState<TTrack>;
  setState: (state: SearchState<TTrack>) => void;
  patchState: (patch: Partial<SearchState<TTrack>>) => void;
  getSearchParams: () => Record<string, unknown>;
  applySearchUiState: (state: "idle" | "loading", token?: number, count?: number) => void;
  getRefreshVersion: () => number;
  incrementRefreshVersion: () => number;
  setTrackInCache: (track: TTrack) => void;
  renderSearchResults: () => void;
  updateSearchSortDefaults: () => void;
  updateTabCount: (count: number) => void;
  updateJumpIndex: (params?: Record<string, unknown>) => Promise<void>;
  loadTandaSearchResults: () => Promise<void>;
  getActiveSearchTab: () => "search-tracks" | "search-tandas";
  getSearchListBody: () => HTMLDivElement | null;
  getSearchListMetrics: () => {
    scrollTop: number;
    clientHeight: number;
    scrollHeight: number;
  } | null;
  setSearchListScrollTop: (top: number) => void;
};

export const createSearchController = <TTrack extends { id: string }>(
  deps: SearchControllerDeps<TTrack>,
) => {
  const loadSearchPage = async (
    offset: number,
    mode: "replace" | "append" | "prepend",
    paramsOverride?: Record<string, unknown>,
  ) => {
    const api = deps.getWindowApi();
    const state = deps.getState();
    if (!api || state.isLoading) {
      return;
    }
    if (offset < 0) {
      return;
    }
    if (state.total && offset >= state.total) {
      return;
    }
    deps.patchState({ isLoading: true });
    deps.applySearchUiState("loading", deps.getRefreshVersion(), deps.getState().total);
    try {
      const params = paramsOverride ?? deps.getSearchParams();
      const nextState = deps.getState();
      const rows = await api.searchTracks({
        ...params,
        limit: deps.searchPageSize,
        offset,
        sortBy: nextState.sortBy,
        sortDir: nextState.sortDir,
      });
      rows.forEach((track) => deps.setTrackInCache(track));
      const current = deps.getState();
      if (mode === "replace") {
        deps.patchState({ items: rows, offsetStart: offset });
      } else if (mode === "append") {
        deps.patchState({ items: [...current.items, ...rows] });
      } else {
        deps.patchState({ items: [...rows, ...current.items], offsetStart: offset });
      }
      deps.renderSearchResults();
    } finally {
      deps.patchState({ isLoading: false });
      deps.applySearchUiState("idle", deps.getRefreshVersion(), deps.getState().total);
    }
  };

  const refreshSearch = async () => {
    const refreshVersion = deps.incrementRefreshVersion();
    deps.applySearchUiState("loading", refreshVersion, 0);
    const params = deps.getSearchParams();
    deps.updateSearchSortDefaults();
    deps.patchState({ total: 0 });
    await loadSearchPage(0, "replace", params);
    if (refreshVersion !== deps.getRefreshVersion()) {
      return;
    }
    const listBody = deps.getSearchListBody();
    if (listBody) {
      listBody.scrollTop = 0;
    }
    const api = deps.getWindowApi();
    if (!api) {
      return;
    }
    deps.patchState({ total: await api.searchTrackCount(params) });
    if (refreshVersion !== deps.getRefreshVersion()) {
      return;
    }
    deps.updateTabCount(deps.getState().total);
    await deps.updateJumpIndex(params);
    if (refreshVersion !== deps.getRefreshVersion()) {
      return;
    }
    const state = deps.getState();
    if (state.total > 0 && state.items.length === 0) {
      await loadSearchPage(0, "replace", params);
      if (refreshVersion !== deps.getRefreshVersion()) {
        return;
      }
    }
    if (deps.getActiveSearchTab() === "search-tandas") {
      await deps.loadTandaSearchResults();
      deps.applySearchUiState("idle", refreshVersion, deps.getState().total);
      return;
    }
    window.setTimeout(() => {
      if (refreshVersion !== deps.getRefreshVersion()) {
        return;
      }
      void deps.loadTandaSearchResults();
    }, 250);
    deps.applySearchUiState("idle", refreshVersion, deps.getState().total);
  };

  const runSearchQuery = (
    query: string,
    allowEmpty: boolean,
    helpers: {
      setInputValue: (value: string) => void;
      schedule: (fn: () => void) => void;
      setActiveSearchTab: (tab: "search-tracks" | "search-tandas") => void;
    },
    preferredTab?: "search-tracks" | "search-tandas",
  ) => {
    const value = query.trim();
    if (!value && !allowEmpty) {
      return;
    }
    helpers.setInputValue(value);
    deps.applySearchUiState("loading", deps.getRefreshVersion() + 1, deps.getState().total);
    helpers.setActiveSearchTab(preferredTab ?? deps.getActiveSearchTab());
    helpers.schedule(() => {
      void refreshSearch();
    });
  };

  const jumpToPrefix = async (prefix: string) => {
    const api = deps.getWindowApi();
    if (!api) {
      return;
    }
    const state = deps.getState();
    const result = await api.searchJumpToPrefix({
      ...deps.getSearchParams(),
      prefix,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
    });
    await loadSearchPage(result.offset, "replace");
    deps.setSearchListScrollTop(0);
  };

  const handleSearchScroll = async () => {
    const state = deps.getState();
    if (state.isLoading || deps.getActiveSearchTab() !== "search-tracks") {
      return;
    }
    if (state.total === 0) {
      return;
    }
    const metrics = deps.getSearchListMetrics();
    if (!metrics) {
      return;
    }
    const threshold = 140;
    const nearBottom = metrics.scrollTop + metrics.clientHeight >= metrics.scrollHeight - threshold;
    const nearTop = metrics.scrollTop <= threshold;

    if (nearBottom) {
      const nextOffset = state.offsetStart + state.items.length;
      if (state.total === 0 || nextOffset < state.total) {
        await loadSearchPage(nextOffset, "append");
      }
      return;
    }

    if (nearTop && state.offsetStart > 0) {
      const prevOffset = Math.max(0, state.offsetStart - deps.searchPageSize);
      const previousHeight = metrics.scrollHeight;
      await loadSearchPage(prevOffset, "prepend");
      const after = deps.getSearchListMetrics();
      if (!after) {
        return;
      }
      deps.setSearchListScrollTop(metrics.scrollTop + (after.scrollHeight - previousHeight));
    }
  };

  return {
    loadSearchPage,
    refreshSearch,
    runSearchQuery,
    jumpToPrefix,
    handleSearchScroll,
  };
};
