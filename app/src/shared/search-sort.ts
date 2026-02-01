export type SearchSortMode = "auto" | "manual";
export type SearchSortDir = "asc" | "desc";

export type SearchSortState = {
  sortBy: string;
  sortDir: SearchSortDir;
  sortMode: SearchSortMode;
  lastQuery: string;
};

export const applySearchSortDefaults = (
  query: string,
  state: SearchSortState,
) => {
  const normalizedQuery = query.trim().toLowerCase();
  let next: SearchSortState = { ...state };
  if (normalizedQuery !== state.lastQuery) {
    next = { ...next, lastQuery: normalizedQuery, sortMode: "auto" };
  }

  if (normalizedQuery.length > 0) {
    if (next.sortMode === "auto") {
      next = { ...next, sortBy: "score", sortDir: "desc" };
    }
  } else if (next.sortMode === "auto") {
    next = { ...next, sortBy: "title", sortDir: "asc" };
  }

  return next;
};
