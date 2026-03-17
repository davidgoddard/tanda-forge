type PanelElements = {
  tandaListEl?: HTMLElement | null;
  playlistTandaEditorEl?: HTMLElement | null;
  panelTabButtons: HTMLElement[];
  documentBody: Document;
};

export type PanelInteractionsControllerDeps = {
  elements: PanelElements;
  readers: {
    getTrackFromCache: (trackId: string) => any | null;
  };
  actions: {
    handleTandaAction: (event: Event) => void | Promise<void>;
    playTrackForMode: (
      track: any,
      data: { filePath: string; trackId: string; gainDb: number | null },
    ) => Promise<any>;
    handleDropToTanda: (event: DragEvent) => void;
    closeRowMenus: () => void;
    closeDetailMenus: () => void;
    closeStyleVariantMenu: () => void;
    closeCollectionTargetMenu: () => void;
    setActiveSearchTab: (tabId: string) => void;
    updateSearchTabVisibility: () => void;
    setActiveRightTab: (tabId: string) => void;
    renderTandaDesigner: () => void;
  };
};

const bindTandaTrackPlayback = (
  element: HTMLElement | null | undefined,
  getTrackFromCache: (trackId: string) => any | null,
  playTrackForMode: (
    track: any,
    data: { filePath: string; trackId: string; gainDb: number | null },
  ) => Promise<any>,
) => {
  element?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      return;
    }
    const row = target.closest<HTMLElement>(".tanda-track-row");
    const trackId = row?.dataset.trackId;
    if (!trackId) {
      return;
    }
    const track = getTrackFromCache(trackId);
    if (!track) {
      return;
    }
    await playTrackForMode(track, {
      filePath: track.full_path,
      trackId: track.id,
      gainDb: track.gain_db ?? null,
    });
  });
};

export const createPanelInteractionsController = (
  deps: PanelInteractionsControllerDeps,
) => {
  const initialize = () => {
    deps.elements.tandaListEl?.addEventListener("click", (event) => {
      void deps.actions.handleTandaAction(event);
    });
    deps.elements.playlistTandaEditorEl?.addEventListener("click", (event) => {
      void deps.actions.handleTandaAction(event);
    });

    bindTandaTrackPlayback(
      deps.elements.tandaListEl,
      deps.readers.getTrackFromCache,
      deps.actions.playTrackForMode,
    );
    bindTandaTrackPlayback(
      deps.elements.playlistTandaEditorEl,
      deps.readers.getTrackFromCache,
      deps.actions.playTrackForMode,
    );

    [deps.elements.tandaListEl, deps.elements.playlistTandaEditorEl].forEach((element) => {
      element?.addEventListener("dragover", (event) => {
        event.preventDefault();
      });
      element?.addEventListener("drop", (event) => {
        deps.actions.handleDropToTanda(event as DragEvent);
      });
    });

    deps.elements.documentBody.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".row-actions") || target?.closest(".tanda-detail-actions-right")) {
        return;
      }
      deps.actions.closeRowMenus();
      deps.actions.closeDetailMenus();
      if (!target?.closest(".style-variant-menu")) {
        deps.actions.closeStyleVariantMenu();
        deps.actions.closeCollectionTargetMenu();
      }
    });

    deps.elements.panelTabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tabId = button.dataset.tab;
        if (!tabId) {
          return;
        }
        const panel = button.closest(".panel");
        if (!panel) {
          return;
        }
        const tabBar = button.closest(".tab-bar");
        tabBar
          ?.querySelectorAll<HTMLButtonElement>("button")
          .forEach((btn) => btn.classList.remove("active"));
        panel
          .querySelectorAll<HTMLElement>(".tab-panel, .list-rows")
          .forEach((list) => list.classList.remove("active"));
        button.classList.add("active");
        const targetPanel = panel.querySelector<HTMLElement>(`#${tabId}`);
        if (targetPanel) {
          targetPanel.classList.add("active");
          if (targetPanel.classList.contains("tab-panel")) {
            targetPanel
              .querySelectorAll<HTMLElement>(".list-rows")
              .forEach((list) => list.classList.add("active"));
          }
        }
        if (tabId === "search-tracks" || tabId === "search-tandas") {
          deps.actions.setActiveSearchTab(tabId);
          deps.actions.updateSearchTabVisibility();
        }
        if (tabId === "tanda-designer-tab" || tabId === "playlist-tab") {
          deps.actions.setActiveRightTab(tabId);
          deps.actions.renderTandaDesigner();
        }
      });
    });
  };

  return {
    initialize,
  };
};
