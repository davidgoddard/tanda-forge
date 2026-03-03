import { computePlaylistWindowMinutes, parseClockMinutes } from "../../shared/playlist-window.js";

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
