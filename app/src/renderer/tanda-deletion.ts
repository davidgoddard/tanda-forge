export type TandaDeletionIdentity = {
  id: string;
  masterTandaId?: string | null;
  playlistUnsaved?: boolean;
};

export const getSavedTandaId = (
  tanda: TandaDeletionIdentity,
): string | null => tanda.masterTandaId ?? (tanda.playlistUnsaved ? null : tanda.id);

export const belongsToSavedTanda = (
  tanda: TandaDeletionIdentity | null,
  referencedId: string,
  savedTandaId: string,
): boolean => (tanda?.masterTandaId ?? referencedId) === savedTandaId;
