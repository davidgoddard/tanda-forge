type CatalogElements = {
  orchestraAddBtn?: HTMLButtonElement | null;
  orchestraResetBtn?: HTMLButtonElement | null;
  orchestraSaveBtn?: HTMLButtonElement | null;
  orchestraFilterInput?: HTMLInputElement | null;
  styleFamilyAddBtn?: HTMLButtonElement | null;
  styleFamilyCodeInput?: HTMLInputElement | null;
  styleFamilyBaseInput?: HTMLInputElement | null;
  styleFamilyVariantsInput?: HTMLInputElement | null;
};

export type SettingsCatalogControllerDeps = {
  elements: CatalogElements;
  actions: {
    addOrchestraEntry: () => void;
    resetOrchestraRegistry: () => Promise<void>;
    saveOrchestraRegistry: () => void;
    setOrchestraFilter: (value: string) => void;
    addStyleFamily: () => Promise<boolean>;
  };
};

export const createSettingsCatalogController = (
  deps: SettingsCatalogControllerDeps,
) => {
  const initialize = () => {
    deps.elements.orchestraAddBtn?.addEventListener("click", () => {
      deps.actions.addOrchestraEntry();
    });
    deps.elements.orchestraResetBtn?.addEventListener("click", () => {
      void deps.actions.resetOrchestraRegistry();
    });
    deps.elements.orchestraSaveBtn?.addEventListener("click", () => {
      deps.actions.saveOrchestraRegistry();
    });
    deps.elements.orchestraFilterInput?.addEventListener("input", () => {
      deps.actions.setOrchestraFilter(deps.elements.orchestraFilterInput?.value ?? "");
    });

    deps.elements.styleFamilyAddBtn?.addEventListener("click", () => {
      void deps.actions.addStyleFamily();
    });

    [
      deps.elements.styleFamilyCodeInput,
      deps.elements.styleFamilyBaseInput,
      deps.elements.styleFamilyVariantsInput,
    ].forEach((input) => {
      input?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        void deps.actions.addStyleFamily();
      });
    });
  };

  return {
    initialize,
  };
};
