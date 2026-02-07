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
  artist_summary: string;
  singer: string | null;
  album: string;
  year: string;
  genre: string;
  bpm: number | null;
  notes: string;
  instrumental: boolean | null;
  duration_ms: number;
  start_offset_ms: number;
  end_trim_ms: number;
  analysis_json: string;
  loudness_db: number | null;
  gain_db: number | null;
  tag_error: string;
  analysis_error: string;
};

export type CortinaTrackRow = TrackRow & {
  cortina_set?: string;
};

export type TandaDetail = {
  id: string;
  name: string;
  styles: string[];
  rating: number;
  instrumental: boolean;
  total_duration_ms: number;
  slot_count: number;
  track_slots: (string | null)[];
  tracks: TrackRow[];
};

export type TandaSearchRow = {
  id: string;
  name: string;
  styles: string[];
  rating: number;
  instrumental: boolean;
  total_duration_ms: number;
  track_count: number;
};

export type ScanSummary = {
  scanned: number;
  added: number;
  updated: number;
  removed: number;
  errors: { filePath: string; message: string }[];
  inProgress?: boolean;
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

export type TrackSearchRequest = {
  query: string;
  styles: string[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: string;
  minScore?: number;
  bpmRange?: number;
};

export type AppApi = {
  ping: () => Promise<string>;
  pickRoot: (kind: "music" | "cortina") => Promise<string | null>;
  pickDataLocation: () => Promise<string | null>;
  getDataLocation: () => Promise<{ path: string; defaultPath: string }>;
  setDataLocation: (path: string | null) => Promise<{ path: string }>;
  addRoot: (kind: "music" | "cortina", path: string) => Promise<LibraryRoot>;
  listRoots: () => Promise<LibraryRoot[]>;
  detectLegacy: (
    path?: string | null,
  ) => Promise<{ available: boolean; rootPath: string }>;
  importLegacy: (rootPath: string) => Promise<{
    tandasImported: number;
    tracksUpdated: number;
    missingTracks: number;
    rootPath: string;
  }>;
  scanAll: () => Promise<ScanSummary>;
  scanKind: (kind: "music" | "cortina") => Promise<ScanSummary>;
  listTracks: () => Promise<TrackRow[]>;
  onScanProgress: (handler: (progress: ScanProgress) => void) => () => void;
  resetDatabase: () => Promise<{ ok: boolean }>;
  listTrackPage: (params: TrackPageRequest) => Promise<TrackRow[]>;
  jumpToPrefix: (params: JumpRequest) => Promise<{ offset: number }>;
  getJumpIndex: (params: { sortBy?: string }) => Promise<string[]>;
  searchTracks: (params: TrackSearchRequest) => Promise<TrackRow[]>;
  searchTrackCount: (params: {
    query: string;
    styles: string[];
    minScore?: number;
    bpmRange?: number;
  }) => Promise<number>;
  searchJumpIndex: (params: {
    query: string;
    styles: string[];
    sortBy?: string;
    minScore?: number;
    bpmRange?: number;
  }) => Promise<string[]>;
  searchJumpToPrefix: (params: {
    query: string;
    styles: string[];
    prefix: string;
    sortBy?: string;
    sortDir?: string;
    minScore?: number;
    bpmRange?: number;
  }) => Promise<{ offset: number }>;
  getTracksByIds: (ids: string[]) => Promise<TrackRow[]>;
  listRecentTracks: (limit: number) => Promise<string[]>;
  getTrackStyles: () => Promise<string[]>;
  updateTrack: (payload: {
    id: string;
    title?: string | null;
    artist?: string | null;
    singer?: string | null;
    album?: string | null;
    year?: string | null;
    genre?: string | null;
    bpm?: number | null;
    notes?: string | null;
    instrumental?: boolean | null;
  }) => Promise<TrackRow | null>;
  getWaveform: (trackId: string) => Promise<string | null>;
  generateWaveform: (trackId: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  getDiagnosticsPaths: () => Promise<{
    userData: string;
    waveformsDir: string;
    ffmpegPath: string;
    ffprobePath: string;
  }>;
  listStyles: () => Promise<string[]>;
  addStyle: (name: string) => Promise<{ ok: boolean }>;
  removeStyle: (name: string) => Promise<{ ok: boolean }>;
  replaceDefaultStyles: (params: {
    oldStyles: string[];
    newStyles: string[];
  }) => Promise<{ ok: boolean }>;
  listTandas: () => Promise<TandaDetail[]>;
  getTandasByIds: (ids: string[]) => Promise<TandaDetail[]>;
  saveTanda: (payload: {
    id: string;
    name: string;
    styles: string[];
    rating: number;
    instrumental: boolean;
    total_duration_ms: number;
    track_slots: (string | null)[];
  }) => Promise<TandaDetail>;
  deleteTanda: (id: string) => Promise<{ ok: boolean }>;
  searchTandas: (params: {
    query: string;
    styles: string[];
  }) => Promise<TandaSearchRow[]>;
  listCortinaSets: () => Promise<string[]>;
  listCortinas: (setName: string) => Promise<CortinaTrackRow[]>;
  searchCortinas: (params: {
    query: string;
    setName?: string;
  }) => Promise<CortinaTrackRow[]>;
  closeApp: () => Promise<void>;
  respondToCloseRequest: (allowed: boolean) => Promise<void>;
  onAppCloseRequest: (handler: () => void) => () => void;
  logClientError: (params: { message: string; stack?: string }) => Promise<void>;
  toggleFullscreen: () => Promise<{ fullscreen: boolean }>;
};

declare global {
  interface Window {
    tanda?: AppApi;
  }
}

export {};
