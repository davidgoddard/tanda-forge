type StorageLike = Pick<Storage, "getItem" | "setItem">;

type SearchAudioElements = {
  tandaSizeInput?: HTMLInputElement | null;
  clipboardNewLimitInput?: HTMLInputElement | null;
  searchMinScoreInput?: HTMLInputElement | null;
  searchTandaSizeInput?: HTMLInputElement | null;
  searchBpmRangeInput?: HTMLInputElement | null;
  trimPaddingInput?: HTMLInputElement | null;
  gapBetweenTracksInput?: HTMLInputElement | null;
  gapBeforeTandaInput?: HTMLInputElement | null;
  gapBeforeCortinaInput?: HTMLInputElement | null;
  stopFadeInput?: HTMLInputElement | null;
  cortinaLevelPercentInput?: HTMLInputElement | null;
  audioDynamicsEnabledInput?: HTMLInputElement | null;
  audioDynamicsLiftThresholdInput?: HTMLInputElement | null;
  audioDynamicsMaxLiftInput?: HTMLInputElement | null;
  audioDynamicsRatioInput?: HTMLInputElement | null;
  audioDynamicsAttackInput?: HTMLInputElement | null;
  audioDynamicsReleaseInput?: HTMLInputElement | null;
  audioDynamicsGateThresholdInput?: HTMLInputElement | null;
  audioDynamicsLimiterCeilingInput?: HTMLInputElement | null;
  audioDynamicsLimiterReleaseInput?: HTMLInputElement | null;
  audioDynamicsRampInput?: HTMLInputElement | null;
};

export type SettingsSearchAudioControllerDeps = {
  storage: StorageLike;
  elements: SearchAudioElements;
  keys: {
    tandaDefaultSize: string;
    clipboardNewLimit: string;
    searchMinScore: string;
    tandaSearchSize: string;
    searchBpmRange: string;
    trimPadding: string;
    gapBetweenTracks: string;
    gapBeforeTanda: string;
    gapBeforeCortina: string;
    stopFade: string;
    cortinaLevelPercent: string;
    dynamicsEnabled: string;
    dynamicsLiftThreshold: string;
    dynamicsMaxLift: string;
    dynamicsRatio: string;
    dynamicsAttack: string;
    dynamicsRelease: string;
    dynamicsGateThreshold: string;
    dynamicsLimiterCeiling: string;
    dynamicsLimiterRelease: string;
    dynamicsRamp: string;
  };
  readers: {
    getDefaultTandaSize: () => number;
    getNewCollectionLimit: () => number;
    getSearchMinScore: () => number;
    getSearchBpmRange: () => number;
    getTrimPaddingSeconds: () => number;
    getGapBetweenTracks: () => number;
    getGapBeforeTanda: () => number;
    getGapBeforeCortina: () => number;
    getStopFadeSeconds: () => number;
    getCortinaLevelPercent: () => number;
    getAudioDynamicsConfig: () => {
      enabled: boolean;
      liftThresholdDb: number;
      maxLiftDb: number;
      ratio: number;
      attackMs: number;
      releaseMs: number;
      gateThresholdDb: number;
      limiterCeilingDb: number;
      limiterReleaseMs: number;
      rampMs: number;
    };
  };
  actions: {
    refreshSearch: () => void;
    renderClipboard: () => Promise<void> | void;
    refreshNewCollectionTracks: () => Promise<void> | void;
    renderTandaSearchResults: () => void;
    renderPlaylist: () => void;
    updateNowPlayingDisplay: () => void;
    setMainCompressionDepthPercent: (value: number) => void;
    scheduleCompressionPrefetch: () => void;
    syncDynamicsRuntimeForActivePlayback: () => Promise<void> | void;
    normalizeTandaSearchSizeInput: (raw: string) => string;
  };
};

const bindValidatedNumberInput = (
  input: HTMLInputElement | null | undefined,
  config: {
    read: () => number;
    write: (value: number) => void;
    parse?: (raw: string) => number;
    isValid?: (value: number) => boolean;
    clamp?: (value: number) => number;
    afterWrite?: () => void;
  },
) => {
  if (!input) {
    return;
  }
  const parse = config.parse ?? ((raw: string) => Number.parseFloat(raw));
  input.value = config.read().toString();
  input.addEventListener("change", () => {
    const next = parse(input.value);
    if (!Number.isFinite(next) || (config.isValid && !config.isValid(next))) {
      input.value = config.read().toString();
      return;
    }
    const resolved = config.clamp ? config.clamp(next) : next;
    config.write(resolved);
    input.value = resolved.toString();
    config.afterWrite?.();
  });
};

export const createSettingsSearchAudioController = (
  deps: SettingsSearchAudioControllerDeps,
) => {
  const initialize = () => {
    const {
      tandaSizeInput,
      clipboardNewLimitInput,
      searchMinScoreInput,
      searchTandaSizeInput,
      searchBpmRangeInput,
      trimPaddingInput,
      gapBetweenTracksInput,
      gapBeforeTandaInput,
      gapBeforeCortinaInput,
      stopFadeInput,
      cortinaLevelPercentInput,
      audioDynamicsEnabledInput,
      audioDynamicsLiftThresholdInput,
      audioDynamicsMaxLiftInput,
      audioDynamicsRatioInput,
      audioDynamicsAttackInput,
      audioDynamicsReleaseInput,
      audioDynamicsGateThresholdInput,
      audioDynamicsLimiterCeilingInput,
      audioDynamicsLimiterReleaseInput,
      audioDynamicsRampInput,
    } = deps.elements;

    bindValidatedNumberInput(tandaSizeInput, {
      read: deps.readers.getDefaultTandaSize,
      parse: (raw) => Number.parseInt(raw, 10),
      isValid: (value) => value >= 1,
      write: (value) => deps.storage.setItem(deps.keys.tandaDefaultSize, value.toString()),
    });

    bindValidatedNumberInput(clipboardNewLimitInput, {
      read: deps.readers.getNewCollectionLimit,
      parse: (raw) => Number.parseInt(raw, 10),
      isValid: (value) => value >= 0,
      clamp: (value) => Math.min(500, Math.max(0, value)),
      write: (value) => deps.storage.setItem(deps.keys.clipboardNewLimit, value.toString()),
      afterWrite: () => {
        void deps.actions.refreshNewCollectionTracks();
        void deps.actions.renderClipboard();
      },
    });

    bindValidatedNumberInput(searchMinScoreInput, {
      read: deps.readers.getSearchMinScore,
      isValid: (value) => value >= 0,
      clamp: (value) => Math.min(value, 1),
      write: (value) => deps.storage.setItem(deps.keys.searchMinScore, value.toString()),
      afterWrite: deps.actions.refreshSearch,
    });

    if (searchTandaSizeInput) {
      const stored = deps.storage.getItem(deps.keys.tandaSearchSize);
      if (stored === null) {
        const defaultValue = deps.readers.getDefaultTandaSize().toString();
        deps.storage.setItem(deps.keys.tandaSearchSize, defaultValue);
        searchTandaSizeInput.value = defaultValue;
      } else {
        searchTandaSizeInput.value = stored;
      }
      const applyTandaSizeFilter = (raw: string, finalize = false) => {
        const trimmed = raw.trim();
        if (trimmed === "" || trimmed === "-") {
          deps.storage.setItem(deps.keys.tandaSearchSize, trimmed);
          deps.actions.renderTandaSearchResults();
          void deps.actions.renderClipboard();
          return;
        }
        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          if (finalize) {
            const normalized = deps.actions.normalizeTandaSearchSizeInput(raw);
            deps.storage.setItem(deps.keys.tandaSearchSize, normalized);
            searchTandaSizeInput.value = normalized;
            deps.actions.renderTandaSearchResults();
            void deps.actions.renderClipboard();
          }
          return;
        }
        const clamped = Math.min(parsed, 10);
        deps.storage.setItem(deps.keys.tandaSearchSize, clamped.toString());
        if (trimmed !== clamped.toString()) {
          searchTandaSizeInput.value = clamped.toString();
        }
        deps.actions.renderTandaSearchResults();
        void deps.actions.renderClipboard();
      };
      searchTandaSizeInput.addEventListener("input", () => {
        applyTandaSizeFilter(searchTandaSizeInput.value);
      });
      searchTandaSizeInput.addEventListener("blur", () => {
        applyTandaSizeFilter(searchTandaSizeInput.value, true);
      });
    }

    bindValidatedNumberInput(searchBpmRangeInput, {
      read: deps.readers.getSearchBpmRange,
      isValid: (value) => value >= 0,
      clamp: (value) => Math.min(value, 20),
      write: (value) => deps.storage.setItem(deps.keys.searchBpmRange, value.toString()),
      afterWrite: deps.actions.refreshSearch,
    });

    bindValidatedNumberInput(trimPaddingInput, {
      read: deps.readers.getTrimPaddingSeconds,
      isValid: (value) => value >= 0,
      clamp: (value) => Math.min(value, 5),
      write: (value) => deps.storage.setItem(deps.keys.trimPadding, value.toString()),
      afterWrite: () => {
        deps.actions.updateNowPlayingDisplay();
        deps.actions.renderPlaylist();
        deps.actions.renderTandaSearchResults();
        void deps.actions.renderClipboard();
      },
    });

    bindValidatedNumberInput(gapBetweenTracksInput, {
      read: deps.readers.getGapBetweenTracks,
      isValid: (value) => value >= -30 && value <= 30,
      write: (value) => deps.storage.setItem(deps.keys.gapBetweenTracks, value.toString()),
    });
    bindValidatedNumberInput(gapBeforeTandaInput, {
      read: deps.readers.getGapBeforeTanda,
      isValid: (value) => value >= -30 && value <= 30,
      write: (value) => deps.storage.setItem(deps.keys.gapBeforeTanda, value.toString()),
    });
    bindValidatedNumberInput(gapBeforeCortinaInput, {
      read: deps.readers.getGapBeforeCortina,
      isValid: (value) => value >= -30 && value <= 30,
      write: (value) => deps.storage.setItem(deps.keys.gapBeforeCortina, value.toString()),
    });
    bindValidatedNumberInput(stopFadeInput, {
      read: deps.readers.getStopFadeSeconds,
      isValid: (value) => value >= 0,
      write: (value) => deps.storage.setItem(deps.keys.stopFade, value.toString()),
    });
    bindValidatedNumberInput(cortinaLevelPercentInput, {
      read: deps.readers.getCortinaLevelPercent,
      parse: (raw) => Number.parseInt(raw, 10),
      clamp: (value) => Math.min(100, Math.max(0, value)),
      write: (value) => deps.storage.setItem(deps.keys.cortinaLevelPercent, value.toString()),
    });

    if (audioDynamicsEnabledInput) {
      audioDynamicsEnabledInput.checked = deps.readers.getAudioDynamicsConfig().enabled;
      audioDynamicsEnabledInput.addEventListener("change", () => {
        deps.storage.setItem(
          deps.keys.dynamicsEnabled,
          audioDynamicsEnabledInput.checked ? "1" : "0",
        );
        deps.actions.setMainCompressionDepthPercent(0);
        if (audioDynamicsEnabledInput.checked) {
          deps.actions.scheduleCompressionPrefetch();
        }
      });
    }

    const bindDynamicsNumber = (
      input: HTMLInputElement | null | undefined,
      read: () => number,
      key: string,
      clamp: (value: number) => number,
    ) => {
      bindValidatedNumberInput(input, {
        read,
        clamp,
        write: (value) => deps.storage.setItem(key, value.toString()),
        afterWrite: () => void deps.actions.syncDynamicsRuntimeForActivePlayback(),
      });
    };

    bindDynamicsNumber(
      audioDynamicsLiftThresholdInput,
      () => deps.readers.getAudioDynamicsConfig().liftThresholdDb,
      deps.keys.dynamicsLiftThreshold,
      (value) => Math.min(-5, Math.max(-80, value)),
    );
    bindDynamicsNumber(
      audioDynamicsMaxLiftInput,
      () => deps.readers.getAudioDynamicsConfig().maxLiftDb,
      deps.keys.dynamicsMaxLift,
      (value) => Math.min(60, Math.max(0, value)),
    );
    bindDynamicsNumber(
      audioDynamicsRatioInput,
      () => deps.readers.getAudioDynamicsConfig().ratio,
      deps.keys.dynamicsRatio,
      (value) => Math.min(24, Math.max(1, value)),
    );
    bindDynamicsNumber(
      audioDynamicsAttackInput,
      () => deps.readers.getAudioDynamicsConfig().attackMs,
      deps.keys.dynamicsAttack,
      (value) => Math.min(1000, Math.max(1, value)),
    );
    bindDynamicsNumber(
      audioDynamicsReleaseInput,
      () => deps.readers.getAudioDynamicsConfig().releaseMs,
      deps.keys.dynamicsRelease,
      (value) => Math.min(3000, Math.max(10, value)),
    );
    bindDynamicsNumber(
      audioDynamicsGateThresholdInput,
      () => deps.readers.getAudioDynamicsConfig().gateThresholdDb,
      deps.keys.dynamicsGateThreshold,
      (value) => Math.min(-10, Math.max(-120, value)),
    );
    bindDynamicsNumber(
      audioDynamicsLimiterCeilingInput,
      () => deps.readers.getAudioDynamicsConfig().limiterCeilingDb,
      deps.keys.dynamicsLimiterCeiling,
      (value) => Math.min(-0.1, Math.max(-6, value)),
    );
    bindDynamicsNumber(
      audioDynamicsLimiterReleaseInput,
      () => deps.readers.getAudioDynamicsConfig().limiterReleaseMs,
      deps.keys.dynamicsLimiterRelease,
      (value) => Math.min(2000, Math.max(10, value)),
    );
    bindDynamicsNumber(
      audioDynamicsRampInput,
      () => deps.readers.getAudioDynamicsConfig().rampMs,
      deps.keys.dynamicsRamp,
      (value) => Math.min(3000, Math.max(50, value)),
    );
  };

  return {
    initialize,
  };
};
