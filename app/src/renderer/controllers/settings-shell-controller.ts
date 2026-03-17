type StorageLike = Pick<Storage, "getItem" | "setItem">;

const THEME_ORDER = [
  "dark-alt",
  "dark-red",
  "dark-green",
  "dark-classic",
  "dark",
  "light",
  "light-alt",
] as const;

type ThemeName = (typeof THEME_ORDER)[number];

type SettingsShellElements = {
  themeToggle?: HTMLButtonElement | null;
  closeSettingsBtn?: HTMLButtonElement | null;
  openSettingsBtn?: HTMLButtonElement | null;
  fullscreenToggle?: HTMLButtonElement | null;
  openDisplayBtn?: HTMLButtonElement | null;
  openDiagnosticsMain?: HTMLElement | null;
  openDiagnosticsSettings?: HTMLElement | null;
  openDiagnosticsPrecompute?: HTMLElement | null;
  tabButtons: Iterable<HTMLElement>;
  tabPanels: Iterable<HTMLElement>;
};

export type SettingsShellControllerDeps = {
  storage: StorageLike;
  body: HTMLElement;
  elements: SettingsShellElements;
  actions: {
    setSettingsOpen: (open: boolean) => Promise<void>;
    activateSettingsTab: (tab: string) => void;
    toggleFullscreen: () => Promise<void>;
    openDisplay: () => Promise<void>;
    updateExternalDisplay: () => void;
    setStatus: (message: string) => void;
  };
  labels: {
    fullscreenUnavailable: string;
    fullscreenFailed: string;
    fullscreenFailedDetail: (message: string) => string;
    noApi: string;
  };
};

const applyTheme = (body: HTMLElement, storage: StorageLike, theme: ThemeName) => {
  THEME_ORDER.forEach((entry) => {
    body.classList.toggle(`theme-${entry}`, entry === theme);
  });
  storage.setItem("tanda-theme", theme);
};

export const createSettingsShellController = (deps: SettingsShellControllerDeps) => {
  const initializeTheme = () => {
    const { themeToggle } = deps.elements;
    if (!themeToggle) {
      return;
    }
    const savedTheme = deps.storage.getItem("tanda-theme") as ThemeName | null;
    const initialTheme =
      savedTheme && THEME_ORDER.includes(savedTheme) ? savedTheme : "dark-alt";
    applyTheme(deps.body, deps.storage, initialTheme);
    themeToggle.addEventListener("click", () => {
      const current =
        THEME_ORDER.find((theme) => deps.body.classList.contains(`theme-${theme}`)) ??
        "dark-alt";
      const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
      applyTheme(deps.body, deps.storage, next);
    });
  };

  const initializeSettingsButtons = () => {
    deps.elements.closeSettingsBtn?.addEventListener("click", () => {
      void deps.actions.setSettingsOpen(false);
    });
    deps.elements.openSettingsBtn?.addEventListener("click", () => {
      void deps.actions.setSettingsOpen(true);
    });
  };

  const initializeDisplayButtons = () => {
    deps.elements.fullscreenToggle?.addEventListener("click", async () => {
      try {
        await deps.actions.toggleFullscreen();
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === deps.labels.fullscreenUnavailable
        ) {
          deps.actions.setStatus(deps.labels.fullscreenUnavailable);
          return;
        }
        deps.actions.setStatus(
          error instanceof Error
            ? deps.labels.fullscreenFailedDetail(error.message)
            : deps.labels.fullscreenFailed,
        );
      }
    });

    deps.elements.openDisplayBtn?.addEventListener("click", async () => {
      try {
        await deps.actions.openDisplay();
      } catch {
        deps.actions.setStatus(deps.labels.noApi);
        return;
      }
      deps.actions.updateExternalDisplay();
    });
  };

  const initializeDiagnosticsShortcuts = () => {
    const openDiagnostics = () => {
      void deps.actions.setSettingsOpen(true);
      deps.actions.activateSettingsTab("diagnostics");
    };
    deps.elements.openDiagnosticsMain?.addEventListener("click", openDiagnostics);
    deps.elements.openDiagnosticsSettings?.addEventListener("click", openDiagnostics);
    deps.elements.openDiagnosticsPrecompute?.addEventListener("click", openDiagnostics);
  };

  const initializeTabButtons = () => {
    Array.from(deps.elements.tabButtons).forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.tab;
        if (!tab) {
          return;
        }
        deps.actions.activateSettingsTab(tab);
      });
    });
  };

  const initialize = () => {
    initializeTheme();
    initializeSettingsButtons();
    initializeDisplayButtons();
    initializeDiagnosticsShortcuts();
    initializeTabButtons();
  };

  return {
    initialize,
  };
};
