import type { TrackRow } from "../../shared/types.js";

type CortinaPickerElements = {
  modal: HTMLElement | null;
  closeButton: HTMLElement | null;
  setSelect: HTMLSelectElement | null;
  searchInput: HTMLInputElement | null;
  results: HTMLElement | null;
  addButton: HTMLButtonElement | null;
  replaceButton: HTMLButtonElement | null;
  removeButton: HTMLButtonElement | null;
  autofillButton: HTMLButtonElement | null;
};

export type CortinaPickerControllerDeps = {
  elements: CortinaPickerElements;
  anySetId: string;
  readers: {
    getAppMode: () => string;
    getConfiguredSet: () => string;
    getSets: () => string[];
    loadTracks: (setName: string) => Promise<TrackRow[]>;
    getRowTracks: (index: number) => TrackRow[];
    getEditableAutofillIndices: () => number[];
    isPositionEditable: (index: number | null, position: number, add?: boolean) => boolean;
    isHeadphoneAvailable: () => boolean;
  };
  actions: {
    resetModalPosition: (modal: HTMLElement) => void;
    buildHeadphoneButton: (trackId: string) => HTMLButtonElement;
    playHeadphone: (track: TrackRow) => Promise<void>;
    updateHeadphoneIndicators: () => void;
    setOverrideTracks: (index: number, tracks: TrackRow[]) => void;
    setStandaloneOverride: (track: TrackRow) => void;
    markPulse: (index: number) => void;
    renderPlaylist: () => void;
    setStatus: (message: string) => void;
    translate: (key: string, params?: Record<string, string | number>) => string;
    resolveTrackLabel: (track: TrackRow) => string;
    shuffleTracks: (tracks: TrackRow[]) => TrackRow[];
    logError: (message: string, error: unknown) => void;
  };
};

export const filterAndSortCortinaTracks = (tracks: TrackRow[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  return tracks.filter((track) => !normalizedQuery
    || (track.title?.toLowerCase() ?? "").includes(normalizedQuery)
    || (track.artist?.toLowerCase() ?? "").includes(normalizedQuery))
    .sort((a, b) => {
      const titleComparison = (a.title?.toLowerCase() ?? "")
        .localeCompare(b.title?.toLowerCase() ?? "");
      return titleComparison || (a.artist?.toLowerCase() ?? "")
        .localeCompare(b.artist?.toLowerCase() ?? "");
    });
};

export const createCortinaPickerController = (deps: CortinaPickerControllerDeps) => {
  const { elements } = deps;
  let targetIndex: number | null = null;
  let targetPosition = 0;
  let selectedTrack: TrackRow | null = null;
  let selectedSet: string | null = null;
  let autofillInProgress = false;

  const setVisible = (visible: boolean) => {
    if (!elements.modal) return;
    if (!visible || deps.readers.getAppMode() !== "edit") {
      deps.actions.resetModalPosition(elements.modal);
    }
    elements.modal.classList.toggle("open", visible);
    elements.modal.setAttribute("aria-hidden", visible ? "false" : "true");
    if (!visible) {
      targetIndex = null;
      selectedTrack = null;
    }
  };

  const updateActions = () => {
    const hasMember = targetIndex !== null
      && Boolean(deps.readers.getRowTracks(targetIndex)[targetPosition]);
    if (elements.addButton) {
      elements.addButton.disabled = !selectedTrack || targetIndex === null
        || !deps.readers.isPositionEditable(targetIndex, targetPosition, true);
    }
    if (elements.replaceButton) {
      elements.replaceButton.disabled = !selectedTrack || (targetIndex !== null && !hasMember)
        || !deps.readers.isPositionEditable(targetIndex, targetPosition);
    }
    if (elements.removeButton) {
      elements.removeButton.disabled = !hasMember
        || !deps.readers.isPositionEditable(targetIndex, targetPosition);
    }
    if (elements.autofillButton) {
      elements.autofillButton.disabled = autofillInProgress
        || !deps.readers.getEditableAutofillIndices().length;
    }
    elements.results?.querySelectorAll<HTMLElement>(".cortina-result").forEach((row) => {
      const selected = row.dataset.trackId === selectedTrack?.id;
      row.classList.toggle("selected", selected);
      row.setAttribute("aria-checked", String(selected));
    });
  };

  const loadSelectedSetTracks = async (deduplicateAnySet = true) => {
    const setName = selectedSet ?? elements.setSelect?.value ?? deps.readers.getConfiguredSet();
    if (!setName) return [];
    if (setName !== deps.anySetId) return deps.readers.loadTracks(setName);
    const seen = new Set<string>();
    const tracks: TrackRow[] = [];
    for (const set of deps.readers.getSets()) {
      for (const track of await deps.readers.loadTracks(set)) {
        if (!deduplicateAnySet || !seen.has(track.id)) {
          seen.add(track.id);
          tracks.push(track);
        }
      }
    }
    return tracks;
  };

  const renderResults = async () => {
    if (!elements.results) return;
    const tracks = await loadSelectedSetTracks();
    const filtered = filterAndSortCortinaTracks(
      tracks,
      elements.searchInput?.value ?? "",
    );
    elements.results.innerHTML = "";
    filtered.forEach((track) => {
      const row = document.createElement("div");
      row.className = "list-row track-row cortina-row cortina-result";
      row.dataset.trackId = track.id;
      row.dataset.filePath = track.full_path;
      row.tabIndex = 0;
      row.setAttribute("role", "radio");
      const details = document.createElement("div");
      details.className = "track-details";
      const primary = document.createElement("div");
      primary.className = "track-primary";
      const title = track.title?.trim() ?? "";
      const artist = track.artist?.trim() ?? "";
      primary.textContent = [title, artist].filter(Boolean).join(" / ")
        || track.relative_path || "";
      details.append(primary);
      const actions = document.createElement("div");
      actions.className = "row-actions";
      if (deps.readers.isHeadphoneAvailable()) {
        const headphone = deps.actions.buildHeadphoneButton(track.id);
        headphone.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          await deps.actions.playHeadphone(track);
          deps.actions.updateHeadphoneIndicators();
        });
        actions.appendChild(headphone);
      }
      row.append(details, actions);
      const select = () => {
        selectedTrack = track;
        updateActions();
      };
      row.addEventListener("click", (event) => {
        if (!(event.target as HTMLElement).closest("button")) select();
      });
      row.addEventListener("keydown", (event) => {
        if (event.target === row && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          select();
        }
      });
      elements.results?.appendChild(row);
    });
    updateActions();
  };

  const applySelection = (add: boolean) => {
    if (!selectedTrack || (add && targetIndex === null)) return;
    if (!deps.readers.isPositionEditable(targetIndex, targetPosition, add)) {
      deps.actions.setStatus(deps.actions.translate("statusCortinaLocked"));
      return;
    }
    if (targetIndex === null) {
      deps.actions.setStandaloneOverride(selectedTrack);
    } else {
      const tracks = [...deps.readers.getRowTracks(targetIndex)];
      if (!add && !tracks[targetPosition]) return;
      if (add) tracks.splice(Math.min(tracks.length, targetPosition + 1), 0, selectedTrack);
      else tracks.splice(targetPosition, 1, selectedTrack);
      deps.actions.setOverrideTracks(targetIndex, tracks);
      deps.actions.markPulse(targetIndex);
    }
    deps.actions.setStatus(deps.actions.translate("statusCortinaSelected", {
      title: deps.actions.resolveTrackLabel(selectedTrack),
    }));
    setVisible(false);
    deps.actions.renderPlaylist();
  };

  const open = (index: number | null, position = 0) => {
    if (!deps.readers.isPositionEditable(index, position, true)
      && !deps.readers.isPositionEditable(index, position)) {
      deps.actions.setStatus(deps.actions.translate("statusCortinaLocked"));
      return;
    }
    targetIndex = index;
    targetPosition = position;
    selectedTrack = index === null ? null : deps.readers.getRowTracks(index)[position] ?? null;
    selectedSet = deps.readers.getConfiguredSet() || deps.anySetId;
    if (elements.setSelect) elements.setSelect.value = selectedSet;
    if (elements.searchInput) elements.searchInput.value = "";
    updateActions();
    void renderResults();
    setVisible(true);
  };

  const autofill = async () => {
    if (autofillInProgress) return;
    autofillInProgress = true;
    updateActions();
    try {
      const tracks = await loadSelectedSetTracks(false);
      if (!tracks.length) {
        deps.actions.setStatus(deps.actions.translate("cortinaNone"));
        return;
      }
      let pool: TrackRow[] = [];
      for (const index of deps.readers.getEditableAutofillIndices()) {
        if (!pool.length) pool = deps.actions.shuffleTracks(tracks);
        deps.actions.setOverrideTracks(index, [pool.pop()!]);
        deps.actions.markPulse(index);
      }
      setVisible(false);
      deps.actions.renderPlaylist();
    } catch (error) {
      deps.actions.setStatus(deps.actions.translate("cortinaAutofillError"));
      deps.actions.logError("Cortina autofill failed", error);
    } finally {
      autofillInProgress = false;
      updateActions();
    }
  };

  const remove = () => {
    if (targetIndex === null) return;
    if (!deps.readers.isPositionEditable(targetIndex, targetPosition)) {
      deps.actions.setStatus(deps.actions.translate("statusCortinaLocked"));
      return;
    }
    const tracks = [...deps.readers.getRowTracks(targetIndex)];
    tracks.splice(targetPosition, 1);
    deps.actions.setOverrideTracks(targetIndex, tracks);
    setVisible(false);
    deps.actions.renderPlaylist();
  };

  const initialize = () => {
    elements.autofillButton?.addEventListener("click", () => { void autofill(); });
    elements.addButton?.addEventListener("click", () => applySelection(true));
    elements.replaceButton?.addEventListener("click", () => applySelection(false));
    elements.removeButton?.addEventListener("click", remove);
    elements.closeButton?.addEventListener("click", () => setVisible(false));
    elements.setSelect?.addEventListener("change", () => {
      selectedSet = elements.setSelect?.value ?? deps.anySetId;
      void renderResults();
    });
    elements.searchInput?.addEventListener("input", () => { void renderResults(); });
  };

  const setSelectedSet = (setName: string) => {
    selectedSet = setName;
    if (elements.setSelect) elements.setSelect.value = setName;
  };

  return { initialize, open, renderResults, setSelectedSet, setVisible, updateActions };
};
