type SortDir = "asc" | "desc";

type RuntimeElements = {
  searchInput?: HTMLElement | null;
  searchButton?: HTMLElement | null;
  searchSortButtons: HTMLElement[];
  searchListBody?: HTMLElement | null;
  clipPanel?: HTMLElement | null;
  playlistListEl?: HTMLElement | null;
  documentBody: Document;
  windowObject: Window;
  mediaDevices?: Pick<MediaDevices, "addEventListener"> | null;
};

export type AppRuntimeControllerDeps = {
  elements: RuntimeElements;
  readers: {
    getSearchState: () => { sortBy?: string; sortDir: SortDir };
    shouldBlockBeforeUnload: () => boolean;
  };
  actions: {
    scheduleSearch: () => void;
    refreshSearch: () => void | Promise<void>;
    patchSearchState: (patch: Record<string, unknown>) => void;
    updateSortButtons: () => void;
    handleSearchScroll: () => void;
    handleDropToClipboard: (event: DragEvent) => void;
    ensureAudioOutputs: () => Promise<void>;
    renderAllLists: () => void;
    markUserInteraction: () => void;
  };
};

export const createAppRuntimeController = (
  deps: AppRuntimeControllerDeps,
) => {
  const initialize = () => {
    deps.elements.searchInput?.addEventListener("input", () => {
      deps.actions.scheduleSearch();
    });

    deps.elements.searchButton?.addEventListener("click", () => {
      void deps.actions.refreshSearch();
    });

    deps.elements.searchSortButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const sort = button.dataset.sort;
        if (!sort) {
          return;
        }
        const searchState = deps.readers.getSearchState();
        if (searchState.sortBy === sort) {
          deps.actions.patchSearchState({
            sortDir: searchState.sortDir === "asc" ? "desc" : "asc",
          });
        } else {
          deps.actions.patchSearchState({ sortBy: sort, sortDir: "asc" });
        }
        deps.actions.patchSearchState({ sortMode: "manual" });
        deps.actions.updateSortButtons();
        void deps.actions.refreshSearch();
      });
    });

    deps.elements.searchListBody?.addEventListener("scroll", () => {
      deps.actions.handleSearchScroll();
    });
    deps.elements.searchListBody?.addEventListener("wheel", () => {
      deps.actions.handleSearchScroll();
    });

    deps.elements.clipPanel?.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    deps.elements.clipPanel?.addEventListener("drop", (event) => {
      deps.actions.handleDropToClipboard(event as DragEvent);
    });

    if (deps.elements.mediaDevices?.addEventListener) {
      deps.elements.mediaDevices.addEventListener("devicechange", async () => {
        await deps.actions.ensureAudioOutputs();
        deps.actions.renderAllLists();
      });
    }

    deps.elements.documentBody.addEventListener("pointerdown", deps.actions.markUserInteraction, {
      passive: true,
    });
    deps.elements.documentBody.addEventListener("keydown", deps.actions.markUserInteraction);
    deps.elements.documentBody.addEventListener("wheel", deps.actions.markUserInteraction, {
      passive: true,
    });
    deps.elements.documentBody.addEventListener("touchstart", deps.actions.markUserInteraction, {
      passive: true,
    });
    deps.elements.playlistListEl?.addEventListener("scroll", deps.actions.markUserInteraction, {
      passive: true,
    });

    deps.elements.windowObject.addEventListener("beforeunload", (event) => {
      if (!deps.readers.shouldBlockBeforeUnload()) {
        return;
      }
      event.preventDefault();
    });
  };

  return {
    initialize,
  };
};
