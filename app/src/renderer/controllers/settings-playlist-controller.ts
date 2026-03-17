type StorageLike = Pick<Storage, "getItem" | "setItem">;

type PlaylistSettingsElements = {
  playlistLastTandaToggle?: HTMLInputElement | null;
  playlistCortinaSetSelect?: HTMLSelectElement | null;
  playlistCortinaDurationInput?: HTMLInputElement | null;
  displayBackgroundIntervalInput?: HTMLInputElement | null;
  displayUseImagesInput?: HTMLInputElement | null;
  displayImageDimInput?: HTMLInputElement | null;
  displayBaseFontSizeInput?: HTMLInputElement | null;
  displayCortinaFontSizeInput?: HTMLInputElement | null;
  displayEdgePaddingInput?: HTMLInputElement | null;
  playlistStartTimeInput?: HTMLInputElement | null;
  playlistEndTimeInput?: HTMLInputElement | null;
  playlistArtistRepeatGapInput?: HTMLInputElement | null;
};

export type SettingsPlaylistControllerDeps = {
  storage: StorageLike;
  elements: PlaylistSettingsElements;
  keys: {
    playlistLastTanda: string;
    cortinaSet: string;
    cortinaDuration: string;
    displayBackgroundInterval: string;
    displayUseImages: string;
    displayImageDim: string;
    displayFontScale: string;
    displayCortinaFontScale: string;
    displayEdgePadding: string;
    playlistStartTime: string;
    playlistEndTime: string;
    playlistArtistRepeatGapMinutes: string;
  };
  readers: {
    getCortinaSet: () => string;
    getCortinaDuration: () => number;
    getDisplayBackgroundIntervalSec: () => number;
    getDisplayUseBackgroundImages: () => boolean;
    getDisplayImageDimOpacity: () => number;
    getDisplayFontScale: () => number;
    getDisplayCortinaFontScale: () => number;
    getDisplayEdgePaddingVmin: () => number;
    getPlaylistStartTimeInput: () => string;
    getPlaylistEndTimeInput: () => string;
    getPlaylistArtistRepeatGapMinutes: () => number;
  };
  actions: {
    resetPlaylistLastTandaState: () => void;
    updateExternalDisplay: () => void;
    onCortinaSetChanged: (value: string) => Promise<void>;
    onCortinaDurationChanged: () => void;
    onPlaylistStartTimeChanged: () => void;
  };
};

const bindNumberInput = (
  input: HTMLInputElement | null | undefined,
  config: {
    read: () => number;
    write: (value: number) => void;
    min: number;
    max: number;
    parse?: (raw: string) => number;
    afterWrite?: () => void;
    events?: Array<"change" | "input">;
    resetOnBlur?: boolean;
  },
) => {
  if (!input) {
    return;
  }
  const parse = config.parse ?? ((raw: string) => Number.parseFloat(raw));
  const apply = () => {
    const next = parse(input.value);
    if (!Number.isFinite(next)) {
      input.value = config.read().toString();
      return;
    }
    const clamped = Math.min(config.max, Math.max(config.min, next));
    config.write(clamped);
    input.value = clamped.toString();
    config.afterWrite?.();
  };
  input.value = config.read().toString();
  (config.events ?? ["change"]).forEach((eventName) => {
    input.addEventListener(eventName, apply);
  });
  if (config.resetOnBlur) {
    input.addEventListener("blur", () => {
      input.value = config.read().toString();
    });
  }
};

const bindClockInput = (
  input: HTMLInputElement | null | undefined,
  read: () => string,
  write: (value: string) => void,
  afterWrite?: () => void,
) => {
  if (!input) {
    return;
  }
  input.value = read();
  input.addEventListener("change", () => {
    const raw = input.value.trim();
    if (!raw.match(/^(\d{1,2}):(\d{2})$/)) {
      input.value = read();
      return;
    }
    write(raw);
    afterWrite?.();
  });
};

export const createSettingsPlaylistController = (deps: SettingsPlaylistControllerDeps) => {
  const initialize = () => {
    const {
      playlistLastTandaToggle,
      playlistCortinaSetSelect,
      playlistCortinaDurationInput,
      displayBackgroundIntervalInput,
      displayUseImagesInput,
      displayImageDimInput,
      displayBaseFontSizeInput,
      displayCortinaFontSizeInput,
      displayEdgePaddingInput,
      playlistStartTimeInput,
      playlistEndTimeInput,
      playlistArtistRepeatGapInput,
    } = deps.elements;

    if (playlistLastTandaToggle) {
      deps.actions.resetPlaylistLastTandaState();
      playlistLastTandaToggle.checked = false;
      playlistLastTandaToggle.addEventListener("change", () => {
        deps.storage.setItem(
          deps.keys.playlistLastTanda,
          playlistLastTandaToggle.checked ? "1" : "0",
        );
        deps.actions.updateExternalDisplay();
      });
    }

    if (playlistCortinaSetSelect) {
      playlistCortinaSetSelect.value = deps.readers.getCortinaSet();
      playlistCortinaSetSelect.addEventListener("change", () => {
        const next = playlistCortinaSetSelect.value ?? "";
        deps.storage.setItem(deps.keys.cortinaSet, next);
        void deps.actions.onCortinaSetChanged(next);
      });
    }

    bindNumberInput(playlistCortinaDurationInput, {
      read: deps.readers.getCortinaDuration,
      write: (value) => deps.storage.setItem(deps.keys.cortinaDuration, value.toString()),
      min: 0.000001,
      max: 180,
      afterWrite: deps.actions.onCortinaDurationChanged,
      events: ["change", "input"],
      resetOnBlur: true,
    });

    bindNumberInput(displayBackgroundIntervalInput, {
      read: deps.readers.getDisplayBackgroundIntervalSec,
      write: (value) => deps.storage.setItem(deps.keys.displayBackgroundInterval, value.toString()),
      min: 5,
      max: 600,
      parse: (raw) => Number.parseInt(raw, 10),
      afterWrite: deps.actions.updateExternalDisplay,
    });

    if (displayUseImagesInput) {
      displayUseImagesInput.checked = deps.readers.getDisplayUseBackgroundImages();
      displayUseImagesInput.addEventListener("change", () => {
        deps.storage.setItem(
          deps.keys.displayUseImages,
          displayUseImagesInput.checked ? "1" : "0",
        );
        deps.actions.updateExternalDisplay();
      });
    }

    bindNumberInput(displayImageDimInput, {
      read: () => Math.round(deps.readers.getDisplayImageDimOpacity() * 100),
      write: (value) => deps.storage.setItem(deps.keys.displayImageDim, value.toString()),
      min: 0,
      max: 90,
      parse: (raw) => Number.parseInt(raw, 10),
      afterWrite: deps.actions.updateExternalDisplay,
    });

    bindNumberInput(displayBaseFontSizeInput, {
      read: () => Math.round(deps.readers.getDisplayFontScale() * 100),
      write: (value) => deps.storage.setItem(deps.keys.displayFontScale, value.toString()),
      min: 70,
      max: 200,
      parse: (raw) => Number.parseInt(raw, 10),
      afterWrite: deps.actions.updateExternalDisplay,
    });

    bindNumberInput(displayCortinaFontSizeInput, {
      read: () => Math.round(deps.readers.getDisplayCortinaFontScale() * 100),
      write: (value) =>
        deps.storage.setItem(deps.keys.displayCortinaFontScale, value.toString()),
      min: 70,
      max: 240,
      parse: (raw) => Number.parseInt(raw, 10),
      afterWrite: deps.actions.updateExternalDisplay,
    });

    bindNumberInput(displayEdgePaddingInput, {
      read: deps.readers.getDisplayEdgePaddingVmin,
      write: (value) => deps.storage.setItem(deps.keys.displayEdgePadding, value.toString()),
      min: 1,
      max: 16,
      afterWrite: deps.actions.updateExternalDisplay,
    });

    bindClockInput(
      playlistStartTimeInput,
      deps.readers.getPlaylistStartTimeInput,
      (value) => deps.storage.setItem(deps.keys.playlistStartTime, value),
      deps.actions.onPlaylistStartTimeChanged,
    );

    bindClockInput(
      playlistEndTimeInput,
      deps.readers.getPlaylistEndTimeInput,
      (value) => deps.storage.setItem(deps.keys.playlistEndTime, value),
    );

    bindNumberInput(playlistArtistRepeatGapInput, {
      read: deps.readers.getPlaylistArtistRepeatGapMinutes,
      write: (value) =>
        deps.storage.setItem(deps.keys.playlistArtistRepeatGapMinutes, value.toString()),
      min: 0,
      max: 180,
      parse: (raw) => Number.parseInt(raw, 10),
    });
  };

  return {
    initialize,
  };
};
