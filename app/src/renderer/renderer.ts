import {
  buildTandaArtistSortKey,
  deriveInstrumental,
  normalizeStyleName,
  summarizeArtistName,
  summarizeTandaTracks,
  collectStylesFromTracks,
} from "../shared/tanda-utils.js";
import { applySearchSortDefaults } from "../shared/search-sort.js";
import { buildTrackSearchQuery } from "../shared/search-query.js";
import {
  buildTandaSearchQuery,
  resolveTandaSearchStyles,
} from "../shared/tanda-search.js";
import {
  getSequenceRule,
  parseSequence,
  parseStyleMap,
  validateTandaForRule,
  type SequenceEntry,
  type StyleMap,
} from "../shared/playlist-sequence.js";
import {
  buildPlaylistDuplicateIndex,
  getDuplicateStatusForTanda,
  getDuplicateStatusForTrack,
  type PlaylistDuplicateIndex,
  type PlaylistDuplicateSource,
} from "../shared/playlist-duplicates.js";
import {
  getDefaultSlotSize,
  getDefaultStylesForRule,
} from "../shared/playlist-defaults.js";
import { shouldAutoCenterPlaylist } from "../shared/playlist-autocenter.js";
import {
  computeCortinaStartOffsetMs,
  computeElapsedMsForEntry,
  computeTimelineOffsetsMs,
  computeTimelineTotalMs,
  getMinutesOfDayFromMs,
  type TimelineEntry,
} from "../shared/playlist-live.js";
import { reorderClipboardCollections } from "../shared/clipboard-order.js";
import { moveTrackToCollection } from "../shared/clipboard-move.js";
import { computeTrimmedEnd } from "../shared/audio-trim.js";
import {
  resolveContinuationIndexAfterEndCortina,
  shouldContinueAfterEndCortina,
  shouldInsertCortinaBeforeTanda,
} from "../shared/playlist-flow.js";
import { getCortinaRowIndices } from "../shared/cortina-plan.js";

const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const addMusicBtn = document.querySelector<HTMLButtonElement>("#add-music");
const addCortinaBtn = document.querySelector<HTMLButtonElement>("#add-cortina");
const scanMusicBtn =
  document.querySelector<HTMLButtonElement>("#scan-music");
const scanCortinasBtn =
  document.querySelector<HTMLButtonElement>("#scan-cortinas");
const errorList = document.querySelector<HTMLUListElement>("#error-list");
const diagnosticsPathsEl =
  document.querySelector<HTMLDivElement>("#diagnostics-paths");
const diagnosticsWaveformBtn =
  document.querySelector<HTMLButtonElement>("#diagnostics-waveform");
const diagnosticsWaveformResult =
  document.querySelector<HTMLDivElement>("#diagnostics-waveform-result");

let allowAppClose = false;
const progressEl = document.querySelector<HTMLProgressElement>("#scan-progress");
const progressLabel = document.querySelector<HTMLDivElement>("#progress-label");
const progressElSettings =
  document.querySelector<HTMLProgressElement>("#scan-progress-settings");
const progressLabelSettings =
  document.querySelector<HTMLDivElement>("#progress-label-settings");
const settingsPanel = document.querySelector<HTMLElement>("#settings-panel");
const closeSettingsBtn =
  document.querySelector<HTMLButtonElement>("#close-settings");
const dataLocationPathInput =
  document.querySelector<HTMLInputElement>("#data-location-path");
const dataLocationChooseBtn =
  document.querySelector<HTMLButtonElement>("#data-location-choose");
const legacyImportSection =
  document.querySelector<HTMLDivElement>("#legacy-import");
const playlistTandaEditorEl =
  document.querySelector<HTMLDivElement>("#playlist-tanda-editor");
const legacyImportDescription =
  document.querySelector<HTMLParagraphElement>("#legacy-import-description");
const legacyImportButton =
  document.querySelector<HTMLButtonElement>("#legacy-import-button");
const clipboardClearBtn =
  document.querySelector<HTMLButtonElement>("#clipboard-clear");
const clipboardFilterInput =
  document.querySelector<HTMLInputElement>("#clipboard-filter");
const tabButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".settings-tabs button"),
);
const tabPanels = Array.from(
  document.querySelectorAll<HTMLElement>(".settings-tab"),
);
const rootList = document.querySelector<HTMLDivElement>("#root-list");
const rootBanner = document.querySelector<HTMLDivElement>("#root-banner");
const rootBannerText =
  document.querySelector<HTMLDivElement>("#root-banner-text");
const openSettingsBtn =
  document.querySelector<HTMLButtonElement>("#open-settings");
const resetDbBtn = document.querySelector<HTMLButtonElement>("#reset-db");
const searchInput = document.querySelector<HTMLInputElement>("#search-input");
const styleOptions = document.querySelector<HTMLDivElement>("#style-options");
const searchTracksEl = document.querySelector<HTMLDivElement>("#search-tracks");
const searchTandasEl = document.querySelector<HTMLDivElement>("#search-tandas");
const searchTrackHeader =
  document.querySelector<HTMLDivElement>("#search-track-header");
const searchTandaHeader =
  document.querySelector<HTMLDivElement>("#search-tanda-header");
const searchListBody =
  document.querySelector<HTMLDivElement>("#search-list-body");
const searchJumpIndex =
  document.querySelector<HTMLDivElement>("#search-jump-index");
const searchSortButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".search-header button[data-sort]"),
);
const clipTracksEl = document.querySelector<HTMLDivElement>("#clip-tracks");
const clipTandasEl = document.querySelector<HTMLDivElement>("#clip-tandas");
const playlistListEl = document.querySelector<HTMLDivElement>("#playlist-list");
const tandaListEl = document.querySelector<HTMLDivElement>("#tanda-list");
const addTandaBtn = document.querySelector<HTMLButtonElement>("#add-tanda");
const playlistStartBtn =
  document.querySelector<HTMLButtonElement>("#playlist-start");
const playlistResumeBtn =
  document.querySelector<HTMLButtonElement>("#playlist-resume");
const playlistStopBtn =
  document.querySelector<HTMLButtonElement>("#playlist-stop");
const playlistClearBtn =
  document.querySelector<HTMLButtonElement>("#playlist-clear");
const clipListBody = clipTracksEl?.closest(".list-body") ?? null;
const clipPanel = clipTracksEl?.closest(".panel") ?? null;
const playlistPanel = playlistListEl?.closest(".panel") ?? null;
const clipboardCollectionsTabs = document.querySelector<HTMLDivElement>(
  "#clipboard-collections-tabs",
);
const clipboardCollectionsInclude = document.querySelector<HTMLDivElement>(
  "#clipboard-collections-include",
);
const clipboardCollectionNameInput =
  document.querySelector<HTMLInputElement>("#clipboard-collection-name");
const clipboardCollectionAddBtn =
  document.querySelector<HTMLButtonElement>("#clipboard-collection-add");
const clipboardCollectionRemoveBtn =
  document.querySelector<HTMLButtonElement>("#clipboard-collection-remove");
const clipboardNewLimitInput =
  document.querySelector<HTMLInputElement>("#clipboard-new-limit");
const panelTabButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".panel .tab-bar button[data-tab]"),
);
const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle");
const closeAppBtn = document.querySelector<HTMLButtonElement>("#close-app");
const fullscreenToggle =
  document.querySelector<HTMLButtonElement>("#fullscreen-toggle");
const languageSelect =
  document.querySelector<HTMLSelectElement>("#language-select");
const styleNameInput =
  document.querySelector<HTMLInputElement>("#style-name-input");
const styleAddBtn = document.querySelector<HTMLButtonElement>("#style-add");
const styleList = document.querySelector<HTMLDivElement>("#style-list");
const modeSelect = document.querySelector<HTMLSelectElement>("#mode-select");
const mainOutputSelect =
  document.querySelector<HTMLSelectElement>("#main-output-select");
const headphoneOutputSelect =
  document.querySelector<HTMLSelectElement>("#headphone-output-select");
const tandaSizeInput =
  document.querySelector<HTMLInputElement>("#tanda-size-input");
const searchTandaSizeInput =
  document.querySelector<HTMLInputElement>("#search-tanda-size");
const searchMinScoreInput =
  document.querySelector<HTMLInputElement>("#search-min-score");
const searchBpmRangeInput =
  document.querySelector<HTMLInputElement>("#search-bpm-range");
const trimPaddingInput =
  document.querySelector<HTMLInputElement>("#trim-padding");
const gapBetweenTracksInput = document.querySelector<HTMLInputElement>(
  "#gap-between-tracks",
);
const gapBeforeTandaInput =
  document.querySelector<HTMLInputElement>("#gap-before-tanda");
const gapBeforeCortinaInput =
  document.querySelector<HTMLInputElement>("#gap-before-cortina");
const playlistStartTimeInput =
  document.querySelector<HTMLInputElement>("#playlist-start-time");
const stopFadeInput =
  document.querySelector<HTMLInputElement>("#stop-fade-duration");
const playlistSequenceInput =
  document.querySelector<HTMLInputElement>("#playlist-sequence");
const playlistStyleMapInput =
  document.querySelector<HTMLTextAreaElement>("#playlist-style-map");
const playlistCortinaSetSelect =
  document.querySelector<HTMLSelectElement>("#playlist-cortina-set");
const playlistCortinaDurationInput =
  document.querySelector<HTMLInputElement>("#playlist-cortina-duration");
const searchButton = document.querySelector<HTMLButtonElement>("#search-button");
const searchCount = document.querySelector<HTMLDivElement>("#search-count");
const alertBanner = document.querySelector<HTMLDivElement>("#alert-banner");
const openDiagnosticsMain =
  document.querySelector<HTMLButtonElement>("#open-diagnostics-main");
const openDiagnosticsSettings =
  document.querySelector<HTMLButtonElement>("#open-diagnostics-settings");
const nowPlayingTrack =
  document.querySelector<HTMLDivElement>("#now-playing-track");
const nowPlayingTime =
  document.querySelector<HTMLSpanElement>("#now-playing-time");
const nowPlayingSource =
  document.querySelector<HTMLSpanElement>("#now-playing-source");
const nowPlayingSection =
  document.querySelector<HTMLElement>("#now-playing");
const waveformContainer =
  document.querySelector<HTMLDivElement>("#waveform-container");
const waveformImage =
  document.querySelector<HTMLImageElement>("#waveform-image");
const waveformPlaceholder =
  document.querySelector<HTMLDivElement>("#waveform-placeholder");
const waveformProgress =
  document.querySelector<HTMLDivElement>("#waveform-progress");
const waveformPlayhead =
  document.querySelector<HTMLDivElement>("#waveform-playhead");
const cortinaControls =
  document.querySelector<HTMLDivElement>("#cortina-controls");
const cortinaStopBtn =
  document.querySelector<HTMLButtonElement>("#cortina-stop");
const cortinaPlayBtn =
  document.querySelector<HTMLButtonElement>("#cortina-play");
const cortinaModal =
  document.querySelector<HTMLElement>("#cortina-modal");
const cortinaModalClose =
  document.querySelector<HTMLButtonElement>("#cortina-modal-close");
const cortinaModalSet =
  document.querySelector<HTMLSelectElement>("#cortina-modal-set");
const cortinaSearchInput =
  document.querySelector<HTMLInputElement>("#cortina-search-input");
const cortinaResults =
  document.querySelector<HTMLDivElement>("#cortina-results");
const trackEditor = document.querySelector<HTMLElement>("#track-editor");
const trackEditorTitleInput =
  document.querySelector<HTMLInputElement>("#track-editor-title");
const trackEditorArtistInput =
  document.querySelector<HTMLInputElement>("#track-editor-artist");
const trackEditorSingerInput =
  document.querySelector<HTMLInputElement>("#track-editor-singer");
const trackEditorVocalInput =
  document.querySelector<HTMLSelectElement>("#track-editor-vocal");
const trackEditorAlbumInput =
  document.querySelector<HTMLInputElement>("#track-editor-album");
const trackEditorYearInput =
  document.querySelector<HTMLInputElement>("#track-editor-year");
const trackEditorGenreInput =
  document.querySelector<HTMLSelectElement>("#track-editor-genre");
const trackEditorNotesInput =
  document.querySelector<HTMLTextAreaElement>("#track-editor-notes");
const trackEditorBpmInput =
  document.querySelector<HTMLInputElement>("#track-editor-bpm");
const trackEditorTapBtn =
  document.querySelector<HTMLButtonElement>("#track-editor-tap");
const trackEditorSaveBtn =
  document.querySelector<HTMLButtonElement>("#track-editor-save");
const trackEditorResetBtn =
  document.querySelector<HTMLButtonElement>("#track-editor-reset");
const trackEditorCancelBtn =
  document.querySelector<HTMLButtonElement>("#track-editor-cancel");

let headphoneAvailable = false;
let audioOutputs: MediaDeviceInfo[] = [];

type TrackRow = import("../shared/types").TrackRow;

type TandaDetail = {
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

type TandaSearchRow = {
  id: string;
  name: string;
  styles: string[];
  rating: number;
  instrumental: boolean;
  total_duration_ms: number;
  track_count: number;
};

const SEARCH_PAGE_SIZE = 120;
const JUMP_PREFIXES = [
  "0-9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "#",
];

const DEFAULT_STYLE_LANG_KEY = "tanda-default-style-lang";
const DEFAULT_STYLE_NAMES_KEY = "tanda-default-style-names";
const SEARCH_MIN_SCORE_KEY = "tanda-search-min-score";
const SEARCH_BPM_RANGE_KEY = "tanda-search-bpm-range";
const TRIM_PADDING_KEY = "tanda-trim-padding";
const PLAYLIST_STORAGE_KEY = "tanda-playlist-items";
const PLAYLIST_AUTO_CENTER_IDLE_MS = 2 * 60 * 1000;
const DEFAULT_SEARCH_MIN_SCORE = 0.25;
const DEFAULT_SEARCH_BPM_RANGE = 5;
const CORTINA_SET_KEY = "tanda-cortina-set";
const DEFAULT_CORTINA_SET_ID = "__default__";
const CORTINA_DURATION_KEY = "tanda-cortina-duration";
const DEFAULT_CORTINA_DURATION = 40;

type SearchState = {
  items: TrackRow[];
  total: number;
  offsetStart: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  isLoading: boolean;
  sortMode: "auto" | "manual";
  lastQuery: string;
};

let searchState: SearchState = {
  items: [],
  total: 0,
  offsetStart: 0,
  sortBy: "title",
  sortDir: "asc",
  isLoading: false,
  sortMode: "auto",
  lastQuery: "",
};
let clipboardTracks: TrackRow[] = [];
let clipboardFilterText = "";
type PlaylistItem =
  | { kind: "track"; track: TrackRow }
  | { kind: "tanda"; tandaId: string; mismatch?: "style" | "count" };
let playlistItems: (PlaylistItem | null)[] = [null];
let playlistSaveSnapshot = "";
let playlistTargetIndex: number | null = null;
let lastUserInteractionAt = Date.now();
let cortinaSets: string[] = [];
const cortinaTracksBySet = new Map<string, TrackRow[]>();
let cortinaQueue: TrackRow[] = [];
let cortinaPreviewQueue: TrackRow[] = [];
let cortinaPreviewSet: string | null = null;
const cortinaPlannedByIndex = new Map<number, TrackRow>();
let lastCortinaId: string | null = null;
let cortinaPlaying = false;
let cortinaAllowFull = false;
let cortinaStopRequested = false;
let cortinaActiveIndex: number | null = null;
let cortinaOverrideTrack: TrackRow | null = null;
const cortinaOverrideByIndex = new Map<number, TrackRow>();
let cortinaModalSetValue: string | null = null;
let cortinaSetsLoaded = false;
let pendingCortinaTargetIndex: number | null = null;
const pulsePlaylistIndices = new Set<number>();
const pulseCortinaIndices = new Set<number>();
const pulseClipboardTrackIds = new Set<string>();
const pulseClipboardTandaIds = new Set<string>();
let legacyImportRootPath: string | null = null;
let tandaEditorReturnTab: RightPanelTab | null = null;

type StoredPlaylistItem =
  | { kind: "track"; id: string }
  | { kind: "tanda"; id: string; mismatch?: "style" | "count" }
  | null;
let selectedClipboardTrackId: string | null = null;
let selectedClipboardTandaId: string | null = null;
let selectedStyles: string[] = [];
let availableStyles: string[] = [];

type ClipboardCollection = {
  id: string;
  name: string;
  trackIds: string[];
  tandaIds: string[];
};

const CLIPBOARD_COLLECTIONS_KEY = "tanda-clipboard-collections";
const CLIPBOARD_ACTIVE_KEY = "tanda-clipboard-active";
const CLIPBOARD_INCLUDE_KEY = "tanda-clipboard-include";
const CLIPBOARD_NEW_LIMIT_KEY = "tanda-clipboard-new-limit";
const CLIPBOARD_NEW_ID = "new";
const DEFAULT_NEW_LIMIT = 100;
const CORTINA_ANY_ID = "__any__";
const TANDA_SEARCH_SIZE_KEY = "tanda-search-size";

let clipboardCollections: ClipboardCollection[] = [];
let activeClipboardCollectionId: string | null = null;
let includedClipboardCollectionIds: string[] = [];

type TandaDraft = {
  id: string;
  name: string;
  styles: string[];
  rating: number;
  trackSlots: (string | null)[];
};

let tandaDrafts: TandaDraft[] = [];
const tandaCache = new Map<string, TandaDraft>();
let selectedTandaId: string | null = null;
let clipboardTandas: TandaDraft[] = [];
let tandaSearchResults: TandaSearchRow[] = [];

type RightPanelTab = "playlist-tab" | "tanda-designer-tab";
let activeRightTab: RightPanelTab = "playlist-tab";
type SearchTab = "search-tracks" | "search-tandas";
let activeSearchTab: SearchTab = "search-tracks";

type OutputMode = "prep" | "live" | "edit";
let appMode: OutputMode = "prep";

type OutputChannel = "main" | "headphone";

type PlaybackState = {
  active?: HTMLAudioElement;
  currentTrackId?: string;
  track?: TrackRow;
};

const playback: Record<OutputChannel, PlaybackState> = {
  main: {},
  headphone: {},
};

let waveformTrackId: string | null = null;
let waveformRequestId = 0;
let openRowMenuId: string | null = null;
let playlistOpenTandaIndex: number | null = null;
let tandaEditorHostTab: RightPanelTab = "tanda-designer-tab";
let scanRequestInFlight = false;

type TrackEditorState = {
  track: TrackRow | null;
  taps: number[];
  tapTimeoutId: number | null;
};

const trackEditorState: TrackEditorState = {
  track: null,
  taps: [],
  tapTimeoutId: null,
};

const updateTrackEditorPresentation = () => {
  if (!trackEditor) {
    return;
  }
  trackEditor.classList.toggle("non-modal", appMode === "edit");
  if (appMode !== "edit") {
    resetModalCardPosition(trackEditor);
  }
};

type PlaylistPlaybackStatus = "idle" | "playing" | "paused";

type PlaylistResumeState = {
  itemIndex: number;
  trackIndex: number;
  trackId: string;
  resumeTime: number;
};

type PlaylistPlaybackState = {
  status: PlaylistPlaybackStatus;
  runId: number;
  currentIndex: number;
  currentTrackIndex: number;
  activeTandaId: string | null;
  activeTrackId: string | null;
  playedThroughIndex: number;
  resume: PlaylistResumeState | null;
  liveBaseStartMs: number | null;
};

const playlistPlayback: PlaylistPlaybackState = {
  status: "idle",
  runId: 0,
  currentIndex: 0,
  currentTrackIndex: 0,
  activeTandaId: null,
  activeTrackId: null,
  playedThroughIndex: -1,
  resume: null,
  liveBaseStartMs: null,
};

const trackCache = new Map<string, TrackRow>();

type LanguageKey = "en" | "es" | "fr" | "de" | "pt" | "it";

const DEFAULT_PLAYLIST_SEQUENCE = "3t 3t 3w";
const DEFAULT_STYLE_MAP = "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga";
const DEFAULT_PLAYLIST_START_TIME = "20:00";

const translations: Record<LanguageKey, Record<string, string>> = {
  en: {
    appTitle: "Tanda Player Lite",
    closeApp: "Close app",
    playlistStart: "Start",
    playlistResume: "Resume",
    playlistStop: "Stop",
    searchTitle: "Search",
    searchPlaceholder: "Search tracks or tandas",
    searchButton: "Search",
    styleLabel: "Styles",
    searchTandaSizeLabel: "Tanda size",
    searchTandaSizeAny: "Any",
    styleAll: "All",
    tabTracks: "Tracks",
    tabTandas: "Tandas",
    tabPlaylist: "Playlist",
    tabTandaDesigner: "Tanda Designer",
    clipboardTitle: "Clipboard",
    clipboardCollectionsLabel: "Collections",
    clipboardCollectionPlaceholder: "New collection",
    clipboardCollectionAdd: "Add",
    clipboardCollectionRemove: "Remove",
    clipboardCollectionInclude: "Include",
    clipboardCollectionGeneral: "General",
    clipboardCollectionNew: "New",
    clipboardFilterPlaceholder: "Filter",
    confirmClipboardCollectionRemove: "Remove collection \"{name}\"?",
    clipboardClear: "Clear",
    playlistTitle: "Playlist",
    playlistHint: "Use tanda menu to mark for replacement and then choose a replacement in the clipboard.",
    playlistClear: "Clear",
    tandasEmpty: "Tandas coming soon.",
    playlistEmptySlot: "Empty tanda",
    playlistEmptyHint: "Drop a track here",
    headphonePreview: "Preview in headphones",
    searchResultsCount: "Results: {count}",
    modeLabel: "Mode",
    modePrep: "Preparation",
    modeLive: "Live",
    modeEdit: "Edit",
    toggleTheme: "Toggle theme",
    toggleFullscreen: "Toggle fullscreen",
    openSettings: "Open Settings",
    settings: "Settings",
    dataLocationLabel: "Data location",
    dataLocationChoose: "Choose…",
    dataLocationHelp: "Data is stored in a _tp_data folder at the selected location.",
    legacyImportTitle: "Legacy Import",
    legacyImportButton: "Import legacy tandas",
    close: "Close",
    idle: "Idle",
    starting: "Starting...",
    nowPlayingLabel: "Now playing",
    nowPlayingIdle: "Idle",
    nowPlayingMain: "Main output",
    nowPlayingHeadphone: "Headphones",
    nowPlayingUnknown: "Unknown track",
    nowPlayingTime: "{current} / {duration}",
    waveformLabel: "Waveform timeline",
    waveformLoading: "Generating waveform...",
    waveformUnavailable: "Waveform unavailable",
    cortinaPickerTitle: "Cortina Picker",
    cortinaSearchLabel: "Search",
    confirmCloseWhilePlaying:
      "Music is still playing. Close the app and stop playback?",
    confirmDataLocationChange:
      "Change data location to {path}? This starts a fresh database.",
    confirmLegacyImport:
      "Import tandas from {path}? This replaces existing tandas and applies legacy track metadata.",
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Remove from clipboard",
    actionRemoveClipboardShort: "R",
    actionRemovePlaylist: "Remove from playlist",
    actionRemovePlaylistShort: "R",
    actionAddPlaylist: "Add to playlist",
    actionAddPlaylistShort: "P",
    actionMarkPlaylist: "Mark playlist target",
    actionMarkPlaylistShort: "M",
    cancelTarget: "Cancel target",
    actionSearch: "Search similar",
    actionSearchShort: "S",
    actionMore: "More actions",
    actionSendClipboard: "Send to clipboard",
    actionSendClipboardShort: "C",
    duplicateFull: "In playlist",
    duplicatePartial: "Partial playlist overlap",
    actionEditTrack: "Edit track",
    actionEditTrackShort: "E",
    actionToggleTanda: "Expand tanda",
    actionToggleTandaShort: "E",
    actionEditTanda: "Edit tanda",
    actionEditTandaShort: "T",
    colTrack: "Track",
    colTitle: "Title",
    colArtist: "Artist",
    colAlbum: "Album",
    colYear: "Year",
    colActions: "Actions",
    colDuration: "Duration",
    colStart: "Start",
    colEndTrim: "End Trim",
    trackEditorTitle: "Edit track",
    trackEditorTitleLabel: "Title",
    trackEditorArtistLabel: "Artist",
    trackEditorSingerLabel: "Singer",
    trackEditorVocalLabel: "Vocal",
    trackEditorVocalSung: "Sung",
    trackEditorVocalInstrumental: "Instrumental",
    trackEditorAlbumLabel: "Album",
    trackEditorYearLabel: "Year",
    trackEditorGenreLabel: "Style",
    trackEditorNotesLabel: "Notes",
    trackEditorBpmLabel: "BPM",
    trackEditorTapTempo: "Tap tempo",
    trackEditorTapHint: "Tap to set BPM · Wait 3 seconds to reset",
    trackEditorSave: "Save",
    trackEditorReset: "Reset",
    trackEditorCancel: "Cancel",
    actionAddClipboard: "Add to clipboard",
    actionAddTanda: "Add to tanda",
    colStatus: "Status",
    tabLibrary: "Library",
    tabDiagnostics: "Diagnostics",
    tabSystem: "System",
    tabPlaylistSettings: "Playlist",
    libraryRoots: "Library Roots",
    libraryRootsHelp: "Configure music and cortina folders used for scanning.",
    addMusicFolder: "Add Music Folder",
    addCortinaFolder: "Add Cortina Folder",
    scanLibrary: "Scan Library",
    scanMusic: "Scan Music",
    scanCortinas: "Scan Cortinas",
    system: "System",
    mainOutput: "Main Output",
    headphoneOutput: "Headphones Output",
    language: "Language",
    languageHelp: "Language selection affects UI labels and formatting.",
    styleManagerLabel: "Styles",
    styleAdd: "Add",
    styleRemove: "Remove",
    styleRemoveLabel: "Remove style: {style}",
    styleEmpty: "No styles yet.",
    styleNone: "None",
    defaultStyleTango: "Tango",
    defaultStyleWaltz: "Waltz",
    defaultStyleMilonga: "Milonga",
    defaultTandaSize: "Default tanda size",
    clipboardNewLimitLabel: "New collection size",
    searchMinScoreLabel: "Search minimum score",
    searchBpmRangeLabel: "BPM search range",
    trimPaddingLabel: "Trim padding (sec)",
    trimPaddingHelp: "Reduces auto-detected start/end trims by this amount.",
    playlistSettingsTitle: "Playlist Settings",
    playlistStartTimeLabel: "Playlist start time",
    playlistSequenceLabel: "Tanda sequence",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Style mapping",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    scanIssues: "Scan Issues",
    scanIssuesHelp: "Recent scan problems and files that need attention.",
    scanIssuesMore: "...and {count} more",
    viewScanIssues: "View scan issues",
    diagnosticsPaths: "Paths",
    diagnosticsPathsUserData: "User data",
    diagnosticsPathsWaveforms: "Waveforms",
    diagnosticsPathsFfmpeg: "ffmpeg",
    diagnosticsPathsFfprobe: "ffprobe",
    diagnosticsWaveform: "Waveform",
    diagnosticsWaveformRun: "Generate waveform for current track",
    diagnosticsWaveformNoTrack: "No track is currently playing.",
    diagnosticsWaveformSuccess: "Waveform generated: {path}",
    diagnosticsWaveformFailed: "Waveform failed: {message}",
    eraseDatabase: "Erase Database",
    statusIssue: "Issue",
    statusOk: "OK",
    statusPreparingScan: "Preparing scan...",
    statusScanInProgress: "Scan already running.",
    statusScanning: "Scanning...",
    statusScanProgress: "Scanning {current}/{total} ({root})",
    statusScanComplete:
      "Scan complete. Scanned {scanned}, added {added}, updated {updated}, removed {removed}.",
    statusScanIssues: "Scan complete. {count} issues.",
    statusScanFailed: "Scan failed.",
    statusScanFailedDetail: "Scan failed: {message}",
    statusScanFailedNoResponse: "Scan failed: no response from main process.",
    statusFullscreenUnavailable: "Fullscreen is unavailable.",
    statusFullscreenFailed: "Fullscreen toggle failed.",
    statusFullscreenFailedDetail: "Fullscreen toggle failed: {message}",
    statusMainProcess: "Main process says: {message}",
    statusNoApi: "API bridge not available.",
    statusUnknownError: "Unknown error.",
    statusRendererError: "A problem occurred. Details have been logged.",
    statusLanguageSet: "Language set to {language}.",
    statusAddedMusic: "Added music folder: {path}.",
    statusAddedCortina: "Added cortina folder: {path}.",
    statusDatabaseErased: "Database erased. Add folders to begin scanning.",
    statusNoRoots:
      "No music folders configured. Add a music folder in Settings to begin scanning.",
    statusDataLocationChanged: "Data location set to {path}. Database reset.",
    statusDataLocationDuringPlayback: "Stop playback before changing data location.",
    legacyImportDetected:
      "Legacy files detected at {path}. Import tandas and legacy metadata?",
    statusLegacyImportDone:
      "Imported {tandas} tandas. Updated {tracks} tracks. Missing {missing} tracks.",
    statusMissingRoots:
      "Some library folders are unavailable. Connect the drive or update Settings.",
    statusTandaSaved: "Tanda saved.",
    statusTandaDeleted: "Tanda deleted.",
    statusTandaSentToClipboard: "Tanda sent to clipboard.",
    statusNoTandaSelected: "Select a tanda to add tracks.",
    statusTrackUpdated: "Track updated.",
    statusTrackUpdateFailed: "Track update failed.",
    statusClipboardReadonlyRemove:
      "Item belongs to an included collection. Switch active collection to remove.",
    statusClipboardCollectionLast: "At least one collection is required.",
    statusClipboardCollectionProtected:
      "This collection is system-managed and cannot be removed.",
    statusClipboardCollectionReadOnly:
      "This collection is read-only. Switch to another collection to add items.",
    statusPlaylistSequenceMismatch:
      "Slot expects {rule}. This tanda is {tanda}.",
    confirmPlaylistSequenceOverride:
      "This slot expects {expected} tracks ({rule}). This tanda has {count}. Use it anyway?",
    confirmPlaylistSequenceStyleOverride:
      "Slot expects {rule}. This tanda is {tanda}. Add anyway?",
    allowOverride: "Allow anyway",
    dismissWarning: "Dismiss",
    playlistMismatchTooltip: "Slot expects {rule}. This tanda is {tanda}.",
    statusStyleAdded: "Style added: {style}.",
    statusStyleAddFailed: "Could not add style.",
    statusTandaLocked: "This tanda is locked during live playback.",
    statusWaveformLoading: "Generating waveform...",
    statusWaveformUnavailable: "Waveform unavailable for this track.",
    statusPlaylistLocked: "This playlist slot is locked during live playback.",
    statusPlaylistNoEmptySlot: "Add a blank slot before adding to the playlist.",
    statusClipboardCleared: "General clipboard cleared.",
    statusPlaylistCleared: "Playlist cleared.",
    confirmPlaylistClear: "Clear the playlist and remove all items?",
    outputSelectionFailed: "Output selection failed.",
    outputSelectionFailedDetail: "Output selection failed: {message}",
    playbackFailed: "Playback failed.",
    playbackFailedDetail: "Playback failed: {message}",
    outputDefault: "Default Output",
    outputSelectHeadphones: "Select headphones output",
    outputNoSecondary: "No secondary output available",
    gapBetweenTracks: "Gap between tracks (sec)",
    gapBeforeTanda: "Gap before tanda (sec)",
    gapBeforeCortina: "Gap before cortina (sec)",
    cortinaSetLabel: "Cortina set",
    cortinaDefaultSet: "Default",
    cortinaAny: "Any",
    cortinaNone: "None",
    cortinaDurationLabel: "Cortina duration (sec)",
    cortinaRowLabel: "Cortina",
    cortinaRowHint: "Click to choose a cortina",
    cortinaStopLabel: "Stop cortina",
    cortinaPlayLabel: "Play cortina",
    statusCortinaSelected: "Cortina selected: {title}.",
    statusCortinaLocked: "This cortina has already played and cannot be changed.",
    stopFade: "Stop fade (sec)",
    addTanda: "Add Tanda",
    tandaNameLabel: "Tanda name",
    tandaStylesLabel: "Styles",
    tandaRatingLabel: "Rating",
    tandaInstrumentalLabel: "Instrumental",
    tandaInstrumentalYes: "Yes",
    tandaInstrumentalNo: "No",
    tandaDurationLabel: "Duration",
    tandaTrackCountLabel: "Tracks",
    tandaAnyStyle: "Any",
    tandaPlaceholder: "Empty slot",
    tandaUnknownArtist: "Unknown artist",
    tandaUnknownYear: "Unknown year",
    tandaNonInstrumental: "Sung",
    tandaMixedLabel: "Mixed",
    tandaSave: "Save tanda",
    tandaDone: "Done",
    tandaDelete: "Delete tanda",
    tandaAddSlot: "Add slot",
    tandaToClipboard: "Send to clipboard",
    tandaRemoveTrack: "Send to clipboard",
    tandaMoveUp: "Move up",
    tandaMoveDown: "Move down",
    tandaRemoveTrackShort: "A",
    tandaMoveUpShort: "^",
    tandaMoveDownShort: "v",
    confirmTandaTooSmall:
      "This tanda has {count} tracks (min {min}). Save anyway?",
    confirmDeleteTanda: "Delete this tanda?",
    rootAvailable: "Available",
    rootMissing: "Missing",
    rootMusic: "Music",
    rootCortina: "Cortina",
    lang_en: "English",
    lang_es: "Spanish",
    lang_fr: "French",
    lang_de: "German",
    lang_pt: "Portuguese",
    lang_it: "Italian",
  },
  es: {
    appTitle: "Tanda Player Lite",
    closeApp: "Cerrar app",
    playlistStart: "Iniciar",
    playlistResume: "Reanudar",
    playlistStop: "Detener",
    searchTitle: "Buscar",
    searchPlaceholder: "Buscar temas o tandas",
    searchButton: "Buscar",
    styleLabel: "Estilos",
    searchTandaSizeLabel: "Tamano tanda",
    searchTandaSizeAny: "Cualquiera",
    styleAll: "Todos",
    tabTracks: "Temas",
    tabTandas: "Tandas",
    tabPlaylist: "Playlist",
    tabTandaDesigner: "Disenador de tandas",
    clipboardTitle: "Portapapeles",
    clipboardCollectionsLabel: "Colecciones",
    clipboardCollectionPlaceholder: "Nueva coleccion",
    clipboardCollectionAdd: "Agregar",
    clipboardCollectionRemove: "Quitar",
    clipboardCollectionInclude: "Incluir",
    clipboardCollectionGeneral: "General",
    clipboardCollectionNew: "Nuevos",
    clipboardFilterPlaceholder: "Filtrar",
    confirmClipboardCollectionRemove: "Quitar la coleccion \"{name}\"?",
    clipboardClear: "Limpiar",
    playlistTitle: "Lista",
    playlistHint:
      "Usa el menu de la tanda para marcar el reemplazo y luego elige en el portapapeles.",
    playlistClear: "Limpiar",
    tandasEmpty: "Tandas pronto.",
    playlistEmptySlot: "Tanda vacia",
    playlistEmptyHint: "Suelta un tema aqui",
    headphonePreview: "Preescuchar en auriculares",
    searchResultsCount: "Resultados: {count}",
    modeLabel: "Modo",
    modePrep: "Preparacion",
    modeLive: "En vivo",
    modeEdit: "Editar",
    toggleTheme: "Cambiar tema",
    toggleFullscreen: "Pantalla completa",
    openSettings: "Abrir ajustes",
    settings: "Ajustes",
    dataLocationLabel: "Ubicacion de datos",
    dataLocationChoose: "Elegir…",
    dataLocationHelp:
      "Los datos se guardan en una carpeta _tp_data en la ubicacion seleccionada.",
    legacyImportTitle: "Importacion heredada",
    legacyImportButton: "Importar tandas heredadas",
    close: "Cerrar",
    idle: "Inactivo",
    starting: "Iniciando...",
    nowPlayingLabel: "Reproduciendo",
    nowPlayingIdle: "En espera",
    nowPlayingMain: "Salida principal",
    nowPlayingHeadphone: "Auriculares",
    nowPlayingUnknown: "Pista desconocida",
    nowPlayingTime: "{current} / {duration}",
    waveformLabel: "Linea de onda",
    waveformLoading: "Generando forma de onda...",
    waveformUnavailable: "Forma de onda no disponible",
    cortinaPickerTitle: "Selector de cortinas",
    cortinaSearchLabel: "Buscar",
    confirmCloseWhilePlaying:
      "La musica sigue sonando. Cerrar la app y detener la reproduccion?",
    confirmDataLocationChange:
      "Cambiar ubicacion de datos a {path}? Esto inicia una base nueva.",
    confirmLegacyImport:
      "Importar tandas desde {path}? Esto reemplaza tandas existentes y aplica metadatos.",
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Quitar del portapapeles",
    actionRemoveClipboardShort: "R",
    actionRemovePlaylist: "Quitar de la lista",
    actionRemovePlaylistShort: "R",
    actionAddPlaylist: "Agregar a la lista",
    actionAddPlaylistShort: "P",
    actionMarkPlaylist: "Marcar objetivo en playlist",
    actionMarkPlaylistShort: "M",
    cancelTarget: "Cancelar objetivo",
    actionSearch: "Buscar similares",
    actionSearchShort: "S",
    actionMore: "Mas acciones",
    actionSendClipboard: "Enviar al portapapeles",
    actionSendClipboardShort: "C",
    duplicateFull: "En la lista",
    duplicatePartial: "Coincidencia parcial en la lista",
    actionEditTrack: "Editar tema",
    actionEditTrackShort: "E",
    actionToggleTanda: "Expandir tanda",
    actionToggleTandaShort: "E",
    actionEditTanda: "Editar tanda",
    actionEditTandaShort: "T",
    colTrack: "Tema",
    colTitle: "Titulo",
    colArtist: "Artista",
    colAlbum: "Album",
    colYear: "Ano",
    colActions: "Acciones",
    colDuration: "Duracion",
    colStart: "Inicio",
    colEndTrim: "Fin",
    trackEditorTitle: "Editar tema",
    trackEditorTitleLabel: "Titulo",
    trackEditorArtistLabel: "Artista",
    trackEditorSingerLabel: "Cantante",
    trackEditorVocalLabel: "Voz",
    trackEditorVocalSung: "Cantado",
    trackEditorVocalInstrumental: "Instrumental",
    trackEditorAlbumLabel: "Album",
    trackEditorYearLabel: "Ano",
    trackEditorGenreLabel: "Estilo",
    trackEditorNotesLabel: "Notas",
    trackEditorBpmLabel: "BPM",
    trackEditorTapTempo: "Marcar tempo",
    trackEditorTapHint: "Pulsa para BPM · Espera 3 segundos para reiniciar",
    trackEditorSave: "Guardar",
    trackEditorReset: "Reiniciar",
    trackEditorCancel: "Cancelar",
    actionAddClipboard: "Agregar al portapapeles",
    actionAddTanda: "Agregar a tanda",
    colStatus: "Estado",
    tabLibrary: "Biblioteca",
    tabDiagnostics: "Diagnostico",
    tabSystem: "Sistema",
    tabPlaylistSettings: "Playlist",
    libraryRoots: "Raices de biblioteca",
    libraryRootsHelp: "Configura carpetas de musica y cortinas.",
    addMusicFolder: "Agregar musica",
    addCortinaFolder: "Agregar cortinas",
    scanLibrary: "Escanear biblioteca",
    scanMusic: "Escanear musica",
    scanCortinas: "Escanear cortinas",
    system: "Sistema",
    mainOutput: "Salida principal",
    headphoneOutput: "Salida de auriculares",
    language: "Idioma",
    languageHelp: "El idioma afecta etiquetas y formato.",
    styleManagerLabel: "Estilos",
    styleAdd: "Agregar",
    styleRemove: "Quitar",
    styleRemoveLabel: "Quitar estilo: {style}",
    styleEmpty: "Sin estilos.",
    styleNone: "Ninguno",
    defaultStyleTango: "Tango",
    defaultStyleWaltz: "Vals",
    defaultStyleMilonga: "Milonga",
    defaultTandaSize: "Tamano de tanda",
    clipboardNewLimitLabel: "Tamano de la coleccion nueva",
    searchMinScoreLabel: "Puntuacion minima de busqueda",
    searchBpmRangeLabel: "Rango de BPM",
    trimPaddingLabel: "Ajuste de recorte (s)",
    trimPaddingHelp:
      "Reduce los recortes de inicio/fin detectados automaticamente.",
    playlistSettingsTitle: "Ajustes de playlist",
    playlistStartTimeLabel: "Hora de inicio de la playlist",
    playlistSequenceLabel: "Secuencia de tandas",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Mapa de estilos",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    scanIssues: "Problemas de escaneo",
    scanIssuesHelp: "Problemas recientes y archivos pendientes.",
    scanIssuesMore: "...y {count} mas",
    viewScanIssues: "Ver problemas",
    diagnosticsPaths: "Rutas",
    diagnosticsPathsUserData: "Datos de usuario",
    diagnosticsPathsWaveforms: "Formas de onda",
    diagnosticsPathsFfmpeg: "ffmpeg",
    diagnosticsPathsFfprobe: "ffprobe",
    diagnosticsWaveform: "Forma de onda",
    diagnosticsWaveformRun: "Generar forma de onda del tema actual",
    diagnosticsWaveformNoTrack: "No hay un tema reproduciendose.",
    diagnosticsWaveformSuccess: "Forma de onda generada: {path}",
    diagnosticsWaveformFailed: "Fallo al generar forma de onda: {message}",
    eraseDatabase: "Borrar base de datos",
    statusIssue: "Problema",
    statusOk: "OK",
    statusPreparingScan: "Preparando escaneo...",
    statusScanInProgress: "El escaneo ya esta en curso.",
    statusScanning: "Escaneando...",
    statusScanProgress: "Escaneando {current}/{total} ({root})",
    statusScanComplete:
      "Escaneo completo. Escaneados {scanned}, agregados {added}, actualizados {updated}, eliminados {removed}.",
    statusScanIssues: "Escaneo completo. {count} problemas.",
    statusScanFailed: "Fallo de escaneo.",
    statusScanFailedDetail: "Fallo de escaneo: {message}",
    statusScanFailedNoResponse: "Fallo de escaneo: sin respuesta.",
    statusFullscreenUnavailable: "Pantalla completa no disponible.",
    statusFullscreenFailed: "Fallo al activar pantalla completa.",
    statusFullscreenFailedDetail: "Fallo en pantalla completa: {message}",
    statusMainProcess: "Proceso principal: {message}",
    statusNoApi: "Puente API no disponible.",
    statusUnknownError: "Error desconocido.",
    statusRendererError: "Ocurrio un problema. Detalles guardados.",
    statusLanguageSet: "Idioma establecido: {language}.",
    statusAddedMusic: "Musica agregada: {path}.",
    statusAddedCortina: "Cortina agregada: {path}.",
    statusDatabaseErased: "Base borrada. Agrega carpetas para escanear.",
    statusNoRoots:
      "No hay carpetas de musica configuradas. Agrega una carpeta en Ajustes.",
    statusDataLocationChanged:
      "Ubicacion de datos establecida en {path}. Base reiniciada.",
    statusDataLocationDuringPlayback:
      "Deten la reproduccion antes de cambiar la ubicacion de datos.",
    legacyImportDetected:
      "Archivos heredados detectados en {path}. Importar tandas y metadatos?",
    statusLegacyImportDone:
      "Importadas {tandas} tandas. Actualizadas {tracks} pistas. Faltan {missing} pistas.",
    statusMissingRoots:
      "Algunas carpetas no estan disponibles. Conecta la unidad o actualiza Ajustes.",
    statusTandaSaved: "Tanda guardada.",
    statusTandaDeleted: "Tanda eliminada.",
    statusTandaSentToClipboard: "Tanda enviada al portapapeles.",
    statusNoTandaSelected: "Selecciona una tanda para agregar temas.",
    statusTrackUpdated: "Tema actualizado.",
    statusTrackUpdateFailed: "Fallo al actualizar tema.",
    statusClipboardReadonlyRemove:
      "El elemento pertenece a una coleccion incluida. Cambia la coleccion activa para quitarlo.",
    statusClipboardCollectionLast: "Se requiere al menos una coleccion.",
    statusClipboardCollectionProtected:
      "Esta coleccion es del sistema y no se puede eliminar.",
    statusClipboardCollectionReadOnly:
      "Esta coleccion es de solo lectura. Cambia a otra para agregar.",
    statusPlaylistSequenceMismatch:
      "El espacio espera {rule}. Esta tanda es {tanda}.",
    confirmPlaylistSequenceOverride:
      "Este espacio espera {expected} temas ({rule}). Esta tanda tiene {count}. ¿Usarla de todos modos?",
    confirmPlaylistSequenceStyleOverride:
      "El espacio espera {rule}. Esta tanda es {tanda}. ¿Añadirla?",
    allowOverride: "Permitir",
    dismissWarning: "Cerrar",
    playlistMismatchTooltip: "El espacio espera {rule}. Esta tanda es {tanda}.",
    statusStyleAdded: "Estilo agregado: {style}.",
    statusStyleAddFailed: "No se pudo agregar el estilo.",
    statusTandaLocked: "Esta tanda esta bloqueada durante la reproduccion.",
    statusWaveformLoading: "Generando forma de onda...",
    statusWaveformUnavailable: "Forma de onda no disponible para este tema.",
    statusPlaylistLocked: "Este slot esta bloqueado durante la reproduccion.",
    statusPlaylistNoEmptySlot: "Agregue un espacio vacio antes de anadir a la lista.",
    statusClipboardCleared: "Portapapeles general vaciado.",
    statusPlaylistCleared: "Lista vaciada.",
    confirmPlaylistClear: "¿Borrar la lista y eliminar todos los elementos?",
    outputSelectionFailed: "Fallo al seleccionar salida.",
    outputSelectionFailedDetail: "Fallo al seleccionar salida: {message}",
    playbackFailed: "Fallo de reproduccion.",
    playbackFailedDetail: "Fallo de reproduccion: {message}",
    outputDefault: "Salida predeterminada",
    outputSelectHeadphones: "Seleccionar salida de auriculares",
    outputNoSecondary: "No hay salida secundaria",
    gapBetweenTracks: "Pausa entre temas (s)",
    gapBeforeTanda: "Pausa antes de tanda (s)",
    gapBeforeCortina: "Pausa antes de cortina (s)",
    cortinaSetLabel: "Set de cortinas",
    cortinaDefaultSet: "Predeterminado",
    cortinaAny: "Cualquiera",
    cortinaNone: "Ninguna",
    cortinaDurationLabel: "Duracion de cortina (s)",
    cortinaRowLabel: "Cortina",
    cortinaRowHint: "Clic para elegir una cortina",
    cortinaStopLabel: "Detener cortina",
    cortinaPlayLabel: "Reproducir cortina",
    statusCortinaSelected: "Cortina seleccionada: {title}.",
    statusCortinaLocked: "Esta cortina ya se reprodujo y no se puede cambiar.",
    stopFade: "Desvanecer al detener (s)",
    addTanda: "Agregar tanda",
    tandaNameLabel: "Nombre de tanda",
    tandaStylesLabel: "Estilos",
    tandaRatingLabel: "Valoracion",
    tandaInstrumentalLabel: "Instrumental",
    tandaInstrumentalYes: "Si",
    tandaInstrumentalNo: "No",
    tandaDurationLabel: "Duracion",
    tandaTrackCountLabel: "Temas",
    tandaAnyStyle: "Cualquiera",
    tandaPlaceholder: "Espacio vacio",
    tandaUnknownArtist: "Artista desconocido",
    tandaUnknownYear: "Ano desconocido",
    tandaNonInstrumental: "Cantado",
    tandaMixedLabel: "Mixto",
    tandaSave: "Guardar tanda",
    tandaDone: "Listo",
    tandaDelete: "Borrar tanda",
    tandaAddSlot: "Agregar espacio",
    tandaToClipboard: "Enviar al portapapeles",
    tandaRemoveTrack: "Enviar al portapapeles",
    tandaMoveUp: "Subir",
    tandaMoveDown: "Bajar",
    tandaRemoveTrackShort: "C",
    tandaMoveUpShort: "^",
    tandaMoveDownShort: "v",
    confirmTandaTooSmall:
      "Esta tanda tiene {count} temas (min {min}). Guardar igual?",
    confirmDeleteTanda: "Borrar esta tanda?",
    rootAvailable: "Disponible",
    rootMissing: "No disponible",
    rootMusic: "Musica",
    rootCortina: "Cortina",
    lang_en: "Ingles",
    lang_es: "Espanol",
    lang_fr: "Frances",
    lang_de: "Aleman",
    lang_pt: "Portugues",
    lang_it: "Italiano",
  },
  fr: {
    appTitle: "Tanda Player Lite",
    closeApp: "Fermer l'application",
    playlistStart: "Demarrer",
    playlistResume: "Reprendre",
    playlistStop: "Arreter",
    searchTitle: "Recherche",
    searchPlaceholder: "Rechercher pistes ou tandas",
    searchButton: "Rechercher",
    styleLabel: "Styles",
    searchTandaSizeLabel: "Taille tanda",
    searchTandaSizeAny: "Toutes",
    styleAll: "Tous",
    tabTracks: "Pistes",
    tabTandas: "Tandas",
    tabPlaylist: "Playlist",
    tabTandaDesigner: "Concepteur de tandas",
    clipboardTitle: "Presse-papiers",
    clipboardCollectionsLabel: "Collections",
    clipboardCollectionPlaceholder: "Nouvelle collection",
    clipboardCollectionAdd: "Ajouter",
    clipboardCollectionRemove: "Retirer",
    clipboardCollectionInclude: "Inclure",
    clipboardCollectionGeneral: "General",
    clipboardCollectionNew: "Nouveaux",
    clipboardFilterPlaceholder: "Filtrer",
    confirmClipboardCollectionRemove: "Retirer la collection \"{name}\" ?",
    clipboardClear: "Vider",
    playlistTitle: "Playlist",
    playlistHint:
      "Utilisez le menu tanda pour marquer le remplacement puis choisissez dans le presse-papiers.",
    playlistClear: "Vider",
    tandasEmpty: "Tandas bientot.",
    playlistEmptySlot: "Tanda vide",
    playlistEmptyHint: "Deposez une piste ici",
    headphonePreview: "Pre-ecoute au casque",
    searchResultsCount: "Resultats: {count}",
    modeLabel: "Mode",
    modePrep: "Preparation",
    modeLive: "Live",
    modeEdit: "Editer",
    toggleTheme: "Basculer le theme",
    toggleFullscreen: "Plein ecran",
    openSettings: "Ouvrir les reglages",
    settings: "Reglages",
    dataLocationLabel: "Emplacement des donnees",
    dataLocationChoose: "Choisir…",
    dataLocationHelp:
      "Les donnees sont stockees dans un dossier _tp_data a l'emplacement choisi.",
    legacyImportTitle: "Import heritage",
    legacyImportButton: "Importer les tandas heritees",
    close: "Fermer",
    idle: "Inactif",
    starting: "Demarrage...",
    nowPlayingLabel: "Lecture",
    nowPlayingIdle: "En attente",
    nowPlayingMain: "Sortie principale",
    nowPlayingHeadphone: "Casque",
    nowPlayingUnknown: "Piste inconnue",
    nowPlayingTime: "{current} / {duration}",
    waveformLabel: "Forme d'onde",
    waveformLoading: "Generation de la forme d'onde...",
    waveformUnavailable: "Forme d'onde indisponible",
    cortinaPickerTitle: "Selection de cortinas",
    cortinaSearchLabel: "Recherche",
    confirmCloseWhilePlaying:
      "La musique joue encore. Fermer l'application et arreter la lecture ?",
    confirmDataLocationChange:
      "Changer l'emplacement des donnees vers {path} ? Cela cree une nouvelle base.",
    confirmLegacyImport:
      "Importer des tandas depuis {path} ? Cela remplace les tandas existantes.",
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Retirer du presse-papiers",
    actionRemoveClipboardShort: "R",
    actionRemovePlaylist: "Retirer de la playlist",
    actionRemovePlaylistShort: "R",
    actionAddPlaylist: "Ajouter a la playlist",
    actionAddPlaylistShort: "P",
    actionMarkPlaylist: "Marquer la cible de playlist",
    actionMarkPlaylistShort: "M",
    cancelTarget: "Annuler la cible",
    actionSearch: "Rechercher similaire",
    actionSearchShort: "S",
    actionMore: "Plus d'actions",
    actionSendClipboard: "Envoyer au presse-papiers",
    actionSendClipboardShort: "C",
    duplicateFull: "Dans la playlist",
    duplicatePartial: "Chevauchement partiel avec la playlist",
    actionEditTrack: "Editer piste",
    actionEditTrackShort: "E",
    actionToggleTanda: "Developper la tanda",
    actionToggleTandaShort: "E",
    actionEditTanda: "Editer la tanda",
    actionEditTandaShort: "T",
    colTrack: "Piste",
    colTitle: "Titre",
    colArtist: "Artiste",
    colAlbum: "Album",
    colYear: "Annee",
    colActions: "Actions",
    colDuration: "Duree",
    colStart: "Debut",
    colEndTrim: "Fin",
    trackEditorTitle: "Editer piste",
    trackEditorTitleLabel: "Titre",
    trackEditorArtistLabel: "Artiste",
    trackEditorSingerLabel: "Chanteur",
    trackEditorVocalLabel: "Voix",
    trackEditorVocalSung: "Chante",
    trackEditorVocalInstrumental: "Instrumental",
    trackEditorAlbumLabel: "Album",
    trackEditorYearLabel: "Annee",
    trackEditorGenreLabel: "Style",
    trackEditorNotesLabel: "Notes",
    trackEditorBpmLabel: "BPM",
    trackEditorTapTempo: "Tap tempo",
    trackEditorTapHint: "Tapez pour BPM · Attendez 3 secondes pour reinitialiser",
    trackEditorSave: "Enregistrer",
    trackEditorReset: "Reinitialiser",
    trackEditorCancel: "Annuler",
    actionAddClipboard: "Ajouter au presse-papiers",
    actionAddTanda: "Ajouter a la tanda",
    colStatus: "Statut",
    tabLibrary: "Bibliotheque",
    tabDiagnostics: "Diagnostic",
    tabSystem: "Systeme",
    tabPlaylistSettings: "Playlist",
    libraryRoots: "Racines de bibliotheque",
    libraryRootsHelp: "Configurer les dossiers musique et cortinas.",
    addMusicFolder: "Ajouter musique",
    addCortinaFolder: "Ajouter cortinas",
    scanLibrary: "Scanner la bibliotheque",
    scanMusic: "Scanner musique",
    scanCortinas: "Scanner cortinas",
    system: "Systeme",
    mainOutput: "Sortie principale",
    headphoneOutput: "Sortie casque",
    language: "Langue",
    languageHelp: "La langue affecte les libelles et le format.",
    styleManagerLabel: "Styles",
    styleAdd: "Ajouter",
    styleRemove: "Supprimer",
    styleRemoveLabel: "Supprimer le style: {style}",
    styleEmpty: "Aucun style.",
    styleNone: "Aucun",
    defaultStyleTango: "Tango",
    defaultStyleWaltz: "Valse",
    defaultStyleMilonga: "Milonga",
    defaultTandaSize: "Taille de tanda",
    clipboardNewLimitLabel: "Taille de la collection nouvelle",
    searchMinScoreLabel: "Score minimum de recherche",
    searchBpmRangeLabel: "Plage BPM",
    trimPaddingLabel: "Marge de coupe (s)",
    trimPaddingHelp:
      "Reduit les coupes debut/fin detectees automatiquement.",
    playlistSettingsTitle: "Reglages de playlist",
    playlistStartTimeLabel: "Heure de debut de la playlist",
    playlistSequenceLabel: "Sequence de tandas",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Mapping de styles",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    scanIssues: "Problemes de scan",
    scanIssuesHelp: "Problemes recents et fichiers a traiter.",
    scanIssuesMore: "...et {count} de plus",
    viewScanIssues: "Voir les problemes",
    diagnosticsPaths: "Chemins",
    diagnosticsPathsUserData: "Donnees utilisateur",
    diagnosticsPathsWaveforms: "Formes d'onde",
    diagnosticsPathsFfmpeg: "ffmpeg",
    diagnosticsPathsFfprobe: "ffprobe",
    diagnosticsWaveform: "Forme d'onde",
    diagnosticsWaveformRun: "Generer la forme d'onde du titre actuel",
    diagnosticsWaveformNoTrack: "Aucun titre en lecture.",
    diagnosticsWaveformSuccess: "Forme d'onde generee: {path}",
    diagnosticsWaveformFailed: "Echec de la forme d'onde: {message}",
    eraseDatabase: "Effacer la base",
    statusIssue: "Probleme",
    statusOk: "OK",
    statusPreparingScan: "Preparation du scan...",
    statusScanInProgress: "Un scan est deja en cours.",
    statusScanning: "Scan en cours...",
    statusScanProgress: "Scan {current}/{total} ({root})",
    statusScanComplete:
      "Scan termine. Scannes {scanned}, ajoutes {added}, maj {updated}, supprimes {removed}.",
    statusScanIssues: "Scan termine. {count} problemes.",
    statusScanFailed: "Echec du scan.",
    statusScanFailedDetail: "Echec du scan: {message}",
    statusScanFailedNoResponse: "Echec du scan: aucune reponse.",
    statusFullscreenUnavailable: "Plein ecran indisponible.",
    statusFullscreenFailed: "Echec du plein ecran.",
    statusFullscreenFailedDetail: "Echec du plein ecran: {message}",
    statusMainProcess: "Processus principal: {message}",
    statusNoApi: "Pont API indisponible.",
    statusUnknownError: "Erreur inconnue.",
    statusRendererError: "Un probleme est survenu. Details enregistres.",
    statusLanguageSet: "Langue definie: {language}.",
    statusAddedMusic: "Musique ajoutee: {path}.",
    statusAddedCortina: "Cortina ajoutee: {path}.",
    statusDatabaseErased: "Base effacee. Ajoutez des dossiers.",
    statusNoRoots:
      "Aucun dossier musique. Ajoutez un dossier dans Reglages.",
    statusDataLocationChanged:
      "Emplacement des donnees defini sur {path}. Base reinitialisee.",
    statusDataLocationDuringPlayback:
      "Arretez la lecture avant de changer l'emplacement des donnees.",
    legacyImportDetected:
      "Fichiers herites detectes a {path}. Importer tandas et metadonnees ?",
    statusLegacyImportDone:
      "{tandas} tandas importees. {tracks} pistes mises a jour. {missing} manquantes.",
    statusMissingRoots:
      "Certains dossiers sont indisponibles. Connectez le disque.",
    statusTandaSaved: "Tanda enregistree.",
    statusTandaDeleted: "Tanda supprimee.",
    statusTandaSentToClipboard: "Tanda envoyee au presse-papiers.",
    statusNoTandaSelected: "Selectionnez une tanda pour ajouter des pistes.",
    statusTrackUpdated: "Piste mise a jour.",
    statusTrackUpdateFailed: "Echec de mise a jour.",
    statusClipboardReadonlyRemove:
      "L'element appartient a une collection incluse. Changez la collection active pour le retirer.",
    statusClipboardCollectionLast: "Au moins une collection est requise.",
    statusClipboardCollectionProtected:
      "Cette collection est geree par le systeme et ne peut pas etre supprimee.",
    statusClipboardCollectionReadOnly:
      "Cette collection est en lecture seule. Passez a une autre pour ajouter.",
    statusPlaylistSequenceMismatch:
      "Ce slot attend {rule}. Cette tanda est {tanda}.",
    confirmPlaylistSequenceOverride:
      "Ce slot attend {expected} pistes ({rule}). Cette tanda en a {count}. L'utiliser quand meme ?",
    confirmPlaylistSequenceStyleOverride:
      "Ce slot attend {rule}. Cette tanda est {tanda}. L'ajouter quand meme ?",
    allowOverride: "Autoriser",
    dismissWarning: "Fermer",
    playlistMismatchTooltip: "Ce slot attend {rule}. Cette tanda est {tanda}.",
    statusStyleAdded: "Style ajoute: {style}.",
    statusStyleAddFailed: "Impossible d'ajouter le style.",
    statusTandaLocked: "Cette tanda est verrouillee en lecture.",
    statusWaveformLoading: "Generation de la forme d'onde...",
    statusWaveformUnavailable: "Forme d'onde indisponible pour ce titre.",
    statusPlaylistLocked: "Ce slot est verrouille en lecture.",
    statusPlaylistNoEmptySlot: "Ajoutez un emplacement vide avant d'ajouter a la playlist.",
    statusClipboardCleared: "Presse-papiers general vide.",
    statusPlaylistCleared: "Playlist videe.",
    confirmPlaylistClear: "Effacer la playlist et supprimer tous les elements ?",
    outputSelectionFailed: "Selection de sortie impossible.",
    outputSelectionFailedDetail: "Selection de sortie impossible: {message}",
    playbackFailed: "Lecture impossible.",
    playbackFailedDetail: "Lecture impossible: {message}",
    outputDefault: "Sortie par defaut",
    outputSelectHeadphones: "Selectionner sortie casque",
    outputNoSecondary: "Pas de sortie secondaire",
    gapBetweenTracks: "Pause entre pistes (s)",
    gapBeforeTanda: "Pause avant tanda (s)",
    gapBeforeCortina: "Pause avant cortina (s)",
    cortinaSetLabel: "Set de cortinas",
    cortinaDefaultSet: "Par defaut",
    cortinaAny: "Toutes",
    cortinaNone: "Aucune",
    cortinaDurationLabel: "Duree de cortina (s)",
    cortinaRowLabel: "Cortina",
    cortinaRowHint: "Cliquez pour choisir une cortina",
    cortinaStopLabel: "Arreter la cortina",
    cortinaPlayLabel: "Lire la cortina",
    statusCortinaSelected: "Cortina choisie: {title}.",
    statusCortinaLocked: "Cette cortina a deja joue et ne peut pas etre modifiee.",
    stopFade: "Fondu a l'arret (s)",
    addTanda: "Ajouter tanda",
    tandaNameLabel: "Nom de tanda",
    tandaStylesLabel: "Styles",
    tandaRatingLabel: "Note",
    tandaInstrumentalLabel: "Instrumental",
    tandaInstrumentalYes: "Oui",
    tandaInstrumentalNo: "Non",
    tandaDurationLabel: "Duree",
    tandaTrackCountLabel: "Pistes",
    tandaAnyStyle: "Tout",
    tandaPlaceholder: "Emplacement vide",
    tandaUnknownArtist: "Artiste inconnu",
    tandaUnknownYear: "Annee inconnue",
    tandaNonInstrumental: "Chante",
    tandaMixedLabel: "Mixte",
    tandaSave: "Enregistrer la tanda",
    tandaDone: "Terminer",
    tandaDelete: "Supprimer la tanda",
    tandaAddSlot: "Ajouter un slot",
    tandaToClipboard: "Envoyer au presse-papiers",
    tandaRemoveTrack: "Envoyer au presse-papiers",
    tandaMoveUp: "Monter",
    tandaMoveDown: "Descendre",
    tandaRemoveTrackShort: "C",
    tandaMoveUpShort: "^",
    tandaMoveDownShort: "v",
    confirmTandaTooSmall:
      "Cette tanda a {count} pistes (min {min}). Enregistrer quand meme?",
    confirmDeleteTanda: "Supprimer cette tanda?",
    rootAvailable: "Disponible",
    rootMissing: "Indisponible",
    rootMusic: "Musique",
    rootCortina: "Cortina",
    lang_en: "Anglais",
    lang_es: "Espagnol",
    lang_fr: "Francais",
    lang_de: "Allemand",
    lang_pt: "Portugais",
    lang_it: "Italien",
  },
  de: {
    appTitle: "Tanda Player Lite",
    closeApp: "App schliessen",
    playlistStart: "Start",
    playlistResume: "Fortsetzen",
    playlistStop: "Stop",
    searchTitle: "Suche",
    searchPlaceholder: "Titel oder Tandas suchen",
    searchButton: "Suchen",
    styleLabel: "Stile",
    searchTandaSizeLabel: "Tanda Groesse",
    searchTandaSizeAny: "Alle",
    styleAll: "Alle",
    tabTracks: "Titel",
    tabTandas: "Tandas",
    tabPlaylist: "Playlist",
    tabTandaDesigner: "Tanda-Designer",
    clipboardTitle: "Zwischenablage",
    clipboardCollectionsLabel: "Sammlungen",
    clipboardCollectionPlaceholder: "Neue Sammlung",
    clipboardCollectionAdd: "Hinzufugen",
    clipboardCollectionRemove: "Entfernen",
    clipboardCollectionInclude: "Einblenden",
    clipboardCollectionGeneral: "Allgemein",
    clipboardCollectionNew: "Neu",
    clipboardFilterPlaceholder: "Filtern",
    confirmClipboardCollectionRemove: "Sammlung \"{name}\" entfernen?",
    clipboardClear: "Leeren",
    playlistTitle: "Playlist",
    playlistHint:
      "Tanda-Menue zum Ersetzen markieren, dann in der Zwischenablage auswaehlen.",
    playlistClear: "Leeren",
    tandasEmpty: "Tandas bald verfugbar.",
    playlistEmptySlot: "Leere Tanda",
    playlistEmptyHint: "Track hier ablegen",
    headphonePreview: "Vorschau im Kopfhoerer",
    searchResultsCount: "Ergebnisse: {count}",
    modeLabel: "Modus",
    modePrep: "Vorbereitung",
    modeLive: "Live",
    modeEdit: "Bearbeiten",
    toggleTheme: "Theme umschalten",
    toggleFullscreen: "Vollbild umschalten",
    openSettings: "Einstellungen",
    settings: "Einstellungen",
    dataLocationLabel: "Datenspeicherort",
    dataLocationChoose: "Auswahlen…",
    dataLocationHelp:
      "Daten werden im Ordner _tp_data am gewahlten Ort gespeichert.",
    legacyImportTitle: "Legacy-Import",
    legacyImportButton: "Legacy-Tandas importieren",
    close: "Schliessen",
    idle: "Leerlauf",
    starting: "Startet...",
    nowPlayingLabel: "Wiedergabe",
    nowPlayingIdle: "Bereit",
    nowPlayingMain: "Hauptausgang",
    nowPlayingHeadphone: "Kopfhorer",
    nowPlayingUnknown: "Unbekannter Track",
    nowPlayingTime: "{current} / {duration}",
    waveformLabel: "Wellenform",
    waveformLoading: "Wellenform wird erstellt...",
    waveformUnavailable: "Wellenform nicht verfugbar",
    cortinaPickerTitle: "Cortina-Auswahl",
    cortinaSearchLabel: "Suche",
    confirmCloseWhilePlaying:
      "Die Musik spielt noch. App schliessen und Wiedergabe stoppen?",
    confirmDataLocationChange:
      "Datenspeicherort auf {path} andern? Dadurch wird eine neue Datenbank erstellt.",
    confirmLegacyImport:
      "Tandas von {path} importieren? Dies ersetzt vorhandene Tandas und ubernimmt Metadaten.",
    actionAddClipboardShort: "Z",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Aus Zwischenablage entfernen",
    actionRemoveClipboardShort: "R",
    actionRemovePlaylist: "Aus Playlist entfernen",
    actionRemovePlaylistShort: "R",
    actionAddPlaylist: "Zur Playlist hinzufugen",
    actionAddPlaylistShort: "P",
    actionMarkPlaylist: "Playlistziel markieren",
    actionMarkPlaylistShort: "M",
    cancelTarget: "Ziel aufheben",
    actionSearch: "Ahnliches suchen",
    actionSearchShort: "S",
    actionMore: "Mehr Aktionen",
    actionSendClipboard: "Zur Zwischenablage",
    actionSendClipboardShort: "C",
    duplicateFull: "In der Playlist",
    duplicatePartial: "Teilweise in der Playlist",
    actionEditTrack: "Track bearbeiten",
    actionEditTrackShort: "E",
    actionToggleTanda: "Tanda aufklappen",
    actionToggleTandaShort: "E",
    actionEditTanda: "Tanda bearbeiten",
    actionEditTandaShort: "T",
    colTrack: "Titel",
    colTitle: "Titel",
    colArtist: "Artist",
    colAlbum: "Album",
    colYear: "Jahr",
    colActions: "Aktionen",
    colDuration: "Dauer",
    colStart: "Start",
    colEndTrim: "Ende",
    trackEditorTitle: "Track bearbeiten",
    trackEditorTitleLabel: "Titel",
    trackEditorArtistLabel: "Artist",
    trackEditorSingerLabel: "Sanger",
    trackEditorVocalLabel: "Stimme",
    trackEditorVocalSung: "Gesungen",
    trackEditorVocalInstrumental: "Instrumental",
    trackEditorAlbumLabel: "Album",
    trackEditorYearLabel: "Jahr",
    trackEditorGenreLabel: "Stil",
    trackEditorNotesLabel: "Notizen",
    trackEditorBpmLabel: "BPM",
    trackEditorTapTempo: "Tap tempo",
    trackEditorTapHint: "Tippen fur BPM · 3 Sekunden warten zum Zurucksetzen",
    trackEditorSave: "Speichern",
    trackEditorReset: "Zurucksetzen",
    trackEditorCancel: "Abbrechen",
    actionAddClipboard: "Zur Zwischenablage",
    actionAddTanda: "Zur Tanda",
    colStatus: "Status",
    tabLibrary: "Bibliothek",
    tabDiagnostics: "Diagnose",
    tabSystem: "System",
    tabPlaylistSettings: "Playlist",
    libraryRoots: "Bibliotheksordner",
    libraryRootsHelp: "Musik- und Cortina-Ordner konfigurieren.",
    addMusicFolder: "Musikordner hinzufugen",
    addCortinaFolder: "Cortina-Ordner hinzufugen",
    scanLibrary: "Bibliothek scannen",
    scanMusic: "Musik scannen",
    scanCortinas: "Cortinas scannen",
    system: "System",
    mainOutput: "Hauptausgang",
    headphoneOutput: "Kopfhorer",
    language: "Sprache",
    languageHelp: "Sprache beeinflusst Labels und Format.",
    styleManagerLabel: "Stile",
    styleAdd: "Hinzufugen",
    styleRemove: "Entfernen",
    styleRemoveLabel: "Stil entfernen: {style}",
    styleEmpty: "Keine Stile.",
    styleNone: "Keine",
    defaultStyleTango: "Tango",
    defaultStyleWaltz: "Walzer",
    defaultStyleMilonga: "Milonga",
    defaultTandaSize: "Tanda-Grosse",
    clipboardNewLimitLabel: "Neue Sammlungsgröße",
    searchMinScoreLabel: "Minimale Suchbewertung",
    searchBpmRangeLabel: "BPM-Bereich",
    trimPaddingLabel: "Trim-Puffer (s)",
    trimPaddingHelp:
      "Reduziert automatisch erkannte Start/End-Trims um diesen Wert.",
    playlistSettingsTitle: "Playlist-Einstellungen",
    playlistStartTimeLabel: "Playlist-Startzeit",
    playlistSequenceLabel: "Tanda-Sequenz",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Stil-Zuordnung",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    scanIssues: "Scan-Probleme",
    scanIssuesHelp: "Aktuelle Probleme und Dateien.",
    scanIssuesMore: "...und {count} weitere",
    viewScanIssues: "Probleme anzeigen",
    diagnosticsPaths: "Pfade",
    diagnosticsPathsUserData: "Benutzerdaten",
    diagnosticsPathsWaveforms: "Wellenformen",
    diagnosticsPathsFfmpeg: "ffmpeg",
    diagnosticsPathsFfprobe: "ffprobe",
    diagnosticsWaveform: "Wellenform",
    diagnosticsWaveformRun: "Wellenform fur aktuellen Track erzeugen",
    diagnosticsWaveformNoTrack: "Kein Track wird abgespielt.",
    diagnosticsWaveformSuccess: "Wellenform erzeugt: {path}",
    diagnosticsWaveformFailed: "Wellenform fehlgeschlagen: {message}",
    eraseDatabase: "Datenbank loschen",
    statusIssue: "Problem",
    statusOk: "OK",
    statusPreparingScan: "Scan vorbereiten...",
    statusScanInProgress: "Scan lauft bereits.",
    statusScanning: "Scanne...",
    statusScanProgress: "Scan {current}/{total} ({root})",
    statusScanComplete:
      "Scan fertig. Gescant {scanned}, hinzugefugt {added}, aktualisiert {updated}, entfernt {removed}.",
    statusScanIssues: "Scan fertig. {count} Probleme.",
    statusScanFailed: "Scan fehlgeschlagen.",
    statusScanFailedDetail: "Scan fehlgeschlagen: {message}",
    statusScanFailedNoResponse: "Scan fehlgeschlagen: keine Antwort.",
    statusFullscreenUnavailable: "Vollbild nicht verfuegbar.",
    statusFullscreenFailed: "Vollbild fehlgeschlagen.",
    statusFullscreenFailedDetail: "Vollbild fehlgeschlagen: {message}",
    statusMainProcess: "Hauptprozess: {message}",
    statusNoApi: "API-Bruecke nicht verfuegbar.",
    statusUnknownError: "Unbekannter Fehler.",
    statusRendererError: "Ein Fehler ist aufgetreten. Details gespeichert.",
    statusLanguageSet: "Sprache gesetzt: {language}.",
    statusAddedMusic: "Musikordner hinzugefugt: {path}.",
    statusAddedCortina: "Cortina-Ordner hinzugefugt: {path}.",
    statusDatabaseErased: "Datenbank geloscht. Ordner hinzufugen.",
    statusNoRoots:
      "Keine Musikordner konfiguriert. Bitte in Einstellungen hinzufugen.",
    statusDataLocationChanged:
      "Datenspeicherort auf {path} gesetzt. Datenbank zuruckgesetzt.",
    statusDataLocationDuringPlayback:
      "Wiedergabe stoppen, bevor der Datenspeicherort geandert wird.",
    legacyImportDetected:
      "Legacy-Dateien in {path} erkannt. Tandas und Metadaten importieren?",
    statusLegacyImportDone:
      "{tandas} Tandas importiert. {tracks} Titel aktualisiert. {missing} fehlen.",
    statusMissingRoots:
      "Einige Ordner sind nicht verfugbar. Laufwerk verbinden.",
    statusTandaSaved: "Tanda gespeichert.",
    statusTandaDeleted: "Tanda geloscht.",
    statusTandaSentToClipboard: "Tanda zur Zwischenablage gesendet.",
    statusNoTandaSelected: "Bitte eine Tanda auswahlen.",
    statusTrackUpdated: "Track aktualisiert.",
    statusTrackUpdateFailed: "Aktualisierung fehlgeschlagen.",
    statusClipboardReadonlyRemove:
      "Element gehort zu einer eingeblendeten Sammlung. Bitte aktive Sammlung wechseln.",
    statusClipboardCollectionLast: "Mindestens eine Sammlung ist erforderlich.",
    statusClipboardCollectionProtected:
      "Diese Sammlung ist systemverwaltet und kann nicht entfernt werden.",
    statusClipboardCollectionReadOnly:
      "Diese Sammlung ist schreibgeschutzt. Wechseln Sie zum Hinzufugen.",
    statusPlaylistSequenceMismatch:
      "Slot erwartet {rule}. Diese Tanda ist {tanda}.",
    confirmPlaylistSequenceOverride:
      "Dieser Slot erwartet {expected} Titel ({rule}). Diese Tanda hat {count}. Trotzdem verwenden?",
    confirmPlaylistSequenceStyleOverride:
      "Slot erwartet {rule}. Diese Tanda ist {tanda}. Trotzdem hinzufugen?",
    allowOverride: "Zulassen",
    dismissWarning: "Schliessen",
    playlistMismatchTooltip: "Slot erwartet {rule}. Diese Tanda ist {tanda}.",
    statusStyleAdded: "Stil hinzugefugt: {style}.",
    statusStyleAddFailed: "Stil konnte nicht hinzugefugt werden.",
    statusTandaLocked: "Diese Tanda ist im Live-Modus gesperrt.",
    statusWaveformLoading: "Wellenform wird erstellt...",
    statusWaveformUnavailable: "Wellenform fur diesen Titel nicht verfugbar.",
    statusPlaylistLocked: "Dieser Playlist-Slot ist im Live-Modus gesperrt.",
    statusPlaylistNoEmptySlot: "Fugen Sie einen leeren Slot hinzu, bevor Sie zur Playlist hinzufugen.",
    statusClipboardCleared: "Allgemeine Zwischenablage geleert.",
    statusPlaylistCleared: "Playlist geleert.",
    confirmPlaylistClear: "Playlist leeren und alle Elemente entfernen?",
    outputSelectionFailed: "Auswahl fehlgeschlagen.",
    outputSelectionFailedDetail: "Auswahl fehlgeschlagen: {message}",
    playbackFailed: "Wiedergabe fehlgeschlagen.",
    playbackFailedDetail: "Wiedergabe fehlgeschlagen: {message}",
    outputDefault: "Standardausgang",
    outputSelectHeadphones: "Kopfhorerausgang wahlen",
    outputNoSecondary: "Keine zweite Ausgabe",
    gapBetweenTracks: "Pause zwischen Titeln (s)",
    gapBeforeTanda: "Pause vor Tanda (s)",
    gapBeforeCortina: "Pause vor Cortina (s)",
    cortinaSetLabel: "Cortina-Set",
    cortinaDefaultSet: "Standard",
    cortinaAny: "Alle",
    cortinaNone: "Keine",
    cortinaDurationLabel: "Cortina-Dauer (s)",
    cortinaRowLabel: "Cortina",
    cortinaRowHint: "Zum Auswahlen klicken",
    cortinaStopLabel: "Cortina stoppen",
    cortinaPlayLabel: "Cortina abspielen",
    statusCortinaSelected: "Cortina gewahlt: {title}.",
    statusCortinaLocked: "Diese Cortina wurde bereits gespielt und kann nicht geandert werden.",
    stopFade: "Stop-Ausblenden (s)",
    addTanda: "Tanda hinzufugen",
    tandaNameLabel: "Tanda-Name",
    tandaStylesLabel: "Stile",
    tandaRatingLabel: "Bewertung",
    tandaInstrumentalLabel: "Instrumental",
    tandaInstrumentalYes: "Ja",
    tandaInstrumentalNo: "Nein",
    tandaDurationLabel: "Dauer",
    tandaTrackCountLabel: "Titel",
    tandaAnyStyle: "Alle",
    tandaPlaceholder: "Leerer Slot",
    tandaUnknownArtist: "Unbekannter Artist",
    tandaUnknownYear: "Unbekanntes Jahr",
    tandaNonInstrumental: "Gesungen",
    tandaMixedLabel: "Gemischt",
    tandaSave: "Tanda speichern",
    tandaDone: "Fertig",
    tandaDelete: "Tanda loschen",
    tandaAddSlot: "Slot hinzufugen",
    tandaToClipboard: "Zur Zwischenablage",
    tandaRemoveTrack: "Zur Zwischenablage",
    tandaMoveUp: "Nach oben",
    tandaMoveDown: "Nach unten",
    tandaRemoveTrackShort: "C",
    tandaMoveUpShort: "^",
    tandaMoveDownShort: "v",
    confirmTandaTooSmall:
      "Diese Tanda hat {count} Titel (min {min}). Trotzdem speichern?",
    confirmDeleteTanda: "Tanda loschen?",
    rootAvailable: "Verfugbar",
    rootMissing: "Fehlt",
    rootMusic: "Musik",
    rootCortina: "Cortina",
    lang_en: "Englisch",
    lang_es: "Spanisch",
    lang_fr: "Franzoesisch",
    lang_de: "Deutsch",
    lang_pt: "Portugiesisch",
    lang_it: "Italienisch",
  },
  pt: {
    appTitle: "Tanda Player Lite",
    closeApp: "Fechar app",
    playlistStart: "Iniciar",
    playlistResume: "Retomar",
    playlistStop: "Parar",
    searchTitle: "Busca",
    searchPlaceholder: "Buscar faixas ou tandas",
    searchButton: "Buscar",
    styleLabel: "Estilos",
    searchTandaSizeLabel: "Tamanho tanda",
    searchTandaSizeAny: "Qualquer",
    styleAll: "Todos",
    tabTracks: "Faixas",
    tabTandas: "Tandas",
    tabPlaylist: "Playlist",
    tabTandaDesigner: "Designer de tandas",
    clipboardTitle: "Area de transferencia",
    clipboardCollectionsLabel: "Colecoes",
    clipboardCollectionPlaceholder: "Nova colecao",
    clipboardCollectionAdd: "Adicionar",
    clipboardCollectionRemove: "Remover",
    clipboardCollectionInclude: "Incluir",
    clipboardCollectionGeneral: "Geral",
    clipboardCollectionNew: "Novos",
    clipboardFilterPlaceholder: "Filtrar",
    confirmClipboardCollectionRemove: "Remover a colecao \"{name}\"?",
    clipboardClear: "Limpar",
    playlistTitle: "Playlist",
    playlistHint:
      "Use o menu da tanda para marcar a substituicao e depois escolha no bloco.",
    playlistClear: "Limpar",
    tandasEmpty: "Tandas em breve.",
    playlistEmptySlot: "Tanda vazia",
    playlistEmptyHint: "Solte a faixa aqui",
    headphonePreview: "Prévia nos fones",
    searchResultsCount: "Resultados: {count}",
    modeLabel: "Modo",
    modePrep: "Preparacao",
    modeLive: "Ao vivo",
    modeEdit: "Editar",
    toggleTheme: "Alternar tema",
    toggleFullscreen: "Tela cheia",
    openSettings: "Abrir ajustes",
    settings: "Ajustes",
    dataLocationLabel: "Local dos dados",
    dataLocationChoose: "Escolher…",
    dataLocationHelp:
      "Os dados sao armazenados em uma pasta _tp_data no local selecionado.",
    legacyImportTitle: "Importacao legada",
    legacyImportButton: "Importar tandas legadas",
    close: "Fechar",
    idle: "Inativo",
    starting: "Iniciando...",
    nowPlayingLabel: "Tocando",
    nowPlayingIdle: "Em espera",
    nowPlayingMain: "Saida principal",
    nowPlayingHeadphone: "Fones",
    nowPlayingUnknown: "Faixa desconhecida",
    nowPlayingTime: "{current} / {duration}",
    waveformLabel: "Forma de onda",
    waveformLoading: "Gerando forma de onda...",
    waveformUnavailable: "Forma de onda indisponivel",
    cortinaPickerTitle: "Seletor de cortinas",
    cortinaSearchLabel: "Buscar",
    confirmCloseWhilePlaying:
      "A musica ainda esta tocando. Fechar o app e parar a reproducao?",
    confirmDataLocationChange:
      "Mudar local dos dados para {path}? Isso inicia um banco novo.",
    confirmLegacyImport:
      "Importar tandas de {path}? Isso substitui tandas existentes e aplica metadados.",
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Remover do bloco",
    actionRemoveClipboardShort: "R",
    actionRemovePlaylist: "Remover da playlist",
    actionRemovePlaylistShort: "R",
    actionAddPlaylist: "Adicionar a playlist",
    actionAddPlaylistShort: "P",
    actionMarkPlaylist: "Marcar alvo da playlist",
    actionMarkPlaylistShort: "M",
    cancelTarget: "Cancelar alvo",
    actionSearch: "Buscar similares",
    actionSearchShort: "S",
    actionMore: "Mais acoes",
    actionSendClipboard: "Enviar ao bloco",
    actionSendClipboardShort: "C",
    duplicateFull: "Na playlist",
    duplicatePartial: "Sobreposicao parcial na playlist",
    actionEditTrack: "Editar faixa",
    actionEditTrackShort: "E",
    actionToggleTanda: "Expandir tanda",
    actionToggleTandaShort: "E",
    actionEditTanda: "Editar tanda",
    actionEditTandaShort: "T",
    colTrack: "Faixa",
    colTitle: "Titulo",
    colArtist: "Artista",
    colAlbum: "Album",
    colYear: "Ano",
    colActions: "Acoes",
    colDuration: "Duracao",
    colStart: "Inicio",
    colEndTrim: "Fim",
    trackEditorTitle: "Editar faixa",
    trackEditorTitleLabel: "Titulo",
    trackEditorArtistLabel: "Artista",
    trackEditorSingerLabel: "Cantor",
    trackEditorVocalLabel: "Voz",
    trackEditorVocalSung: "Cantado",
    trackEditorVocalInstrumental: "Instrumental",
    trackEditorAlbumLabel: "Album",
    trackEditorYearLabel: "Ano",
    trackEditorGenreLabel: "Estilo",
    trackEditorNotesLabel: "Notas",
    trackEditorBpmLabel: "BPM",
    trackEditorTapTempo: "Tap tempo",
    trackEditorTapHint: "Toque para BPM · Aguarde 3 segundos para reiniciar",
    trackEditorSave: "Salvar",
    trackEditorReset: "Reiniciar",
    trackEditorCancel: "Cancelar",
    actionAddClipboard: "Adicionar ao bloco",
    actionAddTanda: "Adicionar a tanda",
    colStatus: "Status",
    tabLibrary: "Biblioteca",
    tabDiagnostics: "Diagnostico",
    tabSystem: "Sistema",
    tabPlaylistSettings: "Playlist",
    libraryRoots: "Pastas da biblioteca",
    libraryRootsHelp: "Configure pastas de musica e cortinas.",
    addMusicFolder: "Adicionar musica",
    addCortinaFolder: "Adicionar cortinas",
    scanLibrary: "Escanear biblioteca",
    system: "Sistema",
    mainOutput: "Saida principal",
    headphoneOutput: "Saida de fone",
    language: "Idioma",
    languageHelp: "Idioma afeta rotulos e formato.",
    styleManagerLabel: "Estilos",
    styleAdd: "Adicionar",
    styleRemove: "Remover",
    styleRemoveLabel: "Remover estilo: {style}",
    styleEmpty: "Sem estilos.",
    styleNone: "Nenhum",
    defaultStyleTango: "Tango",
    defaultStyleWaltz: "Valsa",
    defaultStyleMilonga: "Milonga",
    defaultTandaSize: "Tamanho da tanda",
    clipboardNewLimitLabel: "Tamanho da colecao nova",
    searchMinScoreLabel: "Pontuacao minima de busca",
    searchBpmRangeLabel: "Intervalo de BPM",
    trimPaddingLabel: "Ajuste de corte (s)",
    trimPaddingHelp:
      "Reduz os cortes de inicio/fim detectados automaticamente.",
    playlistSettingsTitle: "Ajustes da playlist",
    playlistStartTimeLabel: "Hora de inicio da playlist",
    playlistSequenceLabel: "Sequencia de tandas",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Mapa de estilos",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    scanIssues: "Problemas de scan",
    scanIssuesHelp: "Problemas recentes e arquivos pendentes.",
    scanIssuesMore: "...e mais {count}",
    viewScanIssues: "Ver problemas",
    diagnosticsPaths: "Caminhos",
    diagnosticsPathsUserData: "Dados do usuario",
    diagnosticsPathsWaveforms: "Formas de onda",
    diagnosticsPathsFfmpeg: "ffmpeg",
    diagnosticsPathsFfprobe: "ffprobe",
    diagnosticsWaveform: "Forma de onda",
    diagnosticsWaveformRun: "Gerar forma de onda da faixa atual",
    diagnosticsWaveformNoTrack: "Nenhuma faixa em reproducao.",
    diagnosticsWaveformSuccess: "Forma de onda gerada: {path}",
    diagnosticsWaveformFailed: "Falha na forma de onda: {message}",
    eraseDatabase: "Apagar base",
    statusIssue: "Problema",
    statusOk: "OK",
    statusPreparingScan: "Preparando scan...",
    statusScanInProgress: "O scan ja esta em andamento.",
    statusScanning: "Escaneando...",
    statusScanProgress: "Scan {current}/{total} ({root})",
    statusScanComplete:
      "Scan completo. Escaneados {scanned}, adicionados {added}, atualizados {updated}, removidos {removed}.",
    statusScanIssues: "Scan completo. {count} problemas.",
    statusScanFailed: "Falha no scan.",
    statusScanFailedDetail: "Falha no scan: {message}",
    statusScanFailedNoResponse: "Falha no scan: sem resposta.",
    statusFullscreenUnavailable: "Tela cheia indisponivel.",
    statusFullscreenFailed: "Falha ao alternar tela cheia.",
    statusFullscreenFailedDetail: "Falha ao alternar tela cheia: {message}",
    statusMainProcess: "Processo principal: {message}",
    statusNoApi: "Ponte de API indisponivel.",
    statusUnknownError: "Erro desconhecido.",
    statusRendererError: "Ocorreu um problema. Detalhes registrados.",
    statusLanguageSet: "Idioma definido: {language}.",
    statusAddedMusic: "Musica adicionada: {path}.",
    statusAddedCortina: "Cortina adicionada: {path}.",
    statusDatabaseErased: "Base apagada. Adicione pastas.",
    statusNoRoots:
      "Nenhuma pasta de musica configurada. Adicione uma pasta em Ajustes.",
    statusDataLocationChanged:
      "Local dos dados definido para {path}. Base reiniciada.",
    statusDataLocationDuringPlayback:
      "Pare a reproducao antes de mudar o local dos dados.",
    legacyImportDetected:
      "Arquivos legados detectados em {path}. Importar tandas e metadados?",
    statusLegacyImportDone:
      "Importadas {tandas} tandas. Atualizadas {tracks} faixas. Faltam {missing} faixas.",
    statusMissingRoots:
      "Algumas pastas nao estao disponiveis. Conecte a unidade.",
    statusTandaSaved: "Tanda salva.",
    statusTandaDeleted: "Tanda apagada.",
    statusTandaSentToClipboard: "Tanda enviada ao bloco.",
    statusNoTandaSelected: "Selecione uma tanda para adicionar faixas.",
    statusTrackUpdated: "Faixa atualizada.",
    statusTrackUpdateFailed: "Falha ao atualizar faixa.",
    statusClipboardReadonlyRemove:
      "O item pertence a uma colecao incluida. Troque a colecao ativa para remover.",
    statusClipboardCollectionLast: "Pelo menos uma colecao e necessaria.",
    statusClipboardCollectionProtected:
      "Esta colecao e do sistema e nao pode ser removida.",
    statusClipboardCollectionReadOnly:
      "Esta colecao e somente leitura. Troque para adicionar itens.",
    statusPlaylistSequenceMismatch:
      "Este slot espera {rule}. Esta tanda e {tanda}.",
    confirmPlaylistSequenceOverride:
      "Este slot espera {expected} faixas ({rule}). Esta tanda tem {count}. Usar mesmo assim?",
    confirmPlaylistSequenceStyleOverride:
      "Este slot espera {rule}. Esta tanda e {tanda}. Adicionar mesmo assim?",
    allowOverride: "Permitir",
    dismissWarning: "Fechar",
    playlistMismatchTooltip: "Este slot espera {rule}. Esta tanda e {tanda}.",
    statusStyleAdded: "Estilo adicionado: {style}.",
    statusStyleAddFailed: "Nao foi possivel adicionar o estilo.",
    statusTandaLocked: "Esta tanda esta bloqueada durante a reproducao.",
    statusWaveformLoading: "Gerando forma de onda...",
    statusWaveformUnavailable: "Forma de onda indisponivel para esta faixa.",
    statusPlaylistLocked: "Este slot esta bloqueado durante a reproducao.",
    statusPlaylistNoEmptySlot: "Adicione um slot vazio antes de adicionar a playlist.",
    statusClipboardCleared: "Area geral limpa.",
    statusPlaylistCleared: "Playlist limpa.",
    confirmPlaylistClear: "Limpar a playlist e remover todos os itens?",
    outputSelectionFailed: "Falha ao selecionar saida.",
    outputSelectionFailedDetail: "Falha ao selecionar saida: {message}",
    playbackFailed: "Falha na reproducao.",
    playbackFailedDetail: "Falha na reproducao: {message}",
    outputDefault: "Saida padrao",
    outputSelectHeadphones: "Selecionar saida de fone",
    outputNoSecondary: "Sem saida secundaria",
    gapBetweenTracks: "Pausa entre faixas (s)",
    gapBeforeTanda: "Pausa antes da tanda (s)",
    gapBeforeCortina: "Pausa antes da cortina (s)",
    cortinaSetLabel: "Set de cortinas",
    cortinaDefaultSet: "Padrao",
    cortinaAny: "Todas",
    cortinaNone: "Nenhuma",
    cortinaDurationLabel: "Duracao da cortina (s)",
    cortinaRowLabel: "Cortina",
    cortinaRowHint: "Clique para escolher uma cortina",
    cortinaStopLabel: "Parar cortina",
    cortinaPlayLabel: "Tocar cortina",
    statusCortinaSelected: "Cortina selecionada: {title}.",
    statusCortinaLocked: "Esta cortina ja tocou e nao pode ser alterada.",
    stopFade: "Desvanecer ao parar (s)",
    addTanda: "Adicionar tanda",
    tandaNameLabel: "Nome da tanda",
    tandaStylesLabel: "Estilos",
    tandaRatingLabel: "Nota",
    tandaInstrumentalLabel: "Instrumental",
    tandaInstrumentalYes: "Sim",
    tandaInstrumentalNo: "Nao",
    tandaDurationLabel: "Duracao",
    tandaTrackCountLabel: "Faixas",
    tandaAnyStyle: "Qualquer",
    tandaPlaceholder: "Espaco vazio",
    tandaUnknownArtist: "Artista desconhecido",
    tandaUnknownYear: "Ano desconhecido",
    tandaNonInstrumental: "Cantado",
    tandaMixedLabel: "Misto",
    tandaSave: "Salvar tanda",
    tandaDone: "Concluir",
    tandaDelete: "Excluir tanda",
    tandaAddSlot: "Adicionar slot",
    tandaToClipboard: "Enviar ao bloco",
    tandaRemoveTrack: "Enviar ao bloco",
    tandaMoveUp: "Subir",
    tandaMoveDown: "Descer",
    tandaRemoveTrackShort: "C",
    tandaMoveUpShort: "^",
    tandaMoveDownShort: "v",
    confirmTandaTooSmall:
      "Esta tanda tem {count} faixas (min {min}). Salvar mesmo assim?",
    confirmDeleteTanda: "Excluir esta tanda?",
    rootAvailable: "Disponivel",
    rootMissing: "Indisponivel",
    rootMusic: "Musica",
    rootCortina: "Cortina",
    lang_en: "Ingles",
    lang_es: "Espanhol",
    lang_fr: "Frances",
    lang_de: "Alemao",
    lang_pt: "Portugues",
    lang_it: "Italiano",
  },
  it: {
    appTitle: "Tanda Player Lite",
    closeApp: "Chiudi app",
    playlistStart: "Avvia",
    playlistResume: "Riprendi",
    playlistStop: "Stop",
    searchTitle: "Cerca",
    searchPlaceholder: "Cerca brani o tandas",
    searchButton: "Cerca",
    styleLabel: "Stili",
    searchTandaSizeLabel: "Dimensione tanda",
    searchTandaSizeAny: "Qualsiasi",
    styleAll: "Tutti",
    tabTracks: "Brani",
    tabTandas: "Tandas",
    tabPlaylist: "Playlist",
    tabTandaDesigner: "Designer Tanda",
    clipboardTitle: "Appunti",
    clipboardCollectionsLabel: "Collezioni",
    clipboardCollectionPlaceholder: "Nuova collezione",
    clipboardCollectionAdd: "Aggiungi",
    clipboardCollectionRemove: "Rimuovi",
    clipboardCollectionInclude: "Includi",
    clipboardCollectionGeneral: "Generale",
    clipboardCollectionNew: "Nuovo",
    clipboardFilterPlaceholder: "Filtra",
    confirmClipboardCollectionRemove: "Rimuovere la collezione \"{name}\"?",
    clipboardClear: "Svuota",
    playlistTitle: "Playlist",
    playlistHint:
      "Usa il menu tanda per segnare la sostituzione e poi scegli negli appunti.",
    playlistClear: "Svuota",
    tandasEmpty: "Tandas in arrivo.",
    playlistEmptySlot: "Tanda vuota",
    playlistEmptyHint: "Trascina un brano qui",
    headphonePreview: "Anteprima in cuffia",
    searchResultsCount: "Risultati: {count}",
    modeLabel: "Modalita",
    modePrep: "Preparazione",
    modeLive: "Live",
    modeEdit: "Modifica",
    toggleTheme: "Cambia tema",
    toggleFullscreen: "Attiva/disattiva schermo intero",
    openSettings: "Apri impostazioni",
    settings: "Impostazioni",
    dataLocationLabel: "Posizione dati",
    dataLocationChoose: "Scegli…",
    dataLocationHelp:
      "I dati sono salvati nella cartella _tp_data nella posizione selezionata.",
    legacyImportTitle: "Import legacy",
    legacyImportButton: "Importa tandas legacy",
    close: "Chiudi",
    idle: "Inattivo",
    starting: "Avvio...",
    nowPlayingLabel: "In riproduzione",
    nowPlayingIdle: "Inattivo",
    nowPlayingMain: "Uscita principale",
    nowPlayingHeadphone: "Cuffie",
    nowPlayingUnknown: "Brano sconosciuto",
    nowPlayingTime: "{current} / {duration}",
    waveformLabel: "Timeline forma d'onda",
    waveformLoading: "Generazione forma d'onda...",
    waveformUnavailable: "Forma d'onda non disponibile",
    cortinaPickerTitle: "Selettore cortina",
    cortinaSearchLabel: "Cerca",
    confirmCloseWhilePlaying:
      "La musica sta suonando. Chiudere l'app e fermare la riproduzione?",
    confirmDataLocationChange:
      "Cambiare posizione dati in {path}? Questo crea un nuovo database.",
    confirmLegacyImport:
      "Importare tandas da {path}? Questo sostituisce le tandas esistenti e applica i metadati.",
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Rimuovi dagli appunti",
    actionRemoveClipboardShort: "R",
    actionRemovePlaylist: "Rimuovi dalla playlist",
    actionRemovePlaylistShort: "R",
    actionAddPlaylist: "Aggiungi alla playlist",
    actionAddPlaylistShort: "P",
    actionMarkPlaylist: "Segna obiettivo playlist",
    actionMarkPlaylistShort: "M",
    cancelTarget: "Annulla obiettivo",
    actionSearch: "Cerca simili",
    actionSearchShort: "S",
    actionMore: "Altre azioni",
    actionSendClipboard: "Invia agli appunti",
    actionSendClipboardShort: "C",
    duplicateFull: "In playlist",
    duplicatePartial: "Parziale sovrapposizione in playlist",
    actionEditTrack: "Modifica brano",
    actionEditTrackShort: "E",
    actionToggleTanda: "Espandi tanda",
    actionToggleTandaShort: "E",
    actionEditTanda: "Modifica tanda",
    actionEditTandaShort: "T",
    colTrack: "Brano",
    colTitle: "Titolo",
    colArtist: "Artista",
    colAlbum: "Album",
    colYear: "Anno",
    colActions: "Azioni",
    colDuration: "Durata",
    colStart: "Inizio",
    colEndTrim: "Taglio fine",
    trackEditorTitle: "Modifica brano",
    trackEditorTitleLabel: "Titolo",
    trackEditorArtistLabel: "Artista",
    trackEditorSingerLabel: "Cantante",
    trackEditorVocalLabel: "Voce",
    trackEditorVocalSung: "Cantato",
    trackEditorVocalInstrumental: "Strumentale",
    trackEditorAlbumLabel: "Album",
    trackEditorYearLabel: "Anno",
    trackEditorGenreLabel: "Stile",
    trackEditorNotesLabel: "Note",
    trackEditorBpmLabel: "BPM",
    trackEditorTapTempo: "Tap tempo",
    trackEditorTapHint: "Tocca per impostare BPM · Attendi 3 secondi per reset",
    trackEditorSave: "Salva",
    trackEditorReset: "Ripristina",
    trackEditorCancel: "Annulla",
    actionAddClipboard: "Aggiungi agli appunti",
    actionAddTanda: "Aggiungi alla tanda",
    colStatus: "Stato",
    tabLibrary: "Libreria",
    tabDiagnostics: "Diagnostica",
    tabSystem: "Sistema",
    tabPlaylistSettings: "Playlist",
    libraryRoots: "Radici libreria",
    libraryRootsHelp: "Configura cartelle musica e cortina per la scansione.",
    addMusicFolder: "Aggiungi cartella musica",
    addCortinaFolder: "Aggiungi cartella cortina",
    scanLibrary: "Scansiona libreria",
    scanMusic: "Scansiona musica",
    scanCortinas: "Scansiona cortine",
    system: "Sistema",
    mainOutput: "Uscita principale",
    headphoneOutput: "Uscita cuffie",
    language: "Lingua",
    languageHelp: "La lingua influisce su etichette e formattazione.",
    styleManagerLabel: "Stili",
    styleAdd: "Aggiungi",
    styleRemove: "Rimuovi",
    styleRemoveLabel: "Rimuovi stile: {style}",
    styleEmpty: "Nessuno stile.",
    styleNone: "Nessuno",
    defaultStyleTango: "Tango",
    defaultStyleWaltz: "Valzer",
    defaultStyleMilonga: "Milonga",
    defaultTandaSize: "Dimensione tanda predefinita",
    clipboardNewLimitLabel: "Dimensione nuova collezione",
    searchMinScoreLabel: "Punteggio minimo ricerca",
    searchBpmRangeLabel: "Intervallo BPM",
    trimPaddingLabel: "Margine taglio (s)",
    trimPaddingHelp:
      "Riduce i tagli inizio/fine rilevati automaticamente.",
    playlistSettingsTitle: "Impostazioni playlist",
    playlistStartTimeLabel: "Ora inizio playlist",
    playlistSequenceLabel: "Sequenza tanda",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Mappa stili",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    scanIssues: "Problemi di scansione",
    scanIssuesHelp: "Problemi recenti di scansione e file da controllare.",
    scanIssuesMore: "...e altri {count}",
    viewScanIssues: "Vedi problemi",
    diagnosticsPaths: "Percorsi",
    diagnosticsPathsUserData: "Dati utente",
    diagnosticsPathsWaveforms: "Forme d'onda",
    diagnosticsPathsFfmpeg: "ffmpeg",
    diagnosticsPathsFfprobe: "ffprobe",
    diagnosticsWaveform: "Forma d'onda",
    diagnosticsWaveformRun: "Genera forma d'onda per il brano corrente",
    diagnosticsWaveformNoTrack: "Nessun brano in riproduzione.",
    diagnosticsWaveformSuccess: "Forma d'onda generata: {path}",
    diagnosticsWaveformFailed: "Generazione forma d'onda fallita: {message}",
    eraseDatabase: "Cancella database",
    statusIssue: "Problema",
    statusOk: "OK",
    statusPreparingScan: "Preparazione scansione...",
    statusScanInProgress: "Scansione gia in corso.",
    statusScanning: "Scansione...",
    statusScanProgress: "Scansione {current}/{total} ({root})",
    statusScanComplete:
      "Scansione completata. Scansionati {scanned}, aggiunti {added}, aggiornati {updated}, rimossi {removed}.",
    statusScanIssues: "Scansione completata. {count} problemi.",
    statusScanFailed: "Scansione fallita.",
    statusScanFailedDetail: "Scansione fallita: {message}",
    statusScanFailedNoResponse:
      "Scansione fallita: nessuna risposta dal processo principale.",
    statusFullscreenUnavailable: "Schermo intero non disponibile.",
    statusFullscreenFailed: "Schermo intero non riuscito.",
    statusFullscreenFailedDetail: "Schermo intero non riuscito: {message}",
    statusMainProcess: "Processo principale: {message}",
    statusNoApi: "Ponte API non disponibile.",
    statusUnknownError: "Errore sconosciuto.",
    statusRendererError: "Si e verificato un problema. Dettagli registrati.",
    statusLanguageSet: "Lingua impostata: {language}.",
    statusAddedMusic: "Cartella musica aggiunta: {path}.",
    statusAddedCortina: "Cartella cortina aggiunta: {path}.",
    statusDatabaseErased:
      "Database cancellato. Aggiungi cartelle per iniziare la scansione.",
    statusNoRoots:
      "Nessuna cartella musica configurata. Aggiungi una cartella in Impostazioni per iniziare la scansione.",
    statusDataLocationChanged:
      "Posizione dati impostata su {path}. Database reimpostato.",
    statusDataLocationDuringPlayback:
      "Ferma la riproduzione prima di cambiare la posizione dati.",
    legacyImportDetected:
      "File legacy rilevati in {path}. Importare tandas e metadati?",
    statusLegacyImportDone:
      "Importate {tandas} tandas. Aggiornati {tracks} brani. Mancano {missing} brani.",
    statusMissingRoots:
      "Alcune cartelle non disponibili. Collega il disco o aggiorna Impostazioni.",
    statusTandaSaved: "Tanda salvata.",
    statusTandaDeleted: "Tanda eliminata.",
    statusTandaSentToClipboard: "Tanda inviata agli appunti.",
    statusNoTandaSelected: "Seleziona una tanda per aggiungere brani.",
    statusTrackUpdated: "Brano aggiornato.",
    statusTrackUpdateFailed: "Aggiornamento brano fallito.",
    statusClipboardReadonlyRemove:
      "Elemento in una collezione inclusa. Cambia collezione attiva per rimuovere.",
    statusClipboardCollectionLast: "E richiesta almeno una collezione.",
    statusClipboardCollectionProtected:
      "Questa collezione e gestita dal sistema e non puo essere rimossa.",
    statusClipboardCollectionReadOnly:
      "Questa collezione e in sola lettura. Passa a un'altra collezione per aggiungere elementi.",
    statusPlaylistSequenceMismatch:
      "Lo slot richiede {rule}. Questa tanda e {tanda}.",
    confirmPlaylistSequenceOverride:
      "Lo slot richiede {expected} brani ({rule}). Questa tanda ne ha {count}. Usarla comunque?",
    confirmPlaylistSequenceStyleOverride:
      "Lo slot richiede {rule}. Questa tanda e {tanda}. Aggiungere comunque?",
    allowOverride: "Consenti comunque",
    dismissWarning: "Ignora",
    playlistMismatchTooltip: "Lo slot richiede {rule}. Questa tanda e {tanda}.",
    statusStyleAdded: "Stile aggiunto: {style}.",
    statusStyleAddFailed: "Impossibile aggiungere stile.",
    statusTandaLocked: "Questa tanda e bloccata durante la riproduzione live.",
    statusWaveformLoading: "Generazione forma d'onda...",
    statusWaveformUnavailable: "Forma d'onda non disponibile per questo brano.",
    statusPlaylistLocked:
      "Questo slot playlist e bloccato durante la riproduzione live.",
    statusPlaylistNoEmptySlot:
      "Aggiungi uno slot vuoto prima di aggiungere alla playlist.",
    statusClipboardCleared: "Appunti generali svuotati.",
    statusPlaylistCleared: "Playlist svuotata.",
    confirmPlaylistClear: "Svuotare la playlist e rimuovere tutti gli elementi?",
    outputSelectionFailed: "Selezione uscita fallita.",
    outputSelectionFailedDetail: "Selezione uscita fallita: {message}",
    playbackFailed: "Riproduzione fallita.",
    playbackFailedDetail: "Riproduzione fallita: {message}",
    outputDefault: "Uscita predefinita",
    outputSelectHeadphones: "Seleziona uscita cuffie",
    outputNoSecondary: "Nessuna uscita secondaria disponibile",
    gapBetweenTracks: "Pausa tra brani (s)",
    gapBeforeTanda: "Pausa prima della tanda (s)",
    gapBeforeCortina: "Pausa prima della cortina (s)",
    cortinaSetLabel: "Set cortina",
    cortinaDefaultSet: "Predefinito",
    cortinaAny: "Qualsiasi",
    cortinaNone: "Nessuna",
    cortinaDurationLabel: "Durata cortina (s)",
    cortinaRowLabel: "Cortina",
    cortinaRowHint: "Clicca per scegliere una cortina",
    cortinaStopLabel: "Ferma cortina",
    cortinaPlayLabel: "Riproduci cortina",
    statusCortinaSelected: "Cortina selezionata: {title}.",
    statusCortinaLocked:
      "Questa cortina e gia stata riprodotta e non puo essere cambiata.",
    stopFade: "Dissolvenza stop (s)",
    addTanda: "Aggiungi tanda",
    tandaNameLabel: "Nome tanda",
    tandaStylesLabel: "Stili",
    tandaRatingLabel: "Valutazione",
    tandaInstrumentalLabel: "Strumentale",
    tandaInstrumentalYes: "Si",
    tandaInstrumentalNo: "No",
    tandaDurationLabel: "Durata",
    tandaTrackCountLabel: "Brani",
    tandaAnyStyle: "Qualsiasi",
    tandaPlaceholder: "Slot vuoto",
    tandaUnknownArtist: "Artista sconosciuto",
    tandaUnknownYear: "Anno sconosciuto",
    tandaNonInstrumental: "Cantato",
    tandaMixedLabel: "Misto",
    tandaSave: "Salva tanda",
    tandaDone: "Fatto",
    tandaDelete: "Elimina tanda",
    tandaAddSlot: "Aggiungi slot",
    tandaToClipboard: "Invia agli appunti",
    tandaRemoveTrack: "Invia agli appunti",
    tandaMoveUp: "Sposta su",
    tandaMoveDown: "Sposta giu",
    tandaRemoveTrackShort: "C",
    tandaMoveUpShort: "^",
    tandaMoveDownShort: "v",
    confirmTandaTooSmall:
      "Questa tanda ha {count} brani (min {min}). Salvare comunque?",
    confirmDeleteTanda: "Eliminare questa tanda?",
    rootAvailable: "Disponibile",
    rootMissing: "Mancante",
    rootMusic: "Musica",
    rootCortina: "Cortina",
    lang_en: "Inglese",
    lang_es: "Spagnolo",
    lang_fr: "Francese",
    lang_de: "Tedesco",
    lang_pt: "Portoghese",
    lang_it: "Italiano",
  },
};

const getLanguage = () =>
  (localStorage.getItem("tanda-language") as LanguageKey) || "en";

const t = (key: string, params?: Record<string, string | number>) => {
  const lang = getLanguage();
  const value = translations[lang]?.[key] ?? translations.en[key] ?? key;
  if (!params) {
    return value;
  }
  return Object.entries(params).reduce(
    (acc, [paramKey, paramValue]) =>
      acc.replace(`{${paramKey}}`, String(paramValue)),
    value,
  );
};

const renderLanguageOptions = () => {
  if (!languageSelect) {
    return;
  }
  const current = getLanguage();
  languageSelect.innerHTML = "";
  (["en", "es", "fr", "de", "pt", "it"] as LanguageKey[]).forEach((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = t(`lang_${code}`);
    languageSelect.appendChild(option);
  });
  languageSelect.value = current;
};

const applyTranslations = () => {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) {
      return;
    }
    const attr = element.dataset.i18nAttr;
    if (attr) {
      attr
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((name) => {
          element.setAttribute(name, t(key));
        });
      return;
    }
    const params =
      key === "searchResultsCount"
        ? { count: searchState.total }
        : undefined;
    element.textContent = t(key, params);
  });
  renderLanguageOptions();
  updateSortButtons();
  updateNowPlayingDisplay();
  renderTandaDesigner();
};

const gainForTrack = (gainDb: number | null | undefined) => {
  if (gainDb === null || gainDb === undefined) {
    return 1;
  }
  const gain = Math.pow(10, gainDb / 20);
  return Math.max(0, Math.min(1, gain));
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

const setTrackEditorOpen = (open: boolean) => {
  if (!trackEditor) {
    return;
  }
  updateTrackEditorPresentation();
  if (!open || appMode !== "edit") {
    resetModalCardPosition(trackEditor);
  }
  trackEditor.classList.toggle("open", open);
  trackEditor.setAttribute("aria-hidden", open ? "false" : "true");
};

const resetTapTempo = () => {
  trackEditorState.taps = [];
  if (trackEditorState.tapTimeoutId !== null) {
    window.clearTimeout(trackEditorState.tapTimeoutId);
    trackEditorState.tapTimeoutId = null;
  }
};

const fillTrackEditorFields = (track: TrackRow) => {
  if (
    !trackEditorTitleInput ||
    !trackEditorArtistInput ||
    !trackEditorSingerInput ||
    !trackEditorVocalInput ||
    !trackEditorAlbumInput ||
    !trackEditorYearInput ||
    !trackEditorGenreInput ||
    !trackEditorNotesInput ||
    !trackEditorBpmInput
  ) {
    return;
  }
  const options = [""].concat(availableStyles);
  trackEditorGenreInput.innerHTML = "";
  options.forEach((style) => {
    const option = document.createElement("option");
    option.value = style;
    option.textContent = style || t("styleNone");
    trackEditorGenreInput.appendChild(option);
  });
  trackEditorTitleInput.value = track.title ?? "";
  trackEditorArtistInput.value = track.artist ?? "";
  trackEditorSingerInput.value = track.singer ?? "";
  trackEditorVocalInput.innerHTML = "";
  const sungOption = document.createElement("option");
  sungOption.value = "sung";
  sungOption.textContent = t("trackEditorVocalSung");
  const instrumentalOption = document.createElement("option");
  instrumentalOption.value = "instrumental";
  instrumentalOption.textContent = t("trackEditorVocalInstrumental");
  trackEditorVocalInput.append(sungOption, instrumentalOption);
  trackEditorVocalInput.value = track.instrumental === true ? "instrumental" : "sung";
  trackEditorAlbumInput.value = track.album ?? "";
  trackEditorYearInput.value = track.year ?? "";
  trackEditorGenreInput.value = track.genre ?? "";
  trackEditorNotesInput.value = track.notes ?? "";
  trackEditorBpmInput.value =
    track.bpm !== null && track.bpm !== undefined ? `${Math.round(track.bpm)}` : "";
  resetTapTempo();
};

const openTrackEditor = (trackId: string) => {
  const track = trackCache.get(trackId);
  if (!track) {
    return;
  }
  trackEditorState.track = { ...track };
  fillTrackEditorFields(track);
  setTrackEditorOpen(true);
};

const updateTrackCaches = (track: TrackRow) => {
  trackCache.set(track.id, track);
  searchState.items = searchState.items.map((item) =>
    item.id === track.id ? track : item,
  );
  clipboardTracks = clipboardTracks.map((item) =>
    item.id === track.id ? track : item,
  );
  playlistItems = playlistItems.map((item) => {
    if (item?.kind === "track" && item.track.id === track.id) {
      return { ...item, track };
    }
    return item;
  });
};

const handleTapTempo = () => {
  if (!trackEditorBpmInput) {
    return;
  }
  const now = Date.now();
  const lastTap =
    trackEditorState.taps.length > 0
      ? trackEditorState.taps[trackEditorState.taps.length - 1]
      : null;
  if (!lastTap || now - lastTap > 3000) {
    resetTapTempo();
  }
  trackEditorState.taps.push(now);
  if (trackEditorState.taps.length >= 2) {
    const elapsed =
      trackEditorState.taps[trackEditorState.taps.length - 1] -
      trackEditorState.taps[0];
    const intervals = trackEditorState.taps.length - 1;
    if (elapsed > 0 && intervals > 0) {
      const bpm = 60000 / (elapsed / intervals);
      trackEditorBpmInput.value = `${Math.round(bpm)}`;
    }
  }
  if (trackEditorState.tapTimeoutId !== null) {
    window.clearTimeout(trackEditorState.tapTimeoutId);
  }
  trackEditorState.tapTimeoutId = window.setTimeout(() => {
    resetTapTempo();
  }, 3000);
};

const resetTrackEditorFields = () => {
  if (!trackEditorState.track) {
    return;
  }
  fillTrackEditorFields(trackEditorState.track);
};

const parseSettingNumber = (
  key: string,
  fallback: number,
  min: number,
  max: number,
) => {
  const raw = localStorage.getItem(key);
  const value = raw ? Number.parseFloat(raw) : fallback;
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
};

const getPlaylistSequenceInput = () =>
  localStorage.getItem("tanda-playlist-sequence") ?? DEFAULT_PLAYLIST_SEQUENCE;

const getPlaylistStyleMapInput = () =>
  localStorage.getItem("tanda-playlist-style-map") ?? DEFAULT_STYLE_MAP;
const getPlaylistStartTimeInput = () =>
  localStorage.getItem("tanda-playlist-start-time") ?? DEFAULT_PLAYLIST_START_TIME;

const getPlaylistSequence = (): SequenceEntry[] =>
  parseSequence(getPlaylistSequenceInput());

const getPlaylistStyleMap = (): StyleMap =>
  parseStyleMap(getPlaylistStyleMapInput());

const getRuleForSlot = (slotIndex: number) =>
  getSequenceRule(getPlaylistSequence(), slotIndex);

const getSequenceLabel = (rule: SequenceEntry) =>
  `${rule.count}${rule.code.toLowerCase()}`;

const getTandaSequenceLabel = (tanda: TandaDraft) => {
  const count = tanda.trackSlots.filter(Boolean).length;
  const style = getTandaStyleBadge(tanda);
  if (!style || style === "?") {
    return `${count}?`;
  }
  return `${count}${style.toLowerCase()}`;
};

const formatClockTime = (totalMinutes: number) => {
  const minutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, "0")}`;
};

const getTrackCount = (tanda: TandaDraft) =>
  tanda.trackSlots.filter(Boolean).length;

const getTrimPaddingSeconds = () =>
  parseSettingNumber(TRIM_PADDING_KEY, 0, 0, 5);

const getAdjustedTrimValues = (track: TrackRow | null) => {
  const paddingMs = getTrimPaddingSeconds() * 1000;
  const startOffsetMs = Math.max(
    0,
    (track?.start_offset_ms ?? 0) - paddingMs,
  );
  const endTrimMs = Math.max(0, (track?.end_trim_ms ?? 0) - paddingMs);
  return { startOffsetMs, endTrimMs };
};

const getEffectiveTrackDurationMs = (track: TrackRow | null) => {
  if (!track) {
    return 0;
  }
  const { startOffsetMs, endTrimMs } = getAdjustedTrimValues(track);
  return Math.max(0, track.duration_ms - startOffsetMs - endTrimMs);
};

const getTandaDurationMs = (tanda: TandaDraft) => {
  const tracks = tanda.trackSlots.map((trackId) =>
    trackId ? trackCache.get(trackId) ?? null : null,
  );
  const trackCount = tracks.filter(Boolean).length;
  const gaps = Math.max(0, trackCount - 1) * getGapBetweenTracks() * 1000;
  const durationMs = tracks.reduce(
    (sum, track) => sum + getEffectiveTrackDurationMs(track),
    0,
  );
  return durationMs + gaps;
};

const buildPlaylistTimeline = () => {
  const entries: TimelineEntry[] = [];
  playlistItems.forEach((item, index) => {
    if (!item) {
      return;
    }
    if (item.kind === "track") {
      const durationMs = getEffectiveTrackDurationMs(item.track);
      entries.push({
        index,
        durationMs,
        trackDurationsMs: [durationMs],
      });
      return;
    }
    const tracks = resolvePlaylistTracks(item);
    if (tracks.length === 0) {
      return;
    }
    const trackDurationsMs = tracks.map((track) => getEffectiveTrackDurationMs(track));
    const gaps =
      Math.max(0, trackDurationsMs.length - 1) * getGapBetweenTracks() * 1000;
    const durationMs =
      trackDurationsMs.reduce((total, value) => total + value, 0) + gaps;
    entries.push({
      index,
      durationMs,
      trackDurationsMs,
    });
  });
  if (entries.length === 0) {
    return { entries, offsets: [], indexToOffset: new Map<number, number>() };
  }
  const offsets = computeTimelineOffsetsMs(entries, {
    gapBeforeTandaMs: getGapBeforeTanda() * 1000,
    gapBeforeCortinaMs: getGapBeforeCortina() * 1000,
    cortinaDurationMs: getCortinaDuration() * 1000,
    cortinaFadeMs: getStopFadeSeconds() * 1000,
    cortinaEnabled: isCortinaEnabled(),
  });
  const indexToOffset = new Map<number, number>();
  offsets.forEach((offset, idx) => {
    indexToOffset.set(entries[idx].index, offset);
  });
  return { entries, offsets, indexToOffset };
};

const computeLiveBaseStartMs = (
  timeline: ReturnType<typeof buildPlaylistTimeline>,
  resumeState: PlaylistResumeState | null,
) => {
  if (appMode !== "live" || playlistPlayback.status !== "playing") {
    return null;
  }
  if (timeline.entries.length === 0) {
    return null;
  }
  let elapsedMs = 0;
  if (resumeState) {
    const entryIndex = timeline.entries.findIndex(
      (entry) => entry.index === resumeState.itemIndex,
    );
    const entry = entryIndex >= 0 ? timeline.entries[entryIndex] : null;
    const offsetMs =
      entryIndex >= 0 ? timeline.offsets[entryIndex] ?? 0 : 0;
    if (entry) {
      elapsedMs = computeElapsedMsForEntry({
        offsetMs,
        trackDurationsMs: entry.trackDurationsMs,
        trackIndex: resumeState.trackIndex,
        gapBetweenTracksMs: getGapBetweenTracks() * 1000,
        progressMs: (resumeState.resumeTime ?? 0) * 1000,
      });
    }
  }
  return Date.now() - elapsedMs;
};

const getLiveBaseStartMs = (
  timeline: ReturnType<typeof buildPlaylistTimeline>,
) => {
  if (appMode !== "live" || playlistPlayback.status !== "playing") {
    return null;
  }
  if (playlistPlayback.liveBaseStartMs) {
    return playlistPlayback.liveBaseStartMs;
  }
  const elapsedMs = getLiveElapsedMs(timeline);
  if (elapsedMs === null) {
    return null;
  }
  return Date.now() - elapsedMs;
};

const getLiveElapsedMs = (
  timeline: ReturnType<typeof buildPlaylistTimeline>,
) => {
  if (timeline.entries.length === 0) {
    return null;
  }
  const progressMs = (playback.main.active?.currentTime ?? 0) * 1000;
  const gapBeforeTandaMs = getGapBeforeTanda() * 1000;
  const gapBeforeCortinaMs = getGapBeforeCortina() * 1000;
  const cortinaDurationMs = getCortinaDuration() * 1000;
  const cortinaFadeMs = getStopFadeSeconds() * 1000;
  if (cortinaPlaying && cortinaActiveIndex !== null) {
    if (cortinaActiveIndex === playlistItems.length) {
      const totalMs = computeTimelineTotalMs(timeline.offsets, timeline.entries);
      return totalMs + gapBeforeCortinaMs + progressMs;
    }
    const entryIndex = timeline.entries.findIndex(
      (entry) => entry.index === cortinaActiveIndex,
    );
    if (entryIndex < 0) {
      return null;
    }
    const offsetMs = timeline.offsets[entryIndex] ?? 0;
    const cortinaStartMs = computeCortinaStartOffsetMs(
      offsetMs,
      gapBeforeTandaMs,
      gapBeforeCortinaMs,
      cortinaDurationMs,
      cortinaFadeMs,
    );
    return cortinaStartMs + progressMs;
  }
  const entryIndex = timeline.entries.findIndex(
    (entry) => entry.index === playlistPlayback.currentIndex,
  );
  if (entryIndex < 0) {
    return null;
  }
  const entry = timeline.entries[entryIndex];
  const offsetMs = timeline.offsets[entryIndex] ?? 0;
  return computeElapsedMsForEntry({
    offsetMs,
    trackDurationsMs: entry.trackDurationsMs,
    trackIndex: playlistPlayback.currentTrackIndex,
    gapBetweenTracksMs: getGapBetweenTracks() * 1000,
    progressMs,
  });
};

const getPlaylistStartTimes = () => {
  const timeline = buildPlaylistTimeline();
  const baseStartMs = getLiveBaseStartMs(timeline);
  const startMinutes = getPlaylistStartTimeMinutes();
  const startTimes = new Map<number, number>();
  timeline.offsets.forEach((offsetMs, idx) => {
    const minutes = baseStartMs
      ? getMinutesOfDayFromMs(baseStartMs + offsetMs)
      : startMinutes + Math.round(offsetMs / 60000);
    startTimes.set(timeline.entries[idx].index, minutes);
  });
  return startTimes;
};

const getCortinaStartTimes = () => {
  const timeline = buildPlaylistTimeline();
  const baseStartMs = getLiveBaseStartMs(timeline);
  const startMinutes = getPlaylistStartTimeMinutes();
  const startTimes = new Map<number, number>();
  if (!isCortinaEnabled()) {
    return startTimes;
  }
  if (timeline.entries.length === 0) {
    return startTimes;
  }
  const gapBeforeTandaMs = getGapBeforeTanda() * 1000;
  const gapBeforeCortinaMs = getGapBeforeCortina() * 1000;
  const cortinaDurationMs = getCortinaDuration() * 1000;
  const cortinaFadeMs = getStopFadeSeconds() * 1000;
  timeline.offsets.forEach((offsetMs, idx) => {
    const cortinaStartMs = computeCortinaStartOffsetMs(
      offsetMs,
      gapBeforeTandaMs,
      gapBeforeCortinaMs,
      cortinaDurationMs,
      cortinaFadeMs,
    );
    const minutes = baseStartMs
      ? getMinutesOfDayFromMs(baseStartMs + cortinaStartMs)
      : startMinutes + Math.round(cortinaStartMs / 60000);
    startTimes.set(timeline.entries[idx].index, minutes);
  });
  const totalMs = computeTimelineTotalMs(timeline.offsets, timeline.entries);
  const endStartMs = totalMs + gapBeforeCortinaMs;
  const endMinutes = baseStartMs
    ? getMinutesOfDayFromMs(baseStartMs + endStartMs)
    : startMinutes + Math.round(endStartMs / 60000);
  startTimes.set(playlistItems.length, endMinutes);
  return startTimes;
};

const validateTandaForSlot = (tanda: TandaDraft, slotIndex: number) => {
  const sequence = getPlaylistSequence();
  const rule = getSequenceRule(sequence, slotIndex);
  if (!rule) {
    return { ok: true, rule: null };
  }
  const trackCount = tanda.trackSlots.filter(Boolean).length;
  const styleMap = getPlaylistStyleMap();
  const validation = validateTandaForRule(trackCount, tanda.styles, rule, styleMap);
  return { ok: validation.ok, rule, reason: validation.reason, trackCount };
};

const getGapBetweenTracks = () =>
  parseSettingNumber("tanda-gap-between-tracks", 2, 0, 30);
const getGapBeforeTanda = () =>
  parseSettingNumber("tanda-gap-before-tanda", 4, 0, 30);
const getGapBeforeCortina = () =>
  parseSettingNumber("tanda-gap-before-cortina", 0, 0, 30);
const getStopFadeSeconds = () =>
  parseSettingNumber("tanda-stop-fade", 2, 0, 10);
const getPlaylistStartTimeMinutes = () => {
  const raw = getPlaylistStartTimeInput().trim() || DEFAULT_PLAYLIST_START_TIME;
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return 20 * 60;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 20 * 60;
  }
  return Math.min(23, Math.max(0, hours)) * 60 + Math.min(59, Math.max(0, minutes));
};

const buildTrackLabel = (track?: TrackRow) => {
  if (!track) {
    return t("nowPlayingUnknown");
  }
  const artist = track.artist?.trim();
  const title = track.title?.trim();
  if (artist && title) {
    return `${artist} — ${title}`;
  }
  return title || artist || t("nowPlayingUnknown");
};

const getNowPlayingState = () => {
  const headphone = playback.headphone;
  if (headphone.active && !headphone.active.paused) {
    return { channel: "headphone" as const, state: headphone };
  }
  const main = playback.main;
  if (main.active && !main.active.paused) {
    return { channel: "main" as const, state: main };
  }
  return null;
};

const applyPulseToRow = <T,>(row: HTMLElement, set: Set<T>, key: T) => {
  if (!set.has(key)) {
    return;
  }
  set.delete(key);
  row.classList.remove("pulse-arrival");
  // Restart animation even if the class was already present.
  void row.offsetWidth;
  row.classList.add("pulse-arrival");
  row.addEventListener(
    "animationend",
    () => row.classList.remove("pulse-arrival"),
    { once: true },
  );
};

const markPlaylistPulse = (index: number) => {
  if (!Number.isFinite(index) || index < 0) {
    return;
  }
  pulsePlaylistIndices.add(index);
};

const markCortinaPulse = (index: number | null) => {
  if (index === null || !Number.isFinite(index) || index < 0) {
    return;
  }
  pulseCortinaIndices.add(index);
};

const markClipboardTrackPulse = (trackId: string) => {
  pulseClipboardTrackIds.add(trackId);
};

const markClipboardTandaPulse = (tandaId: string) => {
  pulseClipboardTandaIds.add(tandaId);
};

const getCortinaRowTrack = (index: number) => {
  const override = cortinaOverrideByIndex.get(index);
  if (override) {
    return override;
  }
  const planned = cortinaPlannedByIndex.get(index);
  if (cortinaPlaying && cortinaActiveIndex === index) {
    return playback.main.track ?? planned ?? null;
  }
  if (planned) {
    return planned;
  }
  return null;
};

const updateWaveformSource = async (trackId: string | null) => {
  if (!waveformImage || !waveformContainer) {
    return;
  }
  if (!trackId) {
    waveformImage.src = "";
    waveformContainer.classList.add("hidden");
    waveformContainer.classList.remove("missing");
    waveformTrackId = null;
    if (waveformPlaceholder) {
      waveformPlaceholder.textContent = t("waveformUnavailable");
    }
    return;
  }
  if (waveformTrackId === trackId && waveformImage.src) {
    return;
  }
  waveformTrackId = trackId;
  waveformContainer.classList.remove("hidden");
  waveformContainer.classList.add("missing");
  if (waveformPlaceholder) {
    waveformPlaceholder.textContent = t("waveformLoading");
  }
  const requestId = (waveformRequestId += 1);
  const dataUrl = await window.tanda?.getWaveform(trackId);
  if (requestId !== waveformRequestId) {
    return;
  }
  if (dataUrl) {
    waveformImage.src = dataUrl;
    waveformContainer.classList.remove("hidden");
    waveformContainer.classList.remove("missing");
  } else {
    waveformImage.src = "";
    waveformContainer.classList.remove("hidden");
    waveformContainer.classList.add("missing");
    if (waveformPlaceholder) {
      waveformPlaceholder.textContent = t("waveformUnavailable");
    }
    setStatus(t("statusWaveformUnavailable"));
  }
};

const updateNowPlayingDisplay = () => {
  if (!nowPlayingTrack || !nowPlayingTime || !nowPlayingSource) {
    return;
  }
  const active = getNowPlayingState();
  if (!active) {
    nowPlayingTrack.textContent = t("nowPlayingIdle");
    nowPlayingSource.textContent = t("nowPlayingMain");
    nowPlayingTime.textContent = t("nowPlayingTime", {
      current: formatTime(0),
      duration: formatTime(0),
    });
    void updateWaveformSource(null);
    if (waveformProgress) {
      waveformProgress.style.width = "0%";
    }
    if (waveformPlayhead) {
      waveformPlayhead.style.left = "0%";
    }
    updatePlayingIndicators();
    return;
  }

  const { channel, state } = active;
  const track = state.track;
  const { startOffsetMs, endTrimMs } = getAdjustedTrimValues(track ?? null);
  const baseDurationMs = track?.duration_ms ?? 0;
  const audioDurationSeconds = Number.isFinite(state.active?.duration)
    ? state.active?.duration ?? 0
    : 0;
  const baseDurationSeconds =
    audioDurationSeconds > 0
      ? audioDurationSeconds
      : baseDurationMs > 0
        ? baseDurationMs / 1000
        : 0;
  const effectiveDurationSeconds =
    baseDurationSeconds > 0
      ? Math.max(
          0,
          baseDurationSeconds - startOffsetMs / 1000 - endTrimMs / 1000,
        )
      : 0;
  const cortinaDisplayDurationSeconds =
    cortinaPlaying &&
    channel === "main" &&
    Boolean(track) &&
    !cortinaAllowFull
      ? Math.min(effectiveDurationSeconds, getCortinaDuration())
      : effectiveDurationSeconds;
  const currentSeconds = Math.max(
    0,
    (state.active?.currentTime ?? 0) - startOffsetMs / 1000,
  );
  const clampedCurrent = Math.min(
    currentSeconds,
    cortinaDisplayDurationSeconds || currentSeconds,
  );

  nowPlayingTrack.textContent = buildTrackLabel(track);
  nowPlayingSource.textContent =
    channel === "headphone"
      ? t("nowPlayingHeadphone")
      : t("nowPlayingMain");
  nowPlayingTime.textContent = t("nowPlayingTime", {
    current: formatTime(clampedCurrent),
    duration: formatTime(cortinaDisplayDurationSeconds),
  });
  const progressSeconds = Math.max(0, state.active?.currentTime ?? 0);
  const progressDurationSeconds = baseDurationSeconds;
  const progress =
    progressDurationSeconds > 0 ? progressSeconds / progressDurationSeconds : 0;
  if (waveformProgress) {
    waveformProgress.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
  }
  if (waveformPlayhead) {
    waveformPlayhead.style.left = `${Math.min(100, Math.max(0, progress * 100))}%`;
  }
  void updateWaveformSource(track?.id ?? null);
  updatePlayingIndicators();
};

const seekToWaveformPosition = (event: MouseEvent) => {
  const active = getNowPlayingState();
  if (!active || !active.state.active) {
    return;
  }
  if (appMode !== "prep" && appMode !== "edit") {
    return;
  }
  if (!waveformContainer) {
    return;
  }
  const rect = waveformContainer.getBoundingClientRect();
  if (rect.width <= 0) {
    return;
  }
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const track = active.state.track;
  const baseDurationMs = track?.duration_ms ?? 0;
  const startOffsetMs = track?.start_offset_ms ?? 0;
  const endTrimMs = track?.end_trim_ms ?? 0;
  const baseDurationSeconds =
    baseDurationMs > 0
      ? baseDurationMs / 1000
      : Number.isFinite(active.state.active.duration)
        ? active.state.active.duration ?? 0
        : 0;
  if (!Number.isFinite(baseDurationSeconds) || baseDurationSeconds <= 0) {
    return;
  }
  const targetSeconds = ratio * baseDurationSeconds;
  active.state.active.currentTime = Math.min(
    targetSeconds,
    baseDurationSeconds > 0 ? baseDurationSeconds : targetSeconds,
  );
  updateNowPlayingDisplay();
};

const handleTandaAction = async (event: Event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>("button[data-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.action;
  const tandaId =
    button.dataset.tandaId ??
    target.closest<HTMLElement>(".tanda-card")?.dataset.tandaId ??
    target.closest<HTMLElement>(".tanda-track-row")?.dataset.tandaId;
  if (!action || !tandaId) {
    return;
  }
  const resolved = resolveTandaDraft(tandaId);
  if (!resolved) {
    return;
  }
  ensureTandaDraft(resolved);
  const tanda = resolved;
  if (isTandaLocked(tandaId)) {
    setStatus(t("statusTandaLocked"));
    return;
  }
  if (action === "tanda-edit") {
    setActiveTanda(tanda.id);
    activateRightTab("tanda-designer-tab");
    renderTandaDesigner();
    return;
  }
  if (action === "tanda-edit-track") {
    const trackId = target
      .closest<HTMLElement>(".tanda-track-row")
      ?.dataset.trackId;
    if (trackId) {
      openTrackEditor(trackId);
    }
    return;
  }
  if (action === "tanda-add-slot") {
    tanda.trackSlots.push(null);
    renderTandaDesigner();
    return;
  }
  if (action === "tanda-save") {
    if (!window.tanda) {
      return;
    }
    const minSize = getDefaultTandaSize();
    const cleanedSlots = tanda.trackSlots.filter(
      (trackId) => trackId !== null,
    );
    if (cleanedSlots.length < minSize) {
      const confirmed = window.confirm(
        t("confirmTandaTooSmall", {
          count: cleanedSlots.length,
          min: minSize,
        }),
      );
      if (!confirmed) {
        return;
      }
    }
    tanda.trackSlots = cleanedSlots;
    const totalDurationMs = tanda.trackSlots.reduce((sum, trackId) => {
      if (!trackId) {
        return sum;
      }
      return sum + getEffectiveTrackDurationMs(trackCache.get(trackId) ?? null);
    }, 0);
    const instrumental = deriveInstrumental(
      tanda.trackSlots.map((trackId) =>
        trackId ? trackCache.get(trackId) ?? null : null,
      ),
    );
    const saved = await window.tanda.saveTanda({
      id: tanda.id,
      name: tanda.name,
      styles: tanda.styles,
      rating: tanda.rating,
      instrumental,
      total_duration_ms: totalDurationMs,
      track_slots: tanda.trackSlots,
    });
    upsertTandaCache(saved);
    tandaDrafts = tandaDrafts.filter((item) => item.id !== tanda.id);
    const fresh = createEmptyTanda();
    tandaDrafts = [fresh, ...tandaDrafts];
    selectedTandaId = fresh.id;
    setStatus(t("statusTandaSaved"));
    renderTandaDesigner();
    await refreshSearch();
    return;
  }
  if (action === "tanda-done") {
    finalizeTandaDraft(tanda, tandaEditorReturnTab);
    tandaEditorReturnTab = null;
    if (tandaEditorHostTab === "playlist-tab") {
      clearPlaylistOpenTanda();
      renderPlaylist();
      renderTandaDesigner();
    }
    return;
  }
  if (action === "tanda-delete") {
    const confirmed = window.confirm(t("confirmDeleteTanda"));
    if (!confirmed) {
      return;
    }
    if (window.tanda) {
      await window.tanda.deleteTanda(tandaId);
    }
    tandaDrafts = tandaDrafts.filter((item) => item.id !== tandaId);
    if (selectedTandaId === tandaId) {
      selectedTandaId = tandaDrafts[0]?.id ?? null;
    }
    setStatus(t("statusTandaDeleted"));
    renderTandaDesigner();
    renderClipboard();
    await refreshSearch();
    return;
  }
  if (action === "tanda-clip") {
    ensureTandaDraft(tanda);
    addTandaToClipboard(tanda.id);
    setStatus(t("statusTandaSentToClipboard"));
    return;
  }
  const slotIndexRaw = target.closest<HTMLElement>(".tanda-track-row")
    ?.dataset.slotIndex;
  const slotIndex = slotIndexRaw ? Number.parseInt(slotIndexRaw, 10) : -1;
  if (slotIndex < 0) {
    return;
  }
  if (action === "tanda-up" && slotIndex > 0) {
    [tanda.trackSlots[slotIndex - 1], tanda.trackSlots[slotIndex]] = [
      tanda.trackSlots[slotIndex],
      tanda.trackSlots[slotIndex - 1],
    ];
    renderTandaDesigner();
    return;
  }
  if (action === "tanda-down" && slotIndex < tanda.trackSlots.length - 1) {
    [tanda.trackSlots[slotIndex + 1], tanda.trackSlots[slotIndex]] = [
      tanda.trackSlots[slotIndex],
      tanda.trackSlots[slotIndex + 1],
    ];
    renderTandaDesigner();
    return;
  }
  if (action === "tanda-remove") {
    const trackId = tanda.trackSlots[slotIndex];
    if (trackId) {
      const track = trackCache.get(trackId);
      if (track) {
        addTrackToClipboard(track);
      }
    }
    tanda.trackSlots[slotIndex] = null;
    const tracks = tanda.trackSlots.map((id) =>
      id ? trackCache.get(id) ?? null : null,
    );
    const derivedStyles = collectStylesFromTracks(tracks, availableStyles);
    const normalizedExisting = tanda.styles
      .map((style) => normalizeStyleName(style))
      .map((normalized) =>
        availableStyles.find(
          (style) => normalizeStyleName(style) === normalized,
        ),
      )
      .filter(Boolean) as string[];
    tanda.styles = Array.from(new Set([...normalizedExisting, ...derivedStyles]));
    if (selectedTandaId === tanda.id) {
      selectedStyles = [...tanda.styles];
      loadStyles();
      updateSearchTabVisibility();
      refreshSearch();
    }
    renderTandaDesigner();
  }
};

const loadTandaDrafts = async () => {
  if (!window.tanda) {
    return;
  }
  try {
    const tandas = await window.tanda.listTandas();
    if (tandas.length > 0) {
      tandas.forEach((tanda) => {
        tanda.tracks.forEach((track) => trackCache.set(track.id, track));
      });
      const draft = createEmptyTanda();
      tandaDrafts = [draft];
      selectedTandaId = draft.id;
      return;
    }
  } catch {
    // ignore load errors, fall back to empty tanda
  }
  const draft = createEmptyTanda();
  tandaDrafts = [draft];
  selectedTandaId = draft.id;
};

const updatePlayingIndicators = () => {
  const active = getNowPlayingState();
  const activeId = active?.state.currentTrackId ?? null;
  const activeChannel = active?.channel ?? null;
  document
    .querySelectorAll<HTMLElement>(".list-row[data-track-id]")
    .forEach((row) => {
      const match = row.dataset.trackId === activeId;
      row.classList.toggle("playing", match);
      row.classList.toggle(
        "playing-headphone",
        match && activeChannel === "headphone",
      );
    });
};

const fadeBetween = (
  from: HTMLAudioElement | undefined,
  to: HTMLAudioElement,
  targetVolume: number,
  durationMs = 600,
) => {
  const fromStart = from ? Math.max(0, from.volume) : 0;
  to.volume = 0;
  const start = performance.now();
  const step = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(1, durationMs > 0 ? elapsed / durationMs : 1);
    if (from) {
      from.volume = Math.max(0, fromStart * (1 - t));
    }
    to.volume = Math.min(targetVolume, targetVolume * t);
    if (t >= 1) {
      if (from) {
        from.pause();
        from.currentTime = 0;
      }
      return;
    }
    window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
};

const applyOutputDevice = async (
  element: HTMLAudioElement,
  deviceId: string | null,
) => {
  const setSink = element.setSinkId as
    | ((sinkId: string) => Promise<void>)
    | undefined;
  if (setSink && deviceId) {
    try {
      await setSink.call(element, deviceId);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? t("outputSelectionFailedDetail", { message: error.message })
          : t("outputSelectionFailed"),
      );
    }
  }
};

type PlayOptions = {
  allowToggle?: boolean;
  startAtSeconds?: number;
};

const playOnChannel = async (
  channel: OutputChannel,
  filePath: string,
  trackId: string,
  track: TrackRow | null,
  gainDb: number | null | undefined,
  options?: PlayOptions,
): Promise<boolean> => {
  const state = playback[channel];
  const allowToggle = options?.allowToggle !== false;
  if (state.currentTrackId === trackId && state.active) {
    if (!allowToggle) {
      if (Number.isFinite(options?.startAtSeconds)) {
        state.active.currentTime = Math.max(0, options?.startAtSeconds ?? 0);
      }
      if (state.active.paused) {
        try {
          await state.active.play();
        } catch (error) {
          setStatus(
            error instanceof Error
              ? t("playbackFailedDetail", { message: error.message })
              : t("playbackFailed"),
          );
          return false;
        }
      }
      updateNowPlayingDisplay();
      return true;
    }
    state.active.pause();
    state.active.currentTime = 0;
    state.currentTrackId = undefined;
    state.active = undefined;
    state.track = undefined;
    updateNowPlayingDisplay();
    return false;
  }

  const next = new Audio();
  next.src = filePath;
  next.loop = false;
  const targetVolume = gainForTrack(gainDb);
  next.volume = targetVolume;

  const deviceId =
    channel === "main"
      ? localStorage.getItem("tanda-main-output")
      : localStorage.getItem("tanda-headphone-output");
  await applyOutputDevice(next, deviceId);

  const previous = state.active;
  state.active = next;
  state.currentTrackId = trackId;
  state.track = track ?? undefined;
  void updateWaveformSource(trackId);
  const { startOffsetMs, endTrimMs } = getAdjustedTrimValues(track);
  const startOffsetSeconds = startOffsetMs > 0 ? startOffsetMs / 1000 : 0;
  const endTrimSeconds = endTrimMs > 0 ? endTrimMs / 1000 : 0;
  const startAt =
    Number.isFinite(options?.startAtSeconds) && (options?.startAtSeconds ?? 0) > 0
      ? options?.startAtSeconds ?? 0
      : startOffsetSeconds;
  let trimmedEndSeconds: number | null = null;
  let trimHandled = false;
  if (Number.isFinite(startAt) && (startAt ?? 0) > 0) {
    next.addEventListener(
      "loadedmetadata",
      () => {
        const duration = Number.isFinite(next.duration) ? next.duration : startAt;
        next.currentTime = Math.min(startAt ?? 0, duration ?? 0);
      },
      { once: true },
    );
  }

  next.addEventListener("ended", () => {
    if (state.active === next) {
      state.active = undefined;
      state.currentTrackId = undefined;
      state.track = undefined;
      updateNowPlayingDisplay();
    }
  });
  next.addEventListener("loadedmetadata", () => {
    trimmedEndSeconds = computeTrimmedEnd(
      Number.isFinite(next.duration) ? next.duration : 0,
      startAt,
      endTrimSeconds,
    );
    updateNowPlayingDisplay();
  });
  next.addEventListener("pause", () => {
    updateNowPlayingDisplay();
  });
  next.addEventListener("timeupdate", () => {
    if (
      !trimHandled &&
      trimmedEndSeconds !== null &&
      next.currentTime >= trimmedEndSeconds - 0.15
    ) {
      trimHandled = true;
      next.currentTime = trimmedEndSeconds;
      next.pause();
      next.dispatchEvent(new Event("ended"));
      return;
    }
    updateNowPlayingDisplay();
  });

  try {
    await next.play();
    fadeBetween(previous, next, targetVolume);
    updateNowPlayingDisplay();
    return true;
  } catch (error) {
    setStatus(
      error instanceof Error
        ? t("playbackFailedDetail", { message: error.message })
        : t("playbackFailed"),
    );
    return false;
  }
};

const playTrackForMode = async (
  track: TrackRow,
  data: { filePath: string; trackId: string; gainDb: number | null },
  options?: PlayOptions,
) => {
  if (appMode === "live") {
    return false;
  }
  const started = await playOnChannel(
    "main",
    data.filePath,
    data.trackId,
    track,
    data.gainDb,
    options,
  );
  if (started && appMode === "edit") {
    openTrackEditor(track.id);
  }
  return started;
};

const fadeOutAudio = async (audio: HTMLAudioElement, durationMs: number) => {
  const startVolume = Math.max(0, audio.volume);
  const start = performance.now();
  return new Promise<void>((resolve) => {
    const step = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, durationMs > 0 ? elapsed / durationMs : 1);
      audio.volume = Math.max(0, startVolume * (1 - t));
      if (t >= 1) {
        resolve();
        return;
      }
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  });
};

const stopChannelPlayback = async (channel: OutputChannel, fadeMs: number) => {
  const state = playback[channel];
  const active = state.active;
  if (!active) {
    return;
  }
  if (fadeMs > 0) {
    await fadeOutAudio(active, fadeMs);
  }
  active.pause();
  active.currentTime = 0;
  state.active = undefined;
  state.currentTrackId = undefined;
  state.track = undefined;
  updateNowPlayingDisplay();
};

const ensureAudioOutputs = async () => {
  try {
    let devices = await navigator.mediaDevices.enumerateDevices();
    if (devices.every((device) => device.kind !== "audiooutput" || !device.label)) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch {}
    }
    audioOutputs = devices.filter((device) => device.kind === "audiooutput");
  } catch {
    audioOutputs = [];
  }
  headphoneAvailable = audioOutputs.length > 1;
  document.body.classList.toggle("no-headphones", !headphoneAvailable);

  if (!headphoneAvailable) {
    localStorage.removeItem("tanda-headphone-output");
    localStorage.removeItem("tanda-headphone-output-label");
    localStorage.removeItem("tanda-headphone-output-group");
  }

  const storedMain = localStorage.getItem("tanda-main-output");
  const storedMainLabel = localStorage.getItem("tanda-main-output-label");
  const storedMainGroup = localStorage.getItem("tanda-main-output-group");
  const storedHeadphone = localStorage.getItem("tanda-headphone-output");
  const storedHeadphoneLabel = localStorage.getItem("tanda-headphone-output-label");
  const storedHeadphoneGroup = localStorage.getItem("tanda-headphone-output-group");

  const resolvePreferredDevice = (
    storedId: string | null,
    storedLabel: string | null,
    storedGroup: string | null,
  ) => {
    if (storedId) {
      const byId = audioOutputs.find((device) => device.deviceId === storedId);
      if (byId) {
        return byId.deviceId;
      }
    }
    if (storedLabel || storedGroup) {
      const byMeta = audioOutputs.find((device) => {
        const labelMatch = storedLabel
          ? device.label.toLowerCase() === storedLabel.toLowerCase()
          : false;
        const groupMatch = storedGroup ? device.groupId === storedGroup : false;
        return labelMatch || groupMatch;
      });
      if (byMeta) {
        return byMeta.deviceId;
      }
    }
    return null;
  };

  const preferredMain = resolvePreferredDevice(
    storedMain,
    storedMainLabel,
    storedMainGroup,
  );
  const preferredHeadphone = resolvePreferredDevice(
    storedHeadphone,
    storedHeadphoneLabel,
    storedHeadphoneGroup,
  );
  const hasStoredMain = Boolean(storedMain || storedMainLabel || storedMainGroup);
  const hasStoredHeadphone = Boolean(
    storedHeadphone || storedHeadphoneLabel || storedHeadphoneGroup,
  );
  const mainId =
    preferredMain ??
    (!hasStoredMain ? audioOutputs[0]?.deviceId ?? null : audioOutputs[0]?.deviceId ?? null);
  let headphoneId =
    preferredHeadphone ??
    (!hasStoredHeadphone && headphoneAvailable
      ? audioOutputs[1]?.deviceId ?? null
      : headphoneAvailable
        ? audioOutputs[1]?.deviceId ?? null
        : null);

  if (headphoneId && mainId && headphoneId === mainId) {
    headphoneId = null;
    headphoneAvailable = false;
  }

  if (mainId && !hasStoredMain) {
    const mainDevice = audioOutputs.find((device) => device.deviceId === mainId);
    localStorage.setItem("tanda-main-output", mainId);
    if (mainDevice?.label) {
      localStorage.setItem("tanda-main-output-label", mainDevice.label);
    }
    if (mainDevice?.groupId) {
      localStorage.setItem("tanda-main-output-group", mainDevice.groupId);
    }
  }
  if (headphoneId && !hasStoredHeadphone) {
    const headphoneDevice = audioOutputs.find(
      (device) => device.deviceId === headphoneId,
    );
    localStorage.setItem("tanda-headphone-output", headphoneId);
    if (headphoneDevice?.label) {
      localStorage.setItem("tanda-headphone-output-label", headphoneDevice.label);
    }
    if (headphoneDevice?.groupId) {
      localStorage.setItem("tanda-headphone-output-group", headphoneDevice.groupId);
    }
  }

  if (mainOutputSelect) {
    mainOutputSelect.innerHTML = "";
    audioOutputs.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || t("outputDefault");
      mainOutputSelect.appendChild(option);
    });
    if (mainId) {
      mainOutputSelect.value = mainId;
    }
  }

  if (headphoneOutputSelect) {
    headphoneOutputSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = headphoneAvailable
      ? t("outputSelectHeadphones")
      : t("outputNoSecondary");
    headphoneOutputSelect.appendChild(placeholder);
    audioOutputs.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || t("outputDefault");
      headphoneOutputSelect.appendChild(option);
    });
    headphoneOutputSelect.value = headphoneId ?? "";
    headphoneOutputSelect.disabled = !headphoneAvailable;
  }
};

const setStatus = (message: string) => {
  if (statusEl) {
    statusEl.textContent = message;
  }
};

const buildActionButton = (
  labelKey: string,
  shortKey: string,
  action: string,
) => {
  const button = document.createElement("button");
  button.className = "action-button";
  button.dataset.action = action;
  const label = t(labelKey);
  if (action === "tanda-up" || action === "tanda-down") {
    const path =
      action === "tanda-up"
        ? "M12 5l6 6-1.4 1.4L12 7.8 7.4 12.4 6 11z"
        : "M12 19l-6-6 1.4-1.4 4.6 4.6 4.6-4.6 1.4 1.4z";
    button.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`;
  } else {
    button.textContent = t(shortKey);
  }
  button.setAttribute("aria-label", label);
  button.title = label;
  return button;
};

const buildDuplicateIcon = (status: "partial" | "full") => {
  const icon = document.createElement("span");
  icon.className = `duplicate-icon ${status}`;
  if (status === "full") {
    const dot = document.createElement("span");
    dot.className = "duplicate-dot";
    icon.appendChild(dot);
    return icon;
  }
  const left = document.createElement("span");
  left.className = "duplicate-dot duplicate-left";
  const right = document.createElement("span");
  right.className = "duplicate-dot duplicate-right";
  icon.append(left, right);
  return icon;
};

const buildMoreButton = (duplicateStatus?: "partial" | "full") => {
  const button = document.createElement("button");
  button.className = "action-button";
  button.dataset.action = "row-menu";
  const label = t("actionMore");
  if (duplicateStatus) {
    const duplicateLabel =
      duplicateStatus === "full" ? t("duplicateFull") : t("duplicatePartial");
    button.classList.add("duplicate-menu", duplicateStatus);
    button.appendChild(buildDuplicateIcon(duplicateStatus));
    const composite = `${label} · ${duplicateLabel}`;
    button.setAttribute("aria-label", composite);
    button.title = composite;
  } else {
    button.textContent = "\u22EF";
    button.setAttribute("aria-label", label);
    button.title = label;
  }
  return button;
};

const buildDetailMenuButton = () => {
  const button = document.createElement("button");
  button.className = "action-button";
  button.dataset.action = "detail-menu";
  const label = t("actionMore");
  button.textContent = "\u22EF";
  button.setAttribute("aria-label", label);
  button.title = label;
  return button;
};

const buildPlaylistDuplicateIndexFromState = (): PlaylistDuplicateIndex => {
  const sources: PlaylistDuplicateSource[] = [];
  playlistItems.forEach((item) => {
    if (!item) {
      return;
    }
    if (item.kind === "track") {
      sources.push({ kind: "track", trackId: item.track.id });
      return;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      return;
    }
    const trackIds = tanda.trackSlots.filter(Boolean) as string[];
    if (trackIds.length === 0) {
      return;
    }
    sources.push({ kind: "tanda", trackIds });
  });
  return buildPlaylistDuplicateIndex(sources);
};

const markUserInteraction = () => {
  lastUserInteractionAt = Date.now();
};

const scrollPlaylistToIndex = (index: number) => {
  if (!playlistListEl) {
    return;
  }
  const target = playlistListEl.querySelector<HTMLElement>(
    `[data-index="${index}"]`,
  );
  if (!target) {
    return;
  }
  target.scrollIntoView({ block: "center", behavior: "smooth" });
};

const maybeAutoCenterPlaylist = () => {
  if (
    !shouldAutoCenterPlaylist({
      lastInteractionAt: lastUserInteractionAt,
      now: Date.now(),
      idleMs: PLAYLIST_AUTO_CENTER_IDLE_MS,
      playbackStatus: playlistPlayback.status,
      activeTab: activeRightTab,
    })
  ) {
    return;
  }
  if (playlistPlayback.currentIndex < 0) {
    return;
  }
  scrollPlaylistToIndex(playlistPlayback.currentIndex);
};

const closeRowMenus = () => {
  document
    .querySelectorAll<HTMLElement>(".list-row.menu-open")
    .forEach((row) => row.classList.remove("menu-open"));
  openRowMenuId = null;
};

const closeDetailMenus = () => {
  document
    .querySelectorAll<HTMLElement>(".tanda-detail-line.detail-menu-open")
    .forEach((line) => line.classList.remove("detail-menu-open"));
};

const resetModalCardPosition = (modal: HTMLElement) => {
  const card = modal.querySelector<HTMLElement>(".modal-card");
  if (!card) {
    return;
  }
  card.style.removeProperty("position");
  card.style.removeProperty("left");
  card.style.removeProperty("top");
  card.style.removeProperty("transform");
  card.style.removeProperty("margin");
  card.style.removeProperty("width");
  card.style.removeProperty("max-width");
};

const attachModalDrag = (modal: HTMLElement | null) => {
  if (!modal) {
    return;
  }
  const card = modal.querySelector<HTMLElement>(".modal-card");
  const header = modal.querySelector<HTMLElement>(".modal-header");
  if (!card || !header) {
    return;
  }
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging) {
      return;
    }
    const maxLeft = window.innerWidth - card.offsetWidth - 8;
    const maxTop = window.innerHeight - card.offsetHeight - 8;
    const nextLeft = Math.min(Math.max(event.clientX - offsetX, 8), maxLeft);
    const nextTop = Math.min(Math.max(event.clientY - offsetY, 8), maxTop);
    card.style.left = `${nextLeft}px`;
    card.style.top = `${nextTop}px`;
  };
  const onMouseUp = () => {
    if (!isDragging) {
      return;
    }
    isDragging = false;
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };
  header.addEventListener("mousedown", (event) => {
    if (appMode !== "edit") {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select")) {
      return;
    }
    const rect = card.getBoundingClientRect();
    isDragging = true;
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    card.style.position = "fixed";
    card.style.left = `${rect.left}px`;
    card.style.top = `${rect.top}px`;
    card.style.width = `${rect.width}px`;
    card.style.maxWidth = "none";
    card.style.transform = "none";
    card.style.margin = "0";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
};

const toggleRowMenu = (row: HTMLElement) => {
  const menuId = row.dataset.menuId;
  if (!menuId) {
    return;
  }
  if (openRowMenuId === menuId && row.classList.contains("menu-open")) {
    row.classList.remove("menu-open");
    openRowMenuId = null;
    return;
  }
  closeDetailMenus();
  closeRowMenus();
  row.classList.add("menu-open");
  openRowMenuId = menuId;
};

const openTandaInDesigner = (
  tandaId: string,
  source?: TandaDraft | null,
  returnTab?: RightPanelTab | null,
) => {
  tandaEditorReturnTab = returnTab ?? null;
  const shouldHostInPlaylist =
    returnTab === "playlist-tab" && playlistOpenTandaIndex !== null;
  tandaEditorHostTab = shouldHostInPlaylist ? "playlist-tab" : "tanda-designer-tab";
  if (source) {
    ensureTandaDraft(source);
  } else if (!tandaDrafts.some((item) => item.id === tandaId)) {
    const cached = resolveTandaDraft(tandaId);
    if (cached) {
      tandaDrafts = [...tandaDrafts, cached];
    }
  }
  setActiveTanda(tandaId);
  activateRightTab(tandaEditorHostTab ?? "tanda-designer-tab");
  renderTandaDesigner();
};

const finalizeTandaDraft = (
  tanda: TandaDraft,
  returnTab?: RightPanelTab | null,
) => {
  tandaCache.set(tanda.id, cloneTanda(tanda));
  tandaDrafts = tandaDrafts.filter((item) => item.id !== tanda.id);
  const fresh = createEmptyTanda();
  tandaDrafts = [...tandaDrafts, fresh];
  selectedTandaId = fresh.id;
  renderTandaDesigner();
  if (returnTab) {
    activateRightTab(returnTab);
  }
  if (returnTab === "playlist-tab") {
    clearPlaylistOpenTanda();
  }
  const openIndex = getOpenPlaylistTandaIndex();
  if (openIndex !== null) {
    const item = playlistItems[openIndex];
    if (item?.kind === "tanda" && item.tandaId === tanda.id) {
      clearPlaylistOpenTanda();
    }
  }
  renderPlaylist();
};

const buildHeadphoneButton = () => {
  const button = document.createElement("button");
  button.className = "headphone-button";
  button.dataset.action = "headphone";
  const label = t("headphonePreview");
  button.setAttribute("aria-label", label);
  button.title = label;
  return button;
};

const attachRowDrag = (row: HTMLElement, track: TrackRow, context: string) => {
  row.draggable = true;
  row.addEventListener("dragstart", (event) => {
    if (!event.dataTransfer) {
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/x-tanda-track",
      JSON.stringify({ trackId: track.id, context, index: row.dataset.index }),
    );
    event.dataTransfer.setData("text/plain", track.title);
  });
};

const renderTrackRow = (
  track: TrackRow,
  context: "search" | "clipboard" | "playlist",
  isSelected = false,
  duplicateIndex?: PlaylistDuplicateIndex,
) => {
  const row = document.createElement("div");
  const active = getNowPlayingState();
  const isPlaying = active?.state.currentTrackId === track.id;
  const playingClass = isPlaying ? "playing" : "";
  const headphoneClass =
    isPlaying && active?.channel === "headphone" ? "playing-headphone" : "";
  row.className = (
    `list-row track-row ${isSelected ? "selected" : ""} ${playingClass} ${headphoneClass}`
  ).trim();
  row.dataset.trackId = track.id;
  row.dataset.filePath = track.full_path;
  row.dataset.menuId = `${context}-track-${track.id}`;
  row.dataset.gainDb =
    track.gain_db !== null && track.gain_db !== undefined
      ? track.gain_db.toString()
      : "";
  row.dataset.context = context;
  const actions = document.createElement("div");
  actions.className = "row-actions";
  if (headphoneAvailable) {
    actions.appendChild(buildHeadphoneButton());
  }
  const menu = document.createElement("div");
  menu.className = "row-menu";
  menu.appendChild(
    buildActionButton(
      "actionEditTrack",
      "actionEditTrackShort",
      "edit-track",
    ),
  );
  menu.appendChild(
    buildActionButton(
      "actionSearch",
      "actionSearchShort",
      "search-track",
    ),
  );
  if (context === "search") {
    menu.appendChild(
      buildActionButton(
        "actionAddClipboard",
        "actionAddClipboardShort",
        "add-clip",
      ),
    );
    menu.appendChild(
      buildActionButton(
        "actionAddPlaylist",
        "actionAddPlaylistShort",
        "add-playlist-track",
      ),
    );
    menu.appendChild(
      buildActionButton(
        "actionAddTanda",
        "actionAddTandaShort",
        "add-tanda",
      ),
    );
  }
  if (context === "clipboard") {
    menu.appendChild(
      buildActionButton(
        "actionAddPlaylist",
        "actionAddPlaylistShort",
        "add-playlist-track",
      ),
    );
    menu.appendChild(
      buildActionButton(
        "actionAddTanda",
        "actionAddTandaShort",
        "add-tanda",
      ),
    );
    menu.appendChild(
      buildActionButton(
        "actionRemoveClipboard",
        "actionRemoveClipboardShort",
        "remove-clip",
      ),
    );
  }
  if (context === "playlist") {
    menu.appendChild(
      buildActionButton(
        "actionSendClipboard",
        "actionSendClipboardShort",
        "send-playlist-track",
      ),
    );
  }
  let duplicateStatus: "partial" | "full" | undefined;
  if (context !== "playlist" && duplicateIndex) {
    duplicateStatus = getDuplicateStatusForTrack(track.id, duplicateIndex) ?? undefined;
  }
  actions.append(menu, buildMoreButton(duplicateStatus));
  const details = document.createElement("div");
  details.className = "track-details";
  const primary = document.createElement("div");
  primary.className = "track-primary";
  const artist = track.artist ? ` — ${track.artist}` : "";
  primary.textContent = `${track.title}${artist}`;
  primary.title = primary.textContent;
  const secondary = document.createElement("div");
  secondary.className = "track-secondary";
  const bpmLabel =
    track.bpm !== null && track.bpm !== undefined && track.bpm > 0
      ? `${Math.round(track.bpm)} bpm`
      : "";
  const secondaryParts = [
    track.year,
    track.album,
    track.genre,
    bpmLabel,
    track.notes,
  ].filter((value) => value && value.trim().length > 0);
  secondary.textContent = secondaryParts.join(" · ");
  secondary.title = secondary.textContent;
  details.append(primary, secondary);
  row.append(details, actions);
  attachRowDrag(row, track, context);
  return row;
};

const renderSearchResults = () => {
  if (!searchTracksEl) {
    return;
  }
  const duplicateIndex = buildPlaylistDuplicateIndexFromState();
  searchTracksEl.innerHTML = "";
  searchState.items.forEach((track) => {
    searchTracksEl.appendChild(renderTrackRow(track, "search", false, duplicateIndex));
  });
  updateTabCount(searchTracksEl.closest(".panel"), "search-tracks", searchState.total);
};

const updateTabCount = (
  panel: Element | null,
  tabId: string,
  count: number,
) => {
  if (!panel) {
    return;
  }
  const button = panel.querySelector<HTMLButtonElement>(
    `.tab-bar button[data-tab="${tabId}"]`,
  );
  if (!button) {
    return;
  }
  const labelKey = button.dataset.i18n;
  const baseLabel = labelKey ? t(labelKey) : button.textContent ?? "";
  button.textContent = `${baseLabel} (${count})`;
};

const getPlaylistCount = () =>
  playlistItems.filter((item) => item !== null).length;

const getTandaStyleBadge = (tanda: TandaDraft) => {
  if (tanda.styles.length === 0) {
    return "?";
  }
  const styleMap = getPlaylistStyleMap();
  const normalized = tanda.styles.map((style) => normalizeStyleName(style));
  const codes = Object.entries(styleMap)
    .filter(([, styles]) => styles.some((style) => normalized.includes(style)))
    .map(([code]) => code);
  if (codes.length > 0) {
    return codes.join("/");
  }
  const fallback = tanda.styles
    .map((style) => style.trim())
    .filter(Boolean)
    .map((style) => style[0]?.toUpperCase() ?? "")
    .filter(Boolean);
  return fallback.length > 0 ? fallback.join("/") : "?";
};

const getTandaYearRange = (years: string[]) => {
  const numericYears = years
    .flatMap((year) => Array.from(year.matchAll(/\d{4}/g)).map((match) => match[0]))
    .map((year) => Number.parseInt(year, 10))
    .filter((year) => Number.isFinite(year));
  if (numericYears.length === 0) {
    return years.length > 0 ? years.join(",") : t("tandaUnknownYear");
  }
  const min = Math.min(...numericYears);
  const max = Math.max(...numericYears);
  if (min === max) {
    return `${min}`;
  }
  return `${min}-${max}`;
};

const getInstrumentalLabel = (status: string) => {
  if (status === "instrumental") {
    return t("tandaInstrumentalLabel");
  }
  if (status === "mixed") {
    return t("tandaMixedLabel");
  }
  return t("tandaNonInstrumental");
};

const buildTandaSummaryText = (tanda: TandaDraft, fallbackName?: string) => {
  const name = (tanda.name || fallbackName || "").trim();
  const tracks = tanda.trackSlots.map((trackId) =>
    trackId ? trackCache.get(trackId) ?? null : null,
  );
  const summary = summarizeTandaTracks(
    tracks.map((track) => {
      if (!track) {
        return null;
      }
      const artist =
        track.artist_summary || summarizeArtistName(track.artist);
      return {
        artist,
        year: track.year,
        instrumental: track.instrumental ?? null,
      };
    }),
  );
  const artistLabel =
    summary.artists.length > 0
      ? summary.artists
          .map((artist) =>
            artist.count > 1 ? `${artist.name}(${artist.count})` : artist.name,
          )
          .join(" / ")
      : t("tandaUnknownArtist");
  const yearLabel =
    summary.years.length > 0 ? summary.years.join(",") : t("tandaUnknownYear");
  const instrumentalLabel = getInstrumentalLabel(summary.instrumentalStatus);
  const bpmValues = tracks
    .map((track) => (track?.bpm && track.bpm > 0 ? Math.round(track.bpm) : null))
    .filter((value): value is number => value !== null);
  const bpmLabel =
    bpmValues.length === 0
      ? ""
      : Math.min(...bpmValues) === Math.max(...bpmValues)
        ? `${Math.min(...bpmValues)} bpm`
        : `${Math.min(...bpmValues)}-${Math.max(...bpmValues)} bpm`;
  const durationLabel = formatTime(
    tracks.reduce((sum, track) => sum + getEffectiveTrackDurationMs(track), 0) /
      1000,
  );
  const ratingLabel =
    tanda.rating > 0 ? `${"\u2605".repeat(Math.min(5, tanda.rating))}` : "";
  const details = [
    artistLabel,
    instrumentalLabel,
    yearLabel,
    bpmLabel,
    durationLabel,
    ratingLabel,
  ].filter((part) => part && part.trim().length > 0);
  return name ? `${name} - ${details.join(" - ")}` : details.join(" - ");
};

const getTandaSortKey = (tanda: TandaDraft) => {
  const tracks = tanda.trackSlots.map((trackId) =>
    trackId ? trackCache.get(trackId) ?? null : null,
  );
  const summary = summarizeTandaTracks(
    tracks.map((track) => {
      if (!track) {
        return null;
      }
      const artist =
        track.artist_summary || summarizeArtistName(track.artist);
      return {
        artist,
        year: track.year,
        instrumental: track.instrumental ?? null,
      };
    }),
  );
  return buildTandaArtistSortKey(summary, t("tandaUnknownArtist"));
};

const buildTandaExpandedSummaryText = (
  tanda: TandaDraft,
  fallbackName?: string,
) => {
  return buildTandaSummaryText(tanda, fallbackName);
};

type TandaDetailLine = {
  text: string;
  trackId?: string;
  slotIndex?: number;
};

const buildTandaDetailLines = (tanda: TandaDraft): TandaDetailLine[] => {
  const slots = tanda.trackSlots;
  const tracks = slots
    .map((trackId) => (trackId ? trackCache.get(trackId) ?? null : null))
    .filter(Boolean) as TrackRow[];
  if (tracks.length === 0) {
    return [{ text: t("tandaPlaceholder") }];
  }
  return slots.flatMap((trackId, slotIndex) => {
    if (!trackId) {
      return [];
    }
    const track = trackCache.get(trackId);
    if (!track) {
      return [];
    }
    const year = track.year?.trim() || t("tandaUnknownYear");
    const duration = formatTime(getEffectiveTrackDurationMs(track) / 1000);
    return [
      {
        text: `${buildTrackLabel(track)} (${year}) · ${duration}`,
        trackId: track.id,
        slotIndex,
      },
    ];
  });
};

const getSearchPanel = () => searchTracksEl?.closest(".panel") ?? null;

const runSearchQuery = (query: string, allowEmpty = false) => {
  const value = query.trim();
  if (!searchInput || (!value && !allowEmpty)) {
    return;
  }
  searchInput.value = value;
  activeSearchTab = "search-tracks";
  updateSearchTabVisibility();
  activatePanelTab(getSearchPanel(), "search-tracks");
  refreshSearch();
};

const buildSearchQueryForTrack = (track: TrackRow) => {
  return buildTrackSearchQuery(track);
};

const normalizeClipboardFilter = (value: string) => value.trim().toLowerCase();

const getClipboardTrackFilterText = (track: TrackRow) =>
  buildTrackSearchQuery(track).toLowerCase();

const getClipboardTandaFilterText = (tanda: TandaDraft) => {
  const parts: string[] = [];
  if (tanda.name) {
    parts.push(tanda.name);
  }
  if (tanda.styles.length > 0) {
    parts.push(tanda.styles.join(" "));
  }
  tanda.trackSlots.forEach((trackId) => {
    if (!trackId) {
      return;
    }
    const track = trackCache.get(trackId);
    if (!track) {
      return;
    }
    const trackText = buildTrackSearchQuery(track);
    if (trackText) {
      parts.push(trackText);
    }
  });
  return parts.join(" ").toLowerCase();
};

const buildSearchQueryForTanda = (tanda: TandaDraft) => {
  const tracks = tanda.trackSlots
    .map((trackId) => (trackId ? trackCache.get(trackId) ?? null : null))
    .filter(Boolean) as TrackRow[];
  return buildTandaSearchQuery({
    name: tanda.name,
    tracks,
  });
};

const resolveSearchStylesForTanda = (
  tanda: TandaDraft,
  tracks: TrackRow[],
) =>
  resolveTandaSearchStyles({
    tandaStyles: tanda.styles,
    tracks,
    availableStyles,
  });

const runSearchForTanda = (tanda: TandaDraft) => {
  const tracks = tanda.trackSlots
    .map((trackId) => (trackId ? trackCache.get(trackId) ?? null : null))
    .filter(Boolean) as TrackRow[];
  const styles = resolveSearchStylesForTanda(tanda, tracks);
  if (styles.length > 0 || selectedStyles.length > 0) {
    selectedStyles = [...styles];
    loadStyles();
  }
  runSearchQuery(buildSearchQueryForTanda(tanda), true);
};

const resolveTandaForSearch = (tandaId: string) =>
  resolveTandaDraft(tandaId) ??
  clipboardTandas.find((item) => item.id === tandaId) ??
  tandaCache.get(tandaId) ??
  null;

const renderTandaRow = (
  tanda: TandaDraft,
  context: "search" | "clipboard" | "playlist",
  nameOverride?: string,
  options?: {
    expanded?: boolean;
    activeTrackId?: string | null;
    played?: boolean;
    locked?: boolean;
    allowSendToClipboard?: boolean;
    playlistStartTime?: string | null;
    playlistDuration?: string | null;
    duplicateIndex?: PlaylistDuplicateIndex;
  },
) => {
  const row = document.createElement("div");
  row.className = "list-row tanda-row";
  row.dataset.tandaId = tanda.id;
  row.dataset.menuId = `${context}-tanda-${tanda.id}`;
  row.dataset.context = context;
  const expanded = options?.expanded ?? false;
  row.classList.toggle("expanded", expanded);
  row.classList.toggle("played", options?.played ?? false);
  row.classList.toggle("locked", options?.locked ?? false);
  row.setAttribute("aria-expanded", expanded ? "true" : "false");
  const actions = document.createElement("div");
  actions.className = "row-actions";
  const menu = document.createElement("div");
  menu.className = "row-menu";
  menu.appendChild(
    buildActionButton(
      "actionToggleTanda",
      "actionToggleTandaShort",
      "tanda-toggle",
    ),
  );
  menu.appendChild(
    buildActionButton(
      "actionEditTanda",
      "actionEditTandaShort",
      "tanda-edit",
    ),
  );
  menu.appendChild(
    buildActionButton(
      "actionSearch",
      "actionSearchShort",
      "search-tanda",
    ),
  );
  if (context === "search") {
    menu.appendChild(
      buildActionButton(
        "actionAddPlaylist",
        "actionAddPlaylistShort",
        "add-playlist-tanda",
      ),
    );
    menu.appendChild(
      buildActionButton(
        "actionAddClipboard",
        "actionAddClipboardShort",
        "add-clip-tanda",
      ),
    );
  }
  if (context === "clipboard") {
    menu.appendChild(
      buildActionButton(
        "actionAddPlaylist",
        "actionAddPlaylistShort",
        "add-playlist-tanda",
      ),
    );
    menu.appendChild(
      buildActionButton(
        "actionRemoveClipboard",
        "actionRemoveClipboardShort",
        "remove-clip-tanda",
      ),
    );
  }
  if (context === "playlist") {
    const markButton = buildActionButton(
      "actionMarkPlaylist",
      "actionMarkPlaylistShort",
      "mark-playlist-target",
    );
    if (options?.locked) {
      markButton.disabled = true;
    }
    menu.appendChild(markButton);
    if (options?.allowSendToClipboard) {
      menu.appendChild(
        buildActionButton(
          "actionSendClipboard",
          "actionSendClipboardShort",
          "send-playlist-tanda",
        ),
      );
    }
  }
  const badge = document.createElement("div");
  badge.className = "tanda-style-badge";
  badge.textContent = getTandaStyleBadge(tanda);
  const summary = document.createElement("div");
  summary.className = "tanda-summary";
  if (context === "playlist" && !expanded) {
    const titleLine = document.createElement("div");
    titleLine.className = "tanda-title-line";
    const startText = isCortinaEnabled() ? "" : options?.playlistStartTime ?? "";
    const summaryText = buildTandaSummaryText(tanda, nameOverride);
    titleLine.textContent = `${startText ? `${startText} ` : ""}${summaryText}`;
    summary.append(titleLine);
  } else {
    summary.textContent = expanded
      ? buildTandaExpandedSummaryText(tanda, nameOverride)
      : buildTandaSummaryText(tanda, nameOverride);
  }
  summary.title = summary.textContent ?? "";
  const details = document.createElement("div");
  details.className = "tanda-details";
  buildTandaDetailLines(tanda).forEach((line) => {
    const lineEl = document.createElement("div");
    lineEl.className = "tanda-detail-line";
    if (line.trackId) {
      lineEl.dataset.trackId = line.trackId;
    }
    if (line.slotIndex !== undefined) {
      lineEl.dataset.slotIndex = line.slotIndex.toString();
    }
    if (line.trackId && line.trackId === options?.activeTrackId) {
      lineEl.classList.add("active");
    }
    lineEl.textContent = line.text;
    if (line.trackId) {
      const actionWrap = document.createElement("div");
      actionWrap.className = "tanda-detail-actions-right";
      const menuButton = buildDetailMenuButton();
      const menuWrap = document.createElement("div");
      menuWrap.className = "tanda-detail-menu";
      if (headphoneAvailable) {
        const headphoneButton = buildHeadphoneButton();
        headphoneButton.classList.add("detail-headphone");
        menuWrap.appendChild(headphoneButton);
      }
      const editButton = buildActionButton(
        "actionEditTrack",
        "actionEditTrackShort",
        "edit-track",
      );
      editButton.classList.add("detail-edit");
      menuWrap.appendChild(editButton);
      if (context === "playlist" && options?.allowSendToClipboard) {
        const sendButton = buildActionButton(
          "actionSendClipboard",
          "actionSendClipboardShort",
          "send-playlist-tanda-track",
        );
        sendButton.classList.add("detail-send");
        menuWrap.appendChild(sendButton);
      }
      actionWrap.append(menuButton, menuWrap);
      lineEl.appendChild(actionWrap);
    }
    details.appendChild(lineEl);
  });
  row.dataset.tandaName = nameOverride ?? "";
  const content = document.createElement("div");
  content.className = "tanda-content";
  content.append(summary, details);
  let duplicateStatus: "partial" | "full" | undefined;
  if (context !== "playlist" && options?.duplicateIndex) {
    const trackIds = tanda.trackSlots.filter(Boolean) as string[];
    duplicateStatus =
      getDuplicateStatusForTanda(trackIds, options.duplicateIndex) ?? undefined;
  }
  actions.append(menu, buildMoreButton(duplicateStatus));
  row.append(badge, content, actions);
  return row;
};

const toggleTandaRow = (row: HTMLElement) => {
  const expanded = row.classList.toggle("expanded");
  row.setAttribute("aria-expanded", expanded ? "true" : "false");
  const tandaId = row.dataset.tandaId;
  if (!tandaId) {
    return;
  }
  const tanda = resolveTandaDraft(tandaId);
  if (!tanda) {
    return;
  }
  const summaryEl = row.querySelector<HTMLElement>(".tanda-summary");
  if (!summaryEl) {
    return;
  }
  const fallbackName = row.dataset.tandaName || undefined;
  const isPlaylist = row.dataset.context === "playlist";
  summaryEl.innerHTML = "";
  if (isPlaylist && !expanded) {
    const startText = isCortinaEnabled() ? "" : row.dataset.playlistStartTime ?? "";
    const titleLine = document.createElement("div");
    titleLine.className = "tanda-title-line";
    titleLine.textContent = `${startText ? `${startText} ` : ""}${buildTandaSummaryText(
      tanda,
      fallbackName,
    )}`;
    summaryEl.append(titleLine);
  } else {
    summaryEl.textContent = expanded
      ? buildTandaExpandedSummaryText(tanda, fallbackName)
      : buildTandaSummaryText(tanda, fallbackName);
  }
  summaryEl.title = summaryEl.textContent ?? "";
};

const renderTandaSearchResults = () => {
  if (!searchTandasEl) {
    return;
  }
  const duplicateIndex = buildPlaylistDuplicateIndexFromState();
  const sizeFilter = getTandaSearchSizeFilter();
  const filtered = sizeFilter
    ? tandaSearchResults.filter((row) => row.track_count === sizeFilter)
    : tandaSearchResults;
  searchTandasEl.innerHTML = "";
  if (filtered.length === 0) {
    searchTandasEl.textContent = t("tandasEmpty");
    updateTabCount(searchTandasEl.closest(".panel"), "search-tandas", 0);
    return;
  }
  filtered.forEach((tanda) => {
    const draft =
      resolveTandaDraft(tanda.id) ??
      ({
        id: tanda.id,
        name: tanda.name,
        styles: tanda.styles,
        rating: tanda.rating,
        trackSlots: Array.from({ length: tanda.track_count }, () => null),
      } as TandaDraft);
    searchTandasEl.appendChild(
      renderTandaRow(draft, "search", tanda.name, { duplicateIndex }),
    );
  });
  updateTabCount(
    searchTandasEl.closest(".panel"),
    "search-tandas",
    filtered.length,
  );
};

const loadTandaSearchResults = async () => {
  if (!window.tanda) {
    return;
  }
  const rows = await window.tanda.searchTandas(getSearchParams());
  tandaSearchResults = rows;
  const ids = rows.map((row) => row.id);
  if (ids.length > 0 && window.tanda.getTandasByIds) {
    const details = await window.tanda.getTandasByIds(ids);
    details.forEach(upsertTandaCache);
  }
  renderTandaSearchResults();
  updateSearchCountDisplay();
};

const renderClipboard = async () => {
  if (!clipTracksEl) {
    return;
  }
  const visibleCollectionIds = getVisibleCollectionIds();
  const visibleTrackIds: string[] = [];
  const visibleTandaIds: string[] = [];
  visibleCollectionIds.forEach((id) => {
    const collection = clipboardCollections.find((item) => item.id === id);
    if (!collection) {
      return;
    }
    collection.trackIds.forEach((trackId) => {
      if (!visibleTrackIds.includes(trackId)) {
        visibleTrackIds.push(trackId);
      }
    });
    collection.tandaIds.forEach((tandaId) => {
      if (!visibleTandaIds.includes(tandaId)) {
        visibleTandaIds.push(tandaId);
      }
    });
  });
  await ensureClipboardTracksLoaded(visibleTrackIds);
  await ensureClipboardTandasLoaded(visibleTandaIds);
  clipboardTracks = visibleTrackIds
    .map((id) => trackCache.get(id))
    .filter(Boolean) as TrackRow[];
  clipboardTandas = visibleTandaIds.map(
    (id) => resolveTandaDraft(id) ?? createPlaceholderTanda(id),
  );
  const emptyTandaIds = clipboardTandas
    .filter((tanda) => isTandaEmpty(tanda))
    .map((tanda) => tanda.id);
  if (emptyTandaIds.length > 0) {
    clipboardCollections.forEach((collection) => {
      collection.tandaIds = collection.tandaIds.filter(
        (id) => !emptyTandaIds.includes(id),
      );
    });
    saveClipboardCollections();
    clipboardTandas = clipboardTandas.filter(
      (tanda) => !emptyTandaIds.includes(tanda.id),
    );
  }
  const forcedStyles = getActiveStyleFilter();
  const filterText = normalizeClipboardFilter(clipboardFilterText);
  const duplicateIndex = buildPlaylistDuplicateIndexFromState();
  clipTracksEl.innerHTML = "";
  const selectedId = selectedClipboardTrackId;
  const filteredTracks =
    forcedStyles.length > 0
      ? clipboardTracks.filter((track) =>
          forcedStyles.includes(normalizeStyleName(track.genre)),
        )
      : clipboardTracks;
  const matchedTracks = filterText
    ? filteredTracks.filter((track) =>
        getClipboardTrackFilterText(track).includes(filterText),
      )
    : filteredTracks;
  matchedTracks.forEach((track, index) => {
    const row = renderTrackRow(
      track,
      "clipboard",
      selectedId === track.id,
      duplicateIndex,
    );
    applyPulseToRow(row, pulseClipboardTrackIds, track.id);
    clipTracksEl.appendChild(row);
  });
  updateTabCount(
    clipTracksEl.closest(".panel"),
    "clip-tracks",
    matchedTracks.length,
  );
  if (clipTandasEl) {
    clipTandasEl.innerHTML = "";
    const sizeFilter = getTandaSearchSizeFilter();
    const styleFilter = getActiveStyleFilter();
    const normalizedStyleFilter = styleFilter.map((style) =>
      normalizeStyleName(style),
    );
    const filteredTandas = clipboardTandas.filter((tanda) => {
      if (sizeFilter && tanda.trackSlots.filter(Boolean).length !== sizeFilter) {
        return false;
      }
      if (normalizedStyleFilter.length === 0) {
        return true;
      }
      const normalizedTandaStyles = tanda.styles.map((style) =>
        normalizeStyleName(style),
      );
      return normalizedStyleFilter.some((style) =>
        normalizedTandaStyles.includes(style),
      );
    });
    const matchedTandas = filterText
      ? filteredTandas.filter((tanda) =>
          getClipboardTandaFilterText(tanda).includes(filterText),
        )
      : filteredTandas;
    matchedTandas
      .slice()
      .sort((a, b) => getTandaSortKey(a).localeCompare(getTandaSortKey(b)))
      .forEach((tanda) => {
      const row = renderTandaRow(tanda, "clipboard", undefined, {
        duplicateIndex,
      });
      if (selectedClipboardTandaId === tanda.id) {
        row.classList.add("selected");
      }
      applyPulseToRow(row, pulseClipboardTandaIds, tanda.id);
      clipTandasEl.appendChild(row);
    });
    updateTabCount(
      clipTandasEl.closest(".panel"),
      "clip-tandas",
      matchedTandas.length,
    );
  }
};

const normalizePlaylist = () => {
  while (
    playlistItems.length > 1 &&
    playlistItems[playlistItems.length - 1] === null &&
    playlistItems[playlistItems.length - 2] === null
  ) {
    playlistItems.pop();
  }
  if (playlistItems[playlistItems.length - 1] !== null) {
    playlistItems.push(null);
  }
};

const serializePlaylistItems = (items: (PlaylistItem | null)[]) => {
  const serialized: StoredPlaylistItem[] = items.map((item) => {
    if (!item) {
      return null;
    }
    if (item.kind === "track") {
      return { kind: "track", id: item.track.id };
    }
    return { kind: "tanda", id: item.tandaId, mismatch: item.mismatch };
  });
  return JSON.stringify(serialized);
};

const savePlaylistToStorage = () => {
  const serialized = serializePlaylistItems(playlistItems);
  if (serialized === playlistSaveSnapshot) {
    return;
  }
  playlistSaveSnapshot = serialized;
  localStorage.setItem(PLAYLIST_STORAGE_KEY, serialized);
};

const loadPlaylistFromStorage = async () => {
  if (!window.tanda) {
    return;
  }
  const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY);
  if (!raw) {
    return;
  }
  let parsed: StoredPlaylistItem[] = [];
  try {
    const data = JSON.parse(raw) as StoredPlaylistItem[];
    if (Array.isArray(data)) {
      parsed = data;
    }
  } catch {
    parsed = [];
  }
  if (parsed.length === 0) {
    return;
  }
  const trackIds = parsed
    .filter((item): item is { kind: "track"; id: string } =>
      Boolean(item && item.kind === "track"),
    )
    .map((item) => item.id);
  const tandaIds = parsed
    .filter((item): item is { kind: "tanda"; id: string } =>
      Boolean(item && item.kind === "tanda"),
    )
    .map((item) => item.id);
  const tracks = await window.tanda.getTracksByIds(trackIds);
  const tandas = await window.tanda.getTandasByIds(tandaIds);
  const trackMap = new Map(tracks.map((track) => [track.id, track]));
  const tandaMap = new Map(tandas.map((tanda) => [tanda.id, tanda]));
  tandas.forEach((tanda) => upsertTandaCache(tanda));
  tracks.forEach((track) => trackCache.set(track.id, track));
  playlistItems = parsed.map((item) => {
    if (!item) {
      return null;
    }
    if (item.kind === "track") {
      const track = trackMap.get(item.id);
      return track ? { kind: "track", track } : null;
    }
    const tanda = tandaMap.get(item.id);
    return tanda ? { kind: "tanda", tandaId: item.id, mismatch: item.mismatch } : null;
  });
  playlistSaveSnapshot = serializePlaylistItems(playlistItems);
  clearPlaylistTarget();
  resetCortinaPlans();
};

const renderPlaylist = () => {
  if (!playlistListEl) {
    return;
  }
  normalizePlaylist();
  savePlaylistToStorage();
  const fragment = document.createDocumentFragment();
  const openIndex = getOpenPlaylistTandaIndex();
  if (isCortinaEnabled()) {
    const indices = getCortinaRowIndices(playlistItems).filter(
      (index) => !getCortinaRowTrack(index),
    );
    if (indices.length > 0) {
      void ensureCortinaPlans(indices);
    }
  }
  const startTimes = getPlaylistStartTimes();
  const cortinaStartTimes = getCortinaStartTimes();
  playlistItems.forEach((item, index) => {
    const isLocked = isPlaylistIndexLocked(index);
    const isPlayed =
      appMode === "live" &&
      playlistPlayback.status === "playing" &&
      playlistPlayback.playedThroughIndex >= index;
    const isActive =
      playlistPlayback.status !== "idle" &&
      playlistPlayback.currentIndex === index;
    if (item && item.kind === "track") {
      const row = renderTrackRow(item.track, "playlist");
      if (isPlayed) {
        row.classList.add("played");
      }
      if (isLocked) {
        row.classList.add("locked");
      }
      row.dataset.index = index.toString();
      applyPulseToRow(row, pulsePlaylistIndices, index);
      fragment.appendChild(row);
    } else if (item && item.kind === "tanda") {
      if (isCortinaEnabled()) {
        const cortinaRow = document.createElement("div");
        cortinaRow.className = "list-row cortina-row";
        cortinaRow.dataset.cortinaIndex = index.toString();
        if (cortinaPlaying && cortinaActiveIndex === index) {
          cortinaRow.classList.add("active");
        }
        const cortinaTrack = getCortinaRowTrack(index);
        const cortinaStart = cortinaStartTimes.get(index);
        const startLabel =
          cortinaStart !== undefined ? `(${formatClockTime(cortinaStart)})` : "";
        const timeEl = document.createElement("span");
        timeEl.className = "cortina-time";
        timeEl.textContent = startLabel;
        const metaEl = document.createElement("span");
        metaEl.className = "cortina-meta";
        metaEl.textContent = cortinaTrack
          ? buildTrackLabel(cortinaTrack)
          : t("cortinaRowHint");
        cortinaRow.append(timeEl, metaEl);
        if (cortinaTrack) {
          cortinaRow.dataset.trackId = cortinaTrack.id;
          cortinaRow.dataset.filePath = cortinaTrack.full_path;
          cortinaRow.dataset.gainDb =
            cortinaTrack.gain_db !== null ? cortinaTrack.gain_db.toString() : "";
        }
        if (headphoneAvailable && cortinaTrack) {
          const actions = document.createElement("div");
          actions.className = "row-actions";
          actions.appendChild(buildHeadphoneButton());
          cortinaRow.appendChild(actions);
        }
        applyPulseToRow(cortinaRow, pulseCortinaIndices, index);
        fragment.appendChild(cortinaRow);
      }
      const tanda =
        resolveTandaDraft(item.tandaId) ?? createPlaceholderTanda(item.tandaId);
      const startTime = startTimes.get(index);
      const startLabel =
        startTime !== undefined ? formatClockTime(startTime) : null;
      const durationLabel = formatTime(getTandaDurationMs(tanda) / 1000);
      const row = renderTandaRow(tanda, "playlist", tanda.name, {
        expanded: isActive,
        activeTrackId: isActive ? playlistPlayback.activeTrackId : null,
        played: isPlayed,
        locked: isLocked,
        allowSendToClipboard: !isLocked,
        playlistStartTime: startLabel,
        playlistDuration: durationLabel,
      });
      if (openIndex !== null && openIndex === index) {
        row.classList.add("playlist-open");
      }
      row.dataset.playlistStartTime = startLabel ?? "";
      row.dataset.playlistDuration = durationLabel ?? "";
      if (item.mismatch) {
        row.classList.add("mismatch");
        const rule = getRuleForSlot(index);
        if (rule) {
          row.title = t("playlistMismatchTooltip", {
            rule: getSequenceLabel(rule),
            tanda: getTandaSequenceLabel(tanda),
          });
        } else {
          row.title = t("playlistMismatchTooltip", {
            rule: "?",
            tanda: getTandaSequenceLabel(tanda),
          });
        }
      }
      row.dataset.index = index.toString();
      if (playlistTargetIndex === index) {
        row.classList.add("playlist-target");
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "playlist-target-cancel";
        cancel.dataset.action = "playlist-target-cancel";
        cancel.textContent = "×";
        cancel.setAttribute("aria-label", t("cancelTarget"));
        cancel.title = t("cancelTarget");
        row.appendChild(cancel);
      }
      applyPulseToRow(row, pulsePlaylistIndices, index);
      fragment.appendChild(row);
    } else {
      const row = document.createElement("div");
      row.className = "list-row";
      if (isPlayed) {
        row.classList.add("played");
      }
      if (isLocked) {
        row.classList.add("locked");
      }
      row.dataset.index = index.toString();
      const styleBadge = document.createElement("span");
      const rule = getRuleForSlot(index);
      const styleCode = rule?.code && rule.code !== "*" && rule.code !== "ANY"
        ? rule.code.toUpperCase()
        : "";
      styleBadge.className = "tanda-style-badge";
      styleBadge.textContent = styleCode || "?";
      row.append(
        styleBadge,
        (() => {
          const label = document.createElement("span");
          label.textContent = t("playlistEmptySlot");
          return label;
        })(),
        (() => {
          const hint = document.createElement("span");
          hint.className = "meta";
          hint.textContent = t("playlistEmptyHint");
          return hint;
        })(),
        document.createElement("span"),
        document.createElement("span"),
      );
      fragment.appendChild(row);
    }
  });
  if (isCortinaEnabled() && playlistItems.some((item) => item?.kind === "tanda")) {
    const endRow = document.createElement("div");
    endRow.className = "list-row cortina-row";
    endRow.dataset.cortinaIndex = playlistItems.length.toString();
    if (cortinaPlaying && cortinaActiveIndex === playlistItems.length) {
      endRow.classList.add("active");
    }
    const endCortinaTrack = getCortinaRowTrack(playlistItems.length);
    const endStart = cortinaStartTimes.get(playlistItems.length);
    const endLabel =
      endStart !== undefined ? `(${formatClockTime(endStart)})` : "";
    const timeEl = document.createElement("span");
    timeEl.className = "cortina-time";
    timeEl.textContent = endLabel;
    const metaEl = document.createElement("span");
    metaEl.className = "cortina-meta";
    metaEl.textContent = endCortinaTrack
      ? buildTrackLabel(endCortinaTrack)
      : t("cortinaRowHint");
    endRow.append(timeEl, metaEl);
    if (endCortinaTrack) {
      endRow.dataset.trackId = endCortinaTrack.id;
      endRow.dataset.filePath = endCortinaTrack.full_path;
      endRow.dataset.gainDb =
        endCortinaTrack.gain_db !== null ? endCortinaTrack.gain_db.toString() : "";
    }
    if (headphoneAvailable && endCortinaTrack) {
      const actions = document.createElement("div");
      actions.className = "row-actions";
      actions.appendChild(buildHeadphoneButton());
      endRow.appendChild(actions);
    }
    applyPulseToRow(endRow, pulseCortinaIndices, playlistItems.length);
    fragment.appendChild(endRow);
  }
  playlistListEl.replaceChildren(fragment);
  updateTabCount(playlistPanel, "playlist-tab", getPlaylistCount());
  updatePlaylistControls();
  renderSearchResults();
  renderTandaSearchResults();
  renderClipboard();
};

const updatePlaylistControls = () => {
  const hasItems = playlistItems.some((item) => item !== null);
  if (playlistStartBtn) {
    playlistStartBtn.disabled =
      !hasItems || playlistPlayback.status === "playing";
  }
  if (playlistResumeBtn) {
    playlistResumeBtn.disabled =
      playlistPlayback.status !== "paused" || !playlistPlayback.resume;
  }
  if (playlistStopBtn) {
    playlistStopBtn.disabled = playlistPlayback.status !== "playing";
  }
  if (playlistClearBtn) {
    playlistClearBtn.disabled = appMode === "live";
  }
};

const isPlaylistRunActive = (runId: number) =>
  playlistPlayback.runId === runId && playlistPlayback.status === "playing";

const waitForGap = (ms: number, runId: number) =>
  new Promise<boolean>((resolve) => {
    if (ms <= 0) {
      resolve(true);
      return;
    }
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (!isPlaylistRunActive(runId)) {
        window.clearInterval(interval);
        resolve(false);
        return;
      }
      if (Date.now() - start >= ms) {
        window.clearInterval(interval);
        resolve(true);
      }
    }, 120);
  });

const waitBeforeCortina = (runId: number) =>
  waitForGap(getGapBeforeCortina() * 1000, runId);

const waitBeforeTanda = (runId: number) =>
  waitForGap(getGapBeforeTanda() * 1000, runId);

const waitForAudioEnd = (audio: HTMLAudioElement, runId: number) =>
  new Promise<boolean>((resolve) => {
    const handleEnd = () => {
      cleanup();
      resolve(true);
    };
    const interval = window.setInterval(() => {
      if (!isPlaylistRunActive(runId)) {
        cleanup();
        resolve(false);
      }
    }, 200);
    const cleanup = () => {
      audio.removeEventListener("ended", handleEnd);
      window.clearInterval(interval);
    };
    audio.addEventListener("ended", handleEnd);
  });

const setCortinaControlsVisible = (visible: boolean) => {
  if (!cortinaControls) {
    return;
  }
  cortinaControls.classList.toggle("visible", visible);
};

const pickNextCortina = async (targetIndex: number) => {
  const overrideForIndex = cortinaOverrideByIndex.get(targetIndex);
  if (overrideForIndex) {
    lastCortinaId = overrideForIndex.id;
    return overrideForIndex;
  }
  const planned = cortinaPlannedByIndex.get(targetIndex);
  if (planned) {
    lastCortinaId = planned.id;
    return planned;
  }
  if (cortinaOverrideTrack) {
    const override = cortinaOverrideTrack;
    cortinaOverrideTrack = null;
    lastCortinaId = override.id;
    return override;
  }
  if (cortinaQueue.length === 0) {
    await resetCortinaQueue();
  }
  if (cortinaQueue.length === 0) {
    return null;
  }
  const next = cortinaQueue.shift() ?? null;
  if (next && lastCortinaId && cortinaQueue.length === 0 && next.id === lastCortinaId) {
    await resetCortinaQueue();
  }
  if (next) {
    lastCortinaId = next.id;
  }
  return next;
};

const waitForCortina = async (
  audio: HTMLAudioElement,
  runId: number,
  durationMs: number,
) =>
  new Promise<boolean>((resolve) => {
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (!isPlaylistRunActive(runId)) {
        window.clearInterval(interval);
        resolve(false);
        return;
      }
      if (cortinaStopRequested) {
        window.clearInterval(interval);
        resolve(true);
        return;
      }
      if (cortinaAllowFull) {
        if (audio.ended) {
          window.clearInterval(interval);
          resolve(true);
        }
        return;
      }
      if (Date.now() - start >= durationMs) {
        window.clearInterval(interval);
        resolve(true);
      }
    }, 200);
  });

const playCortina = async (runId: number, targetIndex: number) => {
  if (!isCortinaEnabled()) {
    return true;
  }
  const setName = getCortinaSet();
  if (!setName) {
    return true;
  }
  const track = await pickNextCortina(targetIndex);
  if (!track) {
    return true;
  }
  cortinaPlaying = true;
  cortinaAllowFull = false;
  cortinaStopRequested = false;
  cortinaActiveIndex = targetIndex;
  setCortinaControlsVisible(true);
  renderPlaylist();
  const started = await playOnChannel(
    "main",
    track.full_path,
    track.id,
    track,
    track.gain_db ?? null,
    { allowToggle: false },
  );
  if (!started) {
    cortinaPlaying = false;
    cortinaActiveIndex = null;
    setCortinaControlsVisible(false);
    renderPlaylist();
    return false;
  }
  // Re-render after playback starts so the active cortina row reflects the
  // actual track now playing instead of any previously active main track.
  renderPlaylist();
  const activeAudio = playback.main.active;
  if (!activeAudio) {
    cortinaPlaying = false;
    cortinaActiveIndex = null;
    setCortinaControlsVisible(false);
    renderPlaylist();
    return false;
  }
  await waitForCortina(activeAudio, runId, getCortinaDuration() * 1000);
  if (!cortinaAllowFull || cortinaStopRequested) {
    const fadeMs = getStopFadeSeconds() * 1000;
    if (fadeMs > 0) {
      await fadeOutAudio(activeAudio, fadeMs);
    }
    activeAudio.pause();
  } else {
    await waitForAudioEnd(activeAudio, runId);
  }
  cortinaPlaying = false;
  cortinaActiveIndex = null;
  setCortinaControlsVisible(false);
  renderPlaylist();
  return true;
};

const runPlaylistPlayback = async (
  resume: boolean,
  options?: { skipInitialCortinaGap?: boolean; startFromIdle?: boolean },
) => {
  playlistPlayback.runId += 1;
  const runId = playlistPlayback.runId;
  const resumeState = resume ? playlistPlayback.resume : null;
  playlistPlayback.resume = null;
  if (!resume) {
    playlistPlayback.currentIndex = 0;
    playlistPlayback.currentTrackIndex = 0;
    playlistPlayback.playedThroughIndex = -1;
    playlistPlayback.resume = null;
  } else if (resumeState) {
    playlistPlayback.currentIndex = resumeState.itemIndex;
    playlistPlayback.currentTrackIndex = resumeState.trackIndex;
  }
  playlistPlayback.status = "playing";
  playlistPlayback.activeTrackId = null;
  playlistPlayback.activeTandaId = null;
  playlistPlayback.liveBaseStartMs = computeLiveBaseStartMs(
    buildPlaylistTimeline(),
    resumeState,
  );
  renderPlaylist();
  const skipInitialGap = options?.skipInitialCortinaGap ?? false;
  let skipInitialGapPending = skipInitialGap;
  const startFromIdle = options?.startFromIdle ?? false;
  let continuedFromEndCortina = false;
  let leadInCortinaPlayed = false;

  const hasPlayableItems = playlistItems.some((item) => {
    if (!item) {
      return false;
    }
    return resolvePlaylistTracks(item).length > 0;
  });
  if (!resume && hasPlayableItems && isCortinaEnabled()) {
    const ok = await playCortina(runId, playlistPlayback.currentIndex);
    if (!ok) {
      return;
    }
    const postOk = await waitBeforeTanda(runId);
    if (!postOk) {
      return;
    }
  }
  if (resume && startFromIdle && isCortinaEnabled()) {
    const item = playlistItems[playlistPlayback.currentIndex];
    if (
      item?.kind === "tanda" &&
      playlistPlayback.currentTrackIndex === 0 &&
      !resumeState?.resumeTime
    ) {
      if (skipInitialGapPending) {
        skipInitialGapPending = false;
      } else {
        const gapOk = await waitBeforeCortina(runId);
        if (!gapOk) {
          return;
        }
      }
      const ok = await playCortina(runId, playlistPlayback.currentIndex);
      if (!ok) {
        return;
      }
      const postOk = await waitBeforeTanda(runId);
      if (!postOk) {
        return;
      }
      leadInCortinaPlayed = true;
    }
  }

  let playedAny = false;
  while (isPlaylistRunActive(runId)) {
    if (playlistPlayback.currentIndex >= playlistItems.length) {
      if (playedAny && isCortinaEnabled()) {
        const gapOk = await waitBeforeCortina(runId);
        if (!gapOk) {
          return;
        }
        const ok = await playCortina(runId, playlistPlayback.currentIndex);
        if (!ok) {
          return;
        }
        if (
          shouldContinueAfterEndCortina(
            playlistPlayback.currentIndex,
            playlistItems.length,
          )
        ) {
          const hasPlayableByIndex = playlistItems.map((entry) =>
            entry ? resolvePlaylistTracks(entry).length > 0 : false,
          );
          playlistPlayback.currentIndex = resolveContinuationIndexAfterEndCortina(
            playlistPlayback.currentIndex,
            playlistPlayback.playedThroughIndex,
            hasPlayableByIndex,
          );
          playlistPlayback.currentTrackIndex = 0;
          continuedFromEndCortina = true;
          continue;
        }
      }
      playlistPlayback.status = "idle";
      playlistPlayback.activeTrackId = null;
      playlistPlayback.activeTandaId = null;
      playlistPlayback.resume = null;
      playlistPlayback.liveBaseStartMs = null;
      renderPlaylist();
      return;
    }
    const item = playlistItems[playlistPlayback.currentIndex];
    if (!item) {
      playlistPlayback.currentIndex += 1;
      playlistPlayback.currentTrackIndex = 0;
      continue;
    }
    const tracks = resolvePlaylistTracks(item);
    if (tracks.length === 0) {
      playlistPlayback.playedThroughIndex = Math.max(
        playlistPlayback.playedThroughIndex,
        playlistPlayback.currentIndex,
      );
      playlistPlayback.currentIndex += 1;
      playlistPlayback.currentTrackIndex = 0;
      renderPlaylist();
      continue;
    }
    const isResumeSameItem =
      resumeState &&
      resumeState.itemIndex === playlistPlayback.currentIndex &&
      resumeState.trackIndex === playlistPlayback.currentTrackIndex;
    const isResumeWithOffset =
      Boolean(isResumeSameItem) && (resumeState?.resumeTime ?? 0) > 0;
    if (
      shouldInsertCortinaBeforeTanda(
        isCortinaEnabled(),
        playlistPlayback.currentIndex,
        playlistPlayback.currentTrackIndex,
        isResumeWithOffset,
        continuedFromEndCortina || leadInCortinaPlayed,
      )
    ) {
      if (skipInitialGapPending) {
        skipInitialGapPending = false;
      } else {
        const gapOk = await waitBeforeCortina(runId);
        if (!gapOk) {
          return;
        }
      }
      const ok = await playCortina(runId, playlistPlayback.currentIndex);
      if (!ok) {
        return;
      }
      const postOk = await waitBeforeTanda(runId);
      if (!postOk) {
        return;
      }
    }
    if (continuedFromEndCortina) {
      const postOk = await waitBeforeTanda(runId);
      if (!postOk) {
        return;
      }
    }
    continuedFromEndCortina = false;
    leadInCortinaPlayed = false;
    if (
      playlistPlayback.currentTrackIndex === 0 &&
      playlistPlayback.currentIndex > 0 &&
      !isResumeWithOffset
    ) {
      if (!isCortinaEnabled() && !skipInitialGap) {
        const ok = await waitBeforeTanda(runId);
        if (!ok) {
          return;
        }
      }
    }
    for (
      let index = playlistPlayback.currentTrackIndex;
      index < tracks.length;
      index += 1
    ) {
      const track = tracks[index];
      playlistPlayback.currentTrackIndex = index;
      playlistPlayback.activeTrackId = track.id;
      playlistPlayback.activeTandaId =
        item.kind === "tanda" ? item.tandaId : null;
      renderPlaylist();
      const resumeSeconds =
        resumeState &&
        resumeState.trackId === track.id &&
        resumeState.itemIndex === playlistPlayback.currentIndex
          ? resumeState.resumeTime
          : undefined;
      playlistPlayback.resume = null;
      const started = await playOnChannel(
        "main",
        track.full_path,
        track.id,
        track,
        track.gain_db,
        { allowToggle: false, startAtSeconds: resumeSeconds },
      );
      if (!started) {
        playlistPlayback.status = "idle";
        playlistPlayback.activeTrackId = null;
        playlistPlayback.activeTandaId = null;
        playlistPlayback.liveBaseStartMs = null;
        renderPlaylist();
        return;
      }
      const activeAudio = playback.main.active;
      if (!activeAudio) {
        playlistPlayback.status = "idle";
        playlistPlayback.liveBaseStartMs = null;
        renderPlaylist();
        return;
      }
      const ended = await waitForAudioEnd(activeAudio, runId);
      if (!ended) {
        return;
      }
      if (index < tracks.length - 1) {
        const ok = await waitForGap(getGapBetweenTracks() * 1000, runId);
        if (!ok) {
          return;
        }
      }
    }
    playedAny = true;
    playlistPlayback.playedThroughIndex = Math.max(
      playlistPlayback.playedThroughIndex,
      playlistPlayback.currentIndex,
    );
    playlistPlayback.currentIndex += 1;
    playlistPlayback.currentTrackIndex = 0;
    playlistPlayback.activeTrackId = null;
    playlistPlayback.activeTandaId = null;
    renderPlaylist();
  }
};

const startPlaylistPlayback = () => {
  if (playlistPlayback.status === "playing") {
    return;
  }
  playlistPlayback.resume = null;
  void runPlaylistPlayback(false);
};

const resumePlaylistPlayback = () => {
  if (playlistPlayback.status !== "paused" || !playlistPlayback.resume) {
    return;
  }
  void runPlaylistPlayback(true);
};

const stopPlaylistPlayback = async () => {
  if (playlistPlayback.status !== "playing") {
    return;
  }
  playlistPlayback.status = "paused";
  playlistPlayback.liveBaseStartMs = null;
  const active = playback.main.active;
  if (active && playback.main.currentTrackId) {
    playlistPlayback.resume = {
      itemIndex: playlistPlayback.currentIndex,
      trackIndex: playlistPlayback.currentTrackIndex,
      trackId: playback.main.currentTrackId,
      resumeTime: active.currentTime ?? 0,
    };
    const durationMs = getStopFadeSeconds() * 1000;
    if (durationMs > 0) {
      await fadeOutAudio(active, durationMs);
    }
    active.pause();
  }
  playback.main.active = undefined;
  playback.main.currentTrackId = undefined;
  playback.main.track = undefined;
  playlistPlayback.activeTrackId = null;
  playlistPlayback.activeTandaId = null;
  renderPlaylist();
};

const clearPlaylist = async () => {
  if (appMode === "live") {
    return;
  }
  if (playlistPlayback.status === "playing") {
    await stopPlaylistPlayback();
  }
  playlistPlayback.status = "idle";
  playlistPlayback.resume = null;
  playlistPlayback.currentIndex = 0;
  playlistPlayback.currentTrackIndex = 0;
  playlistPlayback.playedThroughIndex = -1;
  playlistPlayback.activeTrackId = null;
  playlistPlayback.activeTandaId = null;
  playlistPlayback.liveBaseStartMs = null;
  playlistItems = [null];
  clearPlaylistTarget();
  resetCortinaPlans();
  renderPlaylist();
  setStatus(t("statusPlaylistCleared"));
};

const findPlaylistTrackPosition = (
  item: PlaylistItem,
  trackId?: string | null,
) => {
  if (item.kind === "track") {
    return { trackIndex: 0, trackId: item.track.id };
  }
  const tanda = resolveTandaDraft(item.tandaId);
  if (!tanda) {
    return null;
  }
  const trackIds = tanda.trackSlots.filter(Boolean) as string[];
  if (trackIds.length === 0) {
    return null;
  }
  const resolvedTrackId = trackId && trackIds.includes(trackId)
    ? trackId
    : trackIds[0];
  const trackIndex = Math.max(0, trackIds.indexOf(resolvedTrackId));
  return { trackIndex, trackId: resolvedTrackId };
};

const startPlaylistFrom = (index: number, trackId?: string | null) => {
  const item = playlistItems[index];
  if (!item) {
    return;
  }
  const wasIdle = playlistPlayback.status === "idle";
  const position = findPlaylistTrackPosition(item, trackId);
  if (!position) {
    return;
  }
  playlistPlayback.status = "paused";
  playlistPlayback.currentIndex = index;
  playlistPlayback.currentTrackIndex = position.trackIndex;
  playlistPlayback.playedThroughIndex = Math.max(-1, index - 1);
  playlistPlayback.resume = {
    itemIndex: index,
    trackIndex: position.trackIndex,
    trackId: position.trackId,
    resumeTime: 0,
  };
  const skipInitialCortinaGap = wasIdle || !playback.main.active;
  void runPlaylistPlayback(true, {
    skipInitialCortinaGap,
    startFromIdle: wasIdle,
  });
};

const renderAllLists = () => {
  renderSearchResults();
  renderTandaSearchResults();
  renderClipboard();
  renderPlaylist();
  renderTandaDesigner();
};

const renderTandaDesigner = () => {
  if (!tandaListEl && !playlistTandaEditorEl) {
    return;
  }
  const selected = selectedTandaId
    ? tandaDrafts.find((item) => item.id === selectedTandaId) ?? null
    : null;
  const emptyDrafts = tandaDrafts.filter((item) => isTandaEmpty(item));
  const chosenEmpty =
    (selected && isTandaEmpty(selected) ? selected : emptyDrafts[0]) ??
    createEmptyTanda();
  const nonEmptyDrafts = tandaDrafts.filter((item) => !isTandaEmpty(item));
  tandaDrafts = [chosenEmpty, ...nonEmptyDrafts];
  selectedTandaId = selected?.id ?? chosenEmpty.id;
  const activeId = selectedTandaId ?? tandaDrafts[0]?.id ?? null;
  if (activeId && activeId !== selectedTandaId) {
    selectedTandaId = activeId;
  }
  const renderInto = (container: HTMLDivElement, drafts: TandaDraft[]) => {
    container.innerHTML = "";
    drafts.forEach((tanda) => {
      const locked = isTandaLocked(tanda.id);
      const card = document.createElement("div");
      card.className = `tanda-card${tanda.id === selectedTandaId ? " selected" : ""}`;
      if (locked) {
        card.classList.add("locked");
      }
      card.dataset.tandaId = tanda.id;

      const header = document.createElement("div");
      header.className = "tanda-header";

      const nameRow = document.createElement("div");
      nameRow.className = "tanda-row";
      const nameInput = document.createElement("input");
      nameInput.className = "tanda-name";
      nameInput.value = tanda.name;
      nameInput.placeholder = t("tandaNameLabel");
      nameInput.disabled = locked;
      nameInput.addEventListener("input", () => {
        tanda.name = nameInput.value;
      });
      const ratingLabel = document.createElement("span");
      ratingLabel.className = "tanda-meta";
      ratingLabel.textContent = t("tandaRatingLabel");
      const ratingSelect = document.createElement("select");
      ratingSelect.className = "tanda-rating";
      ratingSelect.setAttribute("aria-label", t("tandaRatingLabel"));
      ratingSelect.disabled = locked;
      for (let rating = 0; rating <= 5; rating += 1) {
        const option = document.createElement("option");
        option.value = rating.toString();
        option.textContent = rating.toString();
        ratingSelect.appendChild(option);
      }
      ratingSelect.value = tanda.rating.toString();
      ratingSelect.addEventListener("change", () => {
        tanda.rating = Number.parseInt(ratingSelect.value, 10);
      });
      nameRow.append(nameInput, ratingLabel, ratingSelect);

      const styleRow = document.createElement("div");
      styleRow.className = "tanda-row";
      const styleLabel = document.createElement("span");
      styleLabel.textContent = t("tandaStylesLabel");
      styleLabel.className = "tanda-meta";
      const styleOptions = document.createElement("div");
      styleOptions.className = "tanda-style-options";
      const anyButton = document.createElement("button");
      anyButton.textContent = t("tandaAnyStyle");
      anyButton.classList.toggle("active", tanda.styles.length === 0);
      anyButton.disabled = locked;
      anyButton.addEventListener("click", () => {
        tanda.styles = [];
        selectedStyles = [...tanda.styles];
        setActiveTanda(tanda.id);
      });
      styleOptions.appendChild(anyButton);
      availableStyles.forEach((style) => {
        const button = document.createElement("button");
        button.textContent = style;
        button.classList.toggle("active", tanda.styles.includes(style));
        button.disabled = locked;
        button.addEventListener("click", () => {
          if (tanda.styles.includes(style)) {
            tanda.styles = tanda.styles.filter((value) => value !== style);
          } else {
            tanda.styles = [...tanda.styles, style];
          }
          selectedStyles = [...tanda.styles];
          setActiveTanda(tanda.id);
        });
        styleOptions.appendChild(button);
      });
      styleRow.append(styleLabel, styleOptions);

      const metaRow = document.createElement("div");
      metaRow.className = "tanda-row";
      const tracks = tanda.trackSlots.map((trackId) =>
        trackId ? trackCache.get(trackId) ?? null : null,
      );
      const totalDurationMs = tracks.reduce(
        (sum, track) => sum + getEffectiveTrackDurationMs(track),
        0,
      );
    const summary = summarizeTandaTracks(
      tracks.map((track) => {
        if (!track) {
          return null;
        }
        return {
          artist: track.artist_summary || summarizeArtistName(track.artist),
          year: track.year,
          instrumental: track.instrumental ?? null,
        };
      }),
    );
    const countMeta = document.createElement("span");
    countMeta.className = "tanda-meta";
    countMeta.textContent = `${t("tandaTrackCountLabel")}: ${tanda.trackSlots.filter(
      Boolean,
    ).length}`;
    const instrumentalMeta = document.createElement("span");
    instrumentalMeta.className = "tanda-meta";
    instrumentalMeta.textContent = getInstrumentalLabel(
      summary.instrumentalStatus,
    );
    const durationMeta = document.createElement("span");
    durationMeta.className = "tanda-meta";
    durationMeta.textContent = `${t("tandaDurationLabel")}: ${formatTime(
      totalDurationMs / 1000,
    )}`;
    metaRow.append(countMeta, instrumentalMeta, durationMeta);

    header.append(nameRow, styleRow, metaRow);

    const trackList = document.createElement("div");
    trackList.className = "tanda-track-list";
    tanda.trackSlots.forEach((trackId, index) => {
      const row = document.createElement("div");
      row.className = `tanda-track-row${trackId ? "" : " placeholder"}`;
      row.dataset.tandaId = tanda.id;
      row.dataset.slotIndex = index.toString();
      if (trackId) {
        row.dataset.trackId = trackId;
      }
      const label = document.createElement("span");
      if (trackId) {
        const track = trackCache.get(trackId);
        label.textContent = track ? buildTrackLabel(track) : t("tandaPlaceholder");
      } else {
        label.textContent = t("tandaPlaceholder");
      }
      const actions = document.createElement("div");
      actions.className = "tanda-track-actions";
      if (trackId) {
        const editButton = buildActionButton(
          "actionEditTrack",
          "actionEditTrackShort",
          "tanda-edit-track",
        );
        editButton.disabled = locked;
        actions.appendChild(editButton);
      }
      const upButton = buildActionButton(
        "tandaMoveUp",
        "tandaMoveUpShort",
        "tanda-up",
      );
      upButton.disabled = locked;
      const downButton = buildActionButton(
        "tandaMoveDown",
        "tandaMoveDownShort",
        "tanda-down",
      );
      downButton.disabled = locked;
      const removeButton = buildActionButton(
        "tandaRemoveTrack",
        "actionSendClipboardShort",
        "tanda-remove",
      );
      removeButton.disabled = locked;
      actions.append(upButton, downButton, removeButton);
      row.append(label, document.createElement("span"), actions);
      trackList.appendChild(row);
    });

    const footerRow = document.createElement("div");
    footerRow.className = "tanda-row";
    const addSlotButton = document.createElement("button");
    addSlotButton.textContent = t("tandaAddSlot");
    addSlotButton.dataset.action = "tanda-add-slot";
    addSlotButton.dataset.tandaId = tanda.id;
    addSlotButton.disabled = locked;
    const saveButton = document.createElement("button");
    saveButton.textContent = t("tandaSave");
    saveButton.dataset.action = "tanda-save";
    saveButton.dataset.tandaId = tanda.id;
    saveButton.disabled = locked;
    const doneButton = document.createElement("button");
    doneButton.textContent = t("tandaDone");
    doneButton.dataset.action = "tanda-done";
    doneButton.dataset.tandaId = tanda.id;
    doneButton.disabled = locked;
    const deleteButton = document.createElement("button");
    deleteButton.textContent = t("tandaDelete");
    deleteButton.dataset.action = "tanda-delete";
    deleteButton.dataset.tandaId = tanda.id;
    deleteButton.disabled = locked;
    const clipButton = document.createElement("button");
    clipButton.textContent = t("tandaToClipboard");
    clipButton.dataset.action = "tanda-clip";
    clipButton.dataset.tandaId = tanda.id;
    clipButton.disabled = locked;
    footerRow.append(addSlotButton, saveButton, doneButton, deleteButton, clipButton);

    card.append(header, trackList, footerRow);
    card.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("button") || target.tagName === "INPUT" || target.tagName === "SELECT") {
        return;
      }
      setActiveTanda(tanda.id);
    });
      container.appendChild(card);
    });
  };
  if (tandaListEl) {
    renderInto(tandaListEl, tandaDrafts);
  }
  if (playlistTandaEditorEl) {
    const openIndex = getOpenPlaylistTandaIndex();
    let playlistDrafts: TandaDraft[] = [];
    if (
      openIndex !== null &&
      tandaEditorHostTab === "playlist-tab" &&
      activeRightTab === "playlist-tab"
    ) {
      const openItem = playlistItems[openIndex];
      if (openItem?.kind === "tanda") {
        const openDraft = resolveTandaDraft(openItem.tandaId);
        if (openDraft) {
          playlistDrafts = [openDraft];
        }
      }
    }
    renderInto(playlistTandaEditorEl, playlistDrafts);
    const shouldShow =
      tandaEditorHostTab === "playlist-tab" &&
      activeRightTab === "playlist-tab" &&
      playlistOpenTandaIndex !== null &&
      playlistDrafts.length > 0;
    playlistTandaEditorEl.classList.toggle("hidden", !shouldShow);
  }
};

const addTrackToClipboard = (track: TrackRow) => {
  const collection = getActiveCollection();
  if (!collection) {
    return;
  }
  if (collection.id === CLIPBOARD_NEW_ID) {
    setStatus(t("statusClipboardCollectionReadOnly"));
    return;
  }
  if (collection.trackIds.includes(track.id)) {
    selectedClipboardTrackId = track.id;
    activatePanelTab(clipPanel, "clip-tracks");
    renderClipboard();
    return;
  }
  collection.trackIds.push(track.id);
  trackCache.set(track.id, track);
  selectedClipboardTrackId = track.id;
  markClipboardTrackPulse(track.id);
  saveClipboardCollections();
  activatePanelTab(clipPanel, "clip-tracks");
  renderClipboard();
};

const addTrackToCollection = (collectionId: string, track: TrackRow) => {
  const collection = clipboardCollections.find((item) => item.id === collectionId);
  if (!collection) {
    return;
  }
  if (collection.id === CLIPBOARD_NEW_ID) {
    setStatus(t("statusClipboardCollectionReadOnly"));
    return;
  }
  if (!collection.trackIds.includes(track.id)) {
    collection.trackIds.push(track.id);
  }
  trackCache.set(track.id, track);
  markClipboardTrackPulse(track.id);
  saveClipboardCollections();
};

const addTandaToCollection = (collectionId: string, tandaId: string) => {
  const collection = clipboardCollections.find((item) => item.id === collectionId);
  if (!collection) {
    return;
  }
  if (collection.id === CLIPBOARD_NEW_ID) {
    setStatus(t("statusClipboardCollectionReadOnly"));
    return;
  }
  if (!collection.tandaIds.includes(tandaId)) {
    collection.tandaIds.push(tandaId);
  }
  markClipboardTandaPulse(tandaId);
  saveClipboardCollections();
};

const refreshNewCollectionTracks = async () => {
  if (!window.tanda) {
    return;
  }
  const collection = clipboardCollections.find((item) => item.id === CLIPBOARD_NEW_ID);
  if (!collection) {
    return;
  }
  const limit = getNewCollectionLimit();
  const ids = await window.tanda.listRecentTracks(limit);
  collection.trackIds = ids;
  collection.tandaIds = [];
  saveClipboardCollections();
};

const switchToGeneralClipboardView = () => {
  activeClipboardCollectionId = "general";
  includedClipboardCollectionIds = [];
  saveClipboardCollections();
  renderClipboardCollections();
};

const findFirstEmptyPlaylistSlot = () =>
  playlistItems.findIndex((item) => item === null);

const clearPlaylistTarget = () => {
  playlistTargetIndex = null;
};

const clearPlaylistOpenTanda = () => {
  playlistOpenTandaIndex = null;
};

const isTandaInClipboard = (tandaId: string) =>
  clipboardCollections.some((collection) => collection.tandaIds.includes(tandaId));

const cloneTandaWithNewId = (tanda: TandaDraft): TandaDraft => ({
  ...cloneTanda(tanda),
  id: crypto.randomUUID(),
});

const ensurePlaylistEditableTanda = (tandaId: string, index: number) => {
  const original = resolveTandaDraft(tandaId);
  if (!original) {
    return null;
  }
  if (!isTandaInClipboard(tandaId)) {
    return original;
  }
  const draft = cloneTandaWithNewId(original);
  ensureTandaDraft(draft);
  const existing = playlistItems[index];
  if (existing?.kind === "tanda") {
    playlistItems[index] = {
      kind: "tanda",
      tandaId: draft.id,
      mismatch: existing.mismatch,
    };
  }
  return draft;
};

const applyPlaylistTargetStyles = (index: number) => {
  const item = playlistItems[index] ?? null;
  if (item?.kind === "tanda") {
    const tanda = resolveTandaDraft(item.tandaId);
    if (tanda) {
      selectedStyles = [...tanda.styles];
    }
  } else {
    const rule = getRuleForSlot(index);
    if (rule?.code && rule.code !== "*" && rule.code !== "ANY") {
      selectedStyles = [...(getPlaylistStyleMap()[rule.code] ?? [])];
    } else {
      selectedStyles = [];
    }
  }
  loadStyles();
  updateSearchTabVisibility();
  refreshSearch();
  renderClipboard();
};

const getPlaylistTargetIndex = () => {
  if (playlistTargetIndex === null) {
    return null;
  }
  if (playlistTargetIndex < 0 || playlistTargetIndex >= playlistItems.length) {
    clearPlaylistTarget();
    return null;
  }
  return playlistTargetIndex;
};

const getOpenPlaylistTandaIndex = () => {
  if (playlistOpenTandaIndex === null) {
    return null;
  }
  if (
    playlistOpenTandaIndex < 0 ||
    playlistOpenTandaIndex >= playlistItems.length
  ) {
    clearPlaylistOpenTanda();
    return null;
  }
  const item = playlistItems[playlistOpenTandaIndex];
  if (!item || item.kind !== "tanda") {
    clearPlaylistOpenTanda();
    return null;
  }
  const tanda = resolveTandaDraft(item.tandaId);
  if (!tanda || !tanda.trackSlots.some((slot) => !slot)) {
    clearPlaylistOpenTanda();
    return null;
  }
  return playlistOpenTandaIndex;
};

const appendTrackToPlaylist = (
  track: TrackRow,
  options?: { allowStyleMismatch?: boolean; forcedIndex?: number },
) => {
  normalizePlaylist();
  const targetIndex = getPlaylistTargetIndex();
  const openIndex = getOpenPlaylistTandaIndex();
  const insertIndex =
    options?.forcedIndex ?? targetIndex ?? openIndex ?? findFirstEmptyPlaylistSlot();
  if (insertIndex < 0) {
    setStatus(t("statusPlaylistNoEmptySlot"));
    return;
  }
  if (isPlaylistIndexLocked(insertIndex)) {
    setStatus(t("statusPlaylistLocked"));
    return;
  }
  const existing = playlistItems[insertIndex];
  if (existing?.kind === "tanda") {
    const tanda = resolveTandaDraft(existing.tandaId);
    if (!tanda) {
      return;
    }
    const emptyIndex = tanda.trackSlots.findIndex((slot) => !slot);
    if (emptyIndex < 0) {
      setStatus(t("statusPlaylistNoEmptySlot"));
      return;
    }
    const previewTrackSlots = [...tanda.trackSlots];
    previewTrackSlots[emptyIndex] = track.id;
    const previewTracks = previewTrackSlots.map((id) =>
      id ? trackCache.get(id) ?? null : null,
    );
    const derivedStyles = collectStylesFromTracks(previewTracks, availableStyles);
    const normalizedExisting = tanda.styles
      .map((style) => normalizeStyleName(style))
      .map((normalized) =>
        availableStyles.find(
          (style) => normalizeStyleName(style) === normalized,
        ),
      )
      .filter(Boolean) as string[];
    const previewStyles = Array.from(
      new Set([...normalizedExisting, ...derivedStyles]),
    );
    const previewTanda: TandaDraft = {
      ...tanda,
      styles: previewStyles,
      trackSlots: previewTrackSlots,
    };
    const validation = validateTandaForSlot(previewTanda, insertIndex);
    if (
      validation.reason === "style" &&
      validation.rule &&
      !options?.allowStyleMismatch
    ) {
      showAlertAction(
        t("confirmPlaylistSequenceStyleOverride", {
          rule: getSequenceLabel(validation.rule),
          tanda: getTandaSequenceLabel(previewTanda),
        }),
        t("allowOverride"),
        () => {
          appendTrackToPlaylist(track, {
            allowStyleMismatch: true,
            forcedIndex: insertIndex,
          });
        },
      );
      return;
    }
    tanda.trackSlots = previewTrackSlots;
    tanda.styles = previewStyles;
    trackCache.set(track.id, track);
    const mismatch =
      validation.reason === "style" || validation.reason === "count"
        ? validation.reason
        : undefined;
    playlistItems[insertIndex] = {
      kind: "tanda",
      tandaId: existing.tandaId,
      mismatch,
    };
    normalizePlaylist();
    activatePanelTab(playlistPanel, "playlist-tab");
    markPlaylistPulse(insertIndex);
    playlistOpenTandaIndex = insertIndex;
    if (!tanda.trackSlots.some((slot) => !slot)) {
      clearPlaylistOpenTanda();
    }
    if (targetIndex !== null) {
      clearPlaylistTarget();
    }
    renderPlaylist();
    requestAnimationFrame(() => scrollPlaylistToIndex(insertIndex));
    return;
  }
  const tanda = createPlaylistTandaForSlot(insertIndex, track);
  ensureTandaDraft(tanda);
  const rule = getRuleForSlot(insertIndex);
  const mismatch = getStyleMismatchForTrack(insertIndex, track) ? "style" : undefined;
  if (mismatch && rule && !options?.allowStyleMismatch) {
    showAlertAction(
      t("confirmPlaylistSequenceStyleOverride", {
        rule: getSequenceLabel(rule),
        tanda: getTandaSequenceLabel(tanda),
      }),
      t("allowOverride"),
      () => {
        appendTrackToPlaylist(track, {
          allowStyleMismatch: true,
          forcedIndex: insertIndex,
        });
      },
    );
    return;
  }
  if (mismatch) {
    if (rule) {
      setStatus(
        t("statusPlaylistSequenceMismatch", {
          rule: getSequenceLabel(rule),
        }),
      );
    }
  }
  playlistItems[insertIndex] = { kind: "tanda", tandaId: tanda.id, mismatch };
  normalizePlaylist();
  trackCache.set(track.id, track);
  activatePanelTab(playlistPanel, "playlist-tab");
  playlistOpenTandaIndex = insertIndex;
  openTandaInDesigner(tanda.id, tanda, "playlist-tab");
  markPlaylistPulse(insertIndex);
  if (targetIndex !== null) {
    clearPlaylistTarget();
  }
  renderPlaylist();
  requestAnimationFrame(() => scrollPlaylistToIndex(insertIndex));
};

const getDefaultTandaSize = () => {
  const raw = localStorage.getItem("tanda-default-size");
  const value = raw ? Number.parseInt(raw, 10) : 3;
  if (Number.isNaN(value) || value < 1) {
    return 3;
  }
  return Math.min(value, 10);
};

const normalizeTandaSearchSizeInput = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-") {
    return "";
  }
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(value) || value < 1) {
    return "";
  }
  return Math.min(value, 10).toString();
};

const getTandaSearchSizeFilter = () => {
  const raw = localStorage.getItem(TANDA_SEARCH_SIZE_KEY);
  if (raw === null) {
    return getDefaultTandaSize();
  }
  if (!raw || raw === "-") {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    return null;
  }
  return Math.min(value, 10);
};

const getDefaultPlaylistTandaSize = (slotIndex: number) =>
  getDefaultSlotSize(getRuleForSlot(slotIndex), getDefaultTandaSize());

const getDefaultPlaylistStyles = (slotIndex: number) =>
  getDefaultStylesForRule(getRuleForSlot(slotIndex), getPlaylistStyleMap());

const getStyleMismatchForTrack = (slotIndex: number, track: TrackRow) => {
  const rule = getRuleForSlot(slotIndex);
  if (!rule) {
    return false;
  }
  if (rule.code === "*" || rule.code === "ANY") {
    return false;
  }
  const mapped = getPlaylistStyleMap()[rule.code] ?? [];
  if (mapped.length === 0) {
    return false;
  }
  const trackStyle = normalizeStyleName(track.genre ?? "");
  return !trackStyle || !mapped.includes(trackStyle);
};

const createPlaylistTandaForSlot = (
  slotIndex: number,
  track?: TrackRow,
): TandaDraft => {
  const size = Math.max(1, getDefaultPlaylistTandaSize(slotIndex));
  const styles = [...getDefaultPlaylistStyles(slotIndex)];
  if (track?.genre) {
    const normalized = normalizeStyleName(track.genre);
    if (normalized && !styles.includes(normalized)) {
      styles.push(normalized);
    }
  }
  const trackSlots = Array.from({ length: size }, (_, index) =>
    index === 0 && track ? track.id : null,
  );
  return {
    id: crypto.randomUUID(),
    name: "",
    styles,
    rating: 0,
    trackSlots,
  };
};

const getSearchMinScore = () => {
  const raw = localStorage.getItem(SEARCH_MIN_SCORE_KEY);
  const value = raw ? Number.parseFloat(raw) : DEFAULT_SEARCH_MIN_SCORE;
  if (Number.isNaN(value) || value < 0) {
    return DEFAULT_SEARCH_MIN_SCORE;
  }
  return Math.min(value, 1);
};

const getSearchBpmRange = () => {
  const raw = localStorage.getItem(SEARCH_BPM_RANGE_KEY);
  const value = raw ? Number.parseFloat(raw) : DEFAULT_SEARCH_BPM_RANGE;
  if (Number.isNaN(value) || value < 0) {
    return DEFAULT_SEARCH_BPM_RANGE;
  }
  return Math.min(value, 20);
};

const getSearchConfig = () => ({
  minScore: getSearchMinScore(),
  bpmRange: getSearchBpmRange(),
});

const getCortinaSet = () => localStorage.getItem(CORTINA_SET_KEY) ?? "";

const getCortinaDuration = () => {
  const raw = localStorage.getItem(CORTINA_DURATION_KEY);
  const value = raw ? Number.parseFloat(raw) : DEFAULT_CORTINA_DURATION;
  if (Number.isNaN(value) || value <= 0) {
    return DEFAULT_CORTINA_DURATION;
  }
  return Math.min(value, 180);
};

const ensureCortinaDurationDefault = () => {
  if (!localStorage.getItem(CORTINA_DURATION_KEY)) {
    localStorage.setItem(CORTINA_DURATION_KEY, DEFAULT_CORTINA_DURATION.toString());
  }
};

const isCortinaEnabled = () => getCortinaSet().trim().length > 0;

const shuffleTracks = (tracks: TrackRow[]) => {
  const items = [...tracks];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

const loadCortinaSets = async () => {
  if (!window.tanda) {
    return;
  }
  cortinaSets = await window.tanda.listCortinaSets();
  const setValue = getCortinaSet();
  const options = ["", ...cortinaSets];
  if (playlistCortinaSetSelect) {
    playlistCortinaSetSelect.innerHTML = "";
    options.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      if (!name) {
        option.textContent = t("cortinaNone");
      } else if (name === DEFAULT_CORTINA_SET_ID) {
        option.textContent = t("cortinaDefaultSet");
      } else {
        option.textContent = name;
      }
      playlistCortinaSetSelect.appendChild(option);
    });
    playlistCortinaSetSelect.value = setValue;
  }
  if (cortinaModalSet) {
    cortinaModalSet.innerHTML = "";
    const modalOptions = [CORTINA_ANY_ID, ...cortinaSets];
    modalOptions.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      if (name === CORTINA_ANY_ID) {
        option.textContent = t("cortinaAny");
      } else if (name === DEFAULT_CORTINA_SET_ID) {
        option.textContent = t("cortinaDefaultSet");
      } else {
        option.textContent = name;
      }
      cortinaModalSet.appendChild(option);
    });
    cortinaModalSetValue = setValue || CORTINA_ANY_ID;
    cortinaModalSet.value = cortinaModalSetValue;
  }
};

const loadCortinaTracks = async (setName: string) => {
  if (!window.tanda) {
    return [];
  }
  if (cortinaTracksBySet.has(setName)) {
    return cortinaTracksBySet.get(setName) ?? [];
  }
  const tracks = await window.tanda.listCortinas(setName);
  cortinaTracksBySet.set(setName, tracks);
  tracks.forEach((track) => trackCache.set(track.id, track));
  return tracks;
};

const resetCortinaQueue = async () => {
  const setName = getCortinaSet();
  if (!setName) {
    cortinaQueue = [];
    return;
  }
  const tracks = await loadCortinaTracks(setName);
  if (tracks.length === 0) {
    cortinaQueue = [];
    return;
  }
  cortinaQueue = shuffleTracks(tracks);
  if (lastCortinaId && cortinaQueue.length > 1 && cortinaQueue[0].id === lastCortinaId) {
    cortinaQueue.push(cortinaQueue.shift()!);
  }
};

const resetCortinaPreviewQueue = async () => {
  const setName = getCortinaSet();
  cortinaPreviewSet = setName;
  if (!setName) {
    cortinaPreviewQueue = [];
    return;
  }
  const tracks = await loadCortinaTracks(setName);
  if (tracks.length === 0) {
    cortinaPreviewQueue = [];
    return;
  }
  cortinaPreviewQueue = shuffleTracks(tracks);
};

const resetCortinaPlans = () => {
  cortinaPlannedByIndex.clear();
  cortinaPreviewQueue = [];
  cortinaPreviewSet = null;
};

let cortinaPlanLoading = false;
const ensureCortinaPlans = async (indices: number[]) => {
  if (cortinaPlanLoading) {
    return;
  }
  const setName = getCortinaSet();
  if (!setName) {
    return;
  }
  cortinaPlanLoading = true;
  try {
    if (cortinaPreviewSet !== setName) {
      cortinaPlannedByIndex.clear();
      await resetCortinaPreviewQueue();
    }
    let assigned = false;
    for (const index of indices) {
      if (cortinaPlannedByIndex.has(index) || cortinaOverrideByIndex.has(index)) {
        continue;
      }
      if (cortinaPreviewQueue.length === 0) {
        await resetCortinaPreviewQueue();
      }
      const next = cortinaPreviewQueue.shift() ?? null;
      if (!next) {
        continue;
      }
      cortinaPlannedByIndex.set(index, next);
      assigned = true;
    }
    if (assigned) {
      renderPlaylist();
    }
  } finally {
    cortinaPlanLoading = false;
  }
};

const setCortinaModalVisible = (visible: boolean) => {
  if (!cortinaModal) {
    return;
  }
  if (!visible || appMode !== "edit") {
    resetModalCardPosition(cortinaModal);
  }
  cortinaModal.classList.toggle("open", visible);
  cortinaModal.setAttribute("aria-hidden", visible ? "false" : "true");
  if (!visible) {
    pendingCortinaTargetIndex = null;
  }
};

const renderCortinaResults = async () => {
  if (!cortinaResults) {
    return;
  }
  const setName = cortinaModalSetValue ?? cortinaModalSet?.value ?? getCortinaSet();
  if (!setName || setName === "") {
    cortinaResults.innerHTML = "";
    return;
  }
  const query = cortinaSearchInput?.value.trim().toLowerCase() ?? "";
  let tracks: TrackRow[] = [];
  if (setName === CORTINA_ANY_ID) {
    const seen = new Set<string>();
    for (const set of cortinaSets) {
      const setTracks = await loadCortinaTracks(set);
      setTracks.forEach((track) => {
        if (!seen.has(track.id)) {
          seen.add(track.id);
          tracks.push(track);
        }
      });
    }
  } else {
    tracks = await loadCortinaTracks(setName);
  }
  const filtered = (query
    ? tracks.filter((track) => {
        const title = track.title?.toLowerCase() ?? "";
        const artist = track.artist?.toLowerCase() ?? "";
        return title.includes(query) || artist.includes(query);
      })
    : tracks
  ).sort((a, b) => {
    const titleA = a.title?.toLowerCase() ?? "";
    const titleB = b.title?.toLowerCase() ?? "";
    const titleCmp = titleA.localeCompare(titleB);
    if (titleCmp !== 0) {
      return titleCmp;
    }
    const artistA = a.artist?.toLowerCase() ?? "";
    const artistB = b.artist?.toLowerCase() ?? "";
    return artistA.localeCompare(artistB);
  });
  cortinaResults.innerHTML = "";
  filtered.forEach((track) => {
    const row = document.createElement("div");
    row.className = "list-row track-row cortina-row cortina-result";
    row.dataset.trackId = track.id;
    row.dataset.filePath = track.full_path;
    row.innerHTML = "";
    const details = document.createElement("div");
    details.className = "track-details";
    const primary = document.createElement("div");
    primary.className = "track-primary";
    const title = track.title?.trim() ?? "";
    const artist = track.artist?.trim() ?? "";
    const label = [title, artist].filter(Boolean).join(" / ");
    primary.textContent = label || track.relative_path || "";
    details.append(primary);
    const actions = document.createElement("div");
    actions.className = "row-actions";
    if (headphoneAvailable) {
      actions.appendChild(buildHeadphoneButton());
    }
    row.append(details, actions);
    row.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("button")) {
        return;
      }
      if (pendingCortinaTargetIndex !== null) {
        cortinaOverrideByIndex.set(pendingCortinaTargetIndex, track);
        cortinaPlannedByIndex.set(pendingCortinaTargetIndex, track);
        markCortinaPulse(pendingCortinaTargetIndex);
      } else {
        cortinaOverrideTrack = track;
      }
      setStatus(t("statusCortinaSelected", { title: buildTrackLabel(track) }));
      setCortinaModalVisible(false);
      renderPlaylist();
    });
    cortinaResults.appendChild(row);
  });
};

const openCortinaModal = (targetIndex: number | null) => {
  pendingCortinaTargetIndex = targetIndex;
  if (cortinaModalSet) {
    cortinaModalSetValue = getCortinaSet() || CORTINA_ANY_ID;
    cortinaModalSet.value = cortinaModalSetValue;
  }
  if (cortinaSearchInput) {
    cortinaSearchInput.value = "";
  }
  void renderCortinaResults();
  setCortinaModalVisible(true);
};

const createEmptyTanda = (): TandaDraft => {
  const size = getDefaultTandaSize();
  return {
    id: crypto.randomUUID(),
    name: "",
    styles: [],
    rating: 0,
    trackSlots: Array.from({ length: size }, () => null),
  };
};

const cloneTanda = (tanda: TandaDraft): TandaDraft => ({
  id: tanda.id,
  name: tanda.name,
  styles: [...tanda.styles],
  rating: tanda.rating,
  trackSlots: [...tanda.trackSlots],
});

const isTandaEmpty = (tanda: TandaDraft | null | undefined) => {
  if (!tanda) {
    return true;
  }
  return tanda.trackSlots.every((slot) => !slot);
};

const createPlaceholderTanda = (tandaId: string): TandaDraft => ({
  id: tandaId,
  name: "",
  styles: [],
  rating: 0,
  trackSlots: Array.from({ length: getDefaultTandaSize() }, () => null),
});

const upsertTandaCache = (tanda: TandaDetail) => {
  tanda.tracks.forEach((track) => trackCache.set(track.id, track));
  tandaCache.set(tanda.id, {
    id: tanda.id,
    name: tanda.name,
    styles: [...tanda.styles],
    rating: tanda.rating,
    trackSlots: [...tanda.track_slots],
  });
};

const resolveTandaDraft = (tandaId: string) =>
  tandaDrafts.find((tanda) => tanda.id === tandaId) ??
  tandaCache.get(tandaId) ??
  null;

const ensureTandaDraft = (tanda: TandaDraft) => {
  if (!tandaDrafts.some((item) => item.id === tanda.id)) {
    tandaDrafts = [...tandaDrafts, tanda];
  }
};

const isPlaylistIndexLocked = (index: number) => {
  if (appMode !== "live") {
    return false;
  }
  if (playlistPlayback.status !== "playing") {
    return false;
  }
  if (index <= playlistPlayback.playedThroughIndex) {
    return true;
  }
  return index === playlistPlayback.currentIndex;
};

const isCortinaIndexEditable = (index: number | null) => {
  if (index === null) {
    return true;
  }
  if (appMode !== "live") {
    return true;
  }
  if (playlistPlayback.status !== "playing") {
    return true;
  }
  return index > playlistPlayback.playedThroughIndex;
};

const isTandaLocked = (tandaId: string) => {
  if (appMode !== "live") {
    return false;
  }
  return playlistItems.some(
    (item, index) =>
      item?.kind === "tanda" &&
      item.tandaId === tandaId &&
      isPlaylistIndexLocked(index),
  );
};

const resolvePlaylistTracks = (item: PlaylistItem | null): TrackRow[] => {
  if (!item) {
    return [];
  }
  if (item.kind === "track") {
    return [item.track];
  }
  const tanda = resolveTandaDraft(item.tandaId);
  if (!tanda) {
    return [];
  }
  return tanda.trackSlots
    .map((trackId) => (trackId ? trackCache.get(trackId) ?? null : null))
    .filter(Boolean) as TrackRow[];
};

const getActiveTanda = () =>
  tandaDrafts.find((tanda) => tanda.id === selectedTandaId) ?? null;

const setActiveTanda = (tandaId: string | null) => {
  selectedTandaId = tandaId;
  const tanda = getActiveTanda();
  if (tanda) {
    selectedStyles = [...tanda.styles];
  }
  loadStyles();
  updateSearchTabVisibility();
  refreshSearch();
  renderClipboard();
  renderTandaDesigner();
};

const activateRightTab = (tabId: RightPanelTab) => {
  const button = playlistPanel?.querySelector<HTMLButtonElement>(
    `.tab-bar button[data-tab="${tabId}"]`,
  );
  button?.click();
};

const activatePanelTab = (panel: Element | null, tabId: string) => {
  if (!panel) {
    return;
  }
  const button = panel.querySelector<HTMLButtonElement>(
    `.tab-bar button[data-tab="${tabId}"]`,
  );
  button?.click();
};

const addTrackToTanda = (tandaId: string | null, track: TrackRow) => {
  const tanda = tandaDrafts.find((item) => item.id === tandaId);
  if (!tanda) {
    return false;
  }
  if (isTandaLocked(tanda.id)) {
    setStatus(t("statusTandaLocked"));
    return false;
  }
  const isActive = selectedTandaId === tanda.id;
  trackCache.set(track.id, track);
  const slotIndex = tanda.trackSlots.findIndex((slot) => slot === null);
  if (slotIndex >= 0) {
    tanda.trackSlots[slotIndex] = track.id;
  } else {
    tanda.trackSlots.push(track.id);
  }
  const tracks = tanda.trackSlots.map((trackId) =>
    trackId ? trackCache.get(trackId) ?? null : null,
  );
  const derivedStyles = collectStylesFromTracks(tracks, availableStyles);
  const normalizedExisting = tanda.styles
    .map((style) => normalizeStyleName(style))
    .map((normalized) =>
      availableStyles.find(
        (style) => normalizeStyleName(style) === normalized,
      ),
    )
    .filter(Boolean) as string[];
  tanda.styles = Array.from(new Set([...normalizedExisting, ...derivedStyles]));
  if (isActive) {
    selectedStyles = [...tanda.styles];
  }
  if (selectedTandaId !== tanda.id) {
    selectedTandaId = tanda.id;
    selectedStyles = [...tanda.styles];
  }
  if (isActive || selectedTandaId === tanda.id) {
    loadStyles();
    updateSearchTabVisibility();
    refreshSearch();
  }
  renderTandaDesigner();
  renderClipboard();
  activateRightTab("tanda-designer-tab");
  return true;
};

const addTrackToActiveTanda = (track: TrackRow) => {
  const added = addTrackToTanda(selectedTandaId, track);
  if (added) {
    activateRightTab("tanda-designer-tab");
  }
  return added;
};

const addTandaToClipboard = (tandaId: string) => {
  const collection = getActiveCollection();
  if (!collection) {
    return;
  }
  if (!collection.tandaIds.includes(tandaId)) {
    collection.tandaIds.push(tandaId);
    saveClipboardCollections();
  }
  markClipboardTandaPulse(tandaId);
  activatePanelTab(clipPanel, "clip-tandas");
  renderClipboard();
};

const addTandaToPlaylist = (tandaId: string, source?: TandaDraft | null) => {
  if (source) {
    ensureTandaDraft(source);
  }
  if (!tandaDrafts.some((item) => item.id === tandaId)) {
    return;
  }
  const openIndex = getOpenPlaylistTandaIndex();
  if (openIndex !== null) {
    const openItem = playlistItems[openIndex];
    if (openItem?.kind === "tanda") {
      const openTanda = resolveTandaDraft(openItem.tandaId);
      if (openTanda) {
        finalizeTandaDraft(openTanda, "playlist-tab");
      }
    }
    clearPlaylistOpenTanda();
  }
  normalizePlaylist();
  const targetIndex = getPlaylistTargetIndex();
  const insertIndex = targetIndex ?? findFirstEmptyPlaylistSlot();
  if (insertIndex < 0) {
    setStatus(t("statusPlaylistNoEmptySlot"));
    return;
  }
  const placed = placeTandaInPlaylistSlot(tandaId, insertIndex);
  if (placed && targetIndex !== null) {
    clearPlaylistTarget();
  }
};

const placeTandaInPlaylistSlot = (
  tandaId: string,
  index: number,
  options?: { allowStyleMismatch?: boolean; allowCountMismatch?: boolean },
) => {
  if (index < 0 || index >= playlistItems.length) {
    return false;
  }
  if (isPlaylistIndexLocked(index)) {
    setStatus(t("statusPlaylistLocked"));
    return false;
  }
  const tanda = resolveTandaDraft(tandaId);
  if (tanda) {
    const validation = validateTandaForSlot(tanda, index);
    if (!validation.ok && validation.rule) {
      if (validation.reason === "count" && !options?.allowCountMismatch) {
        const confirmed = window.confirm(
          t("confirmPlaylistSequenceOverride", {
            rule: getSequenceLabel(validation.rule),
            expected: validation.rule.count,
            count: validation.trackCount ?? 0,
          }),
        );
        if (!confirmed) {
          return false;
        }
        options = { ...options, allowCountMismatch: true };
      } else if (validation.reason === "style" && !options?.allowStyleMismatch) {
        showAlertAction(
          t("confirmPlaylistSequenceStyleOverride", {
            rule: getSequenceLabel(validation.rule),
            tanda: getTandaSequenceLabel(tanda),
          }),
          t("allowOverride"),
          () => {
            placeTandaInPlaylistSlot(tandaId, index, {
              allowStyleMismatch: true,
            });
          },
        );
        return false;
      } else if (!options?.allowStyleMismatch && !options?.allowCountMismatch) {
        setStatus(
          t("statusPlaylistSequenceMismatch", {
            rule: getSequenceLabel(validation.rule),
            tanda: getTandaSequenceLabel(tanda),
          }),
        );
        return false;
      }
      if (validation.reason === "count") {
        options = { ...options, allowCountMismatch: true };
      }
    }
    const mismatch =
      validation.reason === "style" && options?.allowStyleMismatch
        ? "style"
        : undefined;
    playlistItems[index] = { kind: "tanda", tandaId, mismatch };
    normalizePlaylist();
    activatePanelTab(playlistPanel, "playlist-tab");
    markPlaylistPulse(index);
    renderPlaylist();
    return true;
  }
  return false;
};

const removeClipboardTrack = (trackId: string) => {
  const collection = getActiveCollection();
  if (!collection) {
    return;
  }
  if (collection.id === CLIPBOARD_NEW_ID) {
    setStatus(t("statusClipboardCollectionReadOnly"));
    return;
  }
  if (!collection.trackIds.includes(trackId)) {
    setStatus(t("statusClipboardReadonlyRemove"));
    return;
  }
  collection.trackIds = collection.trackIds.filter((id) => id !== trackId);
  if (selectedClipboardTrackId === trackId) {
    selectedClipboardTrackId = null;
  }
  saveClipboardCollections();
};

const removeClipboardTanda = (tandaId: string) => {
  const collection = getActiveCollection();
  if (!collection) {
    return;
  }
  if (collection.id === CLIPBOARD_NEW_ID) {
    setStatus(t("statusClipboardCollectionReadOnly"));
    return;
  }
  if (!collection.tandaIds.includes(tandaId)) {
    setStatus(t("statusClipboardReadonlyRemove"));
    return;
  }
  collection.tandaIds = collection.tandaIds.filter((id) => id !== tandaId);
  if (selectedClipboardTandaId === tandaId) {
    selectedClipboardTandaId = null;
  }
  saveClipboardCollections();
};

const clearGeneralClipboard = () => {
  const collection = getGeneralCollection();
  if (!collection) {
    return;
  }
  collection.trackIds = [];
  collection.tandaIds = [];
  if (activeClipboardCollectionId === "general") {
    selectedClipboardTrackId = null;
    selectedClipboardTandaId = null;
  }
  saveClipboardCollections();
  renderClipboardCollections();
  renderClipboard();
  setStatus(t("statusClipboardCleared"));
};

const resolveTrackById = (trackId: string) => {
  const playlistTrack = playlistItems.find(
    (item): item is { kind: "track"; track: TrackRow } =>
      item?.kind === "track" && item.track.id === trackId,
  );
  return (
    trackCache.get(trackId) ??
    searchState.items.find((item) => item.id === trackId) ??
    clipboardTracks.find((item) => item.id === trackId) ??
    playlistTrack?.track ??
    null
  );
};

const showAlert = (message: string) => {
  if (!alertBanner) {
    return;
  }
  alertBanner.textContent = message;
  alertBanner.classList.add("visible");
  alertBanner.classList.remove("pulse");
};

const clearAlert = () => {
  if (!alertBanner) {
    return;
  }
  alertBanner.textContent = "";
  alertBanner.classList.remove("visible");
  alertBanner.classList.remove("pulse");
};

const getDefaultCollectionName = () => t("clipboardCollectionGeneral");
const getNewCollectionName = () => t("clipboardCollectionNew");

const defaultCollectionNames = () =>
  (Object.keys(translations) as LanguageKey[]).map(
    (lang) => translations[lang].clipboardCollectionGeneral,
  );

const newCollectionNames = () =>
  (Object.keys(translations) as LanguageKey[]).map(
    (lang) => translations[lang].clipboardCollectionNew,
  );

const normalizeCollectionName = (name: string) => name.trim();

const ensureDefaultCollection = () => {
  const existing = clipboardCollections.find((item) => item.id === "general");
  if (!existing) {
    clipboardCollections.unshift({
      id: "general",
      name: getDefaultCollectionName(),
      trackIds: [],
      tandaIds: [],
    });
    return;
  }
  if (defaultCollectionNames().includes(existing.name)) {
    existing.name = getDefaultCollectionName();
  }
};

const ensureNewCollection = () => {
  const existing = clipboardCollections.find((item) => item.id === CLIPBOARD_NEW_ID);
  if (!existing) {
    const generalIndex = clipboardCollections.findIndex((item) => item.id === "general");
    const insertIndex = generalIndex >= 0 ? generalIndex + 1 : clipboardCollections.length;
    clipboardCollections.splice(insertIndex, 0, {
      id: CLIPBOARD_NEW_ID,
      name: getNewCollectionName(),
      trackIds: [],
      tandaIds: [],
    });
    return;
  }
  if (newCollectionNames().includes(existing.name)) {
    existing.name = getNewCollectionName();
  }
};

const getNewCollectionLimit = () => {
  const raw = localStorage.getItem(CLIPBOARD_NEW_LIMIT_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_NEW_LIMIT;
  if (!Number.isFinite(parsed)) {
    return DEFAULT_NEW_LIMIT;
  }
  return Math.max(0, Math.min(500, parsed));
};

const saveClipboardCollections = () => {
  localStorage.setItem(
    CLIPBOARD_COLLECTIONS_KEY,
    JSON.stringify(clipboardCollections),
  );
  if (activeClipboardCollectionId) {
    localStorage.setItem(CLIPBOARD_ACTIVE_KEY, activeClipboardCollectionId);
  }
  localStorage.setItem(
    CLIPBOARD_INCLUDE_KEY,
    JSON.stringify(includedClipboardCollectionIds),
  );
};

const loadClipboardCollections = () => {
  const raw = localStorage.getItem(CLIPBOARD_COLLECTIONS_KEY);
  clipboardCollections = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ClipboardCollection[];
      if (Array.isArray(parsed)) {
        clipboardCollections = parsed.map((item) => ({
          id: item.id,
          name: item.name,
          trackIds: Array.isArray(item.trackIds) ? item.trackIds : [],
          tandaIds: Array.isArray(item.tandaIds) ? item.tandaIds : [],
        }));
      }
    } catch {
      clipboardCollections = [];
    }
  }
  if (clipboardCollections.length === 0) {
    clipboardCollections = [
      {
        id: "general",
        name: getDefaultCollectionName(),
        trackIds: [],
        tandaIds: [],
      },
    ];
  }
  ensureDefaultCollection();
  ensureNewCollection();
  activeClipboardCollectionId =
    localStorage.getItem(CLIPBOARD_ACTIVE_KEY) ??
    clipboardCollections[0]?.id ??
    "general";
  const includeRaw = localStorage.getItem(CLIPBOARD_INCLUDE_KEY);
  includedClipboardCollectionIds = [];
  if (includeRaw) {
    try {
      const parsed = JSON.parse(includeRaw) as string[];
      if (Array.isArray(parsed)) {
        includedClipboardCollectionIds = parsed.filter(
          (id) => id !== activeClipboardCollectionId,
        );
      }
    } catch {
      includedClipboardCollectionIds = [];
    }
  }
  saveClipboardCollections();
};

const getActiveCollection = () =>
  clipboardCollections.find((item) => item.id === activeClipboardCollectionId) ??
  clipboardCollections[0] ??
  null;

const addTrackToActiveCollection = (track: TrackRow) => {
  const collection = getActiveCollection();
  if (!collection) {
    return false;
  }
  if (collection.id === CLIPBOARD_NEW_ID) {
    setStatus(t("statusClipboardCollectionReadOnly"));
    return false;
  }
  addTrackToCollection(collection.id, track);
  selectedClipboardTrackId = track.id;
  selectedClipboardTandaId = null;
  return true;
};

const addTandaToActiveCollection = (tandaId: string) => {
  const collection = getActiveCollection();
  if (!collection) {
    return false;
  }
  if (collection.id === CLIPBOARD_NEW_ID) {
    setStatus(t("statusClipboardCollectionReadOnly"));
    return false;
  }
  addTandaToCollection(collection.id, tandaId);
  selectedClipboardTandaId = tandaId;
  selectedClipboardTrackId = null;
  return true;
};

const getGeneralCollection = () =>
  clipboardCollections.find((item) => item.id === "general") ??
  clipboardCollections[0] ??
  null;

const getVisibleCollectionIds = () => {
  const ids = new Set<string>();
  if (activeClipboardCollectionId) {
    ids.add(activeClipboardCollectionId);
  }
  includedClipboardCollectionIds.forEach((id) => ids.add(id));
  return Array.from(ids);
};

const renderClipboardCollections = () => {
  if (!clipboardCollectionsTabs || !clipboardCollectionsInclude) {
    return;
  }
  clipboardCollectionsTabs.innerHTML = "";
  clipboardCollectionsInclude.innerHTML = "";
  clipboardCollections.forEach((collection) => {
    const button = document.createElement("button");
    button.textContent = collection.name;
    button.classList.toggle(
      "active",
      collection.id === activeClipboardCollectionId,
    );
    button.dataset.collectionId = collection.id;
    button.draggable =
      collection.id !== "general" && collection.id !== CLIPBOARD_NEW_ID;
    button.addEventListener("click", () => {
      activeClipboardCollectionId = collection.id;
      includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
        (id) => id !== collection.id,
      );
      saveClipboardCollections();
      renderClipboardCollections();
      renderClipboard();
    });
    button.addEventListener("dragstart", (event) => {
      if (
        collection.id === "general" ||
        collection.id === CLIPBOARD_NEW_ID ||
        !event.dataTransfer
      ) {
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        "application/x-tanda-collection",
        collection.id,
      );
      event.dataTransfer.setData("text/plain", collection.name);
    });
    button.addEventListener("dragover", (event) => {
      if (collection.id === CLIPBOARD_NEW_ID) {
        return;
      }
      if (
        event.dataTransfer?.types.includes("application/x-tanda-track") ||
        (collection.id !== "general" &&
          event.dataTransfer?.types.includes("application/x-tanda-collection"))
      ) {
        event.preventDefault();
      }
    });
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      if (
        event.dataTransfer?.types.includes("application/x-tanda-track")
      ) {
        if (collection.id === CLIPBOARD_NEW_ID) {
          return;
        }
        const payload =
          event.dataTransfer.getData("application/x-tanda-track") ?? "";
        if (!payload) {
          return;
        }
        let data: { trackId?: string; context?: string } = {};
        try {
          data = JSON.parse(payload) as { trackId?: string; context?: string };
        } catch {
          data = {};
        }
        if (!data.trackId || data.context !== "clipboard") {
          return;
        }
        clipboardCollections = moveTrackToCollection(
          clipboardCollections,
          data.trackId,
          collection.id,
          [CLIPBOARD_NEW_ID],
        );
        activeClipboardCollectionId = collection.id;
        includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
          (id) => id !== collection.id,
        );
        saveClipboardCollections();
        renderClipboardCollections();
        renderClipboard();
        return;
      }
      if (
        collection.id === "general" ||
        collection.id === CLIPBOARD_NEW_ID
      ) {
        return;
      }
      const fromId =
        event.dataTransfer?.getData("application/x-tanda-collection") ?? "";
      if (!fromId || fromId === collection.id) {
        return;
      }
      const reordered = reorderClipboardCollections(
        clipboardCollections,
        fromId,
        collection.id,
        ["general", CLIPBOARD_NEW_ID],
      );
      if (reordered === clipboardCollections) {
        return;
      }
      clipboardCollections = reordered;
      saveClipboardCollections();
      renderClipboardCollections();
    });
    clipboardCollectionsTabs.appendChild(button);
  });

  clipboardCollections.forEach((collection) => {
    if (collection.id === activeClipboardCollectionId) {
      return;
    }
    const label = document.createElement("label");
    label.className = "collection-chip";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = includedClipboardCollectionIds.includes(collection.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        includedClipboardCollectionIds = Array.from(
          new Set([...includedClipboardCollectionIds, collection.id]),
        );
      } else {
        includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
          (id) => id !== collection.id,
        );
      }
      saveClipboardCollections();
      renderClipboard();
      renderClipboardCollections();
    });
    const span = document.createElement("span");
    span.textContent = collection.name;
    label.append(checkbox, span);
    clipboardCollectionsInclude.appendChild(label);
  });
};

const renderStyleList = () => {
  if (!styleList) {
    return;
  }
  styleList.innerHTML = "";
  if (availableStyles.length === 0) {
    styleList.textContent = t("styleEmpty");
    return;
  }
  availableStyles.forEach((style) => {
    const row = document.createElement("div");
    row.className = "style-row";
    const name = document.createElement("span");
    name.textContent = style;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = t("styleRemove");
    remove.setAttribute("aria-label", t("styleRemoveLabel", { style }));
    remove.title = t("styleRemoveLabel", { style });
    remove.addEventListener("click", async () => {
      if (!window.tanda) {
        return;
      }
      await window.tanda.removeStyle(style);
      await loadStyles();
      renderTandaDesigner();
      refreshSearch();
    });
    row.append(name, remove);
    styleList.appendChild(row);
  });
};

const renderDiagnosticsPaths = async () => {
  if (!diagnosticsPathsEl || !window.tanda?.getDiagnosticsPaths) {
    return;
  }
  const paths = await window.tanda.getDiagnosticsPaths();
  diagnosticsPathsEl.innerHTML = "";
  const rows: { label: string; value: string }[] = [
    { label: t("diagnosticsPathsUserData"), value: paths.userData },
    { label: t("diagnosticsPathsWaveforms"), value: paths.waveformsDir },
    { label: t("diagnosticsPathsFfmpeg"), value: paths.ffmpegPath },
    { label: t("diagnosticsPathsFfprobe"), value: paths.ffprobePath },
  ];
  rows.forEach((row) => {
    const line = document.createElement("div");
    const label = document.createElement("strong");
    label.textContent = `${row.label}:`;
    const value = document.createElement("code");
    value.textContent = row.value;
    line.append(label, document.createTextNode(" "), value);
    diagnosticsPathsEl.appendChild(line);
  });
};

const ensureClipboardTracksLoaded = async (ids: string[]) => {
  if (!window.tanda) {
    return;
  }
  const missing = ids.filter((id) => !trackCache.has(id));
  if (missing.length === 0) {
    return;
  }
  const tracks = await window.tanda.getTracksByIds(missing);
  tracks.forEach((track) => trackCache.set(track.id, track));
};

const ensureClipboardTandasLoaded = async (ids: string[]) => {
  if (!window.tanda) {
    return;
  }
  const missing = ids.filter(
    (id) => !tandaDrafts.some((item) => item.id === id) && !tandaCache.has(id),
  );
  if (missing.length === 0) {
    return;
  }
  const tandas = await window.tanda.getTandasByIds(missing);
  tandas.forEach(upsertTandaCache);
};

const showAlertAction = (
  message: string,
  actionLabel: string,
  onAction: () => void,
) => {
  const confirmed = window.confirm(`${message}\n\n${actionLabel}?`);
  if (confirmed) {
    onAction();
  }
};

const getDefaultStyleNames = () => [
  t("defaultStyleTango"),
  t("defaultStyleWaltz"),
  t("defaultStyleMilonga"),
].map((style) => style.trim()).filter(Boolean);

const normalizeStyleList = (styles: string[]) =>
  styles
    .map((style) => normalizeStyleName(style))
    .filter(Boolean)
    .sort();

const styleListsMatch = (left: string[], right: string[]) => {
  const normalizedLeft = normalizeStyleList(left);
  const normalizedRight = normalizeStyleList(right);
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const ensureDefaultStyles = async (mode: "init" | "language") => {
  if (!window.tanda) {
    return;
  }
  const currentStyles = await window.tanda.listStyles();
  const defaults = getDefaultStyleNames();
  if (defaults.length === 0) {
    return;
  }
  const storedDefaultsRaw = localStorage.getItem(DEFAULT_STYLE_NAMES_KEY);
  const storedDefaults = storedDefaultsRaw
    ? (JSON.parse(storedDefaultsRaw) as string[])
    : [];
  if (currentStyles.length === 0) {
    for (const style of defaults) {
      await window.tanda.addStyle(style);
    }
    localStorage.setItem(DEFAULT_STYLE_NAMES_KEY, JSON.stringify(defaults));
    localStorage.setItem(DEFAULT_STYLE_LANG_KEY, getLanguage());
    return;
  }
  if (mode === "language") {
    if (storedDefaults.length === 0) {
      return;
    }
    if (!styleListsMatch(currentStyles, storedDefaults)) {
      return;
    }
    const result = await window.tanda.replaceDefaultStyles({
      oldStyles: storedDefaults,
      newStyles: defaults,
    });
    if (result?.ok) {
      localStorage.setItem(DEFAULT_STYLE_NAMES_KEY, JSON.stringify(defaults));
      localStorage.setItem(DEFAULT_STYLE_LANG_KEY, getLanguage());
    }
  }
};

const loadStyles = async () => {
  if (!window.tanda || !styleOptions) {
    return;
  }
  let styles = await window.tanda.listStyles();
  if (styles.length === 0) {
    await ensureDefaultStyles("init");
    styles = await window.tanda.listStyles();
  }
  availableStyles = styles;
  styleOptions.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.textContent = t("styleAll");
  allButton.classList.toggle(
    "active",
    selectedStyles.length === 0,
  );
  allButton.addEventListener("click", () => {
    selectedStyles = [];
    loadStyles();
    refreshSearch();
    renderClipboard();
  });
  styleOptions.appendChild(allButton);
  availableStyles.forEach((style) => {
    const button = document.createElement("button");
    button.textContent = style;
    button.classList.toggle("active", selectedStyles.includes(style));
    button.addEventListener("click", () => {
      if (selectedStyles.includes(style)) {
        selectedStyles = selectedStyles.filter((value) => value !== style);
      } else {
        selectedStyles = [...selectedStyles, style];
      }
      loadStyles();
      refreshSearch();
      renderClipboard();
    });
    styleOptions.appendChild(button);
  });
  renderStyleList();
  if (trackEditorState.track) {
    fillTrackEditorFields(trackEditorState.track);
  }
};

let searchTimer: number | undefined;

const getActiveStyleFilter = () => {
  return selectedStyles;
};

const getSearchParams = () => {
  const config = getSearchConfig();
  return {
    query: searchInput?.value?.trim() ?? "",
    styles: getActiveStyleFilter(),
    minScore: config.minScore,
    bpmRange: config.bpmRange,
  };
};

const updateSearchSortDefaults = () => {
  const query = searchInput?.value?.trim() ?? "";
  searchState = {
    ...searchState,
    ...applySearchSortDefaults(query, searchState),
  };
  updateSortButtons();
};

const updateSearchCount = async () => {
  if (!window.tanda) {
    return;
  }
  searchState.total = await window.tanda.searchTrackCount(getSearchParams());
  updateSearchCountDisplay();
};

const updateSearchCountDisplay = () => {
  if (!searchCount) {
    return;
  }
  const count =
    activeSearchTab === "search-tracks"
      ? searchState.total
      : tandaSearchResults.length;
  searchCount.textContent = t("searchResultsCount", { count });
};

const renderJumpIndex = (available: string[]) => {
  if (!searchJumpIndex) {
    return;
  }
  const availableSet = new Set(available.map((value) => value.toUpperCase()));
  searchJumpIndex.innerHTML = "";
  JUMP_PREFIXES.forEach((prefix) => {
    const button = document.createElement("button");
    button.textContent = prefix;
    const isAvailable = availableSet.has(prefix);
    button.classList.toggle("disabled", !isAvailable);
    button.disabled = !isAvailable;
    button.addEventListener("click", () => {
      if (isAvailable) {
        jumpToPrefix(prefix);
      }
    });
    searchJumpIndex.appendChild(button);
  });
};

const updateJumpIndex = async () => {
  if (!window.tanda) {
    return;
  }
  if (searchState.sortBy === "score") {
    renderJumpIndex([]);
    return;
  }
  const available = await window.tanda.searchJumpIndex({
    ...getSearchParams(),
    sortBy: searchState.sortBy,
  });
  renderJumpIndex(available);
};

function updateSortButtons() {
  searchSortButtons.forEach((button) => {
    const sort = button.dataset.sort;
    const isActive = sort === searchState.sortBy;
    button.classList.toggle("active", isActive);
    if (isActive) {
      button.dataset.dir = searchState.sortDir === "asc" ? "ASC" : "DESC";
    } else {
      button.dataset.dir = "";
    }
  });
}

const loadSearchPage = async (
  offset: number,
  mode: "replace" | "append" | "prepend",
) => {
  if (!window.tanda || searchState.isLoading) {
    return;
  }
  if (offset < 0) {
    return;
  }
  if (searchState.total && offset >= searchState.total) {
    return;
  }
  searchState.isLoading = true;
  try {
    const rows = await window.tanda.searchTracks({
      ...getSearchParams(),
      limit: SEARCH_PAGE_SIZE,
      offset,
      sortBy: searchState.sortBy,
      sortDir: searchState.sortDir,
    });
    rows.forEach((track) => trackCache.set(track.id, track));
    if (mode === "replace") {
      searchState.items = rows;
      searchState.offsetStart = offset;
    } else if (mode === "append") {
      searchState.items = [...searchState.items, ...rows];
    } else {
      searchState.items = [...rows, ...searchState.items];
      searchState.offsetStart = offset;
    }
    renderSearchResults();
  } finally {
    searchState.isLoading = false;
  }
};

const refreshSearch = async () => {
  updateSearchSortDefaults();
  await updateSearchCount();
  await updateJumpIndex();
  await loadSearchPage(0, "replace");
  await loadTandaSearchResults();
  if (searchListBody) {
    searchListBody.scrollTop = 0;
  }
};

const jumpToPrefix = async (prefix: string) => {
  if (!window.tanda) {
    return;
  }
  const result = await window.tanda.searchJumpToPrefix({
    ...getSearchParams(),
    prefix,
    sortBy: searchState.sortBy,
    sortDir: searchState.sortDir,
  });
  await loadSearchPage(result.offset, "replace");
  if (searchListBody) {
    searchListBody.scrollTop = 0;
  }
};

const handleSearchScroll = async () => {
  if (
    !searchListBody ||
    searchState.isLoading ||
    activeSearchTab !== "search-tracks"
  ) {
    return;
  }
  if (searchState.total === 0) {
    return;
  }
  const threshold = 140;
  const nearBottom =
    searchListBody.scrollTop + searchListBody.clientHeight >=
    searchListBody.scrollHeight - threshold;
  const nearTop = searchListBody.scrollTop <= threshold;

  if (nearBottom) {
    const nextOffset = searchState.offsetStart + searchState.items.length;
    if (searchState.total === 0 || nextOffset < searchState.total) {
      await loadSearchPage(nextOffset, "append");
    }
    return;
  }

  if (nearTop && searchState.offsetStart > 0) {
    const prevOffset = Math.max(0, searchState.offsetStart - SEARCH_PAGE_SIZE);
    const previousHeight = searchListBody.scrollHeight;
    await loadSearchPage(prevOffset, "prepend");
    const newHeight = searchListBody.scrollHeight;
    searchListBody.scrollTop += newHeight - previousHeight;
  }
};

const parseDragData = (event: DragEvent) => {
  if (!event.dataTransfer) {
    return null;
  }
  const raw = event.dataTransfer.getData("application/x-tanda-track");
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as {
      trackId: string;
      context: "search" | "clipboard" | "playlist";
      index?: string;
    };
  } catch {
    return null;
  }
};

const handleDropToClipboard = (event: DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  const payload = parseDragData(event);
  if (!payload) {
    return;
  }
  const track = resolveTrackById(payload.trackId);
  if (!track) {
    return;
  }
  if (payload.context === "playlist" && payload.index) {
    const sourceIndex = Number.parseInt(payload.index, 10);
    if (!Number.isNaN(sourceIndex) && isPlaylistIndexLocked(sourceIndex)) {
      setStatus(t("statusPlaylistLocked"));
      return;
    }
    if (!Number.isNaN(sourceIndex) && playlistItems[sourceIndex]) {
      playlistItems[sourceIndex] = null;
      normalizePlaylist();
      renderPlaylist();
    }
  }
  if (payload.context === "clipboard") {
    return;
  }
  addTrackToClipboard(track);
  activatePanelTab(clipPanel, "clip-tracks");
};

const handleDropToPlaylist = (event: DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  const payload = parseDragData(event);
  if (!payload) {
    return;
  }
  const track = resolveTrackById(payload.trackId);
  if (!track) {
    return;
  }
  const targetRow = (event.target as HTMLElement | null)?.closest<HTMLElement>(
    ".list-row",
  );
  const targetIndex = targetRow?.dataset.index
    ? Number.parseInt(targetRow.dataset.index, 10)
    : null;
  const sourceIndex =
    payload.context === "playlist" && payload.index
      ? Number.parseInt(payload.index, 10)
      : null;

  if (Number.isFinite(targetIndex) && targetIndex !== null) {
    if (isPlaylistIndexLocked(targetIndex)) {
      setStatus(t("statusPlaylistLocked"));
      return;
    }
  }
  if (Number.isFinite(sourceIndex) && sourceIndex !== null) {
    if (isPlaylistIndexLocked(sourceIndex)) {
      setStatus(t("statusPlaylistLocked"));
      return;
    }
  }

  if (targetIndex === null || Number.isNaN(targetIndex)) {
    appendTrackToPlaylist(track);
    activatePanelTab(playlistPanel, "playlist-tab");
    if (payload.context === "clipboard") {
      removeClipboardTrack(payload.trackId);
      renderClipboard();
    } else if (
      payload.context === "playlist" &&
      sourceIndex !== null &&
      !Number.isNaN(sourceIndex)
    ) {
      if (playlistItems[sourceIndex]) {
        playlistItems[sourceIndex] = null;
      }
    }
    normalizePlaylist();
    renderPlaylist();
    return;
  }

  const replaced = playlistItems[targetIndex];
  playlistItems[targetIndex] = { kind: "track", track };
  markPlaylistPulse(targetIndex);

  if (payload.context === "playlist" && sourceIndex !== null) {
    if (!Number.isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      playlistItems[sourceIndex] = replaced ?? null;
    }
  } else if (payload.context === "clipboard") {
    removeClipboardTrack(payload.trackId);
    if (replaced?.kind === "track") {
      addTrackToClipboard(replaced.track);
    } else if (replaced?.kind === "tanda") {
      const tanda =
        resolveTandaDraft(replaced.tandaId) ??
        createPlaceholderTanda(replaced.tandaId);
      clipboardTandas = [...clipboardTandas, cloneTanda(tanda)];
      renderClipboard();
    }
  } else if (payload.context === "search" && replaced?.kind === "track") {
    addTrackToClipboard(replaced.track);
  } else if (payload.context === "search" && replaced?.kind === "tanda") {
    const tanda =
      resolveTandaDraft(replaced.tandaId) ??
      createPlaceholderTanda(replaced.tandaId);
    clipboardTandas = [...clipboardTandas, cloneTanda(tanda)];
    renderClipboard();
  }

  normalizePlaylist();
  activatePanelTab(playlistPanel, "playlist-tab");
  renderPlaylist();
  renderClipboard();
};

const handleDropToTanda = (event: DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  const payload = parseDragData(event);
  if (!payload) {
    return;
  }
  const track = resolveTrackById(payload.trackId);
  if (!track) {
    return;
  }
  const directTarget = (event.target as HTMLElement | null)?.closest<HTMLElement>(
    ".tanda-card",
  );
  const pointTarget = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>(".tanda-card");
  const fallbackId = selectedTandaId ?? tandaDrafts[0]?.id ?? null;
  const targetTandaId =
    directTarget?.dataset.tandaId ??
    pointTarget?.dataset.tandaId ??
    fallbackId;
  const added = addTrackToTanda(targetTandaId ?? null, track);
  if (!added) {
    setStatus(t("statusNoTandaSelected"));
  }
};

const scheduleSearch = () => {
  if (searchTimer) {
    window.clearTimeout(searchTimer);
  }
  searchTimer = window.setTimeout(() => {
    refreshSearch();
  }, 200);
};

const getTrackDataFromRow = (row: HTMLElement) => {
  const trackId = row.dataset.trackId;
  const filePath = row.dataset.filePath;
  const gainDb =
    row.dataset.gainDb !== undefined && row.dataset.gainDb !== ""
      ? Number.parseFloat(row.dataset.gainDb)
      : null;
  if (!trackId || !filePath) {
    return null;
  }
  return { trackId, filePath, gainDb };
};

const setSettingsOpen = (open: boolean) => {
  if (!settingsPanel) {
    return;
  }
  settingsPanel.classList.toggle("open", open);
  settingsPanel.setAttribute("aria-hidden", open ? "false" : "true");
};

const activateSettingsTab = (tab: string) => {
  tabButtons.forEach((btn) => btn.classList.remove("active"));
  tabPanels.forEach((panel) => panel.classList.remove("active"));
  tabButtons
    .filter((btn) => btn.dataset.tab === tab)
    .forEach((btn) => btn.classList.add("active"));
  tabPanels
    .filter((panel) => panel.dataset.tab === tab)
    .forEach((panel) => panel.classList.add("active"));
};

const updateSearchTabVisibility = () => {
  if (searchTrackHeader) {
    searchTrackHeader.classList.toggle(
      "hidden",
      activeSearchTab !== "search-tracks",
    );
  }
  if (searchTandaHeader) {
    searchTandaHeader.classList.toggle(
      "hidden",
      activeSearchTab !== "search-tandas",
    );
  }
  if (searchJumpIndex) {
    searchJumpIndex.classList.toggle(
      "hidden",
      activeSearchTab !== "search-tracks",
    );
  }
  updateSearchCountDisplay();
};

const renderRoots = async () => {
  if (!window.tanda || !rootList || !rootBanner || !rootBannerText) {
    return;
  }
  const roots = await window.tanda.listRoots();
  rootList.innerHTML = "";
  if (roots.length === 0) {
      rootBannerText.textContent = t("statusNoRoots");
    rootBanner.classList.add("visible");
  } else {
    const missing = roots.filter((root) => !root.available);
    if (missing.length > 0) {
      rootBannerText.textContent = t("statusMissingRoots");
      rootBanner.classList.add("visible");
    } else {
      rootBanner.classList.remove("visible");
    }
  }

  roots.forEach((root) => {
    const row = document.createElement("div");
    row.className = "root-row";
    const label = document.createElement("span");
    label.textContent = root.label;
    const kind = document.createElement("span");
    kind.textContent = root.kind === "music" ? t("rootMusic") : t("rootCortina");
    const status = document.createElement("span");
    status.className = root.available ? "ok" : "missing";
    status.textContent = root.available ? t("rootAvailable") : t("rootMissing");
    const path = document.createElement("span");
    path.className = "path";
    path.textContent = root.path;
    path.title = root.path;
    row.append(label, kind, status, path);
    rootList.appendChild(row);
  });
};

const renderDataLocation = async () => {
  if (!window.tanda || !dataLocationPathInput) {
    return;
  }
  const data = await window.tanda.getDataLocation();
  dataLocationPathInput.value = data.path;
  dataLocationPathInput.title = data.path;
};

const updateLegacyImport = async (candidatePath?: string | null) => {
  if (!window.tanda || !legacyImportSection || !legacyImportDescription) {
    return;
  }
  const result = await window.tanda.detectLegacy(candidatePath ?? null);
  if (result.available) {
    legacyImportRootPath = result.rootPath;
    legacyImportSection.classList.remove("hidden");
    legacyImportDescription.textContent = t("legacyImportDetected", {
      path: result.rootPath,
    });
  } else {
    legacyImportRootPath = null;
    legacyImportDescription.textContent = "";
    legacyImportSection.classList.add("hidden");
  }
};

const init = async () => {
  if (!window.tanda) {
    setStatus(t("statusNoApi"));
    return;
  }

  window.addEventListener("error", (event) => {
    const message =
      event.error?.message ?? event.message ?? t("statusUnknownError");
    showAlert(t("statusRendererError"));
    window.tanda?.logClientError({
      message,
      stack: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as Error | string;
    const message =
      typeof reason === "string"
        ? reason
        : reason?.message ?? t("statusUnknownError");
    showAlert(t("statusRendererError"));
    window.tanda?.logClientError({
      message,
      stack: typeof reason === "string" ? undefined : reason?.stack,
    });
  });

  const message = await window.tanda.ping();
  setStatus(t("statusMainProcess", { message }));
  await loadTandaDrafts();
  loadClipboardCollections();
  await refreshNewCollectionTracks();
  renderClipboardCollections();
  await renderClipboard();

  if (themeToggle) {
    const savedTheme = localStorage.getItem("tanda-theme");
    if (savedTheme === "dark") {
      document.body.classList.add("theme-dark");
    }
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("theme-dark");
      const next = document.body.classList.contains("theme-dark")
        ? "dark"
        : "light";
      localStorage.setItem("tanda-theme", next);
    });
  }

  if (closeAppBtn) {
    closeAppBtn.addEventListener("click", async () => {
      const isHeadphonePlaying =
        playback.headphone.active && !playback.headphone.active.paused;
      const isMainPlaying = playback.main.active && !playback.main.active.paused;
      if (isHeadphonePlaying || isMainPlaying) {
        const confirmClose = window.confirm(t("confirmCloseWhilePlaying"));
        if (!confirmClose) {
          return;
        }
      }
      allowAppClose = true;
      await window.tanda?.closeApp();
    });
  }

  clipboardClearBtn?.addEventListener("click", () => {
    clearGeneralClipboard();
  });

  if (clipboardFilterInput) {
    clipboardFilterInput.value = clipboardFilterText;
    clipboardFilterInput.addEventListener("input", () => {
      clipboardFilterText = clipboardFilterInput.value;
      void renderClipboard();
    });
  }

  playlistClearBtn?.addEventListener("click", async () => {
    const confirmed = window.confirm(t("confirmPlaylistClear"));
    if (!confirmed) {
      return;
    }
    await clearPlaylist();
  });

  window.tanda?.onAppCloseRequest(() => {
    const isHeadphonePlaying =
      playback.headphone.active && !playback.headphone.active.paused;
    const isMainPlaying = playback.main.active && !playback.main.active.paused;
    if (isHeadphonePlaying || isMainPlaying) {
      const confirmClose = window.confirm(t("confirmCloseWhilePlaying"));
      if (!confirmClose) {
        void window.tanda?.respondToCloseRequest(false);
        return;
      }
    }
    allowAppClose = true;
    void window.tanda?.respondToCloseRequest(true);
  });

  if (languageSelect) {
    const savedLanguage = getLanguage();
    languageSelect.value = savedLanguage;
    languageSelect.addEventListener("change", async () => {
      localStorage.setItem("tanda-language", languageSelect.value);
      applyTranslations();
      ensureDefaultCollection();
      ensureNewCollection();
      saveClipboardCollections();
      renderClipboardCollections();
      await renderDiagnosticsPaths();
      await ensureDefaultStyles("language");
      await loadStyles();
      renderAllLists();
      setStatus(
        t("statusLanguageSet", { language: languageSelect.value }),
      );
    });
  }

  if (tandaSizeInput) {
    tandaSizeInput.value = getDefaultTandaSize().toString();
    tandaSizeInput.addEventListener("change", () => {
      const next = Number.parseInt(tandaSizeInput.value, 10);
      if (Number.isNaN(next) || next < 1) {
        tandaSizeInput.value = getDefaultTandaSize().toString();
        return;
      }
      localStorage.setItem("tanda-default-size", next.toString());
    });
  }

  if (clipboardNewLimitInput) {
    clipboardNewLimitInput.value = getNewCollectionLimit().toString();
    clipboardNewLimitInput.addEventListener("change", () => {
      const next = Number.parseInt(clipboardNewLimitInput.value, 10);
      if (Number.isNaN(next) || next < 0) {
        clipboardNewLimitInput.value = getNewCollectionLimit().toString();
        return;
      }
      const clamped = Math.min(500, Math.max(0, next));
      localStorage.setItem(CLIPBOARD_NEW_LIMIT_KEY, clamped.toString());
      clipboardNewLimitInput.value = clamped.toString();
      void refreshNewCollectionTracks();
      void renderClipboard();
    });
  }

  if (searchMinScoreInput) {
    searchMinScoreInput.value = getSearchMinScore().toString();
    searchMinScoreInput.addEventListener("change", () => {
      const next = Number.parseFloat(searchMinScoreInput.value);
      if (Number.isNaN(next) || next < 0) {
        searchMinScoreInput.value = getSearchMinScore().toString();
        return;
      }
      localStorage.setItem(SEARCH_MIN_SCORE_KEY, Math.min(next, 1).toString());
      refreshSearch();
    });
  }

  if (searchTandaSizeInput) {
    const stored = localStorage.getItem(TANDA_SEARCH_SIZE_KEY);
    if (stored === null) {
      const defaultValue = getDefaultTandaSize().toString();
      localStorage.setItem(TANDA_SEARCH_SIZE_KEY, defaultValue);
      searchTandaSizeInput.value = defaultValue;
    } else {
      searchTandaSizeInput.value = stored;
    }
    const applyTandaSizeFilter = (raw: string, finalize = false) => {
      const trimmed = raw.trim();
      if (trimmed === "") {
        localStorage.setItem(TANDA_SEARCH_SIZE_KEY, "");
        renderTandaSearchResults();
        void renderClipboard();
        return;
      }
      if (trimmed === "-") {
        localStorage.setItem(TANDA_SEARCH_SIZE_KEY, "-");
        renderTandaSearchResults();
        void renderClipboard();
        return;
      }
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        if (finalize) {
          const normalized = normalizeTandaSearchSizeInput(raw);
          localStorage.setItem(TANDA_SEARCH_SIZE_KEY, normalized);
          searchTandaSizeInput.value = normalized;
          renderTandaSearchResults();
          void renderClipboard();
        }
        return;
      }
      const clamped = Math.min(parsed, 10);
      localStorage.setItem(TANDA_SEARCH_SIZE_KEY, clamped.toString());
      if (trimmed !== clamped.toString()) {
        searchTandaSizeInput.value = clamped.toString();
      }
      renderTandaSearchResults();
      void renderClipboard();
    };
    searchTandaSizeInput.addEventListener("input", () => {
      applyTandaSizeFilter(searchTandaSizeInput.value);
    });
    searchTandaSizeInput.addEventListener("blur", () => {
      applyTandaSizeFilter(searchTandaSizeInput.value, true);
    });
  }

  if (searchBpmRangeInput) {
    searchBpmRangeInput.value = getSearchBpmRange().toString();
    searchBpmRangeInput.addEventListener("change", () => {
      const next = Number.parseFloat(searchBpmRangeInput.value);
      if (Number.isNaN(next) || next < 0) {
        searchBpmRangeInput.value = getSearchBpmRange().toString();
        return;
      }
      localStorage.setItem(
        SEARCH_BPM_RANGE_KEY,
        Math.min(next, 20).toString(),
      );
      refreshSearch();
    });
  }

  if (trimPaddingInput) {
    trimPaddingInput.value = getTrimPaddingSeconds().toString();
    trimPaddingInput.addEventListener("change", () => {
      const next = Number.parseFloat(trimPaddingInput.value);
      if (Number.isNaN(next) || next < 0) {
        trimPaddingInput.value = getTrimPaddingSeconds().toString();
        return;
      }
      const clamped = Math.min(next, 5);
      localStorage.setItem(TRIM_PADDING_KEY, clamped.toString());
      trimPaddingInput.value = clamped.toString();
      updateNowPlayingDisplay();
      renderPlaylist();
      renderTandaSearchResults();
      renderClipboard();
    });
  }

  if (gapBetweenTracksInput) {
    gapBetweenTracksInput.value = getGapBetweenTracks().toString();
    gapBetweenTracksInput.addEventListener("change", () => {
      const next = Number.parseFloat(gapBetweenTracksInput.value);
      if (!Number.isFinite(next) || next < 0) {
        gapBetweenTracksInput.value = getGapBetweenTracks().toString();
        return;
      }
      localStorage.setItem("tanda-gap-between-tracks", next.toString());
    });
  }

  if (gapBeforeTandaInput) {
    gapBeforeTandaInput.value = getGapBeforeTanda().toString();
    gapBeforeTandaInput.addEventListener("change", () => {
      const next = Number.parseFloat(gapBeforeTandaInput.value);
      if (!Number.isFinite(next) || next < 0) {
        gapBeforeTandaInput.value = getGapBeforeTanda().toString();
        return;
      }
      localStorage.setItem("tanda-gap-before-tanda", next.toString());
    });
  }

  if (gapBeforeCortinaInput) {
    gapBeforeCortinaInput.value = getGapBeforeCortina().toString();
    gapBeforeCortinaInput.addEventListener("change", () => {
      const next = Number.parseFloat(gapBeforeCortinaInput.value);
      if (!Number.isFinite(next) || next < 0) {
        gapBeforeCortinaInput.value = getGapBeforeCortina().toString();
        return;
      }
      localStorage.setItem("tanda-gap-before-cortina", next.toString());
    });
  }

  if (stopFadeInput) {
    stopFadeInput.value = getStopFadeSeconds().toString();
    stopFadeInput.addEventListener("change", () => {
      const next = Number.parseFloat(stopFadeInput.value);
      if (!Number.isFinite(next) || next < 0) {
        stopFadeInput.value = getStopFadeSeconds().toString();
        return;
      }
      localStorage.setItem("tanda-stop-fade", next.toString());
    });
  }

  if (playlistCortinaSetSelect) {
    playlistCortinaSetSelect.value = getCortinaSet();
    playlistCortinaSetSelect.addEventListener("change", async () => {
      const next = playlistCortinaSetSelect.value ?? "";
      localStorage.setItem(CORTINA_SET_KEY, next);
      cortinaQueue = [];
      lastCortinaId = null;
      cortinaTracksBySet.clear();
      resetCortinaPlans();
      await resetCortinaQueue();
      renderPlaylist();
      if (cortinaModalSet) {
        cortinaModalSet.value = next;
      }
      await renderCortinaResults();
    });
  }

  if (playlistCortinaDurationInput) {
    const persistCortinaDuration = () => {
      const next = Number.parseFloat(playlistCortinaDurationInput.value);
      if (Number.isNaN(next) || next <= 0) {
        playlistCortinaDurationInput.value = getCortinaDuration().toString();
        return;
      }
      localStorage.setItem(CORTINA_DURATION_KEY, Math.min(next, 180).toString());
    };
    playlistCortinaDurationInput.value = getCortinaDuration().toString();
    playlistCortinaDurationInput.addEventListener("change", persistCortinaDuration);
    playlistCortinaDurationInput.addEventListener("input", persistCortinaDuration);
    playlistCortinaDurationInput.addEventListener("blur", () => {
      playlistCortinaDurationInput.value = getCortinaDuration().toString();
    });
  }

  if (playlistStartTimeInput) {
    playlistStartTimeInput.value = getPlaylistStartTimeInput();
    playlistStartTimeInput.addEventListener("change", () => {
      const raw = playlistStartTimeInput.value.trim();
      if (!raw.match(/^(\d{1,2}):(\d{2})$/)) {
        playlistStartTimeInput.value = getPlaylistStartTimeInput();
        return;
      }
      localStorage.setItem("tanda-playlist-start-time", raw);
      renderPlaylist();
    });
  }

  if (styleAddBtn) {
    styleAddBtn.addEventListener("click", async () => {
      if (!window.tanda || !styleNameInput) {
        return;
      }
      const name = styleNameInput.value.trim();
      if (!name) {
        return;
      }
      const result = await window.tanda.addStyle(name);
      if (result?.ok) {
        styleNameInput.value = "";
        await loadStyles();
        renderTandaDesigner();
        refreshSearch();
        setStatus(t("statusStyleAdded", { style: name }));
      } else {
        setStatus(t("statusStyleAddFailed"));
      }
    });
  }

  styleNameInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    styleAddBtn?.click();
  });

  clipboardCollectionAddBtn?.addEventListener("click", () => {
    const name = normalizeCollectionName(
      clipboardCollectionNameInput?.value ?? "",
    );
    if (!name) {
      return;
    }
    const id = crypto.randomUUID();
    clipboardCollections.push({
      id,
      name,
      trackIds: [],
      tandaIds: [],
    });
    activeClipboardCollectionId = id;
    includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
      (value) => value !== id,
    );
    if (clipboardCollectionNameInput) {
      clipboardCollectionNameInput.value = "";
    }
    saveClipboardCollections();
    renderClipboardCollections();
    renderClipboard();
  });

  clipboardCollectionNameInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    clipboardCollectionAddBtn?.click();
  });

  clipboardCollectionRemoveBtn?.addEventListener("click", () => {
    if (!activeClipboardCollectionId) {
      return;
    }
    if (clipboardCollections.length <= 1) {
      setStatus(t("statusClipboardCollectionLast"));
      return;
    }
    if (
      activeClipboardCollectionId === "general" ||
      activeClipboardCollectionId === CLIPBOARD_NEW_ID
    ) {
      setStatus(t("statusClipboardCollectionProtected"));
      return;
    }
    const activeCollection = getActiveCollection();
    if (!activeCollection) {
      return;
    }
    const confirmed = window.confirm(
      t("confirmClipboardCollectionRemove", { name: activeCollection.name }),
    );
    if (!confirmed) {
      return;
    }
    clipboardCollections = clipboardCollections.filter(
      (item) => item.id !== activeClipboardCollectionId,
    );
    includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
      (id) => id !== activeClipboardCollectionId,
    );
    activeClipboardCollectionId = clipboardCollections[0]?.id ?? "general";
    saveClipboardCollections();
    renderClipboardCollections();
    renderClipboard();
  });

  if (playlistSequenceInput) {
    playlistSequenceInput.value = getPlaylistSequenceInput();
    playlistSequenceInput.addEventListener("change", () => {
      localStorage.setItem("tanda-playlist-sequence", playlistSequenceInput.value);
    });
  }

  if (playlistStyleMapInput) {
    playlistStyleMapInput.value = getPlaylistStyleMapInput();
    playlistStyleMapInput.addEventListener("change", () => {
      localStorage.setItem("tanda-playlist-style-map", playlistStyleMapInput.value);
    });
  }
  cortinaStopBtn?.addEventListener("click", () => {
    if (!cortinaPlaying) {
      return;
    }
    cortinaAllowFull = false;
    cortinaStopRequested = true;
    updateNowPlayingDisplay();
  });
  cortinaPlayBtn?.addEventListener("click", () => {
    if (!cortinaPlaying) {
      return;
    }
    cortinaStopRequested = false;
    cortinaAllowFull = true;
    updateNowPlayingDisplay();
  });
  cortinaModalClose?.addEventListener("click", () => {
    setCortinaModalVisible(false);
  });
  cortinaModalSet?.addEventListener("change", () => {
    if (cortinaModalSet) {
      cortinaModalSetValue = cortinaModalSet.value ?? CORTINA_ANY_ID;
    }
    void renderCortinaResults();
  });
  cortinaSearchInput?.addEventListener("input", () => {
    void renderCortinaResults();
  });

  if (modeSelect) {
    const savedMode = (localStorage.getItem("tanda-mode") ??
      "prep") as OutputMode;
    appMode = savedMode === "live" || savedMode === "edit" ? savedMode : "prep";
    modeSelect.value = appMode;
    document.body.classList.toggle("mode-live", appMode === "live");
    modeSelect.addEventListener("change", () => {
      appMode =
        modeSelect.value === "live"
          ? "live"
          : modeSelect.value === "edit"
            ? "edit"
            : "prep";
      localStorage.setItem("tanda-mode", appMode);
      document.body.classList.toggle("mode-live", appMode === "live");
      if (appMode === "edit") {
        setTrackEditorOpen(false);
        trackEditorState.track = null;
        setCortinaModalVisible(false);
      }
      updateTrackEditorPresentation();
      renderPlaylist();
      renderTandaDesigner();
      updatePlaylistControls();
    });
  }

  if (mainOutputSelect) {
    mainOutputSelect.addEventListener("change", async () => {
      const device = audioOutputs.find(
        (output) => output.deviceId === mainOutputSelect.value,
      );
      localStorage.setItem("tanda-main-output", mainOutputSelect.value);
      if (device?.label) {
        localStorage.setItem("tanda-main-output-label", device.label);
      }
      if (device?.groupId) {
        localStorage.setItem("tanda-main-output-group", device.groupId);
      }
      if (
        headphoneOutputSelect &&
        headphoneOutputSelect.value === mainOutputSelect.value
      ) {
        localStorage.removeItem("tanda-headphone-output");
        localStorage.removeItem("tanda-headphone-output-label");
        localStorage.removeItem("tanda-headphone-output-group");
        await ensureAudioOutputs();
        renderAllLists();
      }
    });
  }

  if (headphoneOutputSelect) {
    headphoneOutputSelect.addEventListener("change", async () => {
      if (
        headphoneOutputSelect.value &&
        headphoneOutputSelect.value !== mainOutputSelect?.value
      ) {
        const device = audioOutputs.find(
          (output) => output.deviceId === headphoneOutputSelect.value,
        );
        localStorage.setItem(
          "tanda-headphone-output",
          headphoneOutputSelect.value,
        );
        if (device?.label) {
          localStorage.setItem("tanda-headphone-output-label", device.label);
        }
        if (device?.groupId) {
          localStorage.setItem("tanda-headphone-output-group", device.groupId);
        }
      } else {
        localStorage.removeItem("tanda-headphone-output");
        localStorage.removeItem("tanda-headphone-output-label");
        localStorage.removeItem("tanda-headphone-output-group");
        await ensureAudioOutputs();
        renderAllLists();
      }
    });
  }

  trackEditorTapBtn?.addEventListener("click", () => {
    handleTapTempo();
  });
  trackEditorSingerInput?.addEventListener("input", () => {
    if (!trackEditorVocalInput) {
      return;
    }
    if (
      trackEditorSingerInput.value.trim().length > 0 &&
      trackEditorVocalInput.value === "instrumental"
    ) {
      trackEditorVocalInput.value = "sung";
    }
  });
  trackEditorResetBtn?.addEventListener("click", () => {
    resetTrackEditorFields();
  });
  trackEditorCancelBtn?.addEventListener("click", () => {
    setTrackEditorOpen(false);
    trackEditorState.track = null;
    resetTapTempo();
  });
  trackEditorSaveBtn?.addEventListener("click", async () => {
    if (!window.tanda || !trackEditorState.track) {
      return;
    }
    const payload = {
      id: trackEditorState.track.id,
      title: trackEditorTitleInput?.value ?? "",
      artist: trackEditorArtistInput?.value ?? "",
      singer: trackEditorSingerInput?.value ?? "",
      instrumental: trackEditorVocalInput?.value === "instrumental",
      album: trackEditorAlbumInput?.value ?? "",
      year: trackEditorYearInput?.value ?? "",
      genre: trackEditorGenreInput?.value ?? "",
      notes: trackEditorNotesInput?.value ?? "",
      bpm:
        trackEditorBpmInput?.value && trackEditorBpmInput.value.trim().length > 0
          ? Number.parseFloat(trackEditorBpmInput.value)
          : null,
    };
    try {
      const updated = await window.tanda.updateTrack(payload);
      if (!updated) {
        setStatus(t("statusTrackUpdateFailed"));
        return;
      }
      updateTrackCaches(updated);
      setStatus(t("statusTrackUpdated"));
      setTrackEditorOpen(false);
      trackEditorState.track = null;
      resetTapTempo();
      await loadStyles();
      await refreshSearch();
      renderAllLists();
    } catch {
      setStatus(t("statusTrackUpdateFailed"));
    }
  });

  attachModalDrag(trackEditor);
  attachModalDrag(cortinaModal);

  window.tanda.onScanProgress((progress) => {
    if (progressEl) {
      progressEl.max = progress.total || 1;
      progressEl.value = progress.current;
    }
    if (progressLabel) {
      progressLabel.textContent = t("statusScanProgress", {
        current: progress.current,
        total: progress.total,
        root: progress.rootLabel,
      });
    }
    if (progressElSettings) {
      progressElSettings.max = progress.total || 1;
      progressElSettings.value = progress.current;
    }
    if (progressLabelSettings) {
      progressLabelSettings.textContent = t("statusScanProgress", {
        current: progress.current,
        total: progress.total,
        root: progress.rootLabel,
      });
    }
  });

  closeSettingsBtn?.addEventListener("click", () => setSettingsOpen(false));
  openSettingsBtn?.addEventListener("click", () => setSettingsOpen(true));
  fullscreenToggle?.addEventListener("click", async () => {
    if (!window.tanda?.toggleFullscreen) {
      setStatus(t("statusFullscreenUnavailable"));
      return;
    }
    try {
      await window.tanda.toggleFullscreen();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? t("statusFullscreenFailedDetail", { message: error.message })
          : t("statusFullscreenFailed"),
      );
    }
  });
  nowPlayingSection?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest("#waveform-container")) {
      return;
    }
    if (appMode !== "prep" && appMode !== "edit") {
      return;
    }
    const isHeadphonePlaying =
      playback.headphone.active && !playback.headphone.active.paused;
    const isMainPlaying = playback.main.active && !playback.main.active.paused;
    if (!isHeadphonePlaying && !isMainPlaying) {
      return;
    }
    const fadeMs = getStopFadeSeconds() * 1000;
    const active = getNowPlayingState();
    if (active?.channel === "headphone") {
      await stopChannelPlayback("headphone", fadeMs);
      return;
    }
    await stopChannelPlayback("main", fadeMs);
  });
  waveformContainer?.addEventListener("click", (event) => {
    event.stopPropagation();
    seekToWaveformPosition(event);
  });
  openDiagnosticsMain?.addEventListener("click", () => {
    setSettingsOpen(true);
    activateSettingsTab("diagnostics");
  });
  openDiagnosticsSettings?.addEventListener("click", () => {
    setSettingsOpen(true);
    activateSettingsTab("diagnostics");
  });

  diagnosticsWaveformBtn?.addEventListener("click", async () => {
    if (!diagnosticsWaveformResult) {
      return;
    }
    const active = getNowPlayingState();
    const trackId = active?.state.track?.id ?? null;
    if (!trackId) {
      diagnosticsWaveformResult.textContent = t("diagnosticsWaveformNoTrack");
      return;
    }
    diagnosticsWaveformResult.textContent = t("statusWaveformLoading");
    const result = await window.tanda?.generateWaveform(trackId);
    if (result?.ok) {
      diagnosticsWaveformResult.textContent = t("diagnosticsWaveformSuccess", {
        path: result.path ?? "",
      });
      void updateWaveformSource(trackId);
      return;
    }
    diagnosticsWaveformResult.textContent = t("diagnosticsWaveformFailed", {
      message: result?.error ?? t("statusUnknownError"),
    });
  });

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (!tab) {
        return;
      }
      activateSettingsTab(tab);
    });
  });

  playlistStartBtn?.addEventListener("click", () => {
    startPlaylistPlayback();
  });
  playlistResumeBtn?.addEventListener("click", () => {
    resumePlaylistPlayback();
  });
  playlistStopBtn?.addEventListener("click", () => {
    void stopPlaylistPlayback();
  });

  addMusicBtn?.addEventListener("click", async () => {
    const selected = await window.tanda?.pickRoot("music");
    if (!selected) {
      return;
    }
    await window.tanda?.addRoot("music", selected);
    setStatus(t("statusAddedMusic", { path: selected }));
    await renderRoots();
    await updateLegacyImport(selected);
  });

  addCortinaBtn?.addEventListener("click", async () => {
    const selected = await window.tanda?.pickRoot("cortina");
    if (!selected) {
      return;
    }
    await window.tanda?.addRoot("cortina", selected);
    setStatus(t("statusAddedCortina", { path: selected }));
    await renderRoots();
    await updateLegacyImport(selected);
  });

  dataLocationChooseBtn?.addEventListener("click", async () => {
    if (!window.tanda) {
      return;
    }
    if (playlistPlayback.status !== "idle") {
      setStatus(t("statusDataLocationDuringPlayback"));
      return;
    }
    const selected = await window.tanda.pickDataLocation();
    if (!selected) {
      return;
    }
    const confirmed = window.confirm(
      t("confirmDataLocationChange", { path: selected }),
    );
    if (!confirmed) {
      return;
    }
    const result = await window.tanda.setDataLocation(selected);
    setStatus(t("statusDataLocationChanged", { path: result.path }));
    trackCache.clear();
    tandaCache.clear();
    clipboardTracks = [];
    clipboardTandas = [];
    playlistItems = [null];
    playlistPlayback.status = "idle";
    playlistPlayback.resume = null;
    playlistPlayback.currentIndex = 0;
    playlistPlayback.currentTrackIndex = 0;
    playlistPlayback.playedThroughIndex = -1;
    playlistPlayback.activeTrackId = null;
    playlistPlayback.activeTandaId = null;
    playlistPlayback.liveBaseStartMs = null;
    clearPlaylistTarget();
    resetCortinaPlans();
    localStorage.removeItem(PLAYLIST_STORAGE_KEY);
    await renderRoots();
    await renderDataLocation();
    await updateLegacyImport(result.path);
    renderClipboard();
    renderPlaylist();
    refreshSearch();
  });

  legacyImportButton?.addEventListener("click", async () => {
    if (!window.tanda || !legacyImportRootPath) {
      return;
    }
    const confirmed = window.confirm(
      t("confirmLegacyImport", { path: legacyImportRootPath }),
    );
    if (!confirmed) {
      return;
    }
    const result = await window.tanda.importLegacy(legacyImportRootPath);
    setStatus(
      t("statusLegacyImportDone", {
        tandas: result.tandasImported,
        tracks: result.tracksUpdated,
        missing: result.missingTracks,
      }),
    );
    await updateLegacyImport(result.rootPath);
    refreshSearch();
  });

  const runScan = async (kind: "music" | "cortina") => {
    if (scanRequestInFlight) {
      setStatus(t("statusScanInProgress"));
      return;
    }
    scanRequestInFlight = true;
    if (scanMusicBtn) {
      scanMusicBtn.disabled = true;
    }
    if (scanCortinasBtn) {
      scanCortinasBtn.disabled = true;
    }
    clearAlert();
    setStatus(t("statusScanning"));
    if (progressLabel) {
      progressLabel.textContent = t("statusPreparingScan");
    }
    if (progressLabelSettings) {
      progressLabelSettings.textContent = t("statusPreparingScan");
    }
    if (progressEl) {
      progressEl.value = 0;
      progressEl.max = 1;
    }
    if (progressElSettings) {
      progressElSettings.value = 0;
      progressElSettings.max = 1;
    }
    try {
      const summary = await window.tanda?.scanKind(kind);
      if (!summary) {
        setStatus(t("statusScanFailedNoResponse"));
        return;
      }
      if (summary.inProgress) {
        setStatus(t("statusScanInProgress"));
        return;
      }
      setStatus(
        t("statusScanComplete", {
          scanned: summary.scanned,
          added: summary.added,
          updated: summary.updated,
          removed: summary.removed,
        }),
      );
      if (progressLabel) {
        progressLabel.textContent = t("statusScanIssues", {
          count: summary.errors.length,
        });
      }
      if (progressLabelSettings) {
        progressLabelSettings.textContent = t("statusScanIssues", {
          count: summary.errors.length,
        });
      }
      if (errorList) {
        errorList.innerHTML = "";
        summary.errors.slice(0, 50).forEach((error) => {
          const li = document.createElement("li");
          li.textContent = `${error.filePath}: ${error.message}`;
          errorList.appendChild(li);
        });
        if (summary.errors.length > 50) {
          const li = document.createElement("li");
          li.textContent = t("scanIssuesMore", {
            count: summary.errors.length - 50,
          });
          errorList.appendChild(li);
        }
      }
      await loadStyles();
      await loadCortinaSets();
      if (kind === "music") {
        await refreshNewCollectionTracks();
      }
      await refreshSearch();
      renderAllLists();
    } catch (error) {
      if (error instanceof Error && error.message === "SCAN_IN_PROGRESS") {
        setStatus(t("statusScanInProgress"));
        return;
      }
      setStatus(
        error instanceof Error
          ? t("statusScanFailedDetail", { message: error.message })
          : t("statusScanFailed"),
      );
    } finally {
      scanRequestInFlight = false;
      if (scanMusicBtn) {
        scanMusicBtn.disabled = false;
      }
      if (scanCortinasBtn) {
        scanCortinasBtn.disabled = false;
      }
    }
  };

  scanMusicBtn?.addEventListener("click", () => runScan("music"));
  scanCortinasBtn?.addEventListener("click", () => runScan("cortina"));

  resetDbBtn?.addEventListener("click", async () => {
    const result = await window.tanda?.resetDatabase();
    if (result?.ok) {
      setStatus(t("statusDatabaseErased"));
      await renderRoots();
      await loadStyles();
      await refreshSearch();
      renderAllLists();
    }
  });

  searchInput?.addEventListener("input", () => {
    scheduleSearch();
  });

  searchButton?.addEventListener("click", () => {
    refreshSearch();
  });

  searchSortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const sort = button.dataset.sort;
      if (!sort) {
        return;
      }
      if (searchState.sortBy === sort) {
        searchState.sortDir = searchState.sortDir === "asc" ? "desc" : "asc";
      } else {
        searchState.sortBy = sort;
        searchState.sortDir = "asc";
      }
      searchState.sortMode = "manual";
      updateSortButtons();
      refreshSearch();
    });
  });

  searchListBody?.addEventListener("scroll", () => {
    handleSearchScroll();
  });
  searchListBody?.addEventListener("wheel", () => {
    handleSearchScroll();
  });

  clipPanel?.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  clipPanel?.addEventListener("drop", (event) => {
    handleDropToClipboard(event as DragEvent);
  });

  clipTandasEl?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".list-row");
    const tandaId = row?.dataset.tandaId;
    if (!tandaId) {
      return;
    }
    if (
      target.closest(".tanda-summary") ||
      target.classList.contains("tanda-style-badge")
    ) {
      if (row) {
        toggleTandaRow(row);
      }
      return;
    }
    const editTrackId = target
      .closest<HTMLElement>(".tanda-detail-line")
      ?.dataset.trackId;
    const editAction =
      (target.closest("button[data-action]") as HTMLButtonElement | null)
        ?.dataset.action ?? null;
    if (editAction === "detail-menu") {
      const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
      if (detailLine) {
        if (detailLine.classList.contains("detail-menu-open")) {
          detailLine.classList.remove("detail-menu-open");
        } else {
          closeDetailMenus();
          detailLine.classList.add("detail-menu-open");
        }
      }
      return;
    }
    if (editAction === "edit-track" && editTrackId) {
      openTrackEditor(editTrackId);
      closeRowMenus();
      return;
    }
    if (editAction === "headphone" && headphoneAvailable && editTrackId) {
      const track = trackCache.get(editTrackId);
      if (track) {
        await playOnChannel(
          "headphone",
          track.full_path,
          track.id,
          track,
          track.gain_db ?? null,
        );
      }
      closeRowMenus();
      return;
    }
    if (editTrackId) {
      const track = trackCache.get(editTrackId);
      if (track) {
        await playTrackForMode(track, {
          filePath: track.full_path,
          trackId: track.id,
          gainDb: track.gain_db ?? null,
        });
      }
      return;
    }
    const action =
      (target.closest("button[data-action]") as HTMLButtonElement | null)
        ?.dataset.action ?? null;
    if (action === "detail-menu") {
      const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
      if (detailLine) {
        if (detailLine.classList.contains("detail-menu-open")) {
          detailLine.classList.remove("detail-menu-open");
        } else {
          closeDetailMenus();
          detailLine.classList.add("detail-menu-open");
        }
      }
      return;
    }
    if (action === "tanda-toggle" && row) {
      toggleTandaRow(row);
      closeRowMenus();
      return;
    }
    if (action === "tanda-edit") {
      const source = clipboardTandas.find((item) => item.id === tandaId) ?? null;
      openTandaInDesigner(tandaId, source, "playlist-tab");
      closeRowMenus();
      return;
    }
    if (action === "search-tanda") {
      const tanda = resolveTandaForSearch(tandaId);
      if (tanda) {
        runSearchForTanda(tanda);
      }
      closeRowMenus();
      return;
    }
    if (action === "row-menu") {
      toggleRowMenu(row);
      return;
    }
    if (action === "add-playlist-tanda") {
      const found = clipboardTandas.find((item) => item.id === tandaId) ?? null;
      addTandaToPlaylist(tandaId, found);
      closeRowMenus();
      return;
    }
    if (action === "remove-clip-tanda") {
      removeClipboardTanda(tandaId);
      renderClipboard();
      closeRowMenus();
      return;
    }
    const found = clipboardTandas.find((item) => item.id === tandaId);
    if (!found) {
      return;
    }
    selectedClipboardTandaId = tandaId;
    selectedClipboardTrackId = null;
    renderClipboard();
  });

  playlistPanel?.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  playlistPanel?.addEventListener("drop", (event) => {
    handleDropToPlaylist(event as DragEvent);
  });

  addTandaBtn?.addEventListener("click", () => {
    const draft = createEmptyTanda();
    tandaDrafts = [...tandaDrafts, draft];
    setActiveTanda(draft.id);
  });

  tandaListEl?.addEventListener("click", (event) => {
    void handleTandaAction(event);
  });
  playlistTandaEditorEl?.addEventListener("click", (event) => {
    void handleTandaAction(event);
  });
  tandaListEl?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      return;
    }
    const row = target.closest<HTMLElement>(".tanda-track-row");
    const trackId = row?.dataset.trackId;
    if (!trackId) {
      return;
    }
    const track = trackCache.get(trackId);
    if (!track) {
      return;
    }
    await playTrackForMode(track, {
      filePath: track.full_path,
      trackId: track.id,
      gainDb: track.gain_db ?? null,
    });
  });
  playlistTandaEditorEl?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      return;
    }
    const row = target.closest<HTMLElement>(".tanda-track-row");
    const trackId = row?.dataset.trackId;
    if (!trackId) {
      return;
    }
    const track = trackCache.get(trackId);
    if (!track) {
      return;
    }
    await playTrackForMode(track, {
      filePath: track.full_path,
      trackId: track.id,
      gainDb: track.gain_db ?? null,
    });
  });

  tandaListEl?.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  tandaListEl?.addEventListener("drop", (event) => {
    handleDropToTanda(event as DragEvent);
  });
  playlistTandaEditorEl?.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  playlistTandaEditorEl?.addEventListener("drop", (event) => {
    handleDropToTanda(event as DragEvent);
  });

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".row-actions") || target?.closest(".tanda-detail-actions-right")) {
      return;
    }
    closeRowMenus();
    closeDetailMenus();
  });

  panelTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.dataset.tab;
      if (!tabId) {
        return;
      }
      const panel = button.closest(".panel");
      if (!panel) {
        return;
      }
      const tabBar = button.closest(".tab-bar");
      tabBar
        ?.querySelectorAll<HTMLButtonElement>("button")
        .forEach((btn) => btn.classList.remove("active"));
      panel
        .querySelectorAll<HTMLElement>(".tab-panel, .list-rows")
        .forEach((list) => list.classList.remove("active"));
      button.classList.add("active");
      const targetPanel = panel.querySelector<HTMLElement>(`#${tabId}`);
      if (targetPanel) {
        targetPanel.classList.add("active");
        if (targetPanel.classList.contains("tab-panel")) {
          targetPanel
            .querySelectorAll<HTMLElement>(".list-rows")
            .forEach((list) => list.classList.add("active"));
        }
      }
      if (tabId === "search-tracks" || tabId === "search-tandas") {
        activeSearchTab = tabId as SearchTab;
        updateSearchTabVisibility();
      }
      if (tabId === "tanda-designer-tab" || tabId === "playlist-tab") {
        activeRightTab = tabId as RightPanelTab;
        renderTandaDesigner();
      }
    });
  });

  searchTracksEl?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".list-row");
    if (!row) {
      return;
    }
    const data = getTrackDataFromRow(row);
    if (!data) {
      return;
    }
    const track = resolveTrackById(data.trackId);
    if (!track) {
      return;
    }
    const action =
      (target.closest("button[data-action]") as HTMLButtonElement | null)
        ?.dataset.action ?? null;
    if (action === "edit-track") {
      openTrackEditor(data.trackId);
      closeRowMenus();
      return;
    }
    if (action === "search-track") {
      runSearchQuery(buildSearchQueryForTrack(track));
      closeRowMenus();
      return;
    }
    if (action === "headphone" && headphoneAvailable) {
      const isPlaying = await playOnChannel(
        "headphone",
        data.filePath,
        data.trackId,
        track,
        data.gainDb,
      );
      document
        .querySelectorAll(".headphone-button.active")
        .forEach((button) => button.classList.remove("active"));
      if (isPlaying) {
        target.classList.add("active");
      }
      closeRowMenus();
      return;
    }
    if (action === "row-menu") {
      toggleRowMenu(row);
      return;
    }
    if (action === "add-clip") {
      addTrackToClipboard(track);
      activatePanelTab(clipPanel, "clip-tracks");
      closeRowMenus();
      return;
    }
    if (action === "add-playlist-track") {
      appendTrackToPlaylist(track);
      closeRowMenus();
      return;
    }
    if (action === "add-tanda") {
      const added = addTrackToActiveTanda(track);
      if (!added) {
        setStatus(t("statusNoTandaSelected"));
      }
      closeRowMenus();
      return;
    }
    await playTrackForMode(track, {
      filePath: data.filePath,
      trackId: data.trackId,
      gainDb: data.gainDb,
    });
  });

  searchTandasEl?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".list-row");
    if (!row) {
      return;
    }
    if (
      target.closest(".tanda-summary") ||
      target.classList.contains("tanda-style-badge")
    ) {
      toggleTandaRow(row);
      return;
    }
    const editTrackId = target
      .closest<HTMLElement>(".tanda-detail-line")
      ?.dataset.trackId;
    const editAction =
      (target.closest("button[data-action]") as HTMLButtonElement | null)
        ?.dataset.action ?? null;
    if (editAction === "detail-menu") {
      const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
      if (detailLine) {
        if (detailLine.classList.contains("detail-menu-open")) {
          detailLine.classList.remove("detail-menu-open");
        } else {
          closeDetailMenus();
          detailLine.classList.add("detail-menu-open");
        }
      }
      return;
    }
    if (editAction === "edit-track" && editTrackId) {
      openTrackEditor(editTrackId);
      return;
    }
    if (editAction === "headphone" && headphoneAvailable && editTrackId) {
      const track = trackCache.get(editTrackId);
      if (track) {
        void playOnChannel(
          "headphone",
          track.full_path,
          track.id,
          track,
          track.gain_db ?? null,
        );
      }
      return;
    }
    if (editTrackId && appMode !== "live") {
      const track = trackCache.get(editTrackId);
      if (track) {
        void playOnChannel(
          "main",
          track.full_path,
          track.id,
          track,
          track.gain_db ?? null,
        );
      }
      return;
    }
    const tandaId = row.dataset.tandaId;
    if (!tandaId) {
      return;
    }
    const action =
      (target.closest("button[data-action]") as HTMLButtonElement | null)
        ?.dataset.action ?? null;
    if (action === "tanda-toggle") {
      const source = tandaCache.get(tandaId) ?? null;
      openTandaInDesigner(tandaId, source, "playlist-tab");
      closeRowMenus();
      return;
    }
    if (action === "tanda-edit") {
      const source = resolveTandaForSearch(tandaId);
      openTandaInDesigner(tandaId, source);
      closeRowMenus();
      return;
    }
    if (action === "search-tanda") {
      const tanda = resolveTandaForSearch(tandaId);
      if (tanda) {
        runSearchForTanda(tanda);
      }
      closeRowMenus();
      return;
    }
    if (action === "add-clip-tanda") {
      addTandaToClipboard(tandaId);
      activatePanelTab(clipPanel, "clip-tandas");
      closeRowMenus();
      return;
    }
    if (action === "add-playlist-tanda") {
      const source = resolveTandaForSearch(tandaId);
      addTandaToPlaylist(tandaId, source);
      closeRowMenus();
      return;
    }
    if (action === "row-menu") {
      toggleRowMenu(row);
      return;
    }
  });

  clipTracksEl?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".list-row");
    if (!row) {
      return;
    }
    const data = getTrackDataFromRow(row);
    if (!data) {
      return;
    }
    const clipTrack = resolveTrackById(data.trackId);
    if (!clipTrack) {
      return;
    }
    const action =
      (target.closest("button[data-action]") as HTMLButtonElement | null)
        ?.dataset.action ?? null;
    if (action === "edit-track") {
      openTrackEditor(data.trackId);
      closeRowMenus();
      return;
    }
    if (action === "search-track") {
      runSearchQuery(buildSearchQueryForTrack(clipTrack));
      closeRowMenus();
      return;
    }
    if (action === "headphone" && headphoneAvailable) {
      const isPlaying = await playOnChannel(
        "headphone",
        data.filePath,
        data.trackId,
        clipTrack,
        data.gainDb,
      );
      document
        .querySelectorAll(".headphone-button.active")
        .forEach((button) => button.classList.remove("active"));
      if (isPlaying) {
        target.classList.add("active");
      }
      closeRowMenus();
      return;
    }
    if (action === "row-menu") {
      toggleRowMenu(row);
      return;
    }
    if (action === "add-tanda") {
      const added = addTrackToActiveTanda(clipTrack);
      if (!added) {
        setStatus(t("statusNoTandaSelected"));
      }
      closeRowMenus();
      return;
    }
    if (action === "add-playlist-track") {
      appendTrackToPlaylist(clipTrack);
      closeRowMenus();
      return;
    }
    if (action === "remove-clip") {
      removeClipboardTrack(clipTrack.id);
      renderClipboard();
      closeRowMenus();
      return;
    }
    const index = clipboardTracks.findIndex((item) => item.id === data.trackId);
    if (index >= 0) {
      selectedClipboardTrackId = data.trackId;
      selectedClipboardTandaId = null;
      renderClipboard();
    }
    await playTrackForMode(clipTrack, {
      filePath: data.filePath,
      trackId: data.trackId,
      gainDb: data.gainDb,
    });
  });

  playlistListEl?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".list-row");
    if (!row) {
      return;
    }
    if (row.classList.contains("cortina-row")) {
      const action =
        (target.closest("button[data-action]") as HTMLButtonElement | null)
          ?.dataset.action ?? null;
      if (action === "headphone" && headphoneAvailable) {
        const data = getTrackDataFromRow(row);
        if (data) {
          const track = resolveTrackById(data.trackId);
          if (track) {
            await playOnChannel(
              "headphone",
              data.filePath,
              data.trackId,
              track,
              data.gainDb,
            );
          }
        }
        return;
      }
      const index = row.dataset.cortinaIndex
        ? Number.parseInt(row.dataset.cortinaIndex, 10)
        : null;
      if (!isCortinaIndexEditable(index)) {
        setStatus(t("statusCortinaLocked"));
        return;
      }
      openCortinaModal(Number.isNaN(index ?? NaN) ? null : index);
      return;
    }
    if (
      target.closest(".tanda-summary") ||
      target.classList.contains("tanda-style-badge")
    ) {
      toggleTandaRow(row);
      return;
    }
    const detailAction =
      (target.closest("button[data-action]") as HTMLButtonElement | null)
        ?.dataset.action ?? null;
    if (detailAction === "detail-menu") {
      const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
      if (detailLine) {
        if (detailLine.classList.contains("detail-menu-open")) {
          detailLine.classList.remove("detail-menu-open");
        } else {
          closeDetailMenus();
          detailLine.classList.add("detail-menu-open");
        }
      }
      return;
    }
    const action =
      (target.closest("button[data-action]") as HTMLButtonElement | null)
        ?.dataset.action ?? null;
    if (action === "edit-track") {
      const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
      const detailTrackId = detailLine?.dataset.trackId;
      const trackId = detailTrackId ?? row.dataset.trackId;
      if (trackId) {
        openTrackEditor(trackId);
      }
      closeRowMenus();
      return;
    }
    if (action === "headphone" && headphoneAvailable) {
      const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
      const detailTrackId = detailLine?.dataset.trackId;
      if (detailTrackId) {
        const track = trackCache.get(detailTrackId);
        if (track) {
          await playOnChannel(
            "headphone",
            track.full_path,
            track.id,
            track,
            track.gain_db ?? null,
          );
        }
        closeRowMenus();
        return;
      }
    }
    if (action === "search-tanda") {
      const tandaId = row.dataset.tandaId;
      if (tandaId) {
        const tanda = resolveTandaForSearch(tandaId);
        if (tanda) {
        runSearchForTanda(tanda);
        }
      }
      closeRowMenus();
      return;
    }
    if (action === "search-track") {
      const data = getTrackDataFromRow(row);
      const track = data ? resolveTrackById(data.trackId) : null;
      if (track) {
        runSearchQuery(buildSearchQueryForTrack(track));
      }
      closeRowMenus();
      return;
    }
    if (action === "row-menu") {
      toggleRowMenu(row);
      return;
    }
    if (action === "playlist-target-cancel") {
      clearPlaylistTarget();
      renderPlaylist();
      return;
    }
    if (action === "tanda-toggle") {
      toggleTandaRow(row);
      closeRowMenus();
      return;
    }
    if (action === "mark-playlist-target") {
      const index = row.dataset.index ? Number.parseInt(row.dataset.index, 10) : -1;
      if (index < 0) {
        return;
      }
      if (isPlaylistIndexLocked(index)) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      if (playlistTargetIndex === index) {
        clearPlaylistTarget();
      } else {
        playlistTargetIndex = index;
        applyPlaylistTargetStyles(index);
      }
      renderPlaylist();
      closeRowMenus();
      return;
    }
    if (action === "tanda-edit") {
      const tandaId = row.dataset.tandaId;
      if (!tandaId) {
        return;
      }
      const index = row.dataset.index ? Number.parseInt(row.dataset.index, 10) : -1;
      const isLocked = index >= 0 ? isPlaylistIndexLocked(index) : false;
      if (isLocked) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      const source =
        index >= 0
          ? ensurePlaylistEditableTanda(tandaId, index)
          : resolveTandaDraft(tandaId) ?? createPlaceholderTanda(tandaId);
      if (!source) {
        return;
      }
      const effectiveId = source.id;
      openTandaInDesigner(effectiveId, source);
      closeRowMenus();
      return;
    }
    const data = getTrackDataFromRow(row);
    if (action === "headphone" && headphoneAvailable && data) {
      const playlistTrack = resolveTrackById(data.trackId);
      const isPlaying = await playOnChannel(
        "headphone",
        data.filePath,
        data.trackId,
        playlistTrack,
        data.gainDb,
      );
      document
        .querySelectorAll(".headphone-button.active")
        .forEach((button) => button.classList.remove("active"));
      if (isPlaying) {
        target.classList.add("active");
      }
      closeRowMenus();
      return;
    }
    const index = row.dataset.index ? Number.parseInt(row.dataset.index, 10) : -1;
    const isLocked = index >= 0 ? isPlaylistIndexLocked(index) : false;
    if (index < 0) {
      return;
    }
    const playlistItem = playlistItems[index] ?? null;
    if (!playlistItem) {
      if (isLocked) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      const rule = getRuleForSlot(index);
      if (rule?.code && rule.code !== "*" && rule.code !== "ANY") {
        const mappedStyles = getPlaylistStyleMap()[rule.code] ?? [];
        selectedStyles = [...mappedStyles];
        loadStyles();
        updateSearchTabVisibility();
        refreshSearch();
        activatePanelTab(getSearchPanel(), "search-tracks");
        activeSearchTab = "search-tracks";
      }
      const tanda = createPlaylistTandaForSlot(index);
      ensureTandaDraft(tanda);
      playlistItems[index] = { kind: "tanda", tandaId: tanda.id };
      normalizePlaylist();
      playlistOpenTandaIndex = index;
      openTandaInDesigner(tanda.id, tanda, "playlist-tab");
      markPlaylistPulse(index);
      renderPlaylist();
      closeRowMenus();
      return;
    }
    if (action === "remove-playlist-tanda") {
      if (isLocked) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      const tandaId = row.dataset.tandaId;
      if (!tandaId) {
        return;
      }
      if (!addTandaToActiveCollection(tandaId)) {
        closeRowMenus();
        return;
      }
      playlistItems[index] = null;
      normalizePlaylist();
      renderPlaylist();
      renderClipboard();
      closeRowMenus();
      return;
    }
    if (action === "send-playlist-tanda") {
      if (isLocked) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      const tandaId = row.dataset.tandaId;
      if (!tandaId) {
        return;
      }
      if (!addTandaToActiveCollection(tandaId)) {
        closeRowMenus();
        return;
      }
      playlistItems[index] = null;
      normalizePlaylist();
      renderPlaylist();
      renderClipboard();
      closeRowMenus();
      return;
    }
    if (action === "send-playlist-track") {
      if (isLocked) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      if (!data) {
        return;
      }
      const track = resolveTrackById(data.trackId);
      if (!track) {
        return;
      }
      if (!addTrackToActiveCollection(track)) {
        closeRowMenus();
        return;
      }
      playlistItems[index] = null;
      normalizePlaylist();
      renderPlaylist();
      renderClipboard();
      closeRowMenus();
      return;
    }
    if (action === "send-playlist-tanda-track") {
      if (isLocked) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      const tandaId = row.dataset.tandaId;
      if (!tandaId) {
        return;
      }
      const index = row.dataset.index ? Number.parseInt(row.dataset.index, 10) : -1;
      const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
      const slotIndexRaw = detailLine?.dataset.slotIndex;
      const slotIndex = slotIndexRaw ? Number.parseInt(slotIndexRaw, 10) : -1;
      if (slotIndex < 0) {
        return;
      }
      const resolvedIndex =
        row.dataset.index ? Number.parseInt(row.dataset.index, 10) : -1;
      const tanda =
        resolvedIndex >= 0
          ? ensurePlaylistEditableTanda(tandaId, resolvedIndex)
          : resolveTandaDraft(tandaId);
      if (!tanda) {
        return;
      }
      const trackId = tanda.trackSlots[slotIndex];
      if (trackId) {
        const track = trackCache.get(trackId);
        if (track) {
          if (!addTrackToActiveCollection(track)) {
            closeRowMenus();
            return;
          }
        }
      }
      tanda.trackSlots[slotIndex] = null;
      const tracks = tanda.trackSlots.map((id) =>
        id ? trackCache.get(id) ?? null : null,
      );
      const derivedStyles = collectStylesFromTracks(tracks, availableStyles);
      const normalizedExisting = tanda.styles
        .map((style) => normalizeStyleName(style))
        .map((normalized) =>
          availableStyles.find(
            (style) => normalizeStyleName(style) === normalized,
          ),
        )
        .filter(Boolean) as string[];
      tanda.styles = Array.from(new Set([...normalizedExisting, ...derivedStyles]));
      if (selectedTandaId === tanda.id) {
        selectedStyles = [...tanda.styles];
        loadStyles();
        updateSearchTabVisibility();
        refreshSearch();
      }
      if (resolvedIndex >= 0) {
        playlistTargetIndex = resolvedIndex;
        playlistOpenTandaIndex = resolvedIndex;
        applyPlaylistTargetStyles(resolvedIndex);
        openTandaInDesigner(tanda.id, tanda, "playlist-tab");
      }
      renderPlaylist();
      renderClipboard();
      closeRowMenus();
      return;
    }
    const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
    const detailTrackId = detailLine?.dataset.trackId ?? null;
    if (selectedClipboardTandaId && !detailLine) {
      if (isLocked) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      const activeCollection = getActiveCollection();
      if (!activeCollection?.tandaIds.includes(selectedClipboardTandaId)) {
        setStatus(t("statusClipboardReadonlyRemove"));
        return;
      }
      const selectedTanda =
        clipboardTandas.find((item) => item.id === selectedClipboardTandaId) ??
        null;
      if (!selectedTanda) {
        selectedClipboardTandaId = null;
        renderClipboard();
        return;
      }
      if (!tandaDrafts.some((item) => item.id === selectedTanda.id)) {
        tandaDrafts = [...tandaDrafts, selectedTanda];
      }
      const replaced = playlistItems[index];
      const placed = placeTandaInPlaylistSlot(selectedTanda.id, index);
      if (!placed) {
        return;
      }
      if (replaced?.kind === "tanda") {
        if (!activeCollection.tandaIds.includes(replaced.tandaId)) {
          activeCollection.tandaIds.push(replaced.tandaId);
        }
      } else if (replaced?.kind === "track") {
        if (!activeCollection.trackIds.includes(replaced.track.id)) {
          activeCollection.trackIds.push(replaced.track.id);
        }
      } else {
        activeCollection.tandaIds = activeCollection.tandaIds.filter(
          (id) => id !== selectedTanda.id,
        );
      }
      selectedClipboardTandaId = null;
      saveClipboardCollections();
      renderClipboard();
      renderPlaylist();
      return;
    }
    if (appMode === "edit" || appMode === "prep") {
      if (detailTrackId) {
        const track = trackCache.get(detailTrackId);
        if (track) {
          await playTrackForMode(track, {
            filePath: track.full_path,
            trackId: track.id,
            gainDb: track.gain_db ?? null,
          });
        }
        return;
      }
      if (playlistItem?.kind === "track" && data) {
        await playTrackForMode(playlistItem.track, {
          filePath: data.filePath,
          trackId: data.trackId,
          gainDb: data.gainDb,
        });
        return;
      }
    }
    const mainActive = playback.main.active;
    const isMainPlaying = !!mainActive && !mainActive.paused;
    if (!selectedClipboardTrackId || detailLine) {
      if (appMode === "live" && isMainPlaying) {
        return;
      }
      if (!isMainPlaying) {
        startPlaylistFrom(index, detailTrackId);
        return;
      }
      const item = playlistItems[index];
      if (item?.kind === "track" && data) {
        await playOnChannel(
          "main",
          data.filePath,
          data.trackId,
          item.track,
          data.gainDb,
        );
      }
      return;
    }
    if (isLocked) {
      setStatus(t("statusPlaylistLocked"));
      return;
    }
    const clipTrack = clipboardTracks.find(
      (track) => track.id === selectedClipboardTrackId,
    );
    if (!clipTrack) {
      return;
    }
    if (playlistItem?.kind === "tanda") {
      return;
    }
    const activeCollection = getActiveCollection();
    if (!activeCollection || !activeCollection.trackIds.includes(clipTrack.id)) {
      setStatus(t("statusClipboardReadonlyRemove"));
      return;
    }
    const selectedIndex = activeCollection.trackIds.indexOf(clipTrack.id);
    if (playlistItem?.kind === "track") {
      if (activeCollection.trackIds.includes(playlistItem.track.id)) {
        activeCollection.trackIds = activeCollection.trackIds.filter(
          (id) => id !== clipTrack.id,
        );
      } else if (selectedIndex >= 0) {
        activeCollection.trackIds[selectedIndex] = playlistItem.track.id;
      }
      playlistItems[index] = { kind: "track", track: clipTrack };
    } else {
      playlistItems[index] = { kind: "track", track: clipTrack };
      activeCollection.trackIds = activeCollection.trackIds.filter(
        (id) => id !== clipTrack.id,
      );
    }
    markPlaylistPulse(index);
    selectedClipboardTrackId = null;
    saveClipboardCollections();
    renderClipboard();
    renderPlaylist();
  });

  applyTranslations();
  ensureCortinaDurationDefault();
  await renderDiagnosticsPaths();
  updateSearchTabVisibility();
  await ensureAudioOutputs();
  if (navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", async () => {
      await ensureAudioOutputs();
      renderAllLists();
    });
  }
  document.addEventListener("pointerdown", markUserInteraction, {
    passive: true,
  });
  document.addEventListener("keydown", markUserInteraction);
  document.addEventListener("wheel", markUserInteraction, { passive: true });
  document.addEventListener("touchstart", markUserInteraction, {
    passive: true,
  });
  playlistListEl?.addEventListener("scroll", markUserInteraction, {
    passive: true,
  });
  window.addEventListener("beforeunload", (event) => {
    if (allowAppClose) {
      return;
    }
    const isHeadphonePlaying =
      playback.headphone.active && !playback.headphone.active.paused;
    const isMainPlaying = playback.main.active && !playback.main.active.paused;
    if (!isHeadphonePlaying && !isMainPlaying) {
      return;
    }
    event.preventDefault();
    event.returnValue = "";
  });
  await renderRoots();
  await renderDataLocation();
  await updateLegacyImport();
  await ensureDefaultStyles("init");
  await loadStyles();
  await loadCortinaSets();
  await refreshSearch();
  await loadPlaylistFromStorage();
  renderAllLists();
  window.setInterval(updateNowPlayingDisplay, 500);
  window.setInterval(maybeAutoCenterPlaylist, 5000);
};

init().catch((error) => {
  setStatus(error instanceof Error ? error.message : t("statusUnknownError"));
});
