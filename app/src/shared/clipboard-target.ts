export type ClipboardWriteTarget = {
  targetCollectionId: string | null;
  nextActiveCollectionId: string | null;
  switchedFromNew: boolean;
};

export const resolveCollectionForClipboardWrite = (
  activeCollectionId: string | null | undefined,
  generalCollectionId: string | null | undefined,
  newCollectionId = "new",
): ClipboardWriteTarget => {
  const active = activeCollectionId ?? null;
  const general = generalCollectionId ?? null;
  if (!active) {
    return {
      targetCollectionId: null,
      nextActiveCollectionId: null,
      switchedFromNew: false,
    };
  }
  if (active !== newCollectionId) {
    return {
      targetCollectionId: active,
      nextActiveCollectionId: active,
      switchedFromNew: false,
    };
  }
  if (!general) {
    return {
      targetCollectionId: null,
      nextActiveCollectionId: active,
      switchedFromNew: false,
    };
  }
  return {
    targetCollectionId: general,
    nextActiveCollectionId: general,
    switchedFromNew: true,
  };
};
