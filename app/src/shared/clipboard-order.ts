export type ClipboardCollectionOrderItem = {
  id: string;
};

export const reorderClipboardCollections = <T extends ClipboardCollectionOrderItem>(
  collections: T[],
  fromId: string,
  toId: string,
  pinnedIds: string[] = ["general"],
) => {
  if (fromId === toId) {
    return collections;
  }
  if (pinnedIds.includes(fromId) || pinnedIds.includes(toId)) {
    return collections;
  }
  const fromIndex = collections.findIndex((item) => item.id === fromId);
  const toIndex = collections.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0) {
    return collections;
  }
  const next = [...collections];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};
