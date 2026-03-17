type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type GeneralSettingsElements = {
  languageSelect?: HTMLSelectElement | null;
  modeSelect?: HTMLSelectElement | null;
  mainOutputSelect?: HTMLSelectElement | null;
  headphoneOutputSelect?: HTMLSelectElement | null;
};

export type SettingsGeneralControllerDeps = {
  storage: StorageLike;
  elements: GeneralSettingsElements;
  keys: {
    language: string;
    mode: string;
    headphoneOutput: string;
    headphoneOutputLabel: string;
    headphoneOutputGroup: string;
  };
  readers: {
    getLanguage: () => string;
    getAppMode: () => string;
    getMainOutputValue: () => string | null;
  };
  actions: {
    applyLanguageChange: (language: string) => Promise<void> | void;
    applyModeChange: (mode: string, previousMode: string) => void;
    verifyOutputSelection: (
      kind: "main" | "headphone",
      selected: string,
    ) => Promise<boolean>;
    ensureAudioOutputs: () => Promise<void>;
    renderAllLists: () => void;
  };
};

export const createSettingsGeneralController = (deps: SettingsGeneralControllerDeps) => {
  const initialize = () => {
    const { languageSelect, modeSelect, mainOutputSelect, headphoneOutputSelect } = deps.elements;

    if (languageSelect) {
      languageSelect.value = deps.readers.getLanguage();
      languageSelect.addEventListener("change", () => {
        deps.storage.setItem(deps.keys.language, languageSelect.value);
        void deps.actions.applyLanguageChange(languageSelect.value);
      });
    }

    if (modeSelect) {
      modeSelect.value = deps.readers.getAppMode();
      modeSelect.addEventListener("change", () => {
        const previousMode = deps.readers.getAppMode();
        const nextMode = modeSelect.value;
        deps.storage.setItem(deps.keys.mode, nextMode);
        deps.actions.applyModeChange(nextMode, previousMode);
      });
    }

    if (mainOutputSelect) {
      mainOutputSelect.addEventListener("change", () => {
        const selected = mainOutputSelect.value || "";
        void deps.actions.verifyOutputSelection("main", selected).then(async (verified) => {
          if (!verified) {
            await deps.actions.ensureAudioOutputs();
            deps.actions.renderAllLists();
            return;
          }
          if (
            headphoneOutputSelect &&
            headphoneOutputSelect.value === mainOutputSelect.value
          ) {
            deps.storage.removeItem(deps.keys.headphoneOutput);
            deps.storage.removeItem(deps.keys.headphoneOutputLabel);
            deps.storage.removeItem(deps.keys.headphoneOutputGroup);
            await deps.actions.ensureAudioOutputs();
            deps.actions.renderAllLists();
          }
        });
      });
    }

    if (headphoneOutputSelect) {
      headphoneOutputSelect.addEventListener("change", () => {
        void (async () => {
          if (
            headphoneOutputSelect.value &&
            headphoneOutputSelect.value !== deps.readers.getMainOutputValue()
          ) {
            const verified = await deps.actions.verifyOutputSelection(
              "headphone",
              headphoneOutputSelect.value,
            );
            if (!verified) {
              await deps.actions.ensureAudioOutputs();
              deps.actions.renderAllLists();
            }
            return;
          }
          deps.storage.removeItem(deps.keys.headphoneOutput);
          deps.storage.removeItem(deps.keys.headphoneOutputLabel);
          deps.storage.removeItem(deps.keys.headphoneOutputGroup);
          await deps.actions.ensureAudioOutputs();
          deps.actions.renderAllLists();
        })();
      });
    }
  };

  return {
    initialize,
  };
};
