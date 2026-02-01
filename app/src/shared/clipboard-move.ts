export type ClipboardCollection = {
  id: string;
  name: string;
  trackIds: string[];
  tandaIds: string[];
};

export const moveTrackToCollection = (
  collections: ClipboardCollection[],
  trackId: string,
  targetId: string,
  protectedIds: string[] = [],
) => {
  if (!trackId || !targetId) {
    return collections;
  }
  if (protectedIds.includes(targetId)) {
    return collections;
  }
  const targetExists = collections.some((item) => item.id === targetId);
  if (!targetExists) {
    return collections;
  }
  return collections.map((collection) => {
    if (protectedIds.includes(collection.id)) {
      return collection;
    }
    const filtered = collection.trackIds.filter((id) => id !== trackId);
    if (collection.id === targetId) {
      if (!filtered.includes(trackId)) {
        filtered.push(trackId);
      }
    }
    return { ...collection, trackIds: filtered };
  });
};
