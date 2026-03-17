type TrackData = {
  filePath: string;
  trackId: string;
  gainDb: number | null;
};

type ClipboardMoveTarget = {
  id: string;
};

type LibraryListElements = {
  clipTandasEl?: HTMLElement | null;
  searchTracksEl?: HTMLElement | null;
  searchTandasEl?: HTMLElement | null;
  clipTracksEl?: HTMLElement | null;
};

export type LibraryListInteractionsControllerDeps = {
  elements: LibraryListElements;
  readers: {
    getClipboardTandas: () => Array<{ id: string }>;
    getClipboardTracks: () => Array<{ id: string }>;
    getActiveCollectionId: () => string | null;
    getAppMode: () => string;
    isHeadphoneAvailable: () => boolean;
    isTrackEditorOpen: () => boolean;
    getTrackDataFromRow: (row: HTMLElement) => TrackData | null;
    getTrackById: (id: string) => any | null;
    getTrackFromCache: (id: string) => any | null;
    resolveTandaForSearch: (id: string) => any | null;
    getClipboardMoveTargets: (activeCollectionId: string | null) => ClipboardMoveTarget[];
  };
  actions: {
    handleDuplicateJump: (target: HTMLElement) => boolean;
    toggleTandaRow: (row: HTMLElement) => void;
    closeDetailMenus: () => void;
    closeRowMenus: () => void;
    toggleRowMenu: (row: HTMLElement) => void;
    openTrackEditor: (trackId: string) => void;
    runSearchForTrack: (track: any) => void;
    runSearchForTanda: (tanda: any) => void;
    playOnChannel: (
      channel: "main" | "headphone",
      filePath: string,
      trackId: string,
      track: any,
      gainDb: number | null,
    ) => Promise<any>;
    playTrackForMode: (track: any, data: TrackData) => Promise<any>;
    updateHeadphoneButtonIndicators: () => void;
    addTrackToClipboard: (track: any) => void;
    addTandaToClipboard: (tandaId: string) => void;
    openTandaInDesigner: (tandaId: string, source: any | null, hostTab?: any) => void;
    addTrackToActiveTanda: (track: any) => boolean;
    appendTrackToPlaylist: (track: any) => void;
    addTandaToPlaylist: (tandaId: string, source: any | null) => void;
    moveTrackBetweenClipboardCollections: (trackId: string, targetId: string) => void;
    moveTandaBetweenClipboardCollections: (tandaId: string, targetId: string) => void;
    openTrackMoveTargetMenu: (x: number, y: number, trackId: string, targets: any[]) => void;
    openTandaMoveTargetMenu: (x: number, y: number, tandaId: string, targets: any[]) => void;
    removeClipboardTrack: (trackId: string) => void;
    removeClipboardTanda: (tandaId: string) => void;
    activateClipboardTab: (tabId: "clip-tracks" | "clip-tandas") => void;
    setSelectedClipboardTrackId: (trackId: string | null) => void;
    setSelectedClipboardTandaId: (tandaId: string | null) => void;
    renderClipboard: () => void;
    setStatusNoTandaSelected: () => void;
  };
};

const toggleDetailMenu = (
  target: HTMLElement,
  closeDetailMenus: () => void,
) => {
  const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
  if (!detailLine) {
    return;
  }
  if (detailLine.classList.contains("detail-menu-open")) {
    detailLine.classList.remove("detail-menu-open");
    return;
  }
  closeDetailMenus();
  detailLine.classList.add("detail-menu-open");
};

export const createLibraryListInteractionsController = (
  deps: LibraryListInteractionsControllerDeps,
) => {
  const initialize = () => {
    deps.elements.clipTandasEl?.addEventListener("click", async (event) => {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLElement>(".list-row");
      if (deps.actions.handleDuplicateJump(target)) {
        return;
      }
      const tandaId = row?.dataset.tandaId;
      if (!tandaId) {
        return;
      }
      if (
        target.closest(".tanda-summary") ||
        target.classList.contains("tanda-style-badge")
      ) {
        if (row) {
          deps.actions.toggleTandaRow(row);
        }
        return;
      }
      const editTrackId = target
        .closest<HTMLElement>(".tanda-detail-line")
        ?.dataset.trackId;
      const editAction =
        (target.closest("button[data-action]") as HTMLButtonElement | null)
          ?.dataset.action ?? null;
      if (editAction === "detail-menu") {
        toggleDetailMenu(target, deps.actions.closeDetailMenus);
        return;
      }
      if (editAction === "edit-track" && editTrackId) {
        deps.actions.openTrackEditor(editTrackId);
        deps.actions.closeRowMenus();
        return;
      }
      if (editAction === "search-track" && editTrackId) {
        const track = deps.readers.getTrackFromCache(editTrackId);
        if (track) {
          deps.actions.runSearchForTrack(track);
        }
        deps.actions.closeRowMenus();
        return;
      }
      if (editAction === "headphone" && deps.readers.isHeadphoneAvailable() && editTrackId) {
        const track = deps.readers.getTrackFromCache(editTrackId);
        if (track) {
          await deps.actions.playOnChannel(
            "headphone",
            track.full_path,
            track.id,
            track,
            track.gain_db ?? null,
          );
        }
        deps.actions.closeRowMenus();
        return;
      }
      if (editTrackId) {
        const track = deps.readers.getTrackFromCache(editTrackId);
        if (track) {
          await deps.actions.playTrackForMode(track, {
            filePath: track.full_path,
            trackId: track.id,
            gainDb: track.gain_db ?? null,
          });
        }
        return;
      }
      const action =
        (target.closest("button[data-action]") as HTMLButtonElement | null)
          ?.dataset.action ?? null;
      if (action === "tanda-toggle" && row) {
        deps.actions.toggleTandaRow(row);
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "tanda-edit") {
        const source = deps.readers.getClipboardTandas().find((item) => item.id === tandaId) ?? null;
        deps.actions.openTandaInDesigner(tandaId, source, "playlist-tab");
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "search-tanda") {
        const tanda = deps.readers.resolveTandaForSearch(tandaId);
        if (tanda) {
          deps.actions.runSearchForTanda(tanda);
        }
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "row-menu") {
        deps.actions.toggleRowMenu(row);
        return;
      }
      if (action === "add-playlist-tanda") {
        const found = deps.readers.getClipboardTandas().find((item) => item.id === tandaId) ?? null;
        deps.actions.addTandaToPlaylist(tandaId, found);
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "move-clip-tanda-collection") {
        const targets = deps.readers.getClipboardMoveTargets(deps.readers.getActiveCollectionId());
        if (targets.length === 0) {
          deps.actions.closeRowMenus();
          return;
        }
        if (targets.length === 1) {
          deps.actions.moveTandaBetweenClipboardCollections(tandaId, targets[0].id);
          deps.actions.closeRowMenus();
          return;
        }
        const actionButton = target.closest<HTMLButtonElement>(
          'button[data-action="move-clip-tanda-collection"]',
        );
        if (actionButton) {
          const rect = actionButton.getBoundingClientRect();
          deps.actions.openTandaMoveTargetMenu(rect.left, rect.bottom + 4, tandaId, targets);
        } else {
          deps.actions.openTandaMoveTargetMenu(event.clientX, event.clientY, tandaId, targets);
        }
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "remove-clip-tanda") {
        deps.actions.removeClipboardTanda(tandaId);
        deps.actions.renderClipboard();
        deps.actions.closeRowMenus();
        return;
      }
      const found = deps.readers.getClipboardTandas().find((item) => item.id === tandaId);
      if (!found) {
        return;
      }
      deps.actions.setSelectedClipboardTandaId(tandaId);
      deps.actions.setSelectedClipboardTrackId(null);
      deps.actions.renderClipboard();
    });

    deps.elements.searchTracksEl?.addEventListener("click", async (event) => {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLElement>(".list-row");
      if (!row) {
        return;
      }
      if (deps.actions.handleDuplicateJump(target)) {
        return;
      }
      const data = deps.readers.getTrackDataFromRow(row);
      if (!data) {
        return;
      }
      const track = deps.readers.getTrackById(data.trackId);
      if (!track) {
        return;
      }
      const action =
        (target.closest("button[data-action]") as HTMLButtonElement | null)
          ?.dataset.action ?? null;
      if (action === "edit-track") {
        deps.actions.openTrackEditor(data.trackId);
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "search-track") {
        deps.actions.runSearchForTrack(track);
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "headphone" && deps.readers.isHeadphoneAvailable()) {
        await deps.actions.playOnChannel(
          "headphone",
          data.filePath,
          data.trackId,
          track,
          data.gainDb,
        );
        deps.actions.updateHeadphoneButtonIndicators();
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "row-menu") {
        deps.actions.toggleRowMenu(row);
        return;
      }
      if (action === "add-clip") {
        deps.actions.addTrackToClipboard(track);
        deps.actions.activateClipboardTab("clip-tracks");
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "add-playlist-track") {
        deps.actions.appendTrackToPlaylist(track);
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "add-tanda") {
        const added = deps.actions.addTrackToActiveTanda(track);
        if (!added) {
          deps.actions.setStatusNoTandaSelected();
        }
        deps.actions.closeRowMenus();
        return;
      }
      await deps.actions.playTrackForMode(track, data);
    });

    deps.elements.searchTandasEl?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLElement>(".list-row");
      if (!row) {
        return;
      }
      if (deps.actions.handleDuplicateJump(target)) {
        return;
      }
      if (
        target.closest(".tanda-summary") ||
        target.classList.contains("tanda-style-badge")
      ) {
        deps.actions.toggleTandaRow(row);
        return;
      }
      const editTrackId = target
        .closest<HTMLElement>(".tanda-detail-line")
        ?.dataset.trackId;
      const editAction =
        (target.closest("button[data-action]") as HTMLButtonElement | null)
          ?.dataset.action ?? null;
      if (editAction === "detail-menu") {
        toggleDetailMenu(target, deps.actions.closeDetailMenus);
        return;
      }
      if (editAction === "edit-track" && editTrackId) {
        deps.actions.openTrackEditor(editTrackId);
        return;
      }
      if (editAction === "search-track" && editTrackId) {
        const track = deps.readers.getTrackFromCache(editTrackId);
        if (track) {
          deps.actions.runSearchForTrack(track);
        }
        return;
      }
      if (editAction === "add-clip-track-from-tanda" && editTrackId) {
        const track = deps.readers.getTrackFromCache(editTrackId);
        if (track) {
          deps.actions.addTrackToClipboard(track);
          deps.actions.activateClipboardTab("clip-tracks");
        }
        deps.actions.closeRowMenus();
        return;
      }
      if (editAction === "headphone" && deps.readers.isHeadphoneAvailable() && editTrackId) {
        const track = deps.readers.getTrackFromCache(editTrackId);
        if (track) {
          void deps.actions.playOnChannel(
            "headphone",
            track.full_path,
            track.id,
            track,
            track.gain_db ?? null,
          );
        }
        return;
      }
      if (editTrackId && deps.readers.getAppMode() !== "live") {
        const track = deps.readers.getTrackFromCache(editTrackId);
        if (track) {
          void deps.actions.playOnChannel(
            "main",
            track.full_path,
            track.id,
            track,
            track.gain_db ?? null,
          ).then((started) => {
            if (started && deps.readers.isTrackEditorOpen()) {
              deps.actions.openTrackEditor(track.id);
            }
          });
        }
        return;
      }
      const tandaId = row.dataset.tandaId;
      if (!tandaId) {
        return;
      }
      const action =
        (target.closest("button[data-action]") as HTMLButtonElement | null)
          ?.dataset.action ?? null;
      if (action === "tanda-edit") {
        const source = deps.readers.resolveTandaForSearch(tandaId);
        deps.actions.openTandaInDesigner(tandaId, source);
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "search-tanda") {
        const tanda = deps.readers.resolveTandaForSearch(tandaId);
        if (tanda) {
          deps.actions.runSearchForTanda(tanda);
        }
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "add-clip-tanda") {
        deps.actions.addTandaToClipboard(tandaId);
        deps.actions.activateClipboardTab("clip-tandas");
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "add-playlist-tanda") {
        const source = deps.readers.resolveTandaForSearch(tandaId);
        deps.actions.addTandaToPlaylist(tandaId, source);
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "row-menu") {
        deps.actions.toggleRowMenu(row);
      }
    });

    deps.elements.clipTracksEl?.addEventListener("click", async (event) => {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLElement>(".list-row");
      if (!row) {
        return;
      }
      if (deps.actions.handleDuplicateJump(target)) {
        return;
      }
      const data = deps.readers.getTrackDataFromRow(row);
      if (!data) {
        return;
      }
      const clipTrack = deps.readers.getTrackById(data.trackId);
      if (!clipTrack) {
        return;
      }
      const action =
        (target.closest("button[data-action]") as HTMLButtonElement | null)
          ?.dataset.action ?? null;
      if (action === "edit-track") {
        deps.actions.openTrackEditor(data.trackId);
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "search-track") {
        deps.actions.runSearchForTrack(clipTrack);
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "headphone" && deps.readers.isHeadphoneAvailable()) {
        await deps.actions.playOnChannel(
          "headphone",
          data.filePath,
          data.trackId,
          clipTrack,
          data.gainDb,
        );
        deps.actions.updateHeadphoneButtonIndicators();
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "row-menu") {
        deps.actions.toggleRowMenu(row);
        return;
      }
      if (action === "add-tanda") {
        const added = deps.actions.addTrackToActiveTanda(clipTrack);
        if (!added) {
          deps.actions.setStatusNoTandaSelected();
        }
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "add-playlist-track") {
        deps.actions.appendTrackToPlaylist(clipTrack);
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "move-clip-track-collection") {
        const targets = deps.readers.getClipboardMoveTargets(deps.readers.getActiveCollectionId());
        if (targets.length === 0) {
          deps.actions.closeRowMenus();
          return;
        }
        if (targets.length === 1) {
          deps.actions.moveTrackBetweenClipboardCollections(clipTrack.id, targets[0].id);
          deps.actions.closeRowMenus();
          return;
        }
        const actionButton = target.closest<HTMLButtonElement>(
          'button[data-action="move-clip-track-collection"]',
        );
        if (actionButton) {
          const rect = actionButton.getBoundingClientRect();
          deps.actions.openTrackMoveTargetMenu(rect.left, rect.bottom + 4, clipTrack.id, targets);
        } else {
          deps.actions.openTrackMoveTargetMenu(event.clientX, event.clientY, clipTrack.id, targets);
        }
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "remove-clip") {
        deps.actions.removeClipboardTrack(clipTrack.id);
        deps.actions.renderClipboard();
        deps.actions.closeRowMenus();
        return;
      }
      const index = deps.readers.getClipboardTracks().findIndex((item) => item.id === data.trackId);
      if (index >= 0) {
        deps.actions.setSelectedClipboardTrackId(data.trackId);
        deps.actions.setSelectedClipboardTandaId(null);
        deps.actions.renderClipboard();
      }
      await deps.actions.playTrackForMode(clipTrack, data);
    });
  };

  return {
    initialize,
  };
};
