type PlaylistItemLike = { kind: "tanda" } | { kind: "track" } | null;

export const getCortinaRowIndices = (items: PlaylistItemLike[]) => {
  const indices: number[] = [];
  let hasTanda = false;
  items.forEach((item, index) => {
    if (item?.kind === "tanda") {
      hasTanda = true;
      indices.push(index);
    }
  });
  if (hasTanda) {
    indices.push(items.length);
  }
  return indices;
};

export const getUnassignedCortinaRowIndices = (
  items: PlaylistItemLike[],
  assignedIndices: Iterable<number>,
) => {
  const assigned = new Set<number>(assignedIndices);
  return getCortinaRowIndices(items).filter((index) => !assigned.has(index));
};
