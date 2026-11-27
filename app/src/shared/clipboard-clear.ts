export type ClipboardCollection = {
  id: string;
  name: string;
  trackIds: string[];
  tandaIds: string[];
};

type ClipboardClearOptions = {
  selectedIds: string[];
  removeEmpty: boolean;
  protectedIds?: string[];
};

export const applyClipboardClear = (
  collections: ClipboardCollection[],
  options: ClipboardClearOptions,
) => {
  const selected = new Set(options.selectedIds);
  const protectedIds = new Set(options.protectedIds ?? []);
  const next = collections.map((collection) => {
    if (!selected.has(collection.id)) {
      return { ...collection };
    }
    return {
      ...collection,
      trackIds: [],
      tandaIds: [],
    };
  });

  if (!options.removeEmpty) {
    return { collections: next, removedIds: [] as string[] };
  }

  const removedIds: string[] = [];
  const filtered = next.filter((collection) => {
    if (protectedIds.has(collection.id)) {
      return true;
    }
    const empty = collection.trackIds.length === 0 && collection.tandaIds.length === 0;
    if (empty) {
      removedIds.push(collection.id);
    }
    return !empty;
  });

  return { collections: filtered, removedIds };
};

export const resolveClipboardSelectionAfterClear = (
  collections: ClipboardCollection[],
  selectedIds: string[],
  activeId: string | null,
  includedIds: string[],
) => {
  const remaining = new Set(collections.map(({ id }) => id));
  const activeCollectionId = activeId && !remaining.has(activeId)
    ? remaining.has("general") ? "general" : collections[0]?.id ?? "general"
    : activeId;
  return {
    activeCollectionId,
    includedCollectionIds: includedIds.filter((id) => remaining.has(id)),
    clearRowSelection: activeCollectionId === "general" ||
      selectedIds.includes(activeCollectionId ?? ""),
  };
};
