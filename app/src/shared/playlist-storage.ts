export type PlaylistTandaSnapshot = {
  id: string;
  name: string;
  styles: string[];
  rating: number;
  trackSlots: (string | null)[];
  totalDurationMs?: number;
};

export type StoredPlaylistItem =
  | { kind: "track"; id: string }
  | {
      kind: "tanda";
      id: string;
      mismatch?: "style" | "count";
      snapshot?: PlaylistTandaSnapshot;
    }
  | null;

export const collectStoredPlaylistTrackIds = (items: StoredPlaylistItem[]) => {
  const trackIds = new Set<string>();
  items.forEach((item) => {
    if (!item) {
      return;
    }
    if (item.kind === "track") {
      trackIds.add(item.id);
      return;
    }
    item.snapshot?.trackSlots.forEach((trackId) => {
      if (trackId) {
        trackIds.add(trackId);
      }
    });
  });
  return [...trackIds];
};
