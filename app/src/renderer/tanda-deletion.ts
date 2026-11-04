export type TandaDeletionIdentity = {
  id: string;
  masterTandaId?: string | null;
  playlistUnsaved?: boolean;
};

export const getSavedTandaId = (
  tanda: TandaDeletionIdentity,
  persistedTandaIds: ReadonlySet<string>,
): string | null => {
  const candidate = tanda.masterTandaId ?? (tanda.playlistUnsaved ? null : tanda.id);
  return candidate && persistedTandaIds.has(candidate) ? candidate : null;
};

export const belongsToSavedTanda = (
  tanda: TandaDeletionIdentity | null,
  referencedId: string,
  savedTandaId: string,
): boolean => (tanda?.masterTandaId ?? referencedId) === savedTandaId;

export const getPlaylistTandaDeleteActions = (canDeleteSavedTanda: boolean) =>
  canDeleteSavedTanda
    ? (["remove", "delete"] as const)
    : (["remove"] as const);
