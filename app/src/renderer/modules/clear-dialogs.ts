type Translate = (key: string, params?: Record<string, string | number>) => string;

export const createClearDialogs = (t: Translate) => {
  let clipboardClearModalEl: HTMLDivElement | null = null;
  let clipboardClearModalResolve:
    | ((value: { selectedIds: string[]; removeEmpty: boolean } | null) => void)
    | null = null;
  let playlistClearModalEl: HTMLDivElement | null = null;
  let playlistClearModalResolve:
    | ((value: "clear" | "autofill" | "generate" | null) => void)
    | null = null;

  const ensureClipboardClearModal = () => {
    if (clipboardClearModalEl) {
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "confirm-modal hidden clipboard-clear-modal";
    const dialog = document.createElement("div");
    dialog.className = "confirm-dialog clipboard-clear-dialog";
    const title = document.createElement("div");
    title.className = "clipboard-clear-title";
    const list = document.createElement("div");
    list.className = "clipboard-clear-list";
    const options = document.createElement("label");
    options.className = "clipboard-clear-option";
    const removeEmptyInput = document.createElement("input");
    removeEmptyInput.type = "checkbox";
    removeEmptyInput.className = "clipboard-clear-remove-empty";
    const removeEmptyLabel = document.createElement("span");
    options.append(removeEmptyInput, removeEmptyLabel);
    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "confirm-cancel";
    cancelBtn.textContent = t("cancel");
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "confirm-ok";
    okBtn.textContent = t("clipboardClearConfirm");
    actions.append(cancelBtn, okBtn);
    dialog.append(title, list, options, actions);
    overlay.append(dialog);
    document.body.appendChild(overlay);
    clipboardClearModalEl = overlay;

    const closeModal = (result: { selectedIds: string[]; removeEmpty: boolean } | null) => {
      if (!clipboardClearModalEl) {
        return;
      }
      clipboardClearModalEl.classList.add("hidden");
      const resolve = clipboardClearModalResolve;
      clipboardClearModalResolve = null;
      if (resolve) {
        resolve(result);
      }
    };

    cancelBtn.addEventListener("click", () => closeModal(null));
    okBtn.addEventListener("click", () => {
      if (!clipboardClearModalEl) {
        closeModal(null);
        return;
      }
      const selected = Array.from(
        clipboardClearModalEl.querySelectorAll<HTMLInputElement>(
          ".clipboard-clear-list input[type=\"checkbox\"]",
        ),
      )
        .filter((input) => input.checked)
        .map((input) => input.value);
      const removeEmpty = removeEmptyInput.checked;
      closeModal({ selectedIds: selected, removeEmpty });
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeModal(null);
      }
    });
  };

  const showClipboardClearModal = async (
    clipboardCollections: ReadonlyArray<{ id: string; name: string }>,
    activeClipboardCollectionId: string | null,
    isReadOnlyCollectionId: (id: string) => boolean,
  ) => {
    ensureClipboardClearModal();
    if (!clipboardClearModalEl) {
      return null;
    }
    if (clipboardClearModalResolve) {
      return null;
    }
    const titleEl = clipboardClearModalEl.querySelector<HTMLElement>(".clipboard-clear-title");
    const listEl = clipboardClearModalEl.querySelector<HTMLElement>(".clipboard-clear-list");
    const removeEmptyLabel =
      clipboardClearModalEl.querySelector<HTMLElement>(".clipboard-clear-option span");
    const removeEmptyInput =
      clipboardClearModalEl.querySelector<HTMLInputElement>(".clipboard-clear-remove-empty");
    const confirmButton = clipboardClearModalEl.querySelector<HTMLButtonElement>(".confirm-ok");
    const cancelButton = clipboardClearModalEl.querySelector<HTMLButtonElement>(".confirm-cancel");
    if (!titleEl || !listEl || !removeEmptyLabel || !removeEmptyInput || !confirmButton || !cancelButton) {
      return null;
    }
    titleEl.textContent = t("clipboardClearTitle");
    removeEmptyLabel.textContent = t("clipboardClearRemoveEmpty");
    confirmButton.textContent = t("clipboardClearConfirm");
    cancelButton.textContent = t("cancel");
    removeEmptyInput.checked = false;
    listEl.innerHTML = "";
    clipboardCollections
      .filter((collection) => !isReadOnlyCollectionId(collection.id))
      .forEach((collection) => {
        const row = document.createElement("label");
        row.className = "clipboard-clear-row";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = collection.id;
        input.checked = collection.id === activeClipboardCollectionId;
        const name = document.createElement("span");
        name.textContent = collection.name;
        row.append(input, name);
        listEl.appendChild(row);
      });
    clipboardClearModalEl.classList.remove("hidden");
    return new Promise<{ selectedIds: string[]; removeEmpty: boolean } | null>((resolve) => {
      clipboardClearModalResolve = resolve;
    });
  };

  const ensurePlaylistClearModal = () => {
    if (playlistClearModalEl) {
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "confirm-modal hidden playlist-clear-modal";
    const dialog = document.createElement("div");
    dialog.className = "confirm-dialog playlist-clear-dialog";
    const title = document.createElement("div");
    title.className = "playlist-clear-title";
    const help = document.createElement("div");
    help.className = "confirm-message playlist-clear-help";
    const actions = document.createElement("div");
    actions.className = "confirm-actions playlist-clear-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "confirm-cancel";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "confirm-ok";
    clearBtn.dataset.option = "clear";
    const autofillBtn = document.createElement("button");
    autofillBtn.type = "button";
    autofillBtn.className = "confirm-ok";
    autofillBtn.dataset.option = "autofill";
    const generateBtn = document.createElement("button");
    generateBtn.type = "button";
    generateBtn.className = "confirm-ok";
    generateBtn.dataset.option = "generate";
    actions.append(cancelBtn, clearBtn, autofillBtn, generateBtn);
    dialog.append(title, help, actions);
    overlay.append(dialog);
    document.body.appendChild(overlay);
    playlistClearModalEl = overlay;

    const closeModal = (result: "clear" | "autofill" | "generate" | null) => {
      if (!playlistClearModalEl) {
        return;
      }
      playlistClearModalEl.classList.add("hidden");
      const resolve = playlistClearModalResolve;
      playlistClearModalResolve = null;
      if (resolve) {
        resolve(result);
      }
    };

    cancelBtn.addEventListener("click", () => closeModal(null));
    clearBtn.addEventListener("click", () => closeModal("clear"));
    autofillBtn.addEventListener("click", () => closeModal("autofill"));
    generateBtn.addEventListener("click", () => closeModal("generate"));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeModal(null);
      }
    });
  };

  const showPlaylistClearModal = async () => {
    ensurePlaylistClearModal();
    if (!playlistClearModalEl) {
      return null;
    }
    if (playlistClearModalResolve) {
      return null;
    }
    const title = playlistClearModalEl.querySelector<HTMLElement>(".playlist-clear-title");
    const help = playlistClearModalEl.querySelector<HTMLElement>(".playlist-clear-help");
    const cancelButton = playlistClearModalEl.querySelector<HTMLButtonElement>(".confirm-cancel");
    const clearButton = playlistClearModalEl.querySelector<HTMLButtonElement>(
      ".confirm-ok[data-option=\"clear\"]",
    );
    const autofillButton = playlistClearModalEl.querySelector<HTMLButtonElement>(
      ".confirm-ok[data-option=\"autofill\"]",
    );
    const generateButton = playlistClearModalEl.querySelector<HTMLButtonElement>(
      ".confirm-ok[data-option=\"generate\"]",
    );
    if (!title || !help || !cancelButton || !clearButton || !autofillButton || !generateButton) {
      return null;
    }
    title.textContent = t("playlistClearTitle");
    help.textContent = t("playlistClearGenerateHelp");
    cancelButton.textContent = t("cancel");
    clearButton.textContent = t("playlistClearOnly");
    autofillButton.textContent = t("playlistClearAutofill");
    generateButton.textContent = t("playlistClearGenerate");
    generateButton.title = t("playlistClearGenerateHelp");
    playlistClearModalEl.classList.remove("hidden");
    return new Promise<"clear" | "autofill" | "generate" | null>((resolve) => {
      playlistClearModalResolve = resolve;
    });
  };

  return { showClipboardClearModal, showPlaylistClearModal };
};
