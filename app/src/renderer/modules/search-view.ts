export const setSearchUiState = (params: {
  searchListBody: HTMLDivElement | null;
  searchTracksEl: HTMLDivElement | null;
  state: "idle" | "loading";
  token?: number;
  count?: number;
}) => {
  const { searchListBody, searchTracksEl, state, token, count } = params;
  if (searchListBody) {
    searchListBody.dataset.state = state;
    searchListBody.dataset.loading = state;
  }
  if (searchTracksEl) {
    searchTracksEl.dataset.state = state;
    searchTracksEl.dataset.loading = state;
    if (typeof count === "number") {
      searchTracksEl.dataset.count = `${count}`;
    }
    if (typeof token === "number") {
      searchTracksEl.dataset.refreshToken = `${token}`;
      if (state === "idle") {
        searchTracksEl.dataset.readyToken = `${token}`;
      }
    }
  }
};
