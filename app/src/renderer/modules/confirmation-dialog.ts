type Translate = (key: string, params?: Record<string, string | number>) => string;

export const createConfirmationDialog = (t: Translate) => {
  let confirmModalEl: HTMLDivElement | null = null;
  let confirmModalTitle: HTMLDivElement | null = null;
  let confirmModalMessage: HTMLDivElement | null = null;
  let confirmModalOk: HTMLButtonElement | null = null;
  let confirmModalCancel: HTMLButtonElement | null = null;
  let confirmModalResolve: ((value: boolean) => void) | null = null;

  const ensureConfirmModal = () => {
    if (confirmModalEl) {
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "confirm-modal hidden";
    const dialog = document.createElement("div");
    dialog.className = "confirm-dialog";
    const title = document.createElement("div");
    title.className = "confirm-title hidden";
    const message = document.createElement("div");
    message.className = "confirm-message";
    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "confirm-cancel";
    cancelBtn.textContent = t("cancel");
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "confirm-ok";
    okBtn.textContent = t("confirmOk");
    actions.append(cancelBtn, okBtn);
    dialog.append(title, message, actions);
    overlay.append(dialog);
    document.body.appendChild(overlay);
    confirmModalEl = overlay;
    confirmModalTitle = title;
    confirmModalMessage = message;
    confirmModalOk = okBtn;
    confirmModalCancel = cancelBtn;

    const closeModal = (result: boolean) => {
      if (!confirmModalEl) {
        return;
      }
      confirmModalEl.classList.add("hidden");
      const resolve = confirmModalResolve;
      confirmModalResolve = null;
      if (resolve) {
        resolve(result);
      }
    };

    cancelBtn.addEventListener("click", () => closeModal(false));
    okBtn.addEventListener("click", () => closeModal(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeModal(false);
      }
    });
  };

  const showConfirmModal = async (
    message: string,
    confirmLabel?: string,
    options?: {
      title?: string;
      cancelLabel?: string;
    },
  ) => {
    ensureConfirmModal();
    if (
      !confirmModalEl ||
      !confirmModalMessage ||
      !confirmModalOk ||
      !confirmModalCancel ||
      !confirmModalTitle
    ) {
      return false;
    }
    if (confirmModalResolve) {
      return false;
    }
    const titleText = options?.title?.trim() ?? "";
    confirmModalTitle.textContent = titleText;
    confirmModalTitle.classList.toggle("hidden", titleText.length === 0);
    confirmModalMessage.textContent = message;
    confirmModalOk.textContent = confirmLabel ?? t("confirmOk");
    confirmModalCancel.textContent = options?.cancelLabel ?? t("cancel");
    confirmModalEl.classList.remove("hidden");
    return new Promise<boolean>((resolve) => {
      confirmModalResolve = resolve;
    });
  };

  return { showConfirmModal };
};
