import { composeStyleLabel, type StyleFamily } from "../../shared/style-families.js";
import type { TrackRow } from "../../shared/types.js";
import {
  computeTapTempoBpm,
  formatTrackEditorBpm,
  trackEditorDraftDiffers,
  type TrackEditorDraft,
} from "../modules/track-editor-view.js";

type Dependencies = {
  fields: {
    trackEditorTitleInput: HTMLInputElement | null;
    trackEditorArtistInput: HTMLInputElement | null;
    trackEditorSingerInput: HTMLInputElement | null;
    trackEditorVocalInput: HTMLSelectElement | null;
    trackEditorAlbumInput: HTMLInputElement | null;
    trackEditorYearInput: HTMLInputElement | null;
    trackEditorGenreInput: HTMLSelectElement | null;
    trackEditorNotesInput: HTMLTextAreaElement | null;
    trackEditorBpmInput: HTMLInputElement | null;
  };
  getStyleFamilies: () => StyleFamily[];
  getAvailableStyles: () => string[];
  getBpmController: () => Pick<ReturnType<typeof import("./bpm-controller.js").createBpmController>, "fill" | "dirty" | "tap"> | null;
  renderPathHints: (track: TrackRow) => void;
  confirmDiscard: (message: string) => Promise<boolean>;
  translate: (key: string) => string;
};

export const createTrackEditorDraftController = (deps: Dependencies) => {
  const {
    trackEditorTitleInput,
    trackEditorArtistInput,
    trackEditorSingerInput,
    trackEditorVocalInput,
    trackEditorAlbumInput,
    trackEditorYearInput,
    trackEditorGenreInput,
    trackEditorNotesInput,
    trackEditorBpmInput,
  } = deps.fields;
  const t = deps.translate;
  type TrackEditorState = {
    track: TrackRow | null;
    baselineDraft: TrackEditorDraft | null;
    taps: number[];
    tapTimeoutId: number | null;
  };

  const trackEditorState: TrackEditorState = {
    track: null,
    baselineDraft: null,
    taps: [],
    tapTimeoutId: null,
  };

  const getTrackEditorDraftPayload = (): TrackEditorDraft | null => {
    if (!trackEditorState.track) {
      return null;
    }
    const bpmText = trackEditorBpmInput?.value?.trim() ?? "";
    const bpmValue = bpmText.length > 0 ? Number.parseFloat(bpmText) : null;
    return {
      id: trackEditorState.track.id,
      title: trackEditorTitleInput?.value ?? "",
      artist: trackEditorArtistInput?.value ?? "",
      singer: trackEditorSingerInput?.value ?? "",
      instrumental: trackEditorVocalInput?.value === "instrumental",
      album: trackEditorAlbumInput?.value ?? "",
      year: trackEditorYearInput?.value ?? "",
      genre: trackEditorGenreInput?.value ?? "",
      notes: trackEditorNotesInput?.value ?? "",
      bpm: Number.isFinite(bpmValue ?? Number.NaN) ? Math.round(bpmValue!) : null,
    };
  };

  const isTrackEditorDirty = () => {
    const original = trackEditorState.baselineDraft;
    const draft = getTrackEditorDraftPayload();
    return trackEditorDraftDiffers(original, draft) || Boolean(deps.getBpmController()?.dirty());
  };

  const confirmTrackEditorDiscardIfDirty = async () => {
    if (!isTrackEditorDirty()) {
      return true;
    }
    return deps.confirmDiscard(t("confirmDiscardTrackEdits"));
  };

  const resetTapTempo = () => {
    trackEditorState.taps = [];
    if (trackEditorState.tapTimeoutId !== null) {
      window.clearTimeout(trackEditorState.tapTimeoutId);
      trackEditorState.tapTimeoutId = null;
    }
  };

  const fillTrackEditorFields = (track: TrackRow) => {
    if (
      !trackEditorTitleInput ||
      !trackEditorArtistInput ||
      !trackEditorSingerInput ||
      !trackEditorVocalInput ||
      !trackEditorAlbumInput ||
      !trackEditorYearInput ||
      !trackEditorGenreInput ||
      !trackEditorNotesInput ||
      !trackEditorBpmInput
    ) {
      return;
    }
    trackEditorGenreInput.innerHTML = "";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = t("styleNone");
    trackEditorGenreInput.appendChild(emptyOption);
    deps.getStyleFamilies().forEach((family) => {
      const group = document.createElement("optgroup");
      group.label = family.base;
      const rootOption = document.createElement("option");
      rootOption.value = family.base;
      rootOption.textContent = family.base;
      group.appendChild(rootOption);
      family.variants.forEach((variant) => {
        const style = composeStyleLabel(family.base, variant);
        if (!style) {
          return;
        }
        const option = document.createElement("option");
        option.value = style;
        option.textContent = style;
        group.appendChild(option);
      });
      trackEditorGenreInput.appendChild(group);
    });
    const knownStyles = new Set(
      Array.from(trackEditorGenreInput.querySelectorAll("option"))
        .map((option) => option.value)
        .filter(Boolean),
    );
    deps.getAvailableStyles().forEach((style) => {
      if (!style || knownStyles.has(style)) {
        return;
      }
      const option = document.createElement("option");
      option.value = style;
      option.textContent = style;
      trackEditorGenreInput.appendChild(option);
    });
    trackEditorTitleInput.value = track.title ?? "";
    trackEditorArtistInput.value = track.artist ?? "";
    trackEditorSingerInput.value = track.singer ?? "";
    trackEditorVocalInput.innerHTML = "";
    const sungOption = document.createElement("option");
    sungOption.value = "sung";
    sungOption.textContent = t("trackEditorVocalSung");
    const instrumentalOption = document.createElement("option");
    instrumentalOption.value = "instrumental";
    instrumentalOption.textContent = t("trackEditorVocalInstrumental");
    trackEditorVocalInput.append(sungOption, instrumentalOption);
    trackEditorVocalInput.value = track.instrumental === true ? "instrumental" : "sung";
    trackEditorAlbumInput.value = track.album ?? "";
    trackEditorYearInput.value = track.year ?? "";
    trackEditorGenreInput.value = track.genre ?? "";
    trackEditorNotesInput.value = track.notes ?? "";
    const bpmController = deps.getBpmController();
    const effectiveBpm = bpmController ? bpmController.fill() : track.bpm;
    trackEditorBpmInput.value = formatTrackEditorBpm(effectiveBpm === undefined ? track.bpm : effectiveBpm);
    trackEditorState.baselineDraft = getTrackEditorDraftPayload();
    deps.renderPathHints(track);
    resetTapTempo();
  };

  const handleTapTempo = () => {
    if (!trackEditorBpmInput) {
      return;
    }
    const now = Date.now();
    const lastTap =
      trackEditorState.taps.length > 0
        ? trackEditorState.taps[trackEditorState.taps.length - 1]
        : null;
    if (!lastTap || now - lastTap > 3000) {
      resetTapTempo();
    }
    trackEditorState.taps.push(now);
    const bpm = computeTapTempoBpm(trackEditorState.taps);
    if (bpm !== null) {
      if (!deps.getBpmController()?.tap(bpm)) trackEditorBpmInput.value = `${bpm}`;
    }
    if (trackEditorState.tapTimeoutId !== null) {
      window.clearTimeout(trackEditorState.tapTimeoutId);
    }
    trackEditorState.tapTimeoutId = window.setTimeout(() => {
      resetTapTempo();
    }, 3000);
  };

  const resetTrackEditorFields = () => {
    if (!trackEditorState.track) {
      return;
    }
    fillTrackEditorFields(trackEditorState.track);
  };

  return {
    get track() {
      return trackEditorState.track;
    },
    set track(track: TrackRow | null) {
      trackEditorState.track = track;
    },
    clear() {
      trackEditorState.track = null;
      trackEditorState.baselineDraft = null;
      resetTapTempo();
    },
    getTrackEditorDraftPayload,
    getEditedBpm(bpm: number | null) {
      return bpm === trackEditorState.baselineDraft?.bpm ? undefined : bpm;
    },
    confirmTrackEditorDiscardIfDirty,
    fillTrackEditorFields,
    handleTapTempo,
    resetTrackEditorFields,
  };
};
