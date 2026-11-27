import { appendQueryTokens, buildVocalSearchQuery } from "../../shared/search-query.js";

export const resolveTrackEditorFieldSearch = (
  field: string,
  value: string,
  currentQuery: string,
): { kind: "style"; style: string } |
   { kind: "query"; query: string; forceTracks: boolean } | null => {
  const term = (field === "vocal" ? buildVocalSearchQuery(value) : value).trim();
  if (!term) return null;
  if (field === "genre") return { kind: "style", style: term };
  if (field === "bpm") {
    const bpm = Math.round(Number(term));
    return bpm >= 1 && bpm <= 1000
      ? { kind: "query", query: `bpm:${bpm}`, forceTracks: true }
      : null;
  }
  if (field === "album") {
    return { kind: "query", query: `album:${JSON.stringify(term)}`, forceTracks: true };
  }
  return { kind: "query", query: appendQueryTokens(currentQuery, term), forceTracks: false };
};

export const computeTapTempoBpm = (taps: number[]) => {
  if (taps.length < 2) {
    return null;
  }
  const elapsed = taps[taps.length - 1] - taps[0];
  const intervals = taps.length - 1;
  if (elapsed <= 0 || intervals <= 0) {
    return null;
  }
  const bpm = 60000 / (elapsed / intervals);
  if (!Number.isFinite(bpm) || bpm <= 0) {
    return null;
  }
  return Math.round(bpm);
};

export type TrackEditorDraft = {
  id: string;
  title: string;
  artist: string;
  singer: string;
  instrumental: boolean;
  album: string;
  year: string;
  genre: string;
  notes: string;
  bpm: number | null;
};

export const formatTrackEditorBpm = (bpm: number | null | undefined) =>
  bpm !== null && bpm !== undefined ? `${Math.round(bpm)}` : "";

export const trackEditorBpmDiffers = (
  originalBpm: number | null | undefined,
  draftBpmText: string | null | undefined,
) => formatTrackEditorBpm(originalBpm) !== (draftBpmText?.trim() ?? "");

export const trackEditorDraftDiffers = (
  original: TrackEditorDraft | null | undefined,
  draft: TrackEditorDraft | null | undefined,
) =>
  !original ||
  !draft ||
  original.id !== draft.id ||
  original.title !== draft.title ||
  original.artist !== draft.artist ||
  original.singer !== draft.singer ||
  original.instrumental !== draft.instrumental ||
  original.album !== draft.album ||
  original.year !== draft.year ||
  original.genre !== draft.genre ||
  original.notes !== draft.notes ||
  original.bpm !== draft.bpm;
