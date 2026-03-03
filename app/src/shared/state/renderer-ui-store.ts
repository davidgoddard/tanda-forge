export type RightPanelTab = "playlist-tab" | "tanda-designer-tab";
export type SearchTab = "search-tracks" | "search-tandas";
export type OutputMode = "prep" | "live" | "edit";

export type SearchState<TItem = unknown> = {
  items: TItem[];
  total: number;
  offsetStart: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  isLoading: boolean;
  sortMode: "auto" | "manual";
  lastQuery: string;
};

export type RendererUiState<TItem = unknown> = {
  appMode: OutputMode;
  activeRightTab: RightPanelTab;
  activeSearchTab: SearchTab;
  playlistFilterText: string;
  clipboardFilterText: string;
  search: SearchState<TItem>;
};

export type RendererUiAction =
  | { type: "set_app_mode"; appMode: OutputMode }
  | { type: "set_right_tab"; tab: RightPanelTab }
  | { type: "set_search_tab"; tab: SearchTab }
  | { type: "set_playlist_filter"; value: string }
  | { type: "set_clipboard_filter"; value: string }
  | { type: "set_search"; search: SearchState }
  | { type: "patch_search"; patch: Partial<SearchState> };

export const reduceRendererUiState = (
  state: RendererUiState,
  action: RendererUiAction,
): RendererUiState => {
  switch (action.type) {
    case "set_app_mode":
      return { ...state, appMode: action.appMode };
    case "set_right_tab":
      return { ...state, activeRightTab: action.tab };
    case "set_search_tab":
      return { ...state, activeSearchTab: action.tab };
    case "set_playlist_filter":
      return { ...state, playlistFilterText: action.value };
    case "set_clipboard_filter":
      return { ...state, clipboardFilterText: action.value };
    case "set_search":
      return { ...state, search: action.search };
    case "patch_search":
      return { ...state, search: { ...state.search, ...action.patch } };
    default: {
      const unknownAction: never = action;
      return unknownAction;
    }
  }
};

export const createRendererUiStore = (initial: RendererUiState) => {
  let current = initial;
  const listeners = new Set<(nextState: RendererUiState) => void>();

  return {
    getState: () => current,
    dispatch: (action: RendererUiAction) => {
      const next = reduceRendererUiState(current, action);
      if (next === current) {
        return current;
      }
      current = next;
      listeners.forEach((listener) => listener(current));
      return current;
    },
    subscribe: (listener: (nextState: RendererUiState) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
