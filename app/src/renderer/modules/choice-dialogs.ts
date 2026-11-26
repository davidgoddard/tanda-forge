import { getPlaylistTandaDeleteActions } from "../tanda-deletion.js";

type Translate = (key: string, params?: Record<string, string | number>) => string;

export const createChoiceDialogs = (t: Translate) => {
  type TandaSaveChoice = "new" | "replace" | null;

  const showTandaSaveChoiceModal = async (): Promise<TandaSaveChoice> => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-modal";
    const dialog = document.createElement("div");
    dialog.className = "confirm-dialog";
    const title = document.createElement("div");
    title.className = "confirm-title";
    title.textContent = t("tandaSaveChoiceTitle");
    const message = document.createElement("div");
    message.className = "confirm-message";
    message.textContent = t("tandaSaveChoiceMessage");
    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "confirm-cancel";
    cancel.textContent = t("cancel");
    const saveNew = document.createElement("button");
    saveNew.type = "button";
    saveNew.className = "tanda-save-new";
    saveNew.textContent = t("tandaSaveAsNew");
    const replace = document.createElement("button");
    replace.type = "button";
    replace.className = "confirm-ok tanda-save-replace";
    replace.textContent = t("tandaReplaceExisting");
    actions.append(cancel, saveNew, replace);
    dialog.append(title, message, actions);
    overlay.append(dialog);
    document.body.appendChild(overlay);
    return new Promise((resolve) => {
      const close = (result: TandaSaveChoice) => {
        overlay.remove();
        resolve(result);
      };
      cancel.addEventListener("click", () => close(null));
      saveNew.addEventListener("click", () => close("new"));
      replace.addEventListener("click", () => close("replace"));
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close(null);
      });
    });
  };

  type PlaylistTandaDeleteChoice = "remove" | "delete" | null;

  type PlaylistTandaRemoveChoice = "clipboard" | "remove" | null;

  const showPlaylistTandaRemoveModal = async (): Promise<PlaylistTandaRemoveChoice> => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-modal playlist-tanda-remove-modal";
    const dialog = document.createElement("div");
    dialog.className = "confirm-dialog playlist-tanda-remove-dialog";
    const title = document.createElement("div");
    title.className = "confirm-title";
    title.textContent = t("playlistTandaRemoveTitle");
    const message = document.createElement("div");
    message.className = "confirm-message";
    message.textContent = t("playlistTandaRemoveMessage");
    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "confirm-cancel";
    cancel.textContent = t("cancel");
    const clipboard = document.createElement("button");
    clipboard.type = "button";
    clipboard.className = "playlist-tanda-remove-clipboard";
    clipboard.textContent = t("playlistTandaRemoveToClipboard");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger playlist-tanda-remove-only";
    remove.textContent = t("playlistTandaRemoveOnly");
    actions.append(cancel, clipboard, remove);
    dialog.append(title, message, actions);
    overlay.append(dialog);
    document.body.appendChild(overlay);
    return new Promise((resolve) => {
      const close = (result: PlaylistTandaRemoveChoice) => {
        overlay.remove();
        resolve(result);
      };
      cancel.addEventListener("click", () => close(null));
      clipboard.addEventListener("click", () => close("clipboard"));
      remove.addEventListener("click", () => close("remove"));
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close(null);
      });
    });
  };

  const showPlaylistTandaDeleteModal = async (
    canDeleteSavedTanda: boolean,
  ): Promise<PlaylistTandaDeleteChoice> => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-modal";
    const dialog = document.createElement("div");
    dialog.className = "confirm-dialog playlist-tanda-delete-dialog";
    const title = document.createElement("div");
    title.className = "confirm-title";
    title.textContent = t("playlistTandaDeleteTitle");
    const message = document.createElement("div");
    message.className = "confirm-message";
    message.textContent = t(canDeleteSavedTanda
      ? "playlistTandaDeleteMessage"
      : "playlistTandaDeleteUnsavedMessage");
    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "confirm-cancel";
    cancel.textContent = t("cancel");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = t("playlistTandaRemoveOnly");
    const deleteSaved = document.createElement("button");
    deleteSaved.type = "button";
    deleteSaved.className = "danger";
    deleteSaved.textContent = t("playlistTandaDeleteSaved");
    const availableActions = getPlaylistTandaDeleteActions(canDeleteSavedTanda);
    const showDeleteSaved = availableActions.length > 1;
    actions.append(cancel, remove);
    if (showDeleteSaved) {
      actions.append(deleteSaved);
    }
    dialog.append(title, message, actions);
    overlay.append(dialog);
    document.body.appendChild(overlay);
    return new Promise((resolve) => {
      const close = (result: PlaylistTandaDeleteChoice) => {
        overlay.remove();
        resolve(result);
      };
      cancel.addEventListener("click", () => close(null));
      remove.addEventListener("click", () => close("remove"));
      if (showDeleteSaved) {
        deleteSaved.addEventListener("click", () => close("delete"));
      }
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close(null);
      });
    });
  };

  const showDeleteTrackModal = async (): Promise<boolean | null> => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-modal";
    const dialog = document.createElement("div");
    dialog.className = "confirm-dialog";
    const title = document.createElement("div");
    title.className = "confirm-title";
    title.textContent = t("trackEditorDeleteTitle");
    const message = document.createElement("div");
    message.className = "confirm-message";
    message.textContent = t("trackEditorDeleteMessage");
    const fileOption = document.createElement("label");
    fileOption.className = "confirm-checkbox";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const optionText = document.createElement("span");
    optionText.textContent = t("trackEditorDeleteFileOption");
    fileOption.append(checkbox, optionText);
    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "confirm-cancel";
    cancel.textContent = t("cancel");
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "danger";
    confirm.textContent = t("trackEditorDelete");
    actions.append(cancel, confirm);
    dialog.append(title, message, fileOption, actions);
    overlay.append(dialog);
    document.body.appendChild(overlay);
    return new Promise((resolve) => {
      const close = (result: boolean | null) => { overlay.remove(); resolve(result); };
      cancel.addEventListener("click", () => close(null));
      confirm.addEventListener("click", () => close(checkbox.checked));
      overlay.addEventListener("click", (event) => { if (event.target === overlay) close(null); });
    });
  };

  type RelocatableRootKind = "music" | "cortina" | "background";

  const showRootRelocationOptionsModal = async (
    mode: "copy" | "move",
    destination: string,
    libraryWorkflowRoots: ReadonlyArray<{ kind: string }>,
  ): Promise<RelocatableRootKind[] | null> => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-modal";
    const dialog = document.createElement("div");
    dialog.className = "confirm-dialog";
    const title = document.createElement("div");
    title.className = "confirm-title";
    title.textContent = t(mode === "copy" ? "copyMusicButton" : "relocateMusicButton");
    const message = document.createElement("div");
    message.className = "confirm-message";
    message.textContent = `${t("rootRelocationOptionsMessage", { path: destination })}\n\n${
      t(mode === "copy" ? "rootRelocationCopyNotice" : "rootRelocationMoveNotice")
    }`;
    const options = document.createElement("div");
    options.className = "root-relocation-options";
    const definitions: Array<{ kind: RelocatableRootKind; key: string }> = [
      { kind: "music", key: "rootRelocationOptionMusic" },
      { kind: "cortina", key: "rootRelocationOptionCortinas" },
      { kind: "background", key: "rootRelocationOptionImages" },
    ];
    const checkboxes = definitions.map(({ kind, key }) => {
      const label = document.createElement("label");
      label.className = "confirm-checkbox";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = libraryWorkflowRoots.some((root) => root.kind === kind);
      input.disabled = !input.checked;
      const text = document.createElement("span");
      text.textContent = t(key);
      label.append(input, text);
      options.append(label);
      return { kind, input };
    });
    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "confirm-cancel";
    cancel.textContent = t("cancel");
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "confirm-ok";
    confirm.textContent = t(mode === "copy" ? "copyMusicButton" : "relocateMusicButton");
    actions.append(cancel, confirm);
    dialog.append(title, message, options, actions);
    overlay.append(dialog);
    document.body.appendChild(overlay);
    return new Promise((resolve) => {
      const close = (result: RelocatableRootKind[] | null) => {
        overlay.remove();
        resolve(result);
      };
      cancel.addEventListener("click", () => close(null));
      confirm.addEventListener("click", () => {
        const selected = checkboxes.filter(({ input }) => input.checked).map(({ kind }) => kind);
        if (selected.length > 0) close(selected);
      });
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close(null);
      });
    });
  };

  return { showTandaSaveChoiceModal, showPlaylistTandaRemoveModal, showPlaylistTandaDeleteModal, showDeleteTrackModal, showRootRelocationOptionsModal };
};
