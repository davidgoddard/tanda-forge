import type { PlaylistExportManifest } from "./library-transfer";
import type { StoredPlaylistState } from "./playlist-storage";

export type LibraryRoot = {
  id: string;
  kind: "music" | "cortina" | "background";
  path: string;
  label: string;
  available: boolean;
};

export type DisplayUpdatePayload = {
  title?: string;
  artist?: string;
  singer?: string;
  progressText?: string;
  nextTandaHintText?: string;
  nextTandaText?: string;
  backgroundIntervalSec?: number;
  useBackgroundImages?: boolean;
  imageDimOpacity?: number;
  fontScale?: number;
  cortinaFontScale?: number;
  edgePaddingVmin?: number;
  mode?: "normal" | "cortina";
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

export type SuspiciousTrackLength = {
  id: string;
  title: string;
  relativePath: string;
  durationMs: number;
  effectiveDurationMs: number;
  removedMs: number;
};

export type CompressionReadinessIssue = {
  id: string;
  relativePath: string;
  rootKind: "music" | "cortina";
  status: "missing" | "invalid-source";
};

export type StartupFlowPhase = "music" | "cortina" | "compression" | "complete" | "failed";

export type CompressedTrackLookupParams = {
  trackId: string;
  filePath: string;
  loudnessDb?: number | null;
  depthPercent: number;
  mode: "upward" | "track-leveler";
  liftThresholdDb: number;
  maxLiftDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  gateThresholdDb: number;
  limiterCeilingDb: number;
  limiterReleaseMs: number;
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

export type E2ESeedTrack = {
  id: string;
  root_id: "root-music" | "root-cortina";
  relative_path: string;
  full_path: string;
  file_hash: string;
  file_size: number;
  file_mtime_ms: number;
  title: string;
  artist: string;
  artist_summary: string;
  album: string;
  album_artist: string;
  singer: string;
  year: string;
  genre: string;
  bpm: number;
  notes: string;
  instrumental: number;
  duration_ms: number;
};

export type E2ESeedTanda = {
  id: string;
  name: string;
  rating: number;
  instrumental: number;
  tracks: string[];
  style: string;
};

export type E2ESeedPayload = {
  roots: {
    musicRoot: string;
    cortinaRoot: string;
    backgroundRoot: string;
  };
  styles: string[];
  tracks: E2ESeedTrack[];
  tandas: E2ESeedTanda[];
};

export type AppApi = {
  ping: () => Promise<string>;
  pickRoot: (kind: "music" | "cortina" | "background") => Promise<string | null>;
  pickDataLocation: () => Promise<string | null>;
  getDataLocation: () => Promise<{ path: string; defaultPath: string }>;
  setDataLocation: (path: string | null) => Promise<{ path: string }>;
  addRoot: (kind: "music" | "cortina" | "background", path: string) => Promise<LibraryRoot>;
  listRoots: () => Promise<LibraryRoot[]>;
  detectLegacy: (
    path?: string | null,
  ) => Promise<{ available: boolean; rootPath: string }>;
  importLegacy: (rootPath: string) => Promise<{
    tandasImported: number;
    tracksUpdated: number;
    missingTracks: number;
    missingFiles: { filePath: string; message: string }[];
    rootPath: string;
  }>;
  listLegacyStyles: (rootPath: string) => Promise<{
    ok: boolean;
    styles: Array<{
      value: string;
      normalized: string;
      count: number;
      mappedTo: string;
    }>;
  }>;
  scanAll: () => Promise<ScanSummary>;
  scanKind: (kind: "music" | "cortina") => Promise<ScanSummary>;
  refreshStoredMetadata: () => Promise<{
    ok: boolean;
    total: number;
    updated: number;
    unchanged: number;
    error?: string;
  }>;
  runStartupFlow: (params: {
    mode: "upward" | "track-leveler";
    liftThresholdDb: number;
    maxLiftDb: number;
    ratio: number;
    attackMs: number;
    releaseMs: number;
    gateThresholdDb: number;
    limiterCeilingDb: number;
    limiterReleaseMs: number;
  }) => Promise<
    | {
        ok: true;
        musicScan: ScanSummary;
        cortinaScan: ScanSummary;
        precompute: {
          rendered: number;
          cached: number;
          failed: number;
          eligible: number;
          ready: number;
          missing: number;
          invalidSource: number;
          missingTracks: CompressionReadinessIssue[];
          errors: { filePath: string; message: string }[];
        };
      }
    | {
        ok: false;
        error: string;
      }
  >;
  listTracks: () => Promise<TrackRow[]>;
  onScanProgress: (handler: (progress: ScanProgress) => void) => () => void;
  onStartupFlowProgress: (handler: (progress: {
    phase: StartupFlowPhase;
  }) => void) => () => void;
  resetDatabase: () => Promise<{ ok: boolean }>;
  clearCachedFiles: () => Promise<{ ok: boolean }>;
  exportSystemData: () => Promise<{
    ok: boolean;
    cancelled?: boolean;
    path: string;
    error?: string;
  }>;
  importSystemData: () => Promise<{
    ok: boolean;
    cancelled?: boolean;
    path: string;
    error?: string;
  }>;
  exportTandasData: () => Promise<{
    ok: boolean;
    cancelled?: boolean;
    path: string;
    error?: string;
  }>;
  exportPlaylistData: (manifest: PlaylistExportManifest) => Promise<{
    ok: boolean;
    cancelled?: boolean;
    path: string;
    error?: string;
  }>;
  importPlaylistData: () => Promise<{
    ok: boolean;
    cancelled?: boolean;
    path: string;
    error?: string;
    format?: "tanda-forge-playlist" | "m3u";
    state?: StoredPlaylistState;
    warnings?: string[];
  }>;
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
  listRecentTandas: (limit: number) => Promise<string[]>;
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
  getCompressedTrackPath: (params: CompressedTrackLookupParams) => Promise<{
    ok: boolean;
    filePath?: string;
    cached?: boolean;
    error?: string;
  }>;
  renderCompressedTrack: (params: CompressedTrackLookupParams) => Promise<{
    ok: boolean;
    filePath?: string;
    cached?: boolean;
    error?: string;
  }>;
  precomputeCompressedTracks: (params: {
    mode: "upward" | "track-leveler";
    liftThresholdDb: number;
    maxLiftDb: number;
    ratio: number;
    attackMs: number;
    releaseMs: number;
    gateThresholdDb: number;
    limiterCeilingDb: number;
    limiterReleaseMs: number;
  }) => Promise<{
    ok: boolean;
    rendered: number;
    cached: number;
    failed: number;
    eligible: number;
    ready: number;
    missing: number;
    invalidSource: number;
    missingTracks?: CompressionReadinessIssue[];
    errors?: { filePath: string; message: string }[];
    error?: string;
  }>;
  onPrecomputeCompressedProgress: (handler: (progress: {
    current: number;
    total: number;
    rendered: number;
    cached: number;
    failed: number;
    currentFile?: string | null;
    latestError?: { filePath: string; message: string } | null;
    done: boolean;
  }) => void) => () => void;
  getSearchDiversityStats: () => Promise<{
    orchestraRows: Array<{ artist: string; total: number; styles: Record<string, number> }>;
    availableOrchestraRows: Array<{
      artist: string;
      trackCount: number;
      styles: Record<string, number>;
      yearCount: number;
      tempoCount: number;
    }>;
    yearBuckets: Array<[number, number]>;
    yearStyleBuckets: Array<[number, Array<[string, number]>]>;
    tempoBuckets: Array<[number, number]>;
    tempoStyleBuckets: Array<[number, Array<[string, number]>]>;
    styleBuckets: Array<[string, number]>;
    availableYearBuckets: Array<[number, number]>;
    availableTempoBuckets: Array<[number, number]>;
    availableStyleBuckets: Array<[string, number]>;
  }>;
  getDiagnosticsPaths: () => Promise<{
    userData: string;
    waveformsDir: string;
    compressedCacheDir: string;
    ffmpegPath: string;
    ffmpegSource: "bundled" | "override" | "path";
    ffprobePath: string;
    ffprobeSource: "bundled" | "override" | "path";
    ffmpegToolsDir: string;
    playbackLogPath: string;
  }>;
  pickFfmpegToolsDir: () => Promise<string | null>;
  getFfmpegToolsDir: () => Promise<{ path: string }>;
  setFfmpegToolsDir: (path: string | null) => Promise<{ path: string }>;
  verifyCachedFiles: () => Promise<{
    ok: boolean;
    waveformFiles: number;
    waveformRemoved: number;
    compressedFiles: number;
    compressedRemoved: number;
    eligible: number;
    ready: number;
    missing: number;
    invalidSource: number;
  }>;
  getDiagnosticsLogs: (params: {
    kind: "playback" | "renderer";
    limit?: number;
  }) => Promise<{ path: string; lines: string[] }>;
  clearDiagnosticsLogs: () => Promise<{ ok: boolean }>;
  getDiagnosticsDataReadiness: () => Promise<{
    totalTracks: number;
    missingDuration: number;
    missingLoudness: number;
    missingTrimSignals: number;
    analysisErrors: number;
    missingWaveforms: number;
    compressedEligible: number;
    compressedReady: number;
    compressedMissing: number;
    compressedInvalidSource: number;
    missingCompressedTracks: CompressionReadinessIssue[];
    shortDurationTracks: SuspiciousTrackLength[];
    aggressivelyTrimmedTracks: SuspiciousTrackLength[];
  }>;
  logPlaybackDiagnostic: (params: {
    channel: "main" | "headphone";
    mode: "prep" | "live" | "edit";
    trackId: string;
    title: string;
    artist: string;
    playlistStatus: "idle" | "playing" | "paused";
    playlistIndex: number;
    trackIndex: number;
    gainSource: "gain_db" | "loudness_db" | "none";
    gainDb: number | null;
    loudnessDb: number | null;
    linearGain: number;
    correctionDb?: number;
    driftDb?: number;
    targetLoudnessDb?: number;
    expectedOutputLoudnessDb?: number | null;
    requestedOutputDeviceId?: string | null;
    appliedOutputDeviceId?: string | null;
    outputRouteMethod?: string;
    outputRouteError?: string | null;
    attemptedOutputDeviceIds?: string[];
  }) => Promise<void>;
  listStyles: () => Promise<string[]>;
  listStyleDefinitions: () => Promise<Array<{ name: string; aliases: string[] }>>;
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
  listBackgroundImages: (group?: "images" | "cortina_images") => Promise<string[]>;
  openDisplay: () => Promise<{ ok: boolean }>;
  getDisplayStatus: () => Promise<{
    open: boolean;
    lastPayload: DisplayUpdatePayload | null;
  }>;
  updateDisplay: (payload: DisplayUpdatePayload) => Promise<void>;
  onDisplayUpdate: (handler: (payload: DisplayUpdatePayload) => void) => () => void;
  closeApp: () => Promise<void>;
  respondToCloseRequest: (allowed: boolean) => Promise<void>;
  onAppCloseRequest: (handler: () => void) => () => void;
  logClientError: (params: { message: string; stack?: string }) => Promise<void>;
  toggleFullscreen: () => Promise<{ fullscreen: boolean }>;
  seedE2eData: (payload: E2ESeedPayload) => Promise<{ ok: boolean }>;
};

declare global {
  interface Window {
    tanda?: AppApi;
  }
}

export {};
