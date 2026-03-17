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

export type StoredCortinaAssignment = {
  index: number;
  trackId: string;
};

export type StoredPlaylistState = {
  version: 2;
  items: StoredPlaylistItem[];
  cortinaSet?: string;
  cortinaAssignments?: StoredCortinaAssignment[];
};

export const parseStoredPlaylistState = (raw: string): StoredPlaylistState | null => {
  try {
    const data = JSON.parse(raw) as StoredPlaylistItem[] | StoredPlaylistState;
    if (Array.isArray(data)) {
      return { version: 2, items: data, cortinaAssignments: [] };
    }
    if (!data || !Array.isArray(data.items)) {
      return null;
    }
    const legacyData = data as StoredPlaylistState & { cortinaOverrides?: unknown[] };
    const rawAssignments = Array.isArray(data.cortinaAssignments)
      ? data.cortinaAssignments
      : Array.isArray(legacyData.cortinaOverrides)
        ? legacyData.cortinaOverrides
        : [];
    return {
      version: 2,
      items: data.items,
      cortinaSet: typeof data.cortinaSet === "string" ? data.cortinaSet : undefined,
      cortinaAssignments: rawAssignments.filter(
        (entry): entry is StoredCortinaAssignment =>
          Boolean(entry) &&
          typeof entry === "object" &&
          Number.isInteger((entry as { index?: number }).index) &&
          ((entry as { index: number }).index ?? -1) >= 0 &&
          typeof (entry as { trackId?: string }).trackId === "string" &&
          ((entry as { trackId: string }).trackId ?? "").length > 0,
      ),
    };
  } catch {
    return null;
  }
};

export const serializeStoredPlaylistState = (state: StoredPlaylistState) =>
  JSON.stringify(state);

export const collectStoredPlaylistTrackIds = (
  stored: StoredPlaylistItem[] | StoredPlaylistState,
) => {
  const items = Array.isArray(stored) ? stored : stored.items;
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
  if (!Array.isArray(stored)) {
    stored.cortinaAssignments?.forEach((entry) => {
      if (entry.trackId) {
        trackIds.add(entry.trackId);
      }
    });
  }
  return [...trackIds];
};
