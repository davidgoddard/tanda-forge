export type LibraryRoot = {
  id: string;
  kind: "music" | "cortina";
  path: string;
  label: string;
  available: boolean;
};

export type TrackRow = {
  id: string;
  full_path: string;
  relative_path: string;
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  year: string;
  genre: string;
  duration_ms: number;
  start_offset_ms: number;
  end_trim_ms: number;
  analysis_json: string;
  tag_error: string;
  analysis_error: string;
};

export type ScanSummary = {
  scanned: number;
  added: number;
  updated: number;
  removed: number;
  errors: { filePath: string; message: string }[];
};

export type ScanProgress = {
  current: number;
  total: number;
  filePath: string;
  rootLabel: string;
  errors: number;
};

export type TrackPageRequest = {
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: string;
};

export type JumpRequest = {
  prefix: string;
  sortBy?: string;
  sortDir?: string;
};

export type AppApi = {
  ping: () => Promise<string>;
  pickRoot: (kind: "music" | "cortina") => Promise<string | null>;
  addRoot: (kind: "music" | "cortina", path: string) => Promise<LibraryRoot>;
  listRoots: () => Promise<LibraryRoot[]>;
  scanAll: () => Promise<ScanSummary>;
  listTracks: () => Promise<TrackRow[]>;
  onScanProgress: (handler: (progress: ScanProgress) => void) => () => void;
  resetDatabase: () => Promise<{ ok: boolean }>;
  listTrackPage: (params: TrackPageRequest) => Promise<TrackRow[]>;
  jumpToPrefix: (params: JumpRequest) => Promise<{ offset: number }>;
  getJumpIndex: (params: { sortBy?: string }) => Promise<string[]>;
};

declare global {
  interface Window {
    tanda?: AppApi;
  }
}

export {};
