import type {
  PlaylistItem,
  PlaylistRule,
  RendererTrack,
  RightPanelTab,
  TandaDraft,
  TandaSlotValidation,
} from "../domain.js";
import { toggleDetailMenu } from "../modules/row-menu.js";

type TrackData = {
  filePath: string;
  trackId: string;
  gainDb: number | null;
};

type ActiveCollection = {
  trackIds: string[];
  tandaIds: string[];
};

type PlaylistInteractionsElements = {
  playlistPanel?: HTMLElement | null;
  playlistListEl?: HTMLElement | null;
  addTandaBtn?: HTMLElement | null;
  generateTandaBtn?: HTMLElement | null;
};

export type PlaylistInteractionsControllerDeps = {
  elements: PlaylistInteractionsElements;
  readers: {
    getHeadphoneAvailable: () => boolean;
    getTrackDataFromRow: (row: HTMLElement) => TrackData | null;
    getTrackFromCache: (trackId: string) => RendererTrack | null;
    getTrackById: (trackId: string) => RendererTrack | null;
    resolveTandaForSearch: (tandaId: string) => TandaDraft | null;
    resolvePlaylistRowIndex: (row: HTMLElement) => number;
    resolveSearchStylesForPlaylistIndex: (index: number) => string[] | undefined;
    isCortinaIndexEditable: (index: number | null) => boolean;
    isPlaylistIndexLocked: (index: number) => boolean;
    isPlaylistTandaSlotLocked: (index: number, slotIndex: number) => boolean;
    getPlaylistTargetIndex: () => number | null;
    getPlaylistTrackTargetIndex: () => number | null;
    getPlaylistItems: () => Array<PlaylistItem | null>;
    getPlaylistOpenTandaIndex: () => number | null;
    getRuleForSlot: (index: number) => PlaylistRule | null;
    getPlaylistStyleMap: () => Record<string, string[]>;
    getSelectedTandaId: () => string | null;
    getSelectedClipboardTandaId: () => string | null;
    getSelectedClipboardTrackId: () => string | null;
    getClipboardTandas: () => TandaDraft[];
    getClipboardTracks: () => RendererTrack[];
    getActiveCollection: () => ActiveCollection | null;
    getAppMode: () => string;
    isMainPlaying: () => boolean;
    shouldStartPlaylistFromClick: (appMode: string, isMainPlaying: boolean) => boolean;
    resolveTandaDraft: (tandaId: string) => TandaDraft | null;
  };
  actions: {
    handleDropToPlaylist: (event: DragEvent) => void;
    createEmptyTanda: () => TandaDraft;
    appendTandaDraft: (draft: TandaDraft) => TandaDraft;
    generateDesignerTanda: () => Promise<void>;
    setActiveTanda: (tandaId: string) => void;
    openCortinaModal: (index: number | null) => void;
    toggleTandaRow: (row: HTMLElement) => void;
    closeDetailMenus: () => void;
    closeRowMenus: () => void;
    openTrackEditor: (trackId: string) => void;
    playOnChannel: (
      channel: "main" | "headphone",
      filePath: string,
      trackId: string,
      track: RendererTrack,
      gainDb: number | null,
    ) => Promise<unknown>;
    runSearchForTanda: (tanda: TandaDraft, preferredStyles?: string[]) => void;
    runSearchForTrack: (track: RendererTrack, preferredStyles?: string[]) => void;
    toggleRowMenu: (row: HTMLElement) => void;
    clearPlaylistTarget: () => void;
    retainPlaylistTargetAtIndex: (index: number) => number | null;
    retainPlaylistTrackTargetAtIndex: (index: number) => number | null;
    applyPlaylistTargetStyles: (index: number) => void;
    setPlaylistTargetIndex: (index: number | null) => void;
    setCenterPlaylistTargetOnNextRender: (value: boolean) => void;
    renderPlaylist: () => void;
    setStatusPlaylistLocked: () => void;
    setStatusPlaylistSwapInvalid: () => void;
    setStatusClipboardReadonlyRemove: () => void;
    setStatusCortinaLocked: () => void;
    markPlaylistPulse: (index: number) => void;
    validateTandaForSlot: (tanda: TandaDraft, slotIndex: number) => TandaSlotValidation;
    confirmPlaylistCountOverride: (
      ruleLabel: string,
      expected: number,
      count: number,
      onConfirm: () => void,
    ) => void;
    confirmPlaylistStyleOverride: (
      ruleLabel: string,
      tandaLabel: string,
      onConfirm: () => void,
    ) => void;
    setPlaylistItem: (index: number, item: PlaylistItem | null) => void;
    setPlaylistOpenTandaIndex: (index: number | null) => void;
    ensurePlaylistEditableTanda: (tandaId: string, index: number) => TandaDraft | null;
    createPlaceholderTanda: (tandaId: string) => TandaDraft;
    openTandaInDesigner: (tandaId: string, source: TandaDraft | null, hostTab?: RightPanelTab) => void;
    addTandaToActiveCollection: (tandaId: string) => boolean;
    addTrackToActiveCollection: (track: RendererTrack) => boolean;
    normalizePlaylist: () => void;
    renderClipboard: () => void;
    setSelectedStylesFromRule: (styles: string[]) => void;
    createPlaylistTandaForSlot: (index: number) => TandaDraft;
    ensureTandaDraft: (tanda: TandaDraft) => void;
    startPlaylistFrom: (index: number, trackId: string | null) => void;
    setSelectedClipboardTandaId: (tandaId: string | null) => void;
    setSelectedClipboardTrackId: (trackId: string | null) => void;
    saveClipboardCollections: () => void;
    placeTandaInPlaylistSlot: (tandaId: string, index: number) => boolean;
    playTrackForMode: (track: RendererTrack, data: TrackData) => Promise<unknown>;
    refreshPlaylistTandaStyles: (tanda: TandaDraft) => void;
    setTrackInCache: (track: RendererTrack) => void;
    updateHeadphoneButtonIndicators: () => void;
    getSequenceLabel: (rule: PlaylistRule) => string;
    getTandaSequenceLabel: (tanda: TandaDraft) => string;
  };
};

const getAction = (target: HTMLElement) =>
  (target.closest("button[data-action]") as HTMLButtonElement | null)?.dataset.action ?? null;

export const createPlaylistInteractionsController = (
  deps: PlaylistInteractionsControllerDeps,
) => {
  const handleSwapPlaylistTarget = (
    index: number,
    targetIndex: number,
    options?: { allowStyleMismatch?: boolean; allowCountMismatch?: boolean },
  ) => {
    const playlistItems = deps.readers.getPlaylistItems();
    const currentItem = playlistItems[index];
    const targetItem = playlistItems[targetIndex];
    if (!currentItem || !targetItem) {
      deps.actions.setStatusPlaylistSwapInvalid();
      return;
    }
    if (currentItem.kind !== "tanda" || targetItem.kind !== "tanda") {
      deps.actions.setStatusPlaylistSwapInvalid();
      return;
    }
    const currentTanda = deps.readers.resolveTandaDraft(currentItem.tandaId);
    const targetTanda = deps.readers.resolveTandaDraft(targetItem.tandaId);
    if (!currentTanda || !targetTanda) {
      deps.actions.setStatusPlaylistSwapInvalid();
      return;
    }
    const currentValidation = deps.actions.validateTandaForSlot(currentTanda, targetIndex);
    const targetValidation = deps.actions.validateTandaForSlot(targetTanda, index);
    const countIssue =
      currentValidation.reason === "count" || targetValidation.reason === "count";
    if (countIssue && !options?.allowCountMismatch) {
      const ruleForCount = currentValidation.rule ?? targetValidation.rule;
      deps.actions.confirmPlaylistCountOverride(
        ruleForCount ? deps.actions.getSequenceLabel(ruleForCount) : "?",
        ruleForCount?.count ?? 0,
        currentValidation.trackCount ?? targetValidation.trackCount ?? 0,
        () => {
          handleSwapPlaylistTarget(index, targetIndex, {
            ...options,
            allowCountMismatch: true,
          });
        },
      );
      return;
    }
    const styleIssue =
      currentValidation.reason === "style" || targetValidation.reason === "style";
    if (styleIssue && !options?.allowStyleMismatch) {
      const ruleForStyle = currentValidation.rule ?? targetValidation.rule;
      deps.actions.confirmPlaylistStyleOverride(
        ruleForStyle ? deps.actions.getSequenceLabel(ruleForStyle) : "?",
        deps.actions.getTandaSequenceLabel(currentTanda),
        () => {
          handleSwapPlaylistTarget(index, targetIndex, {
            ...options,
            allowStyleMismatch: true,
          });
        },
      );
      return;
    }
    const currentMismatch =
      currentValidation.reason === "style"
        ? "style"
        : currentValidation.reason === "count"
          ? "count"
          : undefined;
    const targetMismatch =
      targetValidation.reason === "style"
        ? "style"
        : targetValidation.reason === "count"
          ? "count"
          : undefined;
    deps.actions.setPlaylistItem(index, { ...targetItem, mismatch: targetMismatch });
    deps.actions.setPlaylistItem(targetIndex, { ...currentItem, mismatch: currentMismatch });
    const openIndex = deps.readers.getPlaylistOpenTandaIndex();
    if (openIndex === index) {
      deps.actions.setPlaylistOpenTandaIndex(targetIndex);
    } else if (openIndex === targetIndex) {
      deps.actions.setPlaylistOpenTandaIndex(index);
    }
    deps.actions.retainPlaylistTargetAtIndex(targetIndex);
    deps.actions.setCenterPlaylistTargetOnNextRender(true);
    deps.actions.markPlaylistPulse(index);
    deps.actions.markPlaylistPulse(targetIndex);
    deps.actions.renderPlaylist();
    deps.actions.closeRowMenus();
  };

  const initialize = () => {
    deps.elements.playlistPanel?.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    deps.elements.playlistPanel?.addEventListener("drop", (event) => {
      deps.actions.handleDropToPlaylist(event as DragEvent);
    });

    deps.elements.addTandaBtn?.addEventListener("click", () => {
      const draft = deps.actions.createEmptyTanda();
      const activeDraft = deps.actions.appendTandaDraft(draft);
      deps.actions.setActiveTanda(activeDraft.id);
    });
    deps.elements.generateTandaBtn?.addEventListener("click", async () => {
      await deps.actions.generateDesignerTanda();
    });

    deps.elements.playlistListEl?.addEventListener("click", async (event) => {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLElement>(".list-row");
      if (!row) {
        return;
      }
      if (target.closest("#playlist-tanda-editor")) {
        return;
      }
      if (row.classList.contains("cortina-row")) {
        const action = getAction(target);
        if (action === "headphone" && deps.readers.getHeadphoneAvailable()) {
          const data = deps.readers.getTrackDataFromRow(row);
          if (data) {
            const track = deps.readers.getTrackById(data.trackId);
            if (track) {
              await deps.actions.playOnChannel(
                "headphone",
                data.filePath,
                data.trackId,
                track,
                data.gainDb,
              );
            }
          }
          return;
        }
        const index = row.dataset.cortinaIndex
          ? Number.parseInt(row.dataset.cortinaIndex, 10)
          : null;
        if (!deps.readers.isCortinaIndexEditable(index)) {
          deps.actions.setStatusCortinaLocked();
          return;
        }
        deps.actions.openCortinaModal(Number.isNaN(index ?? NaN) ? null : index);
        return;
      }
      if (
        target.closest(".tanda-summary") ||
        target.classList.contains("tanda-style-badge")
      ) {
        deps.actions.toggleTandaRow(row);
        return;
      }
      const detailAction = getAction(target);
      if (detailAction === "detail-menu") {
        toggleDetailMenu(target, deps.actions.closeDetailMenus);
        return;
      }
      const action = getAction(target);
      if (action === "edit-track") {
        const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
        const trackId = detailLine?.dataset.trackId ?? row.dataset.trackId;
        if (trackId) {
          deps.actions.openTrackEditor(trackId);
        }
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "headphone" && deps.readers.getHeadphoneAvailable()) {
        const detailTrackId =
          target.closest<HTMLElement>(".tanda-detail-line")?.dataset.trackId ?? null;
        if (detailTrackId) {
          const track = deps.readers.getTrackFromCache(detailTrackId);
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
      }
      if (action === "search-tanda") {
        const tandaId = row.dataset.tandaId;
        if (tandaId) {
          const tanda = deps.readers.resolveTandaForSearch(tandaId);
          if (tanda) {
            const playlistIndex = deps.readers.resolvePlaylistRowIndex(row);
            const preferredStyles =
              playlistIndex >= 0
                ? deps.readers.resolveSearchStylesForPlaylistIndex(playlistIndex)
                : undefined;
            deps.actions.runSearchForTanda(tanda, preferredStyles);
          }
        }
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "search-track") {
        const detailTrackId =
          target.closest<HTMLElement>(".tanda-detail-line")?.dataset.trackId ?? null;
        const playlistIndex = deps.readers.resolvePlaylistRowIndex(row);
        const data = deps.readers.getTrackDataFromRow(row);
        const track = detailTrackId
          ? deps.readers.getTrackFromCache(detailTrackId) ?? deps.readers.getTrackById(detailTrackId)
          : data
            ? deps.readers.getTrackById(data.trackId)
            : null;
        if (track) {
          const preferredStyles =
            playlistIndex >= 0
              ? deps.readers.resolveSearchStylesForPlaylistIndex(playlistIndex)
              : undefined;
          deps.actions.runSearchForTrack(track, preferredStyles);
        }
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "row-menu") {
        deps.actions.toggleRowMenu(row);
        return;
      }
      if (action === "playlist-target-cancel") {
        deps.actions.clearPlaylistTarget();
        deps.actions.renderPlaylist();
        return;
      }
      if (action === "tanda-toggle") {
        deps.actions.toggleTandaRow(row);
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "mark-playlist-target" || action === "mark-playlist-track-target") {
        const index = deps.readers.resolvePlaylistRowIndex(row);
        if (index < 0) {
          if (action === "mark-playlist-target") {
            deps.actions.setStatusPlaylistSwapInvalid();
          }
          return;
        }
        if (deps.readers.isPlaylistIndexLocked(index)) {
          deps.actions.setStatusPlaylistLocked();
          return;
        }
        const currentTargetIndex =
          action === "mark-playlist-target"
            ? deps.readers.getPlaylistTargetIndex()
            : deps.readers.getPlaylistTrackTargetIndex();
        if (currentTargetIndex === index) {
          deps.actions.clearPlaylistTarget();
        } else {
          const retained =
            action === "mark-playlist-target"
              ? deps.actions.retainPlaylistTargetAtIndex(index)
              : deps.actions.retainPlaylistTrackTargetAtIndex(index);
          if (retained !== null) {
            deps.actions.applyPlaylistTargetStyles(index);
            deps.actions.setCenterPlaylistTargetOnNextRender(true);
          }
        }
        deps.actions.renderPlaylist();
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "swap-playlist-target") {
        const index = deps.readers.resolvePlaylistRowIndex(row);
        const targetIndex = deps.readers.getPlaylistTargetIndex();
        if (index < 0 || targetIndex === null || targetIndex === index) {
          deps.actions.setStatusPlaylistSwapInvalid();
          return;
        }
        if (
          deps.readers.isPlaylistIndexLocked(index) ||
          deps.readers.isPlaylistIndexLocked(targetIndex)
        ) {
          deps.actions.setStatusPlaylistLocked();
          return;
        }
        handleSwapPlaylistTarget(index, targetIndex);
        return;
      }
      if (action === "tanda-edit") {
        const tandaId = row.dataset.tandaId;
        if (!tandaId) {
          return;
        }
        const index = row.dataset.index ? Number.parseInt(row.dataset.index, 10) : -1;
        if (index >= 0 && deps.readers.isPlaylistIndexLocked(index)) {
          deps.actions.setStatusPlaylistLocked();
          return;
        }
        const source =
          index >= 0
            ? deps.actions.ensurePlaylistEditableTanda(tandaId, index)
            : deps.readers.resolveTandaDraft(tandaId) ?? deps.actions.createPlaceholderTanda(tandaId);
        if (!source) {
          return;
        }
        if (index >= 0) {
          deps.actions.setPlaylistOpenTandaIndex(index);
        }
        deps.actions.openTandaInDesigner(source.id, source, "playlist-tab");
        deps.actions.closeRowMenus();
        return;
      }
      const data = deps.readers.getTrackDataFromRow(row);
      if (action === "headphone" && deps.readers.getHeadphoneAvailable() && data) {
        const playlistTrack = deps.readers.getTrackById(data.trackId);
        if (!playlistTrack) return;
        await deps.actions.playOnChannel(
          "headphone",
          data.filePath,
          data.trackId,
          playlistTrack,
          data.gainDb,
        );
        deps.actions.updateHeadphoneButtonIndicators();
        deps.actions.closeRowMenus();
        return;
      }
      const index = row.dataset.index ? Number.parseInt(row.dataset.index, 10) : -1;
      const isLocked = index >= 0 ? deps.readers.isPlaylistIndexLocked(index) : false;
      if (index < 0) {
        return;
      }
      const playlistItem = deps.readers.getPlaylistItems()[index] ?? null;
      if (!playlistItem) {
        if (isLocked) {
          deps.actions.setStatusPlaylistLocked();
          return;
        }
        const rule = deps.readers.getRuleForSlot(index);
        if (rule?.code) {
          deps.actions.setSelectedStylesFromRule(
            deps.readers.getPlaylistStyleMap()[rule.code] ?? [],
          );
        }
        const tanda = deps.actions.createPlaylistTandaForSlot(index);
        deps.actions.ensureTandaDraft(tanda);
        deps.actions.setPlaylistItem(index, { kind: "tanda", tandaId: tanda.id });
        deps.actions.normalizePlaylist();
        deps.actions.setPlaylistOpenTandaIndex(index);
        deps.actions.openTandaInDesigner(tanda.id, tanda, "playlist-tab");
        deps.actions.markPlaylistPulse(index);
        deps.actions.renderPlaylist();
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "remove-playlist-tanda" || action === "send-playlist-tanda") {
        if (isLocked) {
          deps.actions.setStatusPlaylistLocked();
          return;
        }
        const tandaId = row.dataset.tandaId;
        if (!tandaId) {
          return;
        }
        if (!deps.actions.addTandaToActiveCollection(tandaId)) {
          deps.actions.closeRowMenus();
          return;
        }
        deps.actions.setPlaylistItem(index, null);
        deps.actions.normalizePlaylist();
        deps.actions.renderPlaylist();
        deps.actions.renderClipboard();
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "send-playlist-track") {
        if (isLocked) {
          deps.actions.setStatusPlaylistLocked();
          return;
        }
        if (!data) {
          return;
        }
        const track = deps.readers.getTrackById(data.trackId);
        if (!track) {
          return;
        }
        if (!deps.actions.addTrackToActiveCollection(track)) {
          deps.actions.closeRowMenus();
          return;
        }
        deps.actions.setPlaylistItem(index, null);
        deps.actions.retainPlaylistTrackTargetAtIndex(index);
        deps.actions.normalizePlaylist();
        deps.actions.renderPlaylist();
        deps.actions.renderClipboard();
        deps.actions.closeRowMenus();
        return;
      }
      if (action === "send-playlist-tanda-track") {
        const tandaId = row.dataset.tandaId;
        if (!tandaId) {
          return;
        }
        const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
        const slotIndex = detailLine?.dataset.slotIndex
          ? Number.parseInt(detailLine.dataset.slotIndex, 10)
          : -1;
        if (slotIndex < 0) {
          return;
        }
        if (deps.readers.isPlaylistTandaSlotLocked(index, slotIndex)) {
          deps.actions.setStatusPlaylistLocked();
          return;
        }
        const tanda =
          index >= 0
            ? deps.actions.ensurePlaylistEditableTanda(tandaId, index)
            : deps.readers.resolveTandaDraft(tandaId);
        if (!tanda) {
          return;
        }
        const trackId = tanda.trackSlots[slotIndex];
        if (trackId) {
          const track = deps.readers.getTrackFromCache(trackId);
          if (track && !deps.actions.addTrackToActiveCollection(track)) {
            deps.actions.closeRowMenus();
            return;
          }
        }
        tanda.trackSlots[slotIndex] = null;
        deps.actions.refreshPlaylistTandaStyles(tanda);
        if (index >= 0) {
          deps.actions.setPlaylistTargetIndex(index);
          deps.actions.setPlaylistOpenTandaIndex(index);
          deps.actions.applyPlaylistTargetStyles(index);
          deps.actions.openTandaInDesigner(tanda.id, tanda, "playlist-tab");
        }
        deps.actions.renderPlaylist();
        deps.actions.renderClipboard();
        deps.actions.closeRowMenus();
        return;
      }
      const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
      const detailTrackId = detailLine?.dataset.trackId ?? null;
      const appMode = deps.readers.getAppMode();
      if (appMode === "prep") {
        if (detailTrackId) {
          deps.actions.startPlaylistFrom(index, detailTrackId);
          return;
        }
        if (playlistItem?.kind === "track" && data) {
          deps.actions.startPlaylistFrom(index, data.trackId);
          return;
        }
      }
      const selectedClipboardTandaId = deps.readers.getSelectedClipboardTandaId();
      if (selectedClipboardTandaId && !detailLine) {
        if (isLocked) {
          deps.actions.setStatusPlaylistLocked();
          return;
        }
        const activeCollection = deps.readers.getActiveCollection();
        if (!activeCollection?.tandaIds.includes(selectedClipboardTandaId)) {
          deps.actions.setStatusClipboardReadonlyRemove();
          return;
        }
        const selectedTanda =
          deps.readers.getClipboardTandas().find((item) => item.id === selectedClipboardTandaId) ??
          null;
        if (!selectedTanda) {
          deps.actions.setSelectedClipboardTandaId(null);
          deps.actions.renderClipboard();
          return;
        }
        deps.actions.ensureTandaDraft(selectedTanda);
        const replaced = deps.readers.getPlaylistItems()[index] ?? null;
        const placed = deps.actions.placeTandaInPlaylistSlot(selectedTanda.id, index);
        if (!placed) {
          return;
        }
        if (replaced?.kind === "tanda") {
          if (!activeCollection.tandaIds.includes(replaced.tandaId)) {
            activeCollection.tandaIds.push(replaced.tandaId);
          }
        } else if (replaced?.kind === "track") {
          if (!activeCollection.trackIds.includes(replaced.track.id)) {
            activeCollection.trackIds.push(replaced.track.id);
          }
        } else {
          activeCollection.tandaIds = activeCollection.tandaIds.filter(
            (id) => id !== selectedTanda.id,
          );
        }
        deps.actions.setSelectedClipboardTandaId(null);
        deps.actions.saveClipboardCollections();
        deps.actions.renderClipboard();
        deps.actions.renderPlaylist();
        return;
      }
      if (appMode === "edit") {
        if (detailTrackId) {
          const track = deps.readers.getTrackFromCache(detailTrackId);
          if (track) {
            await deps.actions.playTrackForMode(track, {
              filePath: track.full_path,
              trackId: track.id,
              gainDb: track.gain_db ?? null,
            });
          }
          return;
        }
        if (playlistItem?.kind === "track" && data) {
          await deps.actions.playTrackForMode(playlistItem.track, data);
          return;
        }
      }
      const selectedClipboardTrackId = deps.readers.getSelectedClipboardTrackId();
      if (selectedClipboardTrackId && detailLine && playlistItem?.kind === "tanda") {
        const slotIndex = detailLine.dataset.slotIndex
          ? Number.parseInt(detailLine.dataset.slotIndex, 10)
          : -1;
        if (!Number.isFinite(slotIndex) || slotIndex < 0) {
          return;
        }
        if (deps.readers.isPlaylistTandaSlotLocked(index, slotIndex)) {
          deps.actions.setStatusPlaylistLocked();
          return;
        }
        const activeCollection = deps.readers.getActiveCollection();
        const clipTrack =
          deps.readers.getClipboardTracks().find((track) => track.id === selectedClipboardTrackId) ??
          null;
        if (!clipTrack || !activeCollection?.trackIds.includes(clipTrack.id)) {
          deps.actions.setStatusClipboardReadonlyRemove();
          return;
        }
        const tanda = deps.actions.ensurePlaylistEditableTanda(playlistItem.tandaId, index);
        if (!tanda || slotIndex >= tanda.trackSlots.length) {
          return;
        }
        const replacedTrackId = tanda.trackSlots[slotIndex] ?? null;
        tanda.trackSlots[slotIndex] = clipTrack.id;
        deps.actions.refreshPlaylistTandaStyles(tanda);
        const selectedIndex = activeCollection.trackIds.indexOf(clipTrack.id);
        if (selectedIndex >= 0) {
          if (replacedTrackId && !activeCollection.trackIds.includes(replacedTrackId)) {
            activeCollection.trackIds[selectedIndex] = replacedTrackId;
          } else {
            activeCollection.trackIds = activeCollection.trackIds.filter(
              (id) => id !== clipTrack.id,
            );
          }
        }
        deps.actions.setTrackInCache(clipTrack);
        deps.actions.setSelectedClipboardTrackId(null);
        deps.actions.saveClipboardCollections();
        deps.actions.markPlaylistPulse(index);
        deps.actions.renderClipboard();
        deps.actions.renderPlaylist();
        return;
      }
      if (!selectedClipboardTrackId || detailLine) {
        if (!deps.readers.shouldStartPlaylistFromClick(appMode, deps.readers.isMainPlaying())) {
          return;
        }
        deps.actions.startPlaylistFrom(index, detailTrackId);
        return;
      }
      if (isLocked) {
        deps.actions.setStatusPlaylistLocked();
        return;
      }
      const clipTrack =
        deps.readers.getClipboardTracks().find((track) => track.id === selectedClipboardTrackId) ??
        null;
      if (!clipTrack || playlistItem?.kind === "tanda") {
        return;
      }
      const activeCollection = deps.readers.getActiveCollection();
      if (!activeCollection || !activeCollection.trackIds.includes(clipTrack.id)) {
        deps.actions.setStatusClipboardReadonlyRemove();
        return;
      }
      const selectedIndex = activeCollection.trackIds.indexOf(clipTrack.id);
      if (playlistItem?.kind === "track") {
        if (activeCollection.trackIds.includes(playlistItem.track.id)) {
          activeCollection.trackIds = activeCollection.trackIds.filter(
            (id) => id !== clipTrack.id,
          );
        } else if (selectedIndex >= 0) {
          activeCollection.trackIds[selectedIndex] = playlistItem.track.id;
        }
        deps.actions.setPlaylistItem(index, { kind: "track", track: clipTrack });
      } else {
        deps.actions.setPlaylistItem(index, { kind: "track", track: clipTrack });
        activeCollection.trackIds = activeCollection.trackIds.filter(
          (id) => id !== clipTrack.id,
        );
      }
      deps.actions.markPlaylistPulse(index);
      deps.actions.setSelectedClipboardTrackId(null);
      deps.actions.saveClipboardCollections();
      deps.actions.renderClipboard();
      deps.actions.renderPlaylist();
    });
  };

  return {
    initialize,
  };
};
