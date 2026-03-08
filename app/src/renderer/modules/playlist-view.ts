import { computePlaylistWindowMinutes, parseClockMinutes } from "../../shared/playlist-window.js";
import { normalizeClipboardFilter } from "./clipboard-view.js";

export const resetPlaylistLastTandaState = (storage: Pick<Storage, "setItem">, key: string) => {
  storage.setItem(key, "0");
};

export const resolvePlaylistWindowMs = (params: {
  startInput: string;
  endInput: string;
  defaultStartMinutes: number;
  defaultEndMinutes: number;
}) => {
  const startMinutes = parseClockMinutes(params.startInput, params.defaultStartMinutes);
  const endMinutes = parseClockMinutes(params.endInput, params.defaultEndMinutes);
  return computePlaylistWindowMinutes(startMinutes, endMinutes) * 60 * 1000;
};

export const matchesPlaylistFilter = (params: {
  filterText: string;
  orchestraFilter: string | null;
  fallbackText: string;
  canonicalArtists: string[];
}) => {
  const normalizedFilter = normalizeClipboardFilter(params.filterText);
  if (!normalizedFilter) {
    return true;
  }
  if (params.orchestraFilter) {
    const normalizedOrchestra = normalizeClipboardFilter(params.orchestraFilter);
    return params.canonicalArtists.some(
      (artist) => normalizeClipboardFilter(artist) === normalizedOrchestra,
    );
  }
  return params.fallbackText.includes(normalizedFilter);
};
