import {
  buildTandaArtistSortKey,
  deriveInstrumental,
  normalizeStyleName,
  summarizeArtistName,
  summarizeTandaTracks,
  collectStylesFromTracks,
} from "../shared/tanda-utils.js";
import { applySearchSortDefaults } from "../shared/search-sort.js";
import {
  appendQueryTokens,
  buildTrackSimilarityQuery,
  buildTrackSearchQuery,
  dedupeQueryTokens,
} from "../shared/search-query.js";
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
import type { DisplayUpdatePayload } from "../shared/types.js";
import {
  computeCortinaStartOffsetMs,
  computeElapsedMsForEntry,
  computeTimelineOffsetsMs,
  computeTimelineTotalMs,
  getMinutesOfDayFromMs,
  isPlaylistIndexLockedDuringLive,
  isPlaylistTandaSlotLockedDuringLive,
  shouldShowDisplayNextTanda,
  type TimelineEntry,
} from "../shared/playlist-live.js";
import {
  computePlaylistWindowMinutes,
  parseClockMinutes,
} from "../shared/playlist-window.js";
import { evaluateDataReadiness } from "../shared/data-readiness.js";
import { reorderClipboardCollections } from "../shared/clipboard-order.js";
import { moveTrackToCollection } from "../shared/clipboard-move.js";
import { applyClipboardClear } from "../shared/clipboard-clear.js";
import { resolveCollectionForClipboardWrite } from "../shared/clipboard-target.js";
import { computeTrimmedEnd } from "../shared/audio-trim.js";
import {
  applyGainStepGuard,
  gainDbToLinear,
  resolvePlaybackNormalization,
} from "../shared/audio-normalization.js";
import { computeFadeDurationMs } from "../shared/audio-fade.js";
import {
  chooseAvailableOutputDeviceId,
  dedupeAudioOutputs,
  getOutputCandidateIds,
  resolveStoredOutputDevice,
  type AudioOutputDevice,
} from "../shared/audio-outputs.js";
import {
  resolveContinuationIndexAfterEndCortina,
  shouldContinueAfterEndCortina,
  shouldInsertCortinaBeforeTanda,
  shouldSkipLeadInCortinaForSelectedStart,
  shouldStopAfterMarkedLastTanda,
  shouldTreatClickStartAsIdle,
} from "../shared/playlist-flow.js";
import { computeAutoClearRemainingMs } from "../shared/playlist-filter.js";
import { normalizePlaylistItems } from "../shared/playlist-normalize.js";
import { computeScaledPercent } from "../shared/chart-scale.js";
import {
  collectStoredPlaylistTrackIds,
  type PlaylistTandaSnapshot,
  type StoredPlaylistItem,
} from "../shared/playlist-storage.js";
import {
  aggregateOrchestraDurations,
  areArtistsGapSatisfied,
  buildAdaptiveNumericDistribution,
  collectEligibleArtistStyleGroups,
  isTandaArtistStyleAvailable,
  normalizeArtistGroupKey,
} from "../shared/playlist-diversity.js";
import { ORCHESTRA_SEED_DATA } from "../shared/orchestra-seed.js";
import {
  buildOrchestraAliasIndex,
  convertSeedToRegistry,
  normalizeRegistryEntry,
  resolveOrchestraCanonical,
  type OrchestraRegistryEntry,
} from "../shared/orchestra-registry.js";
import {
  getCortinaRowIndices,
  getUnassignedCortinaRowIndices,
} from "../shared/cortina-plan.js";

const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const addMusicBtn = document.querySelector<HTMLButtonElement>("#add-music");
const addCortinaBtn = document.querySelector<HTMLButtonElement>("#add-cortina");
const addBackgroundsBtn =
  document.querySelector<HTMLButtonElement>("#add-backgrounds");
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
const diagnosticsDataReadinessEl =
  document.querySelector<HTMLDivElement>("#diagnostics-data-readiness");
const diagnosticsPlaybackLogBtn =
  document.querySelector<HTMLButtonElement>("#diagnostics-playback-log");
const diagnosticsClearLogsBtn =
  document.querySelector<HTMLButtonElement>("#diagnostics-clear-logs");
const diagnosticsPlaybackLogResult =
  document.querySelector<HTMLPreElement>("#diagnostics-playback-log-result");
const diagnosticsOutputProbeBtn =
  document.querySelector<HTMLButtonElement>("#diagnostics-output-probe");
const diagnosticsOutputProbeResult =
  document.querySelector<HTMLPreElement>("#diagnostics-output-probe-result");
const orchestraFilterInput =
  document.querySelector<HTMLInputElement>("#orchestra-filter");
const orchestraAddBtn =
  document.querySelector<HTMLButtonElement>("#orchestra-add");
const orchestraResetBtn =
  document.querySelector<HTMLButtonElement>("#orchestra-reset");
const orchestraSaveBtn =
  document.querySelector<HTMLButtonElement>("#orchestra-save");
const orchestraListEl =
  document.querySelector<HTMLDivElement>("#orchestra-list");

let allowAppClose = false;
let confirmModalEl: HTMLDivElement | null = null;
let confirmModalMessage: HTMLDivElement | null = null;
let confirmModalOk: HTMLButtonElement | null = null;
let confirmModalCancel: HTMLButtonElement | null = null;
let confirmModalResolve: ((value: boolean) => void) | null = null;
let clipboardClearModalEl: HTMLDivElement | null = null;
let clipboardClearModalResolve:
  | ((value: { selectedIds: string[]; removeEmpty: boolean } | null) => void)
  | null = null;
let playlistClearModalEl: HTMLDivElement | null = null;
let playlistClearModalResolve:
  | ((value: "clear" | "autofill" | null) => void)
  | null = null;
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
const legacyReadinessButton =
  document.querySelector<HTMLButtonElement>("#legacy-readiness-button");
const legacyReadinessResult =
  document.querySelector<HTMLDivElement>("#legacy-readiness-result");
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
const playlistStopBtn =
  document.querySelector<HTMLButtonElement>("#playlist-stop");
const playlistClearBtn =
  document.querySelector<HTMLButtonElement>("#playlist-clear");
const playlistFilterInput =
  document.querySelector<HTMLInputElement>("#playlist-filter");
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
const clearPlayCountsBtn =
  document.querySelector<HTMLButtonElement>("#clear-play-counts");
const playlistStatsBtn =
  document.querySelector<HTMLButtonElement>("#playlist-stats");
const playlistStatsModal =
  document.querySelector<HTMLElement>("#playlist-stats-modal");
const playlistStatsCloseBtn =
  document.querySelector<HTMLButtonElement>("#playlist-stats-close");
const playlistStatsOrchestraEl =
  document.querySelector<HTMLDivElement>("#playlist-stats-orchestra");
const playlistStatsYearEl =
  document.querySelector<HTMLDivElement>("#playlist-stats-year");
const playlistStatsTempoEl =
  document.querySelector<HTMLDivElement>("#playlist-stats-tempo");
const clipboardNewLimitInput =
  document.querySelector<HTMLInputElement>("#clipboard-new-limit");
const panelTabButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".panel .tab-bar button[data-tab]"),
);
const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle");
const closeAppBtn = document.querySelector<HTMLButtonElement>("#close-app");
const fullscreenToggle =
  document.querySelector<HTMLButtonElement>("#fullscreen-toggle");
const openDisplayBtn =
  document.querySelector<HTMLButtonElement>("#open-display");
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
const cortinaLevelPercentInput =
  document.querySelector<HTMLInputElement>("#cortina-level-percent");
const DEFAULT_OUTPUT_ID = "default";
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
const playlistEndTimeInput =
  document.querySelector<HTMLInputElement>("#playlist-end-time");
const stopFadeInput =
  document.querySelector<HTMLInputElement>("#stop-fade-duration");
const playlistSequenceInput =
  document.querySelector<HTMLInputElement>("#playlist-sequence");
const playlistArtistRepeatGapInput =
  document.querySelector<HTMLInputElement>("#playlist-artist-repeat-gap");
const playlistStyleMapInput =
  document.querySelector<HTMLTextAreaElement>("#playlist-style-map");
const playlistCortinaSetSelect =
  document.querySelector<HTMLSelectElement>("#playlist-cortina-set");
const playlistCortinaDurationInput =
  document.querySelector<HTMLInputElement>("#playlist-cortina-duration");
const displayBackgroundIntervalInput =
  document.querySelector<HTMLInputElement>("#display-background-interval");
const displayUseImagesInput =
  document.querySelector<HTMLInputElement>("#display-use-images");
const displayImageDimInput =
  document.querySelector<HTMLInputElement>("#display-image-dim");
const displayBaseFontSizeInput =
  document.querySelector<HTMLInputElement>("#display-base-font-size");
const displayCortinaFontSizeInput =
  document.querySelector<HTMLInputElement>("#display-cortina-font-size");
const displayEdgePaddingInput =
  document.querySelector<HTMLInputElement>("#display-edge-padding");
const playlistLastTandaToggle =
  document.querySelector<HTMLInputElement>("#playlist-last-tanda");
const searchButton = document.querySelector<HTMLButtonElement>("#search-button");
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
const trackEditorWaveformContainer =
  document.querySelector<HTMLDivElement>("#track-editor-waveform-container");
const trackEditorWaveformImage =
  document.querySelector<HTMLImageElement>("#track-editor-waveform-image");
const trackEditorWaveformPlaceholder =
  document.querySelector<HTMLDivElement>("#track-editor-waveform-placeholder");
const trackEditorWaveformProgress =
  document.querySelector<HTMLDivElement>("#track-editor-waveform-progress");
const trackEditorWaveformPlayhead =
  document.querySelector<HTMLDivElement>("#track-editor-waveform-playhead");
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
const trackEditorCloseBtn =
  document.querySelector<HTMLButtonElement>("#track-editor-close");
const trackEditorSaveBtn =
  document.querySelector<HTMLButtonElement>("#track-editor-save");
const trackEditorResetBtn =
  document.querySelector<HTMLButtonElement>("#track-editor-reset");

let headphoneAvailable = false;
let audioOutputs: AudioOutputDevice[] = [];
let audioOutputRouteCandidates = new Map<string, string[]>();

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
const DISPLAY_BACKGROUND_INTERVAL_KEY = "tanda-display-background-interval";
const DEFAULT_DISPLAY_BACKGROUND_INTERVAL_SEC = 20;
const DISPLAY_USE_IMAGES_KEY = "tanda-display-use-images";
const DISPLAY_IMAGE_DIM_KEY = "tanda-display-image-dim";
const DEFAULT_DISPLAY_IMAGE_DIM = 0.35;
const DISPLAY_FONT_SCALE_KEY = "tanda-display-font-scale";
const DEFAULT_DISPLAY_FONT_SCALE = 1;
const DISPLAY_CORTINA_FONT_SCALE_KEY = "tanda-display-cortina-font-scale";
const DEFAULT_DISPLAY_CORTINA_FONT_SCALE = 1;
const DISPLAY_EDGE_PADDING_KEY = "tanda-display-edge-padding-vmin";
const DEFAULT_DISPLAY_EDGE_PADDING_VMIN = 5;
const CORTINA_LEVEL_PERCENT_KEY = "tanda-cortina-level-percent";
const DEFAULT_CORTINA_LEVEL_PERCENT = 100;
const PLAYLIST_LAST_TANDA_KEY = "tanda-playlist-current-last";
const PLAYLIST_END_TIME_KEY = "tanda-playlist-end-time";
const DEFAULT_PLAYLIST_END_TIME = "03:00";

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
let pendingSearchRefreshTimer: number | null = null;
let pendingSearchFrame: number | null = null;
let searchRefreshVersion = 0;
const setSearchUiState = (
  state: "idle" | "loading",
  token?: number,
  count?: number,
) => {
  if (searchListBody) {
    searchListBody.dataset.state = state;
    searchListBody.dataset.loading = state;
  }
  if (searchTracksEl) {
    searchTracksEl.dataset.state = state;
    searchTracksEl.dataset.loading = state;
    if (typeof count === "number") {
      searchTracksEl.dataset.count = `${count}`;
    }
    if (typeof token === "number") {
      searchTracksEl.dataset.refreshToken = `${token}`;
      if (state === "idle") {
        searchTracksEl.dataset.readyToken = `${token}`;
      }
    }
  }
};
setSearchUiState("idle", 0, 0);
let clipboardTracks: TrackRow[] = [];
let clipboardFilterText = "";
type PlaylistItem =
  | { kind: "track"; track: TrackRow }
  | { kind: "tanda"; tandaId: string; mismatch?: "style" | "count" };
let playlistItems: (PlaylistItem | null)[] = [null];
let playlistSaveSnapshot = "";
let playlistTargetIndex: number | null = null;
let playlistTargetTandaId: string | null = null;
let playlistTrackTargetIndex: number | null = null;
let playlistTrackTargetTrackId: string | null = null;
let playlistAutofillInProgress = false;
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
type CortinaDisplayPhase = "none" | "about" | "playing" | "after";
let cortinaDisplayPhase: CortinaDisplayPhase = "none";
let holdCortinaDisplayWhenIdle = false;
let lastDisplayPayloadSignature = "";
const waveformWidgets = [
  {
    container: waveformContainer,
    image: waveformImage,
    placeholder: waveformPlaceholder,
    progress: waveformProgress,
    playhead: waveformPlayhead,
  },
  {
    container: trackEditorWaveformContainer,
    image: trackEditorWaveformImage,
    placeholder: trackEditorWaveformPlaceholder,
    progress: trackEditorWaveformProgress,
    playhead: trackEditorWaveformPlayhead,
  },
];
let pendingCortinaTargetIndex: number | null = null;
const pulsePlaylistIndices = new Set<number>();
const pulseCortinaIndices = new Set<number>();
const pulseClipboardTrackIds = new Set<string>();
const pulseClipboardTandaIds = new Set<string>();
let legacyImportRootPath: string | null = null;
let tandaEditorReturnTab: RightPanelTab | null = null;

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
const CLIPBOARD_TOP_ID = "top";
const CLIPBOARD_LEAST_ID = "least";
const CLIPBOARD_AVAILABLE_ID = "available";
const DEFAULT_NEW_LIMIT = 100;
const SMART_COLLECTION_LIMIT = 100;
const PLAY_COUNTS_KEY = "tanda-play-counts";
const PLAYLIST_ARTIST_REPEAT_GAP_MIN_KEY = "tanda-playlist-artist-repeat-gap-min";
const DEFAULT_PLAYLIST_ARTIST_REPEAT_GAP_MIN = 30;
const ORCHESTRA_REGISTRY_KEY = "tanda-orchestra-registry-v1";
const CORTINA_ANY_ID = "__any__";
const TANDA_SEARCH_SIZE_KEY = "tanda-search-size";

let clipboardCollections: ClipboardCollection[] = [];
let activeClipboardCollectionId: string | null = null;
let includedClipboardCollectionIds: string[] = [];
type PlayCounts = {
  tracks: Record<string, number>;
  tandas: Record<string, number>;
};
let playCounts: PlayCounts = { tracks: {}, tandas: {} };
let allTracksForSmartCollections: TrackRow[] | null = null;
let allTandasForSmartCollections: TandaDraft[] | null = null;
let orchestraRegistry: OrchestraRegistryEntry[] = [];
let orchestraAliasIndex = new Map<string, string>();
let orchestraFilterText = "";

type TandaDraft = {
  id: string;
  name: string;
  styles: string[];
  rating: number;
  trackSlots: (string | null)[];
  totalDurationMs?: number;
  origin?: "designer" | "playlist";
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
let playlistFilterText = "";
let playlistFilterClearTimer: number | undefined;
const PLAYLIST_FILTER_AUTO_CLEAR_MS = 30_000;
let lastRenderedPlaylistHasFilter = false;
let centerPlaylistTargetOnNextRender = false;

type OutputMode = "prep" | "live" | "edit";
let appMode: OutputMode = "prep";

type OutputChannel = "main" | "headphone";

type PlaybackState = {
  active?: HTMLAudioElement;
  currentTrackId?: string;
  track?: TrackRow;
  appliedGainDb?: number | null;
  isCortinaPlayback?: boolean;
};

const playback: Record<OutputChannel, PlaybackState> = {
  main: {},
  headphone: {},
};
const lastAppliedGainDbByChannel: Record<OutputChannel, number | null> = {
  main: null,
  headphone: null,
};
const MAX_GAIN_ONLY_STEP_DB = 4;

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
  trackEditor.classList.add("non-modal");
  if (trackEditorCloseBtn) {
    trackEditorCloseBtn.hidden = false;
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
let lastPlayingIndicatorTrackId: string | null = null;

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
    clipboardCollectionInclude: "Include",
    clipboardCollectionGeneral: "General",
    clipboardCollectionNew: "New",
    clipboardCollectionTop: "Top",
    clipboardCollectionLeast: "Least",
    clipboardCollectionAvailable: "Available",
    clipboardFilterPlaceholder: "Filter",
    confirmClipboardCollectionRemove: "Remove collection \"{name}\"?",
    clipboardClear: "Clear",
    clipboardClearTitle: "Clear clipboard collections",
    clipboardClearConfirm: "Clear selected",
    clipboardClearRemoveEmpty: "Remove empty collections (except General/New)",
    playlistTitle: "Playlist",
    playlistHint:
      "Use a tanda menu to mark a playlist slot for replacement, then choose a track/tanda from Clipboard or Search. Without a marked slot, sent tracks/tandas go to the first free slot.",
    playlistCurrentIsLast: "Current tanda is the last tanda",
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
    openDisplay: "Open display window",
    settings: "Settings",
    dataLocationLabel: "Data location",
    dataLocationChoose: "Choose…",
    dataLocationHelp: "Data is stored in a _tp_data folder at the selected location.",
    legacyImportTitle: "Legacy Import",
    legacyImportButton: "Import legacy library",
    legacyReadinessButton: "Verify library readiness",
    legacyReadinessRunning: "Running readiness checks...",
    legacyReadinessPass: "Readiness check passed.",
    legacyReadinessWarn: "Playback-ready with warnings.",
    legacyReadinessFail: "Readiness check failed.",
    legacyReadinessSummary:
      "{status} Tracks {total}; missing duration {missingDuration}; missing loudness+gain {missingLoudness}; no trim signals {missingTrimSignals}; analysis errors {analysisErrors}; missing waveforms {missingWaveforms}.",
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
      "Import legacy library data from {path}? This replaces existing tandas and uses legacy metadata without a full scan.",
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
    actionMarkPlaylistTrack: "Mark track target",
    actionMarkPlaylistTrackShort: "M",
    actionSwapPlaylist: "Cross swap with marked",
    actionSwapPlaylistShort: "X",
    cancelTarget: "Cancel target",
    cancel: "Cancel",
    confirmOk: "OK",
    actionSearch: "Search similar",
    actionSearchShort: "S",
    actionMore: "More actions",
    actionSendClipboard: "Send to clipboard",
    actionSendClipboardShort: "C",
    duplicateFull: "In playlist",
    duplicatePartial: "Partial playlist overlap",
    duplicateJumpHint: "Click to locate duplicate in playlist",
    duplicateReasonWholeTanda: "Whole tanda already exists in playlist.",
    duplicateReasonTrack: "Track in playlist: {track}",
    duplicateReasonTracks: "Tracks in playlist: {tracks}",
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
    tabOrchestras: "Orchestras",
    tabPlaylistSettings: "Playlist",
    tabDisplayBoard: "Display Board",
    libraryRoots: "Library Roots",
    libraryRootsHelp: "Configure music and cortina folders used for scanning.",
    addMusicFolder: "Add Music Folder",
    addCortinaFolder: "Add Cortina Folder",
    addBackgroundFolder: "Add Background Folder",
    scanLibrary: "Scan Library",
    scanMusic: "Scan Music",
    scanCortinas: "Scan Cortinas",
    system: "System",
    systemGroupLanguage: "Language",
    systemGroupOutputs: "Outputs",
    systemGroupStyles: "Styles",
    systemGroupSearch: "Searching / scoring",
    systemGroupCollections: "Collections",
    systemGroupCounts: "Counts",
    systemGroupDynamics: "Compressor / limiter",
    systemGroupData: "Data",
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
    displayBackgroundInterval: "Display background rotation (sec)",
    displayUseImages: "Use background images on display",
    displayImageDimLabel: "Display image darken (%)",
    displayBaseFontSizeLabel: "Display base font size (%)",
    displayBaseFontSizeHelp: "Scales display text for distance readability.",
    displayCortinaFontSizeLabel: "Display cortina font size (%)",
    displayCortinaFontSizeHelp: "Scales cortina headline text independently.",
    displayEdgePaddingLabel: "Display edge padding (vmin)",
    displayEdgePaddingHelp: "Adds space between display text and screen edges.",
    searchMinScoreLabel: "Search minimum score",
    searchBpmRangeLabel: "BPM search range",
    trimPaddingLabel: "Trim padding (sec)",
    trimPaddingHelp: "Reduces auto-detected start/end trims by this amount.",
    playlistSettingsTitle: "Playlist Settings",
    playlistStartTimeLabel: "Playlist start time",
    playlistEndTimeLabel: "Playlist expected end time",
    playlistSequenceLabel: "Tanda sequence",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Style mapping",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    playlistArtistRepeatGapLabel: "Artist repeat gap aspiration (min)",
    playlistArtistRepeatGapHelp:
      "Auto-fill tries to avoid repeating artists within this time window.",
    playlistStatsTitle: "Playlist diversity",
    playlistStatsOrchestra: "Orchestra seconds",
    playlistStatsYear: "Year distribution",
    playlistStatsTempo: "Tempo distribution",
    playlistStatsNoData: "No data",
    playlistFilterPlaceholder: "Filter playlist",
    playlistFilterNoMatch: "No matching playlist items.",
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
    diagnosticsDataReadiness: "Data readiness",
    diagnosticsReadinessTotalTracks: "Tracks",
    diagnosticsReadinessMissingDuration: "Missing duration",
    diagnosticsReadinessMissingLoudness: "Missing loudness+gain",
    diagnosticsReadinessMissingTrimSignals: "No trim signals",
    diagnosticsReadinessAnalysisErrors: "Analysis errors",
    diagnosticsReadinessMissingWaveforms: "Missing waveforms",
    diagnosticsPlaybackLog: "Playback leveling log",
    diagnosticsPlaybackLogRun: "Load recent playback leveling entries",
    diagnosticsClearLogs: "Clear diagnostics logs",
    diagnosticsLogsCleared: "Diagnostics logs cleared.",
    diagnosticsLogsClearFailed: "Clearing diagnostics logs failed: {message}",
    diagnosticsOutputProbe: "Audio output probe",
    diagnosticsOutputProbeRun: "Run audio output probe",
    diagnosticsOutputProbeNoDevices: "No audio output devices detected.",
    diagnosticsOutputProbeUnsupported: "Output routing unsupported by this runtime.",
    diagnosticsOutputProbeError: "Probe failed: {message}",
    diagnosticsPlaybackLogEmpty: "No playback leveling log entries yet.",
    diagnosticsPlaybackLogFailed: "Playback log failed: {message}",
    diagnosticsPathsPlaybackLog: "Playback log",
    clearPlayCountsLabel: "Playback counters",
    clearPlayCountsButton: "Clear play counts",
    confirmClearPlayCounts: "Clear all track and tanda play counts?",
    statusPlayCountsCleared: "Playback counters cleared.",
    orchestraRegistryTitle: "Orchestras",
    orchestraRegistryHelp:
      "Canonical orchestra names, aliases, and related names used by search and collections.",
    orchestraFilterPlaceholder: "Filter orchestras or aliases",
    orchestraCanonicalLabel: "Canonical orchestra",
    orchestraAliasesLabel: "Aliases (comma separated)",
    orchestraRelatedLabel: "Related orchestras (comma separated)",
    orchestraAdd: "Add orchestra",
    orchestraReset: "Reset to seeded list",
    orchestraSave: "Save orchestra list",
    orchestraDelete: "Delete",
    confirmOrchestraRegistryReset:
      "Reset orchestra aliases to the seeded list? This will overwrite local edits.",
    statusOrchestraRegistrySaved: "Orchestra list saved.",
    statusOrchestraRegistryReset: "Orchestra list reset to seeded defaults.",
    statusOrchestraRegistryInvalid: "Orchestra list has invalid entries.",
    eraseDatabase: "Erase Database",
    confirmEraseDatabase:
      "This will permanently delete your library scan, tandas, playlists, and settings stored in this app. You can re-import folders afterward, but this action cannot be undone.",
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
    statusAddedBackground: "Added background folder: {path}.",
    statusDatabaseErased: "Database erased. Add folders to begin scanning.",
    statusNoRoots:
      "No music folders configured. Add a music folder in Settings to begin scanning.",
    statusDataLocationChanged: "Data location set to {path}. Database reset.",
    statusDataLocationDuringPlayback: "Stop playback before changing data location.",
    legacyImportDetected:
      "Legacy files detected at {path}. Import library.dat and cortinas.dat (no full scan)?",
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
    statusPlaylistSwapInvalid: "Select a marked tanda and swap with another tanda.",
    statusClipboardCleared: "Clipboard collections updated.",
    statusPlaylistCleared: "Playlist cleared.",
    statusPlaylistAutofillRunning: "Building playlist, please wait...",
    statusPlaylistAutofillDone:
      "Playlist auto-fill complete: {count} tanda(s), ends around {time}.",
    statusPlaylistAutofillPartial:
      "Playlist auto-fill stopped after {count} tanda(s): no suitable items found.",
    confirmPlaylistClear: "Clear the playlist and remove all items?",
    confirmDiscardTrackEdits: "Discard unsaved track edits?",
    playlistClearTitle: "Playlist clear options",
    playlistClearOnly: "Clear playlist",
    playlistClearAutofill: "Clear and auto-fill",
    outputSelectionFailed: "Output selection failed.",
    outputSelectionFailedDetail: "Output selection failed: {message}",
    statusDspBypassedOutput:
      "Dynamics DSP is bypassed for non-default output devices. Use Default Output to hear compression.",
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
    cortinaLevelPercentLabel: "Cortina level (% of main output)",
    audioDspEnabledLabel: "Enable real-time dynamics DSP",
    audioDynamicsPresetLabel: "Playback dynamics preset",
    audioDynamicsPresetOff: "Off",
    audioDynamicsPresetGentle: "Gentle",
    audioDynamicsPresetBalanced: "Balanced",
    audioDynamicsPresetStrong: "Strong",
    audioDynamicsPresetCustom: "Custom",
    audioDynamicsThresholdLabel: "Compressor threshold (dB)",
    audioDynamicsRatioLabel: "Compressor ratio",
    audioDynamicsMakeupLabel: "Makeup gain (dB)",
    audioDynamicsLimiterLabel: "Limiter ceiling (dB)",
    audioLiveBoostLabel: "Live boost",
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
    tandaDone: "Close",
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
    rootBackground: "Background",
    displayPlayingTrack: "Playing track {index} of {count}",
    displayThisTanda: "This tanda: {style}",
    displayNextTanda: "Next Tanda: {style}",
    displayThisIsLastTanda: "This is the last tanda",
    displayNoMoreTandas: "That's all folks",
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
    tabPlaylist: "Lista",
    tabTandaDesigner: "Disenador de tandas",
    clipboardTitle: "Portapapeles",
    clipboardCollectionsLabel: "Colecciones",
    clipboardCollectionPlaceholder: "Nueva coleccion",
    clipboardCollectionAdd: "Agregar",
    clipboardCollectionInclude: "Incluir",
    clipboardCollectionGeneral: "General",
    clipboardCollectionNew: "Nuevos",
    clipboardCollectionTop: "Mas",
    clipboardCollectionLeast: "Menos",
    clipboardCollectionAvailable: "Disponibles",
    clipboardFilterPlaceholder: "Filtrar",
    confirmClipboardCollectionRemove: "Quitar la coleccion \"{name}\"?",
    clipboardClear: "Limpiar",
    clipboardClearTitle: "Vaciar colecciones del portapapeles",
    clipboardClearConfirm: "Vaciar seleccionadas",
    clipboardClearRemoveEmpty: "Eliminar colecciones vacias (excepto General/Nuevos)",
    playlistTitle: "Lista",
    playlistHint:
      "Usa el menu de tanda para marcar un hueco de la lista para reemplazo y luego elige una pista/tanda desde Portapapeles o Busqueda. Sin hueco marcado, los envios van al primer hueco libre.",
    playlistCurrentIsLast: "La tanda actual es la ultima tanda",
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
    openDisplay: "Abrir pantalla externa",
    settings: "Ajustes",
    dataLocationLabel: "Ubicacion de datos",
    dataLocationChoose: "Elegir…",
    dataLocationHelp:
      "Los datos se guardan en una carpeta _tp_data en la ubicacion seleccionada.",
    legacyImportTitle: "Importacion heredada",
    legacyImportButton: "Importar tandas heredadas",
    legacyReadinessButton: "Verificar estado de biblioteca",
    legacyReadinessRunning: "Ejecutando verificaciones...",
    legacyReadinessPass: "Verificacion completada correctamente.",
    legacyReadinessWarn: "Lista para reproduccion con avisos.",
    legacyReadinessFail: "La verificacion fallo.",
    legacyReadinessSummary:
      "{status} Pistas {total}; duracion faltante {missingDuration}; sonoridad+ganancia faltante {missingLoudness}; sin senales de recorte {missingTrimSignals}; errores de analisis {analysisErrors}; formas de onda faltantes {missingWaveforms}.",
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
    actionMarkPlaylistTrack: "Marcar objetivo de pista",
    actionMarkPlaylistTrackShort: "M",
    cancelTarget: "Cancelar objetivo",
    cancel: "Cancelar",
    confirmOk: "OK",
    actionSearch: "Buscar similares",
    actionSearchShort: "S",
    actionMore: "Mas acciones",
    actionSendClipboard: "Enviar al portapapeles",
    actionSendClipboardShort: "C",
    duplicateFull: "En la lista",
    duplicatePartial: "Coincidencia parcial en la lista",
    duplicateJumpHint: "Haz clic para ubicar el duplicado en la lista",
    duplicateReasonWholeTanda: "La tanda completa ya existe en la lista.",
    duplicateReasonTrack: "Pista en la lista: {track}",
    duplicateReasonTracks: "Pistas en la lista: {tracks}",
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
    tabOrchestras: "Orquestas",
    tabPlaylistSettings: "Lista",
    tabDisplayBoard: "Pantalla",
    libraryRoots: "Raices de biblioteca",
    libraryRootsHelp: "Configura carpetas de musica y cortinas.",
    addMusicFolder: "Agregar musica",
    addCortinaFolder: "Agregar cortinas",
    addBackgroundFolder: "Agregar fondos",
    scanLibrary: "Escanear biblioteca",
    scanMusic: "Escanear musica",
    scanCortinas: "Escanear cortinas",
    system: "Sistema",
    systemGroupLanguage: "Idioma",
    systemGroupOutputs: "Salidas",
    systemGroupStyles: "Estilos",
    systemGroupSearch: "Busqueda / puntuacion",
    systemGroupCollections: "Colecciones",
    systemGroupCounts: "Conteos",
    systemGroupDynamics: "Compresor / limitador",
    systemGroupData: "Datos",
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
    displayBackgroundInterval: "Rotacion de fondos en pantalla (s)",
    displayUseImages: "Usar imagenes de fondo en pantalla",
    displayImageDimLabel: "Oscurecer imagen de pantalla (%)",
    displayBaseFontSizeLabel: "Tamano base de fuente en pantalla (%)",
    displayBaseFontSizeHelp: "Escala el texto de pantalla para mejor lectura a distancia.",
    displayCortinaFontSizeLabel: "Tamano de fuente cortina en pantalla (%)",
    displayCortinaFontSizeHelp: "Escala por separado el titulo de cortina.",
    displayEdgePaddingLabel: "Margen del borde en pantalla (vmin)",
    displayEdgePaddingHelp: "Agrega espacio entre el texto y los bordes de la pantalla.",
    searchMinScoreLabel: "Puntuacion minima de busqueda",
    searchBpmRangeLabel: "Rango de BPM",
    trimPaddingLabel: "Ajuste de recorte (s)",
    trimPaddingHelp:
      "Reduce los recortes de inicio/fin detectados automaticamente.",
    playlistSettingsTitle: "Ajustes de playlist",
    playlistStartTimeLabel: "Hora de inicio de la playlist",
    playlistEndTimeLabel: "Hora prevista de fin de la playlist",
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
    diagnosticsDataReadiness: "Estado de datos",
    diagnosticsReadinessTotalTracks: "Pistas",
    diagnosticsReadinessMissingDuration: "Duracion faltante",
    diagnosticsReadinessMissingLoudness: "Sonoridad+ganancia faltante",
    diagnosticsReadinessMissingTrimSignals: "Sin senales de recorte",
    diagnosticsReadinessAnalysisErrors: "Errores de analisis",
    diagnosticsReadinessMissingWaveforms: "Formas de onda faltantes",
    eraseDatabase: "Borrar base de datos",
    confirmEraseDatabase:
      "Esto borrara permanentemente el escaneo de biblioteca, tandas, playlists y ajustes guardados en esta app. Puedes reimportar carpetas despues, pero esta accion no se puede deshacer.",
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
    statusAddedBackground: "Fondos agregados: {path}.",
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
    statusClipboardCleared: "Colecciones del portapapeles actualizadas.",
    statusPlaylistCleared: "Lista vaciada.",
    statusPlaylistAutofillRunning: "Construyendo playlist, espere por favor...",
    statusPlaylistAutofillDone:
      "Autocompletado finalizado: {count} tanda(s), termina cerca de {time}.",
    statusPlaylistAutofillPartial:
      "Autocompletado detenido tras {count} tanda(s): no se encontraron candidatos.",
    confirmPlaylistClear: "¿Borrar la lista y eliminar todos los elementos?",
    confirmDiscardTrackEdits: "¿Descartar cambios no guardados de la pista?",
    playlistClearTitle: "Opciones de limpieza de playlist",
    playlistClearOnly: "Borrar playlist",
    playlistClearAutofill: "Borrar y autocompletar",
    outputSelectionFailed: "Fallo al seleccionar salida.",
    outputSelectionFailedDetail: "Fallo al seleccionar salida: {message}",
    statusDspBypassedOutput:
      "El DSP de dinamica se omite para salidas no predeterminadas. Use Salida predeterminada para oir compresion.",
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
    cortinaLevelPercentLabel: "Nivel de cortina (% de salida principal)",
    audioDspEnabledLabel: "Habilitar DSP de dinamica en tiempo real",
    audioDynamicsPresetLabel: "Preajuste de dinamica",
    audioDynamicsPresetOff: "Apagado",
    audioDynamicsPresetGentle: "Suave",
    audioDynamicsPresetBalanced: "Equilibrado",
    audioDynamicsPresetStrong: "Fuerte",
    audioDynamicsPresetCustom: "Personalizado",
    audioDynamicsThresholdLabel: "Umbral del compresor (dB)",
    audioDynamicsRatioLabel: "Relacion del compresor",
    audioDynamicsMakeupLabel: "Ganancia de compensacion (dB)",
    audioDynamicsLimiterLabel: "Techo del limitador (dB)",
    audioLiveBoostLabel: "Refuerzo en vivo",
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
    tandaDone: "Cerrar",
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
    rootBackground: "Fondo",
    displayPlayingTrack: "Reproduciendo pista {index} de {count}",
    displayThisTanda: "Esta tanda: {style}",
    displayNextTanda: "Proxima tanda: {style}",
    displayThisIsLastTanda: "Esta es la ultima tanda",
    displayNoMoreTandas: "Eso es todo, amigos",
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
    tabPlaylist: "Liste",
    tabTandaDesigner: "Concepteur de tandas",
    clipboardTitle: "Presse-papiers",
    clipboardCollectionsLabel: "Collections",
    clipboardCollectionPlaceholder: "Nouvelle collection",
    clipboardCollectionAdd: "Ajouter",
    clipboardCollectionInclude: "Inclure",
    clipboardCollectionGeneral: "General",
    clipboardCollectionNew: "Nouveaux",
    clipboardCollectionTop: "Plus",
    clipboardCollectionLeast: "Moins",
    clipboardCollectionAvailable: "Disponibles",
    clipboardFilterPlaceholder: "Filtrer",
    confirmClipboardCollectionRemove: "Retirer la collection \"{name}\" ?",
    clipboardClear: "Vider",
    clipboardClearTitle: "Vider les collections du presse-papiers",
    clipboardClearConfirm: "Vider la selection",
    clipboardClearRemoveEmpty: "Supprimer les collections vides (sauf General/Nouveaux)",
    playlistTitle: "Liste",
    playlistHint:
      "Utilisez le menu de tanda pour marquer un emplacement a remplacer, puis choisissez une piste/tanda depuis le presse-papiers ou la recherche. Sans emplacement marque, les envois vont dans le premier emplacement libre.",
    playlistCurrentIsLast: "La tanda en cours est la derniere",
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
    openDisplay: "Ouvrir l'ecran externe",
    settings: "Reglages",
    dataLocationLabel: "Emplacement des donnees",
    dataLocationChoose: "Choisir…",
    dataLocationHelp:
      "Les donnees sont stockees dans un dossier _tp_data a l'emplacement choisi.",
    legacyImportTitle: "Import heritage",
    legacyImportButton: "Importer les tandas heritees",
    legacyReadinessButton: "Verifier l'etat de la bibliotheque",
    legacyReadinessRunning: "Verification en cours...",
    legacyReadinessPass: "Verification terminee avec succes.",
    legacyReadinessWarn: "Pret pour lecture avec avertissements.",
    legacyReadinessFail: "La verification a echoue.",
    legacyReadinessSummary:
      "{status} Pistes {total}; duree manquante {missingDuration}; loudness+gain manquants {missingLoudness}; aucun signal de trim {missingTrimSignals}; erreurs d'analyse {analysisErrors}; formes d'onde manquantes {missingWaveforms}.",
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
    actionMarkPlaylistTrack: "Marquer la cible de piste",
    actionMarkPlaylistTrackShort: "M",
    cancelTarget: "Annuler la cible",
    cancel: "Annuler",
    confirmOk: "OK",
    actionSearch: "Rechercher similaire",
    actionSearchShort: "S",
    actionMore: "Plus d'actions",
    actionSendClipboard: "Envoyer au presse-papiers",
    actionSendClipboardShort: "C",
    duplicateFull: "Dans la playlist",
    duplicatePartial: "Chevauchement partiel avec la playlist",
    duplicateJumpHint: "Cliquer pour trouver le doublon dans la playlist",
    duplicateReasonWholeTanda: "La tanda complete existe deja dans la playlist.",
    duplicateReasonTrack: "Piste dans la playlist: {track}",
    duplicateReasonTracks: "Pistes dans la playlist: {tracks}",
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
    tabOrchestras: "Orchestres",
    tabPlaylistSettings: "Liste",
    tabDisplayBoard: "Ecran",
    libraryRoots: "Racines de bibliotheque",
    libraryRootsHelp: "Configurer les dossiers musique et cortinas.",
    addMusicFolder: "Ajouter musique",
    addCortinaFolder: "Ajouter cortinas",
    addBackgroundFolder: "Ajouter fonds",
    scanLibrary: "Scanner la bibliotheque",
    scanMusic: "Scanner musique",
    scanCortinas: "Scanner cortinas",
    system: "Systeme",
    systemGroupLanguage: "Langue",
    systemGroupOutputs: "Sorties",
    systemGroupStyles: "Styles",
    systemGroupSearch: "Recherche / score",
    systemGroupCollections: "Collections",
    systemGroupCounts: "Comptages",
    systemGroupDynamics: "Compresseur / limiteur",
    systemGroupData: "Donnees",
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
    displayBackgroundInterval: "Rotation des fonds de l'ecran (s)",
    displayUseImages: "Utiliser les images de fond sur l'ecran",
    displayImageDimLabel: "Assombrir l'image ecran (%)",
    displayBaseFontSizeLabel: "Taille de police de base ecran (%)",
    displayBaseFontSizeHelp: "Ajuste le texte de l'ecran pour la lisibilite a distance.",
    displayCortinaFontSizeLabel: "Taille de police cortina ecran (%)",
    displayCortinaFontSizeHelp: "Ajuste separement le titre cortina.",
    displayEdgePaddingLabel: "Marge d'ecran (vmin)",
    displayEdgePaddingHelp: "Ajoute de l'espace entre le texte et les bords de l'ecran.",
    searchMinScoreLabel: "Score minimum de recherche",
    searchBpmRangeLabel: "Plage BPM",
    trimPaddingLabel: "Marge de coupe (s)",
    trimPaddingHelp:
      "Reduit les coupes debut/fin detectees automatiquement.",
    playlistSettingsTitle: "Reglages de playlist",
    playlistStartTimeLabel: "Heure de debut de la playlist",
    playlistEndTimeLabel: "Heure de fin attendue de la playlist",
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
    diagnosticsDataReadiness: "Etat des donnees",
    diagnosticsReadinessTotalTracks: "Pistes",
    diagnosticsReadinessMissingDuration: "Duree manquante",
    diagnosticsReadinessMissingLoudness: "Loudness+gain manquants",
    diagnosticsReadinessMissingTrimSignals: "Aucun signal de trim",
    diagnosticsReadinessAnalysisErrors: "Erreurs d'analyse",
    diagnosticsReadinessMissingWaveforms: "Formes d'onde manquantes",
    eraseDatabase: "Effacer la base",
    confirmEraseDatabase:
      "Cette action supprimera definitivement le scan de bibliotheque, les tandas, les playlists et les reglages stockes dans cette application. Vous pourrez reimporter des dossiers ensuite, mais cette action est irreversible.",
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
    statusAddedBackground: "Fonds ajoutes: {path}.",
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
    statusClipboardCleared: "Collections du presse-papiers mises a jour.",
    statusPlaylistCleared: "Playlist videe.",
    statusPlaylistAutofillRunning: "Construction de la playlist en cours, veuillez patienter...",
    statusPlaylistAutofillDone:
      "Remplissage auto termine: {count} tanda(s), fin vers {time}.",
    statusPlaylistAutofillPartial:
      "Remplissage auto arrete apres {count} tanda(s): aucun candidat adapte.",
    confirmPlaylistClear: "Effacer la playlist et supprimer tous les elements ?",
    confirmDiscardTrackEdits: "Ignorer les modifications non enregistrees de la piste ?",
    playlistClearTitle: "Options de nettoyage de playlist",
    playlistClearOnly: "Effacer la playlist",
    playlistClearAutofill: "Effacer et remplir automatiquement",
    outputSelectionFailed: "Selection de sortie impossible.",
    outputSelectionFailedDetail: "Selection de sortie impossible: {message}",
    statusDspBypassedOutput:
      "Le DSP dynamique est ignore pour les sorties non par defaut. Utilisez la sortie par defaut pour entendre la compression.",
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
    cortinaLevelPercentLabel: "Niveau cortina (% de la sortie principale)",
    audioDspEnabledLabel: "Activer le DSP dynamique en temps reel",
    audioDynamicsPresetLabel: "Preréglage dynamique",
    audioDynamicsPresetOff: "Desactive",
    audioDynamicsPresetGentle: "Doux",
    audioDynamicsPresetBalanced: "Equilibre",
    audioDynamicsPresetStrong: "Fort",
    audioDynamicsPresetCustom: "Personnalise",
    audioDynamicsThresholdLabel: "Seuil du compresseur (dB)",
    audioDynamicsRatioLabel: "Ratio du compresseur",
    audioDynamicsMakeupLabel: "Gain de compensation (dB)",
    audioDynamicsLimiterLabel: "Plafond du limiteur (dB)",
    audioLiveBoostLabel: "Renfort en direct",
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
    tandaDone: "Fermer",
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
    rootBackground: "Fond",
    displayPlayingTrack: "Lecture piste {index} sur {count}",
    displayThisTanda: "Cette tanda: {style}",
    displayNextTanda: "Prochaine tanda: {style}",
    displayThisIsLastTanda: "C'est la derniere tanda",
    displayNoMoreTandas: "C'est tout, les amis",
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
    tabPlaylist: "Liste",
    tabTandaDesigner: "Tanda-Designer",
    clipboardTitle: "Zwischenablage",
    clipboardCollectionsLabel: "Sammlungen",
    clipboardCollectionPlaceholder: "Neue Sammlung",
    clipboardCollectionAdd: "Hinzufugen",
    clipboardCollectionInclude: "Einblenden",
    clipboardCollectionGeneral: "Allgemein",
    clipboardCollectionNew: "Neu",
    clipboardCollectionTop: "Meiste",
    clipboardCollectionLeast: "Wenigste",
    clipboardCollectionAvailable: "Verfugbar",
    clipboardFilterPlaceholder: "Filtern",
    confirmClipboardCollectionRemove: "Sammlung \"{name}\" entfernen?",
    clipboardClear: "Leeren",
    clipboardClearTitle: "Zwischenablagen-Sammlungen leeren",
    clipboardClearConfirm: "Auswahl leeren",
    clipboardClearRemoveEmpty: "Leere Sammlungen entfernen (ausser Allgemein/Neu)",
    playlistTitle: "Liste",
    playlistHint:
      "Mit dem Tanda-Menue einen Playlist-Slot zum Ersetzen markieren und dann Track/Tanda aus Zwischenablage oder Suche waehlen. Ohne markierten Slot gehen gesendete Tracks/Tandas in den ersten freien Slot.",
    playlistCurrentIsLast: "Aktuelle Tanda ist die letzte Tanda",
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
    openDisplay: "Anzeigefenster offnen",
    settings: "Einstellungen",
    dataLocationLabel: "Datenspeicherort",
    dataLocationChoose: "Auswahlen…",
    dataLocationHelp:
      "Daten werden im Ordner _tp_data am gewahlten Ort gespeichert.",
    legacyImportTitle: "Legacy-Import",
    legacyImportButton: "Legacy-Tandas importieren",
    legacyReadinessButton: "Bibliothek-Bereitschaft pruefen",
    legacyReadinessRunning: "Bereitschaftsprüfung laeuft...",
    legacyReadinessPass: "Pruefung erfolgreich.",
    legacyReadinessWarn: "Fuer Wiedergabe bereit, mit Warnungen.",
    legacyReadinessFail: "Pruefung fehlgeschlagen.",
    legacyReadinessSummary:
      "{status} Tracks {total}; fehlende Dauer {missingDuration}; fehlende Lautheit+Gain {missingLoudness}; keine Trim-Signale {missingTrimSignals}; Analysefehler {analysisErrors}; fehlende Wellenformen {missingWaveforms}.",
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
    actionMarkPlaylistTrack: "Trackziel markieren",
    actionMarkPlaylistTrackShort: "M",
    cancelTarget: "Ziel aufheben",
    cancel: "Abbrechen",
    confirmOk: "OK",
    actionSearch: "Ahnliches suchen",
    actionSearchShort: "S",
    actionMore: "Mehr Aktionen",
    actionSendClipboard: "Zur Zwischenablage",
    actionSendClipboardShort: "C",
    duplicateFull: "In der Playlist",
    duplicatePartial: "Teilweise in der Playlist",
    duplicateJumpHint: "Klicken, um das Duplikat in der Playlist zu finden",
    duplicateReasonWholeTanda: "Die ganze Tanda ist bereits in der Playlist.",
    duplicateReasonTrack: "Track in der Playlist: {track}",
    duplicateReasonTracks: "Tracks in der Playlist: {tracks}",
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
    tabOrchestras: "Orchester",
    tabPlaylistSettings: "Liste",
    tabDisplayBoard: "Anzeige",
    libraryRoots: "Bibliotheksordner",
    libraryRootsHelp: "Musik- und Cortina-Ordner konfigurieren.",
    addMusicFolder: "Musikordner hinzufugen",
    addCortinaFolder: "Cortina-Ordner hinzufugen",
    addBackgroundFolder: "Hintergrundordner hinzufugen",
    scanLibrary: "Bibliothek scannen",
    scanMusic: "Musik scannen",
    scanCortinas: "Cortinas scannen",
    system: "System",
    systemGroupLanguage: "Sprache",
    systemGroupOutputs: "Ausgange",
    systemGroupStyles: "Stile",
    systemGroupSearch: "Suche / Bewertung",
    systemGroupCollections: "Sammlungen",
    systemGroupCounts: "Anzahlen",
    systemGroupDynamics: "Kompressor / Limiter",
    systemGroupData: "Daten",
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
    displayBackgroundInterval: "Hintergrundwechsel Anzeige (s)",
    displayUseImages: "Hintergrundbilder auf Anzeige verwenden",
    displayImageDimLabel: "Anzeige-Bild abdunkeln (%)",
    displayBaseFontSizeLabel: "Basis-Schriftgroesse Anzeige (%)",
    displayBaseFontSizeHelp: "Skaliert den Anzeigetext fur bessere Lesbarkeit aus der Distanz.",
    displayCortinaFontSizeLabel: "Cortina-Schriftgroesse Anzeige (%)",
    displayCortinaFontSizeHelp: "Skaliert die Cortina-Uberschrift getrennt.",
    displayEdgePaddingLabel: "Display-Randabstand (vmin)",
    displayEdgePaddingHelp: "Fuegt Abstand zwischen Text und Bildschirmrand hinzu.",
    searchMinScoreLabel: "Minimale Suchbewertung",
    searchBpmRangeLabel: "BPM-Bereich",
    trimPaddingLabel: "Trim-Puffer (s)",
    trimPaddingHelp:
      "Reduziert automatisch erkannte Start/End-Trims um diesen Wert.",
    playlistSettingsTitle: "Playlist-Einstellungen",
    playlistStartTimeLabel: "Playlist-Startzeit",
    playlistEndTimeLabel: "Geplante Playlist-Endzeit",
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
    diagnosticsDataReadiness: "Datenbereitschaft",
    diagnosticsReadinessTotalTracks: "Tracks",
    diagnosticsReadinessMissingDuration: "Fehlende Dauer",
    diagnosticsReadinessMissingLoudness: "Fehlende Lautheit+Gain",
    diagnosticsReadinessMissingTrimSignals: "Keine Trim-Signale",
    diagnosticsReadinessAnalysisErrors: "Analysefehler",
    diagnosticsReadinessMissingWaveforms: "Fehlende Wellenformen",
    eraseDatabase: "Datenbank loschen",
    confirmEraseDatabase:
      "Dadurch werden Bibliotheksscan, Tandas, Playlists und Einstellungen in dieser App dauerhaft geloscht. Ordner konnen danach erneut importiert werden, diese Aktion ist jedoch nicht ruckgangig zu machen.",
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
    statusAddedBackground: "Hintergrundordner hinzugefugt: {path}.",
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
    statusClipboardCleared: "Zwischenablage-Sammlungen aktualisiert.",
    statusPlaylistCleared: "Playlist geleert.",
    statusPlaylistAutofillRunning: "Playlist wird aufgebaut, bitte warten...",
    statusPlaylistAutofillDone:
      "Automatisches Fuellen abgeschlossen: {count} Tanda(s), Ende ca. {time}.",
    statusPlaylistAutofillPartial:
      "Automatisches Fuellen nach {count} Tanda(s) gestoppt: keine passenden Kandidaten.",
    confirmPlaylistClear: "Playlist leeren und alle Elemente entfernen?",
    confirmDiscardTrackEdits: "Ungespeicherte Track-Anderungen verwerfen?",
    playlistClearTitle: "Playlist-Leeren Optionen",
    playlistClearOnly: "Playlist leeren",
    playlistClearAutofill: "Leeren und automatisch fuellen",
    outputSelectionFailed: "Auswahl fehlgeschlagen.",
    outputSelectionFailedDetail: "Auswahl fehlgeschlagen: {message}",
    statusDspBypassedOutput:
      "Dynamik-DSP wird bei nicht standardmaessigen Ausgaengen umgangen. Fuer Kompression Standardausgabe verwenden.",
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
    cortinaLevelPercentLabel: "Cortina-Lautstaerke (% vom Hauptausgang)",
    audioDspEnabledLabel: "Echtzeit-Dynamik-DSP aktivieren",
    audioDynamicsPresetLabel: "Dynamik-Voreinstellung",
    audioDynamicsPresetOff: "Aus",
    audioDynamicsPresetGentle: "Sanft",
    audioDynamicsPresetBalanced: "Ausgewogen",
    audioDynamicsPresetStrong: "Stark",
    audioDynamicsPresetCustom: "Benutzerdefiniert",
    audioDynamicsThresholdLabel: "Kompressor-Schwelle (dB)",
    audioDynamicsRatioLabel: "Kompressor-Verhaeltnis",
    audioDynamicsMakeupLabel: "Makeup-Gain (dB)",
    audioDynamicsLimiterLabel: "Limiter-Grenze (dB)",
    audioLiveBoostLabel: "Live-Verstaerkung",
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
    tandaDone: "Schliessen",
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
    rootBackground: "Hintergrund",
    displayPlayingTrack: "Spiele Track {index} von {count}",
    displayThisTanda: "Diese tanda: {style}",
    displayNextTanda: "Naechste Tanda: {style}",
    displayThisIsLastTanda: "Das ist die letzte Tanda",
    displayNoMoreTandas: "Das war's, Leute",
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
    tabPlaylist: "Lista",
    tabTandaDesigner: "Designer de tandas",
    clipboardTitle: "Area de transferencia",
    clipboardCollectionsLabel: "Colecoes",
    clipboardCollectionPlaceholder: "Nova colecao",
    clipboardCollectionAdd: "Adicionar",
    clipboardCollectionInclude: "Incluir",
    clipboardCollectionGeneral: "Geral",
    clipboardCollectionNew: "Novos",
    clipboardCollectionTop: "Mais",
    clipboardCollectionLeast: "Menos",
    clipboardCollectionAvailable: "Disponiveis",
    clipboardFilterPlaceholder: "Filtrar",
    confirmClipboardCollectionRemove: "Remover a colecao \"{name}\"?",
    clipboardClear: "Limpar",
    clipboardClearTitle: "Limpar colecoes da area de transferencia",
    clipboardClearConfirm: "Limpar selecionadas",
    clipboardClearRemoveEmpty: "Remover colecoes vazias (exceto Geral/Novos)",
    playlistTitle: "Lista",
    playlistHint:
      "Use o menu da tanda para marcar um slot da playlist para substituicao e depois escolha faixa/tanda no Bloco ou na Busca. Sem slot marcado, os envios vao para o primeiro slot livre.",
    playlistCurrentIsLast: "A tanda atual e a ultima tanda",
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
    openDisplay: "Abrir tela externa",
    settings: "Ajustes",
    dataLocationLabel: "Local dos dados",
    dataLocationChoose: "Escolher…",
    dataLocationHelp:
      "Os dados sao armazenados em uma pasta _tp_data no local selecionado.",
    legacyImportTitle: "Importacao legada",
    legacyImportButton: "Importar tandas legadas",
    legacyReadinessButton: "Verificar prontidao da biblioteca",
    legacyReadinessRunning: "Executando verificacoes...",
    legacyReadinessPass: "Verificacao concluida com sucesso.",
    legacyReadinessWarn: "Pronta para reproducao com avisos.",
    legacyReadinessFail: "A verificacao falhou.",
    legacyReadinessSummary:
      "{status} Faixas {total}; duracao ausente {missingDuration}; loudness+ganho ausentes {missingLoudness}; sem sinais de trim {missingTrimSignals}; erros de analise {analysisErrors}; formas de onda ausentes {missingWaveforms}.",
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
    actionMarkPlaylistTrack: "Marcar alvo da faixa",
    actionMarkPlaylistTrackShort: "M",
    cancelTarget: "Cancelar alvo",
    cancel: "Cancelar",
    confirmOk: "OK",
    actionSearch: "Buscar similares",
    actionSearchShort: "S",
    actionMore: "Mais acoes",
    actionSendClipboard: "Enviar ao bloco",
    actionSendClipboardShort: "C",
    duplicateFull: "Na playlist",
    duplicatePartial: "Sobreposicao parcial na playlist",
    duplicateJumpHint: "Clique para localizar o duplicado na playlist",
    duplicateReasonWholeTanda: "A tanda completa ja existe na playlist.",
    duplicateReasonTrack: "Faixa na playlist: {track}",
    duplicateReasonTracks: "Faixas na playlist: {tracks}",
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
    tabOrchestras: "Orquestras",
    tabPlaylistSettings: "Lista",
    tabDisplayBoard: "Tela",
    libraryRoots: "Pastas da biblioteca",
    libraryRootsHelp: "Configure pastas de musica e cortinas.",
    addMusicFolder: "Adicionar musica",
    addCortinaFolder: "Adicionar cortinas",
    addBackgroundFolder: "Adicionar fundos",
    scanLibrary: "Escanear biblioteca",
    system: "Sistema",
    systemGroupLanguage: "Idioma",
    systemGroupOutputs: "Saidas",
    systemGroupStyles: "Estilos",
    systemGroupSearch: "Pesquisa / pontuacao",
    systemGroupCollections: "Colecoes",
    systemGroupCounts: "Contagens",
    systemGroupDynamics: "Compressor / limitador",
    systemGroupData: "Dados",
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
    displayBackgroundInterval: "Rotacao de fundos na tela (s)",
    displayUseImages: "Usar imagens de fundo na tela",
    displayImageDimLabel: "Escurecer imagem da tela (%)",
    displayBaseFontSizeLabel: "Tamanho base da fonte na tela (%)",
    displayBaseFontSizeHelp: "Escala o texto da tela para melhor leitura a distancia.",
    displayCortinaFontSizeLabel: "Tamanho da fonte cortina na tela (%)",
    displayCortinaFontSizeHelp: "Escala separadamente o titulo de cortina.",
    displayEdgePaddingLabel: "Espacamento da borda na tela (vmin)",
    displayEdgePaddingHelp: "Adiciona espaco entre o texto e as bordas da tela.",
    searchMinScoreLabel: "Pontuacao minima de busca",
    searchBpmRangeLabel: "Intervalo de BPM",
    trimPaddingLabel: "Ajuste de corte (s)",
    trimPaddingHelp:
      "Reduz os cortes de inicio/fim detectados automaticamente.",
    playlistSettingsTitle: "Ajustes da playlist",
    playlistStartTimeLabel: "Hora de inicio da playlist",
    playlistEndTimeLabel: "Hora prevista de fim da playlist",
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
    diagnosticsDataReadiness: "Prontidao de dados",
    diagnosticsReadinessTotalTracks: "Faixas",
    diagnosticsReadinessMissingDuration: "Duracao ausente",
    diagnosticsReadinessMissingLoudness: "Loudness+ganho ausentes",
    diagnosticsReadinessMissingTrimSignals: "Sem sinais de trim",
    diagnosticsReadinessAnalysisErrors: "Erros de analise",
    diagnosticsReadinessMissingWaveforms: "Formas de onda ausentes",
    eraseDatabase: "Apagar base",
    confirmEraseDatabase:
      "Isto apagará permanentemente a varredura da biblioteca, tandas, playlists e configuracoes guardadas nesta app. Pode reimportar pastas depois, mas esta acao nao pode ser desfeita.",
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
    statusAddedBackground: "Fundos adicionados: {path}.",
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
    statusClipboardCleared: "Colecoes da area de transferencia atualizadas.",
    statusPlaylistCleared: "Playlist limpa.",
    statusPlaylistAutofillRunning: "Montando playlist, aguarde por favor...",
    statusPlaylistAutofillDone:
      "Preenchimento automatico concluido: {count} tanda(s), termina por volta de {time}.",
    statusPlaylistAutofillPartial:
      "Preenchimento automatico interrompido apos {count} tanda(s): sem candidatos adequados.",
    confirmPlaylistClear: "Limpar a playlist e remover todos os itens?",
    confirmDiscardTrackEdits: "Descartar edicoes nao salvas da faixa?",
    playlistClearTitle: "Opcoes de limpeza da playlist",
    playlistClearOnly: "Limpar playlist",
    playlistClearAutofill: "Limpar e preencher automaticamente",
    outputSelectionFailed: "Falha ao selecionar saida.",
    outputSelectionFailedDetail: "Falha ao selecionar saida: {message}",
    statusDspBypassedOutput:
      "O DSP de dinamica e ignorado para saidas nao padrao. Use Saida padrao para ouvir compressao.",
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
    cortinaLevelPercentLabel: "Nivel da cortina (% da saida principal)",
    audioDspEnabledLabel: "Ativar DSP de dinamica em tempo real",
    audioDynamicsPresetLabel: "Predefinicao de dinamica",
    audioDynamicsPresetOff: "Desligado",
    audioDynamicsPresetGentle: "Suave",
    audioDynamicsPresetBalanced: "Equilibrado",
    audioDynamicsPresetStrong: "Forte",
    audioDynamicsPresetCustom: "Personalizado",
    audioDynamicsThresholdLabel: "Limiar do compressor (dB)",
    audioDynamicsRatioLabel: "Razao do compressor",
    audioDynamicsMakeupLabel: "Ganho de compensacao (dB)",
    audioDynamicsLimiterLabel: "Teto do limitador (dB)",
    audioLiveBoostLabel: "Reforco ao vivo",
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
    tandaDone: "Fechar",
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
    rootBackground: "Fundo",
    displayPlayingTrack: "Tocando faixa {index} de {count}",
    displayThisTanda: "Esta tanda: {style}",
    displayNextTanda: "Proxima tanda: {style}",
    displayThisIsLastTanda: "Esta e a ultima tanda",
    displayNoMoreTandas: "E isso, pessoal",
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
    tabPlaylist: "Scaletta",
    tabTandaDesigner: "Designer Tanda",
    clipboardTitle: "Appunti",
    clipboardCollectionsLabel: "Collezioni",
    clipboardCollectionPlaceholder: "Nuova collezione",
    clipboardCollectionAdd: "Aggiungi",
    clipboardCollectionInclude: "Includi",
    clipboardCollectionGeneral: "Generale",
    clipboardCollectionNew: "Nuovo",
    clipboardCollectionTop: "Piu",
    clipboardCollectionLeast: "Meno",
    clipboardCollectionAvailable: "Disponibili",
    clipboardFilterPlaceholder: "Filtra",
    confirmClipboardCollectionRemove: "Rimuovere la collezione \"{name}\"?",
    clipboardClear: "Svuota",
    clipboardClearTitle: "Svuota collezioni appunti",
    clipboardClearConfirm: "Svuota selezionate",
    clipboardClearRemoveEmpty: "Rimuovi collezioni vuote (tranne Generale/Nuovo)",
    playlistTitle: "Scaletta",
    playlistHint:
      "Usa il menu della tanda per segnare uno slot playlist da sostituire, poi scegli brano/tanda da Appunti o Ricerca. Senza slot segnato, gli invii vanno al primo slot libero.",
    playlistCurrentIsLast: "La tanda corrente e l'ultima tanda",
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
    openDisplay: "Apri schermo esterno",
    settings: "Impostazioni",
    dataLocationLabel: "Posizione dati",
    dataLocationChoose: "Scegli…",
    dataLocationHelp:
      "I dati sono salvati nella cartella _tp_data nella posizione selezionata.",
    legacyImportTitle: "Import legacy",
    legacyImportButton: "Importa tandas legacy",
    legacyReadinessButton: "Verifica stato libreria",
    legacyReadinessRunning: "Verifica in corso...",
    legacyReadinessPass: "Verifica completata con successo.",
    legacyReadinessWarn: "Pronta alla riproduzione con avvisi.",
    legacyReadinessFail: "Verifica non riuscita.",
    legacyReadinessSummary:
      "{status} Brani {total}; durata mancante {missingDuration}; loudness+gain mancanti {missingLoudness}; nessun segnale di trim {missingTrimSignals}; errori di analisi {analysisErrors}; forme d'onda mancanti {missingWaveforms}.",
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
    actionMarkPlaylistTrack: "Segna obiettivo brano",
    actionMarkPlaylistTrackShort: "M",
    cancelTarget: "Annulla obiettivo",
    cancel: "Annulla",
    confirmOk: "OK",
    actionSearch: "Cerca simili",
    actionSearchShort: "S",
    actionMore: "Altre azioni",
    actionSendClipboard: "Invia agli appunti",
    actionSendClipboardShort: "C",
    duplicateFull: "In playlist",
    duplicatePartial: "Parziale sovrapposizione in playlist",
    duplicateJumpHint: "Fai clic per trovare il duplicato nella playlist",
    duplicateReasonWholeTanda: "La tanda completa esiste gia in playlist.",
    duplicateReasonTrack: "Brano in playlist: {track}",
    duplicateReasonTracks: "Brani in playlist: {tracks}",
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
    tabOrchestras: "Orchestre",
    tabPlaylistSettings: "Scaletta",
    tabDisplayBoard: "Display",
    libraryRoots: "Radici libreria",
    libraryRootsHelp: "Configura cartelle musica e cortina per la scansione.",
    addMusicFolder: "Aggiungi cartella musica",
    addCortinaFolder: "Aggiungi cartella cortina",
    addBackgroundFolder: "Aggiungi cartella sfondi",
    scanLibrary: "Scansiona libreria",
    scanMusic: "Scansiona musica",
    scanCortinas: "Scansiona cortine",
    system: "Sistema",
    systemGroupLanguage: "Lingua",
    systemGroupOutputs: "Uscite",
    systemGroupStyles: "Stili",
    systemGroupSearch: "Ricerca / punteggio",
    systemGroupCollections: "Collezioni",
    systemGroupCounts: "Conteggi",
    systemGroupDynamics: "Compressore / limiter",
    systemGroupData: "Dati",
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
    displayBackgroundInterval: "Rotazione sfondi schermo (s)",
    displayUseImages: "Usa immagini di sfondo sul display",
    displayImageDimLabel: "Scurisci immagine display (%)",
    displayBaseFontSizeLabel: "Dimensione base carattere display (%)",
    displayBaseFontSizeHelp: "Scala il testo del display per leggibilita a distanza.",
    displayCortinaFontSizeLabel: "Dimensione carattere cortina display (%)",
    displayCortinaFontSizeHelp: "Scala separatamente il titolo cortina.",
    displayEdgePaddingLabel: "Spazio bordo display (vmin)",
    displayEdgePaddingHelp: "Aggiunge spazio tra il testo e i bordi dello schermo.",
    searchMinScoreLabel: "Punteggio minimo ricerca",
    searchBpmRangeLabel: "Intervallo BPM",
    trimPaddingLabel: "Margine taglio (s)",
    trimPaddingHelp:
      "Riduce i tagli inizio/fine rilevati automaticamente.",
    playlistSettingsTitle: "Impostazioni playlist",
    playlistStartTimeLabel: "Ora inizio playlist",
    playlistEndTimeLabel: "Ora prevista di fine playlist",
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
    diagnosticsDataReadiness: "Stato dati",
    diagnosticsReadinessTotalTracks: "Brani",
    diagnosticsReadinessMissingDuration: "Durata mancante",
    diagnosticsReadinessMissingLoudness: "Loudness+gain mancanti",
    diagnosticsReadinessMissingTrimSignals: "Nessun segnale di trim",
    diagnosticsReadinessAnalysisErrors: "Errori di analisi",
    diagnosticsReadinessMissingWaveforms: "Forme d'onda mancanti",
    eraseDatabase: "Cancella database",
    confirmEraseDatabase:
      "Questa azione eliminera definitivamente scansione libreria, tandas, playlist e impostazioni salvate in questa app. Potrai reimportare le cartelle dopo, ma l'azione non e annullabile.",
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
    statusAddedBackground: "Cartella sfondi aggiunta: {path}.",
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
    statusClipboardCleared: "Collezioni appunti aggiornate.",
    statusPlaylistCleared: "Playlist svuotata.",
    statusPlaylistAutofillRunning: "Creazione playlist in corso, attendere...",
    statusPlaylistAutofillDone:
      "Riempimento automatico completato: {count} tanda, fine circa alle {time}.",
    statusPlaylistAutofillPartial:
      "Riempimento automatico fermato dopo {count} tanda: nessun candidato adatto.",
    confirmPlaylistClear: "Svuotare la playlist e rimuovere tutti gli elementi?",
    confirmDiscardTrackEdits: "Scartare le modifiche traccia non salvate?",
    playlistClearTitle: "Opzioni svuota playlist",
    playlistClearOnly: "Svuota playlist",
    playlistClearAutofill: "Svuota e riempi automaticamente",
    outputSelectionFailed: "Selezione uscita fallita.",
    outputSelectionFailedDetail: "Selezione uscita fallita: {message}",
    statusDspBypassedOutput:
      "Il DSP dinamico viene ignorato per uscite non predefinite. Usa l'uscita predefinita per sentire la compressione.",
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
    cortinaLevelPercentLabel: "Livello cortina (% uscita principale)",
    audioDspEnabledLabel: "Abilita DSP dinamica in tempo reale",
    audioDynamicsPresetLabel: "Preset dinamica",
    audioDynamicsPresetOff: "Spento",
    audioDynamicsPresetGentle: "Leggero",
    audioDynamicsPresetBalanced: "Bilanciato",
    audioDynamicsPresetStrong: "Forte",
    audioDynamicsPresetCustom: "Personalizzato",
    audioDynamicsThresholdLabel: "Soglia compressore (dB)",
    audioDynamicsRatioLabel: "Rapporto compressore",
    audioDynamicsMakeupLabel: "Guadagno makeup (dB)",
    audioDynamicsLimiterLabel: "Soglia limiter (dB)",
    audioLiveBoostLabel: "Boost live",
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
    tandaDone: "Chiudi",
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
    rootBackground: "Sfondo",
    displayPlayingTrack: "Riproduzione brano {index} di {count}",
    displayThisTanda: "Questa tanda: {style}",
    displayNextTanda: "Prossima tanda: {style}",
    displayThisIsLastTanda: "Questa e l'ultima tanda",
    displayNoMoreTandas: "E' tutto, amici",
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
    element.textContent = t(key);
  });
  document
    .querySelectorAll<HTMLButtonElement>(".track-editor-search-field")
    .forEach((button) => {
      const label = t("actionSearch");
      button.title = label;
      button.setAttribute("aria-label", label);
    });
  renderLanguageOptions();
  updateSortButtons();
  updateNowPlayingDisplay();
  renderTandaDesigner();
};

const gainForTrack = (gainDb: number | null | undefined) => {
  return gainDbToLinear(gainDb, 2);
};
const audioLevels = new WeakMap<HTMLAudioElement, number>();

const releaseAudioDspRuntime = async (_audio: HTMLAudioElement) => {};

const setAudioLevel = (audio: HTMLAudioElement, level: number) => {
  const safe = Math.max(0, level);
  audioLevels.set(audio, safe);
  audio.volume = Math.min(1, safe);
};

const getAudioLevel = (audio: HTMLAudioElement) => {
  const stored = audioLevels.get(audio);
  if (typeof stored === "number" && Number.isFinite(stored)) {
    return Math.max(0, stored);
  }
  return Math.max(0, audio.volume || 0);
};

const resumeAudioContextForElement = async (audio: HTMLAudioElement) => {
  void audio;
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

const isTrackEditorOpen = () => Boolean(trackEditor?.classList.contains("open"));

const clearTrackEditorState = () => {
  trackEditorState.track = null;
  resetTapTempo();
};

const getTrackEditorDraftPayload = () => {
  if (!trackEditorState.track) {
    return null;
  }
  const bpmText = trackEditorBpmInput?.value?.trim() ?? "";
  const bpmValue = bpmText.length > 0 ? Number.parseFloat(bpmText) : null;
  return {
    id: trackEditorState.track.id,
    title: trackEditorTitleInput?.value ?? "",
    artist: trackEditorArtistInput?.value ?? "",
    singer: trackEditorSingerInput?.value ?? "",
    instrumental: trackEditorVocalInput?.value === "instrumental",
    album: trackEditorAlbumInput?.value ?? "",
    year: trackEditorYearInput?.value ?? "",
    genre: trackEditorGenreInput?.value ?? "",
    notes: trackEditorNotesInput?.value ?? "",
    bpm: Number.isFinite(bpmValue ?? Number.NaN) ? bpmValue : null,
  };
};

const isTrackEditorDirty = () => {
  const original = trackEditorState.track;
  const draft = getTrackEditorDraftPayload();
  if (!original || !draft) {
    return false;
  }
  const normalizedOriginalBpm =
    original.bpm !== null && original.bpm !== undefined ? Number(original.bpm) : null;
  const normalizedDraftBpm = draft.bpm !== null ? Number(draft.bpm) : null;
  return (
    draft.title !== (original.title ?? "") ||
    draft.artist !== (original.artist ?? "") ||
    draft.singer !== (original.singer ?? "") ||
    draft.instrumental !== Boolean(original.instrumental) ||
    draft.album !== (original.album ?? "") ||
    draft.year !== (original.year ?? "") ||
    draft.genre !== (original.genre ?? "") ||
    draft.notes !== (original.notes ?? "") ||
    normalizedDraftBpm !== normalizedOriginalBpm
  );
};

const confirmTrackEditorDiscardIfDirty = async () => {
  if (!isTrackEditorDirty()) {
    return true;
  }
  return showConfirmModal(t("confirmDiscardTrackEdits"));
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

const openTrackEditor = async (trackId: string) => {
  const track = trackCache.get(trackId);
  if (!track) {
    return;
  }
  const currentTrackId = trackEditorState.track?.id ?? null;
  if (
    isTrackEditorOpen() &&
    currentTrackId &&
    currentTrackId !== trackId &&
    !(await confirmTrackEditorDiscardIfDirty())
  ) {
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
const getPlaylistEndTimeInput = () =>
  localStorage.getItem(PLAYLIST_END_TIME_KEY) ?? DEFAULT_PLAYLIST_END_TIME;

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
  if (durationMs > 0) {
    return durationMs + gaps;
  }
  const fallback =
    typeof tanda.totalDurationMs === "number" && Number.isFinite(tanda.totalDurationMs)
      ? Math.max(0, tanda.totalDurationMs)
      : 0;
  return fallback;
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
      const tanda = resolveTandaDraft(item.tandaId);
      const fallbackDurationMs =
        tanda &&
        typeof tanda.totalDurationMs === "number" &&
        Number.isFinite(tanda.totalDurationMs)
          ? Math.max(0, tanda.totalDurationMs)
          : 0;
      if (fallbackDurationMs <= 0) {
        return;
      }
      entries.push({
        index,
        durationMs: fallbackDurationMs,
        trackDurationsMs: [fallbackDurationMs],
      });
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
  const elapsedMs = getLiveElapsedMs(timeline);
  if (elapsedMs !== null) {
    const recalibrated = Date.now() - elapsedMs;
    playlistPlayback.liveBaseStartMs = recalibrated;
    return recalibrated;
  }
  if (playlistPlayback.liveBaseStartMs) {
    return playlistPlayback.liveBaseStartMs;
  }
  return null;
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
  const nowMs = Date.now();
  const startTimes = new Map<number, number>();
  timeline.offsets.forEach((offsetMs, idx) => {
    const eventMs = baseStartMs ? baseStartMs + offsetMs : null;
    const minutes =
      eventMs !== null
        ? getMinutesOfDayFromMs(eventMs + (eventMs > nowMs ? 59_999 : 0))
        : startMinutes + Math.ceil(offsetMs / 60000);
    startTimes.set(timeline.entries[idx].index, minutes);
  });
  return startTimes;
};

const getCortinaStartTimes = () => {
  const timeline = buildPlaylistTimeline();
  const baseStartMs = getLiveBaseStartMs(timeline);
  const startMinutes = getPlaylistStartTimeMinutes();
  const nowMs = Date.now();
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
    const eventMs = baseStartMs ? baseStartMs + cortinaStartMs : null;
    const minutes =
      eventMs !== null
        ? getMinutesOfDayFromMs(eventMs + (eventMs > nowMs ? 59_999 : 0))
        : startMinutes + Math.ceil(cortinaStartMs / 60000);
    startTimes.set(timeline.entries[idx].index, minutes);
  });
  const totalMs = computeTimelineTotalMs(timeline.offsets, timeline.entries);
  const endStartMs = totalMs + gapBeforeCortinaMs;
  const endMs = baseStartMs ? baseStartMs + endStartMs : null;
  const endMinutes =
    endMs !== null
      ? getMinutesOfDayFromMs(endMs + (endMs > nowMs ? 59_999 : 0))
      : startMinutes + Math.ceil(endStartMs / 60000);
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
const getCortinaLevelPercent = () =>
  parseSettingNumber(
    CORTINA_LEVEL_PERCENT_KEY,
    DEFAULT_CORTINA_LEVEL_PERCENT,
    0,
    100,
  );
const applyAudioDynamicsToGain = (linearGain: number) => linearGain;
const applyDynamicLevelToChannel = (channel: OutputChannel) => {
  const state = playback[channel];
  if (!state.active) {
    return;
  }
  const linearGain = gainForTrack(state.appliedGainDb);
  let targetVolume = applyAudioDynamicsToGain(linearGain);
  if (state.isCortinaPlayback && channel === "main") {
    targetVolume *= getCortinaLevelPercent() / 100;
  }
  setAudioLevel(state.active, targetVolume);
};
const applyDynamicLevelToActivePlayback = () => {
  applyDynamicLevelToChannel("main");
  applyDynamicLevelToChannel("headphone");
};
const isCurrentTandaMarkedLast = () =>
  localStorage.getItem(PLAYLIST_LAST_TANDA_KEY) === "1";
const getPlaylistStartTimeMinutes = () => {
  return parseClockMinutes(
    getPlaylistStartTimeInput().trim() || DEFAULT_PLAYLIST_START_TIME,
    20 * 60,
  );
};

const getPlaylistEndTimeMinutes = () =>
  parseClockMinutes(getPlaylistEndTimeInput().trim() || DEFAULT_PLAYLIST_END_TIME, 3 * 60);

const getPlaylistTargetWindowMs = () => {
  const startMinutes = getPlaylistStartTimeMinutes();
  const endMinutes = getPlaylistEndTimeMinutes();
  return computePlaylistWindowMinutes(startMinutes, endMinutes) * 60 * 1000;
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
  const activeWidgets = waveformWidgets.filter(
    (widget) => widget.container && widget.image,
  );
  if (activeWidgets.length === 0) {
    return;
  }
  if (!trackId) {
    activeWidgets.forEach((widget) => {
      widget.image!.src = "";
      widget.container!.classList.add("hidden");
      widget.container!.classList.remove("missing");
      if (widget.placeholder) {
        widget.placeholder.textContent = t("waveformUnavailable");
      }
    });
    waveformTrackId = null;
    return;
  }
  if (
    waveformTrackId === trackId &&
    activeWidgets.some((widget) => Boolean(widget.image?.src))
  ) {
    return;
  }
  waveformTrackId = trackId;
  activeWidgets.forEach((widget) => {
    widget.container!.classList.remove("hidden");
    widget.container!.classList.add("missing");
    if (widget.placeholder) {
      widget.placeholder.textContent = t("waveformLoading");
    }
  });
  const requestId = (waveformRequestId += 1);
  const dataUrl = await window.tanda?.getWaveform(trackId);
  if (requestId !== waveformRequestId) {
    return;
  }
  if (dataUrl) {
    activeWidgets.forEach((widget) => {
      widget.image!.src = dataUrl;
      widget.container!.classList.remove("hidden");
      widget.container!.classList.remove("missing");
    });
  } else {
    activeWidgets.forEach((widget) => {
      widget.image!.src = "";
      widget.container!.classList.remove("hidden");
      widget.container!.classList.add("missing");
      if (widget.placeholder) {
        widget.placeholder.textContent = t("waveformUnavailable");
      }
    });
    setStatus(t("statusWaveformUnavailable"));
  }
};

const toDisplayStyleLabel = (style: string | null | undefined) => {
  if (!style) {
    return "";
  }
  const trimmed = style.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const getCurrentProgressText = () => {
  if (playlistPlayback.status !== "playing") {
    return "";
  }
  const currentItem = playlistItems[playlistPlayback.currentIndex];
  if (!currentItem) {
    return "";
  }
  if (currentItem.kind === "track") {
    return t("displayPlayingTrack", { index: 1, count: 1 });
  }
  const tanda = resolveTandaDraft(currentItem.tandaId);
  if (!tanda) {
    return "";
  }
  const count = tanda.trackSlots.filter(Boolean).length;
  if (count <= 0) {
    return "";
  }
  const index = Math.min(count, Math.max(1, playlistPlayback.currentTrackIndex + 1));
  return t("displayPlayingTrack", { index, count });
};

const getNextTandaStyle = () => {
  if (isCurrentTandaMarkedLast()) {
    return "";
  }
  if (!shouldShowDisplayNextTanda(playlistPlayback.status)) {
    return "";
  }
  let startIndex = 0;
  if (playlistPlayback.status === "playing") {
    startIndex = playlistPlayback.currentIndex + 1;
  } else if (playlistPlayback.status === "paused" && playlistPlayback.resume) {
    startIndex = playlistPlayback.resume.itemIndex;
  }
  for (let i = Math.max(0, startIndex); i < playlistItems.length; i += 1) {
    const item = playlistItems[i];
    if (!item || item.kind === "track") {
      continue;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    const style = toDisplayStyleLabel(tanda?.styles?.[0]);
    if (!style) {
      continue;
    }
    return style;
  }
  return "";
};

const getNextTandaLabel = () => {
  if (isCurrentTandaMarkedLast()) {
    return t("displayThisIsLastTanda");
  }
  const style = getNextTandaStyle();
  if (style) {
    return t("displayNextTanda", { style });
  }
  return "";
};

const updateExternalDisplay = () => {
  if (!window.tanda?.updateDisplay) {
    return;
  }
  const nextStyle = getNextTandaStyle();
  const isMarkedLast = isCurrentTandaMarkedLast();
  const cortinaHeadline = isMarkedLast ? t("displayNoMoreTandas") : t("cortinaRowLabel");
  const cortinaSubline = isMarkedLast
    ? ""
    : nextStyle
      ? t("displayThisTanda", { style: nextStyle })
      : "";
  if (cortinaDisplayPhase !== "none") {
    holdCortinaDisplayWhenIdle = true;
    const payload: DisplayUpdatePayload = {
      title: cortinaHeadline,
      artist: cortinaSubline,
      progressText: "",
      nextTandaText: "",
      backgroundIntervalSec: getDisplayBackgroundIntervalSec(),
      useBackgroundImages: getDisplayUseBackgroundImages(),
      imageDimOpacity: getDisplayImageDimOpacity(),
      fontScale: getDisplayFontScale(),
      cortinaFontScale: getDisplayCortinaFontScale(),
      edgePaddingVmin: getDisplayEdgePaddingVmin(),
      mode: "cortina",
    };
    const signature = JSON.stringify(payload);
    if (signature === lastDisplayPayloadSignature) {
      return;
    }
    lastDisplayPayloadSignature = signature;
    void window.tanda.updateDisplay(payload);
    return;
  }
  const active = getNowPlayingState();
  if (!active) {
    if (holdCortinaDisplayWhenIdle) {
      const payload: DisplayUpdatePayload = {
        title: cortinaHeadline,
        artist: cortinaSubline,
        progressText: "",
        nextTandaText: "",
        backgroundIntervalSec: getDisplayBackgroundIntervalSec(),
        useBackgroundImages: getDisplayUseBackgroundImages(),
        imageDimOpacity: getDisplayImageDimOpacity(),
        fontScale: getDisplayFontScale(),
        cortinaFontScale: getDisplayCortinaFontScale(),
        edgePaddingVmin: getDisplayEdgePaddingVmin(),
        mode: "cortina",
      };
      const signature = JSON.stringify(payload);
      if (signature === lastDisplayPayloadSignature) {
        return;
      }
      lastDisplayPayloadSignature = signature;
      void window.tanda.updateDisplay(payload);
      return;
    }
    const payload: DisplayUpdatePayload = {
      backgroundIntervalSec: getDisplayBackgroundIntervalSec(),
      useBackgroundImages: getDisplayUseBackgroundImages(),
      imageDimOpacity: getDisplayImageDimOpacity(),
      fontScale: getDisplayFontScale(),
      cortinaFontScale: getDisplayCortinaFontScale(),
      edgePaddingVmin: getDisplayEdgePaddingVmin(),
      mode: "normal",
    };
    const signature = JSON.stringify(payload);
    if (signature === lastDisplayPayloadSignature) {
      return;
    }
    lastDisplayPayloadSignature = signature;
    void window.tanda.updateDisplay(payload);
    return;
  }
  const track = active?.state.track ?? null;
  if (!track) {
    return;
  }
  holdCortinaDisplayWhenIdle = false;
  const title = track?.title?.trim() || t("nowPlayingUnknown");
  const artist = track?.artist?.trim() ?? "";
  const payload: DisplayUpdatePayload = {
    title,
    artist,
    progressText: getCurrentProgressText(),
    nextTandaText: getNextTandaLabel(),
    backgroundIntervalSec: getDisplayBackgroundIntervalSec(),
    useBackgroundImages: getDisplayUseBackgroundImages(),
    imageDimOpacity: getDisplayImageDimOpacity(),
    fontScale: getDisplayFontScale(),
    cortinaFontScale: getDisplayCortinaFontScale(),
    edgePaddingVmin: getDisplayEdgePaddingVmin(),
    mode: "normal",
  };
  const signature = JSON.stringify(payload);
  if (signature === lastDisplayPayloadSignature) {
    return;
  }
  lastDisplayPayloadSignature = signature;
  void window.tanda.updateDisplay(payload);
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
    waveformWidgets.forEach((widget) => {
      if (widget.progress) {
        widget.progress.style.width = "0%";
      }
      if (widget.playhead) {
        widget.playhead.style.left = "0%";
      }
    });
    updatePlayingIndicators();
    updateHeadphoneButtonIndicators();
    updateExternalDisplay();
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
  waveformWidgets.forEach((widget) => {
    if (widget.progress) {
      widget.progress.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
    }
    if (widget.playhead) {
      widget.playhead.style.left = `${Math.min(100, Math.max(0, progress * 100))}%`;
    }
  });
  void updateWaveformSource(track?.id ?? null);
  updatePlayingIndicators();
  updateHeadphoneButtonIndicators();
  updateExternalDisplay();
};

const seekToWaveformPosition = (
  event: MouseEvent,
  container: HTMLDivElement | null = waveformContainer,
) => {
  const active = getNowPlayingState();
  if (!active || !active.state.active) {
    return;
  }
  if (appMode !== "prep" && appMode !== "edit") {
    return;
  }
  if (!container) {
    return;
  }
  const rect = container.getBoundingClientRect();
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
      const confirmed = await showConfirmModal(
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
    renderPlaylist();
    await refreshNewCollectionTracks();
    await renderClipboard();
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
    const wasPlaylistHosted = tandaEditorHostTab === "playlist-tab";
    const confirmed = await showConfirmModal(t("confirmDeleteTanda"));
    if (!confirmed) {
      return;
    }
    if (window.tanda) {
      await window.tanda.deleteTanda(tandaId);
    }
    const removedFromPlaylist = playlistItems.reduce((count, item, index) => {
      if (item?.kind !== "tanda" || item.tandaId !== tandaId) {
        return count;
      }
      playlistItems[index] = null;
      return count + 1;
    }, 0);
    if (removedFromPlaylist > 0) {
      normalizePlaylist();
      clearPlaylistTarget();
      if (playlistOpenTandaIndex !== null) {
        const openItem = playlistItems[playlistOpenTandaIndex];
        if (!openItem || openItem.kind !== "tanda" || openItem.tandaId === tandaId) {
          clearPlaylistOpenTanda();
        }
      }
    }
    clipboardCollections.forEach((collection) => {
      collection.tandaIds = collection.tandaIds.filter((id) => id !== tandaId);
    });
    if (selectedClipboardTandaId === tandaId) {
      selectedClipboardTandaId = null;
    }
    saveClipboardCollections();
    tandaCache.delete(tandaId);
    tandaDrafts = tandaDrafts.filter((item) => item.id !== tandaId);
    if (selectedTandaId === tandaId) {
      selectedTandaId = tandaDrafts[0]?.id ?? null;
    }
    setStatus(t("statusTandaDeleted"));
    if (wasPlaylistHosted) {
      clearPlaylistOpenTanda();
      activateRightTab("playlist-tab");
    }
    renderTandaDesigner();
    renderPlaylist();
    renderClipboardCollections();
    renderClipboard();
    await refreshNewCollectionTracks();
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
  const playlistDrafts = tandaDrafts.filter((item) => item.origin === "playlist");
  const draft = createEmptyTanda();
  tandaDrafts = [...playlistDrafts, draft];
  selectedTandaId = draft.id;
};

const updatePlayingIndicators = () => {
  const active = getNowPlayingState();
  const activeId = active?.state.currentTrackId ?? null;
  const activeChannel = active?.channel ?? null;
  const cssEscape =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape
      : (value: string) => value.replace(/["\\]/g, "\\$&");
  const clearRows = (trackId: string | null) => {
    if (!trackId) {
      return;
    }
    document
      .querySelectorAll<HTMLElement>(
        `.list-row[data-track-id="${cssEscape(trackId)}"]`,
      )
      .forEach((row) => {
        if (row.classList.contains("cortina-row")) {
          return;
        }
        row.classList.remove("playing", "playing-headphone");
      });
  };
  if (!activeId) {
    clearRows(lastPlayingIndicatorTrackId);
    lastPlayingIndicatorTrackId = null;
    return;
  }
  if (lastPlayingIndicatorTrackId && lastPlayingIndicatorTrackId !== activeId) {
    clearRows(lastPlayingIndicatorTrackId);
  }
  document
    .querySelectorAll<HTMLElement>(
      `.list-row[data-track-id="${cssEscape(activeId)}"]`,
    )
    .forEach((row) => {
      if (row.classList.contains("cortina-row")) {
        row.classList.remove("playing", "playing-headphone");
        return;
      }
      row.classList.add("playing");
      row.classList.toggle("playing-headphone", activeChannel === "headphone");
    });
  lastPlayingIndicatorTrackId = activeId;
};

const fadeBetween = (
  from: HTMLAudioElement | undefined,
  to: HTMLAudioElement,
  targetVolume: number,
  durationMs = 600,
) => {
  setAudioLevel(to, targetVolume);
  if (!from) {
    return;
  }
  const fromStart = getAudioLevel(from);
  const start = performance.now();
  const step = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(1, durationMs > 0 ? elapsed / durationMs : 1);
    setAudioLevel(from, Math.max(0, fromStart * (1 - t)));
    if (t >= 1) {
      from.pause();
      from.currentTime = 0;
      void releaseAudioDspRuntime(from);
      return;
    }
    window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
};

type OutputRoutingResult = {
  requestedDeviceId: string | null;
  appliedDeviceId: string | null;
  method: "default" | "setSinkId" | "selectAudioOutput" | "unsupported" | "failed";
  error: string | null;
  attemptedDeviceIds: string[];
};

const applyOutputDevice = async (
  element: HTMLAudioElement,
  deviceId: string | null,
): Promise<OutputRoutingResult> => {
  if (!deviceId) {
    return {
      requestedDeviceId: null,
      appliedDeviceId: null,
      method: "default",
      error: null,
      attemptedDeviceIds: [],
    };
  }
  const setSink = element.setSinkId as
    | ((sinkId: string) => Promise<void>)
    | undefined;
  if (!setSink) {
    const message = "setSinkId unsupported";
    setStatus(t("outputSelectionFailedDetail", { message }));
    return {
      requestedDeviceId: deviceId,
      appliedDeviceId: null,
      method: "unsupported",
      error: message,
      attemptedDeviceIds: [deviceId],
    };
  }
  try {
    const candidateIds = Array.from(
      new Set([
        deviceId,
        ...(audioOutputRouteCandidates.get(deviceId) ?? []),
      ]),
    );
    const attemptedDeviceIds: string[] = [];
    const orderedCandidates = Array.from(new Set(candidateIds));
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), ms);
      });
    let lastSetSinkMessage: string | null = null;
    for (const candidateId of orderedCandidates) {
      attemptedDeviceIds.push(candidateId);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await setSink.call(element, candidateId);
          return {
            requestedDeviceId: deviceId,
            appliedDeviceId: candidateId,
            method: "setSinkId",
            error: null,
            attemptedDeviceIds,
          };
        } catch (error) {
          lastSetSinkMessage =
            error instanceof Error ? error.message : String(error);
          if (attempt < 2) {
            await wait(120);
          }
        }
      }
    }
    const setSinkMessage = lastSetSinkMessage ?? "setSinkId failed";
    setStatus(t("outputSelectionFailedDetail", { message: setSinkMessage }));
    return {
      requestedDeviceId: deviceId,
      appliedDeviceId: null,
      method: "failed",
      error: setSinkMessage,
      attemptedDeviceIds,
    };
  } catch {
    return {
      requestedDeviceId: deviceId,
      appliedDeviceId: null,
      method: "failed",
      error: "setSinkId failed",
      attemptedDeviceIds: [deviceId],
    };
  }
};

const resolveOutputDeviceIdForChannel = (
  channel: OutputChannel,
): string | null => {
  const selectedId =
    channel === "main"
      ? mainOutputSelect?.value ?? null
      : headphoneOutputSelect?.value ?? null;
  const rawId =
    channel === "main"
      ? localStorage.getItem("tanda-main-output")
      : localStorage.getItem("tanda-headphone-output");
  const resolved = chooseAvailableOutputDeviceId(audioOutputs, [selectedId, rawId]);
  if (resolved) {
    persistOutputDeviceSelection(channel, resolved);
  }
  return resolved;
};

const persistOutputDeviceSelection = (
  channel: "main" | "headphone",
  deviceId: string | null,
) => {
  const keyPrefix = `tanda-${channel}-output`;
  if (!deviceId || deviceId === DEFAULT_OUTPUT_ID) {
    if (channel === "main") {
      localStorage.setItem(keyPrefix, DEFAULT_OUTPUT_ID);
      localStorage.setItem(`${keyPrefix}-label`, t("outputDefault"));
      localStorage.removeItem(`${keyPrefix}-group`);
      return;
    }
    localStorage.removeItem(keyPrefix);
    localStorage.removeItem(`${keyPrefix}-label`);
    localStorage.removeItem(`${keyPrefix}-group`);
    return;
  }
  const device = audioOutputs.find((output) => output.deviceId === deviceId);
  localStorage.setItem(keyPrefix, deviceId);
  if (device?.label) {
    localStorage.setItem(`${keyPrefix}-label`, device.label);
  }
  if (device?.groupId) {
    localStorage.setItem(`${keyPrefix}-group`, device.groupId);
  }
};

const verifyOutputSelection = async (
  channel: "main" | "headphone",
  deviceId: string | null,
) => {
  if (!deviceId || deviceId === DEFAULT_OUTPUT_ID) {
    persistOutputDeviceSelection(channel, deviceId);
    return true;
  }
  let verifiedDeviceId = deviceId;
  const selectAudioOutput = (
    navigator.mediaDevices as MediaDevices & {
      selectAudioOutput?: (options?: { deviceId?: string }) => Promise<{
        deviceId: string;
      }>;
    }
  ).selectAudioOutput;
  if (typeof selectAudioOutput === "function") {
    try {
      const granted = await selectAudioOutput({ deviceId });
      if (granted?.deviceId) {
        verifiedDeviceId = granted.deviceId;
      }
    } catch (error) {
      setStatus(
        t("outputSelectionFailedDetail", {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return false;
    }
  }
  const probe = new Audio();
  const routing = await applyOutputDevice(probe, verifiedDeviceId);
  probe.pause();
  probe.src = "";
  if (!routing.appliedDeviceId) {
    return false;
  }
  persistOutputDeviceSelection(channel, routing.appliedDeviceId);
  return true;
};

type PlayOptions = {
  allowToggle?: boolean;
  startAtSeconds?: number;
  maxDurationSeconds?: number;
  isCortinaPlayback?: boolean;
  autoStopFadeMs?: number;
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
    await releaseAudioDspRuntime(state.active);
    state.currentTrackId = undefined;
    state.active = undefined;
    state.track = undefined;
    state.appliedGainDb = null;
    state.isCortinaPlayback = false;
    lastAppliedGainDbByChannel[channel] = null;
    updateNowPlayingDisplay();
    return false;
  }

  const next = new Audio();
  next.loop = false;
  const normalization = resolvePlaybackNormalization(gainDb, track?.loudness_db);
  let appliedGainDb = normalization.gainDb;
  let stepCorrectionDb = 0;
  if (normalization.source === "gain" && normalization.loudnessDb === null) {
    const stepGuard = applyGainStepGuard(
      normalization.gainDb,
      lastAppliedGainDbByChannel[channel],
      MAX_GAIN_ONLY_STEP_DB,
    );
    appliedGainDb = stepGuard.gainDb;
    stepCorrectionDb = stepGuard.correctionDb;
  }
  let targetVolume = gainForTrack(appliedGainDb);
  const gainSource =
    normalization.source === "gain"
      ? "gain_db"
      : normalization.source === "loudness"
        ? "loudness_db"
        : "none";
  setAudioLevel(next, targetVolume);
  const requestedOutputDeviceId = resolveOutputDeviceIdForChannel(channel);
  targetVolume = applyAudioDynamicsToGain(targetVolume);
  if (options?.isCortinaPlayback && channel === "main") {
    targetVolume *= getCortinaLevelPercent() / 100;
  }
  const preAttachRouting = await applyOutputDevice(next, requestedOutputDeviceId);
  next.src = filePath;
  const postAttachRouting = await applyOutputDevice(next, requestedOutputDeviceId);
  const outputRouting =
    postAttachRouting.appliedDeviceId || !preAttachRouting.appliedDeviceId
      ? postAttachRouting
      : preAttachRouting;
  if (requestedOutputDeviceId && !outputRouting.appliedDeviceId) {
    await releaseAudioDspRuntime(next);
    void window.tanda?.logPlaybackDiagnostic?.({
      channel,
      mode: appMode,
      trackId,
      title: track?.title ?? "",
      artist: track?.artist ?? "",
      playlistStatus: playlistPlayback.status,
      playlistIndex: playlistPlayback.currentIndex,
      trackIndex: playlistPlayback.currentTrackIndex,
      gainSource,
      gainDb: appliedGainDb,
      loudnessDb: normalization.loudnessDb,
      linearGain: targetVolume,
      correctionDb: normalization.correctionDb + stepCorrectionDb,
      driftDb: normalization.driftDb,
      targetLoudnessDb: normalization.targetLoudnessDb,
      expectedOutputLoudnessDb:
        normalization.loudnessDb !== null && appliedGainDb !== null
          ? normalization.loudnessDb + appliedGainDb
          : null,
      requestedOutputDeviceId,
      appliedOutputDeviceId: outputRouting.appliedDeviceId,
      outputRouteMethod: outputRouting.method,
      outputRouteError: outputRouting.error,
      attemptedOutputDeviceIds: [
        ...preAttachRouting.attemptedDeviceIds,
        ...postAttachRouting.attemptedDeviceIds,
      ],
    });
    setStatus(
      t("outputSelectionFailedDetail", {
        message:
          outputRouting.error ??
          (channel === "headphone"
            ? "headphone routing unavailable"
            : "main output routing unavailable"),
      }),
    );
    return false;
  }
  void window.tanda?.logPlaybackDiagnostic?.({
    channel,
    mode: appMode,
    trackId,
    title: track?.title ?? "",
    artist: track?.artist ?? "",
    playlistStatus: playlistPlayback.status,
    playlistIndex: playlistPlayback.currentIndex,
    trackIndex: playlistPlayback.currentTrackIndex,
    gainSource,
    gainDb: appliedGainDb,
    loudnessDb: normalization.loudnessDb,
    linearGain: targetVolume,
    correctionDb: normalization.correctionDb + stepCorrectionDb,
    driftDb: normalization.driftDb,
    targetLoudnessDb: normalization.targetLoudnessDb,
    expectedOutputLoudnessDb:
      normalization.loudnessDb !== null && appliedGainDb !== null
        ? normalization.loudnessDb + appliedGainDb
        : null,
    requestedOutputDeviceId,
    appliedOutputDeviceId: outputRouting.appliedDeviceId,
    outputRouteMethod: outputRouting.method,
    outputRouteError: outputRouting.error,
    attemptedOutputDeviceIds: [
      ...preAttachRouting.attemptedDeviceIds,
      ...postAttachRouting.attemptedDeviceIds,
    ],
  });
  await resumeAudioContextForElement(next);

  const previous = state.active;
  state.active = next;
  state.currentTrackId = trackId;
  state.track = track ?? undefined;
  state.appliedGainDb = appliedGainDb;
  state.isCortinaPlayback = options?.isCortinaPlayback ?? false;
  void updateWaveformSource(trackId);
  const { startOffsetMs, endTrimMs } = getAdjustedTrimValues(track);
  const startOffsetSeconds = startOffsetMs > 0 ? startOffsetMs / 1000 : 0;
  const endTrimSeconds = endTrimMs > 0 ? endTrimMs / 1000 : 0;
  const startAt =
    Number.isFinite(options?.startAtSeconds) && (options?.startAtSeconds ?? 0) > 0
      ? options?.startAtSeconds ?? 0
      : startOffsetSeconds;
  let maxDurationSeconds =
    Number.isFinite(options?.maxDurationSeconds) &&
    (options?.maxDurationSeconds ?? 0) > 0
      ? options?.maxDurationSeconds ?? 0
      : null;
  const autoStopFadeMs =
    Number.isFinite(options?.autoStopFadeMs) && (options?.autoStopFadeMs ?? 0) > 0
      ? options?.autoStopFadeMs ?? 0
      : 0;
  let trimmedEndSeconds: number | null = null;
  let trimHandled = false;
  let trackDurationSeconds = 0;
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
      void releaseAudioDspRuntime(next);
      state.active = undefined;
      state.currentTrackId = undefined;
      state.track = undefined;
      state.appliedGainDb = null;
      state.isCortinaPlayback = false;
      updateNowPlayingDisplay();
    }
  });
  next.addEventListener("loadedmetadata", () => {
    trackDurationSeconds = Number.isFinite(next.duration) ? next.duration : 0;
    trimmedEndSeconds = computeTrimmedEnd(
      trackDurationSeconds,
      startAt,
      endTrimSeconds,
    );
    if (maxDurationSeconds !== null) {
      if (trackDurationSeconds > 0) {
        maxDurationSeconds = Math.min(maxDurationSeconds, trackDurationSeconds);
      }
      if (maxDurationSeconds <= startAt) {
        maxDurationSeconds = null;
      }
    }
    updateNowPlayingDisplay();
  });
  next.addEventListener("pause", () => {
    updateNowPlayingDisplay();
  });
  next.addEventListener("timeupdate", () => {
    const durationCutoffSeconds =
      options?.isCortinaPlayback && cortinaAllowFull
        ? null
        : maxDurationSeconds;
    const effectiveEndSeconds =
      trimmedEndSeconds !== null && durationCutoffSeconds !== null
        ? Math.min(trimmedEndSeconds, durationCutoffSeconds)
        : trimmedEndSeconds ?? durationCutoffSeconds;
    const fadeLeadSeconds =
      autoStopFadeMs > 0 ? Math.max(0, autoStopFadeMs / 1000) : 0.14;
    const fadeStartSeconds =
      effectiveEndSeconds !== null
        ? Math.max(0, effectiveEndSeconds - fadeLeadSeconds)
        : null;
    if (
      !trimHandled &&
      effectiveEndSeconds !== null &&
      fadeStartSeconds !== null &&
      next.currentTime >= fadeStartSeconds
    ) {
      trimHandled = true;
      const isTrimmedEarly =
        trackDurationSeconds > 0 &&
        effectiveEndSeconds < Math.max(0, trackDurationSeconds - 0.05);
      const finalize = async () => {
        const remainingMs = Math.max(
          0,
          (effectiveEndSeconds - next.currentTime) * 1000,
        );
        if (autoStopFadeMs > 0 || isTrimmedEarly) {
          const preferredFadeMs = autoStopFadeMs > 0 ? autoStopFadeMs : 140;
          const fadeMs = computeFadeDurationMs(preferredFadeMs, remainingMs);
          if (fadeMs > 0) {
            await fadeOutAudio(next, fadeMs);
          }
        }
        setAudioLevel(next, 0);
        next.currentTime = effectiveEndSeconds ?? next.currentTime;
        next.pause();
        next.dispatchEvent(new Event("ended"));
      };
      void finalize();
      return;
    }
    updateNowPlayingDisplay();
  });

  try {
    await next.play();
    fadeBetween(previous, next, targetVolume);
    lastAppliedGainDbByChannel[channel] = appliedGainDb;
    updateNowPlayingDisplay();
    return true;
  } catch (error) {
    await releaseAudioDspRuntime(next);
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
  if (started && (appMode === "edit" || isTrackEditorOpen())) {
    openTrackEditor(track.id);
  }
  return started;
};

const fadeOutAudio = async (audio: HTMLAudioElement, durationMs: number) => {
  const startVolume = getAudioLevel(audio);
  const start = performance.now();
  return new Promise<void>((resolve) => {
    const step = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, durationMs > 0 ? elapsed / durationMs : 1);
      setAudioLevel(audio, Math.max(0, startVolume * (1 - t)));
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
  await releaseAudioDspRuntime(active);
  state.active = undefined;
  state.currentTrackId = undefined;
  state.track = undefined;
  state.appliedGainDb = null;
  state.isCortinaPlayback = false;
  lastAppliedGainDbByChannel[channel] = null;
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
    const outputs = devices
      .filter((device) => device.kind === "audiooutput")
      .map(
        (device) =>
          ({
            deviceId: device.deviceId,
            groupId: device.groupId,
            label: device.label,
          }) satisfies AudioOutputDevice,
      );
    audioOutputs = dedupeAudioOutputs(outputs);
    audioOutputRouteCandidates = new Map(
      audioOutputs.map((device) => [
        device.deviceId,
        getOutputCandidateIds(outputs, device),
      ]),
    );
  } catch {
    audioOutputs = [];
    audioOutputRouteCandidates = new Map();
  }
  const hasSecondaryOutput = audioOutputs.length > 1;
  headphoneAvailable = hasSecondaryOutput;
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

  const preferredMain = resolveStoredOutputDevice(
    storedMain,
    storedMainLabel,
    storedMainGroup,
    audioOutputs,
  );
  const preferredHeadphone = resolveStoredOutputDevice(
    storedHeadphone,
    storedHeadphoneLabel,
    storedHeadphoneGroup,
    audioOutputs,
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
    (!hasStoredHeadphone && hasSecondaryOutput
      ? audioOutputs[1]?.deviceId ?? null
      : hasSecondaryOutput
        ? audioOutputs[1]?.deviceId ?? null
        : null);

  if (headphoneId && mainId && headphoneId === mainId) {
    headphoneId = null;
  }

  if (mainId) {
    if (mainId !== storedMain || !hasStoredMain) {
      persistOutputDeviceSelection("main", mainId);
    }
  } else {
    persistOutputDeviceSelection("main", DEFAULT_OUTPUT_ID);
  }
  if (headphoneId) {
    if (headphoneId !== storedHeadphone || !hasStoredHeadphone) {
      persistOutputDeviceSelection("headphone", headphoneId);
    }
  } else {
    persistOutputDeviceSelection("headphone", null);
  }

  if (mainOutputSelect) {
    mainOutputSelect.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = DEFAULT_OUTPUT_ID;
    defaultOption.textContent = t("outputDefault");
    mainOutputSelect.appendChild(defaultOption);
    audioOutputs.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || t("outputDefault");
      mainOutputSelect.appendChild(option);
    });
    mainOutputSelect.value = mainId ?? DEFAULT_OUTPUT_ID;
  }

  if (headphoneOutputSelect) {
    headphoneOutputSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = hasSecondaryOutput
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
    headphoneOutputSelect.disabled = !hasSecondaryOutput;
  }
};

const setStatus = (message: string) => {
  if (statusEl) {
    statusEl.textContent = message;
  }
};

const ensureConfirmModal = () => {
  if (confirmModalEl) {
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "confirm-modal hidden";
  const dialog = document.createElement("div");
  dialog.className = "confirm-dialog";
  const message = document.createElement("div");
  message.className = "confirm-message";
  const actions = document.createElement("div");
  actions.className = "confirm-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "confirm-cancel";
  cancelBtn.textContent = t("cancel");
  const okBtn = document.createElement("button");
  okBtn.type = "button";
  okBtn.className = "confirm-ok";
  okBtn.textContent = t("confirmOk");
  actions.append(cancelBtn, okBtn);
  dialog.append(message, actions);
  overlay.append(dialog);
  document.body.appendChild(overlay);
  confirmModalEl = overlay;
  confirmModalMessage = message;
  confirmModalOk = okBtn;
  confirmModalCancel = cancelBtn;

  const closeModal = (result: boolean) => {
    if (!confirmModalEl) {
      return;
    }
    confirmModalEl.classList.add("hidden");
    const resolve = confirmModalResolve;
    confirmModalResolve = null;
    if (resolve) {
      resolve(result);
    }
  };

  cancelBtn.addEventListener("click", () => closeModal(false));
  okBtn.addEventListener("click", () => closeModal(true));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal(false);
    }
  });
};

const showConfirmModal = async (
  message: string,
  confirmLabel?: string,
) => {
  ensureConfirmModal();
  if (!confirmModalEl || !confirmModalMessage || !confirmModalOk || !confirmModalCancel) {
    return false;
  }
  if (confirmModalResolve) {
    return false;
  }
  confirmModalMessage.textContent = message;
  confirmModalOk.textContent = confirmLabel ?? t("confirmOk");
  confirmModalCancel.textContent = t("cancel");
  confirmModalEl.classList.remove("hidden");
  return new Promise<boolean>((resolve) => {
    confirmModalResolve = resolve;
  });
};

const ensureClipboardClearModal = () => {
  if (clipboardClearModalEl) {
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "confirm-modal hidden clipboard-clear-modal";
  const dialog = document.createElement("div");
  dialog.className = "confirm-dialog clipboard-clear-dialog";
  const title = document.createElement("div");
  title.className = "clipboard-clear-title";
  const list = document.createElement("div");
  list.className = "clipboard-clear-list";
  const options = document.createElement("label");
  options.className = "clipboard-clear-option";
  const removeEmptyInput = document.createElement("input");
  removeEmptyInput.type = "checkbox";
  removeEmptyInput.className = "clipboard-clear-remove-empty";
  const removeEmptyLabel = document.createElement("span");
  options.append(removeEmptyInput, removeEmptyLabel);
  const actions = document.createElement("div");
  actions.className = "confirm-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "confirm-cancel";
  cancelBtn.textContent = t("cancel");
  const okBtn = document.createElement("button");
  okBtn.type = "button";
  okBtn.className = "confirm-ok";
  okBtn.textContent = t("clipboardClearConfirm");
  actions.append(cancelBtn, okBtn);
  dialog.append(title, list, options, actions);
  overlay.append(dialog);
  document.body.appendChild(overlay);
  clipboardClearModalEl = overlay;

  const closeModal = (result: { selectedIds: string[]; removeEmpty: boolean } | null) => {
    if (!clipboardClearModalEl) {
      return;
    }
    clipboardClearModalEl.classList.add("hidden");
    const resolve = clipboardClearModalResolve;
    clipboardClearModalResolve = null;
    if (resolve) {
      resolve(result);
    }
  };

  cancelBtn.addEventListener("click", () => closeModal(null));
  okBtn.addEventListener("click", () => {
    if (!clipboardClearModalEl) {
      closeModal(null);
      return;
    }
    const selected = Array.from(
      clipboardClearModalEl.querySelectorAll<HTMLInputElement>(
        ".clipboard-clear-list input[type=\"checkbox\"]",
      ),
    )
      .filter((input) => input.checked)
      .map((input) => input.value);
    const removeEmpty = removeEmptyInput.checked;
    closeModal({ selectedIds: selected, removeEmpty });
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal(null);
    }
  });
};

const showClipboardClearModal = async () => {
  ensureClipboardClearModal();
  if (!clipboardClearModalEl) {
    return null;
  }
  if (clipboardClearModalResolve) {
    return null;
  }
  const titleEl = clipboardClearModalEl.querySelector<HTMLElement>(".clipboard-clear-title");
  const listEl = clipboardClearModalEl.querySelector<HTMLElement>(".clipboard-clear-list");
  const removeEmptyLabel =
    clipboardClearModalEl.querySelector<HTMLElement>(".clipboard-clear-option span");
  const removeEmptyInput =
    clipboardClearModalEl.querySelector<HTMLInputElement>(".clipboard-clear-remove-empty");
  const confirmButton = clipboardClearModalEl.querySelector<HTMLButtonElement>(".confirm-ok");
  const cancelButton = clipboardClearModalEl.querySelector<HTMLButtonElement>(".confirm-cancel");
  if (!titleEl || !listEl || !removeEmptyLabel || !removeEmptyInput || !confirmButton || !cancelButton) {
    return null;
  }
  titleEl.textContent = t("clipboardClearTitle");
  removeEmptyLabel.textContent = t("clipboardClearRemoveEmpty");
  confirmButton.textContent = t("clipboardClearConfirm");
  cancelButton.textContent = t("cancel");
  removeEmptyInput.checked = false;
  listEl.innerHTML = "";
  clipboardCollections
    .filter((collection) => !isReadOnlyCollectionId(collection.id))
    .forEach((collection) => {
      const row = document.createElement("label");
      row.className = "clipboard-clear-row";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = collection.id;
      input.checked = collection.id === activeClipboardCollectionId;
      const name = document.createElement("span");
      name.textContent = collection.name;
      row.append(input, name);
      listEl.appendChild(row);
    });
  clipboardClearModalEl.classList.remove("hidden");
  return new Promise<{ selectedIds: string[]; removeEmpty: boolean } | null>((resolve) => {
    clipboardClearModalResolve = resolve;
  });
};

const ensurePlaylistClearModal = () => {
  if (playlistClearModalEl) {
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "confirm-modal hidden playlist-clear-modal";
  const dialog = document.createElement("div");
  dialog.className = "confirm-dialog playlist-clear-dialog";
  const title = document.createElement("div");
  title.className = "playlist-clear-title";
  const actions = document.createElement("div");
  actions.className = "confirm-actions playlist-clear-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "confirm-cancel";
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "confirm-ok";
  clearBtn.dataset.option = "clear";
  const autofillBtn = document.createElement("button");
  autofillBtn.type = "button";
  autofillBtn.className = "confirm-ok";
  autofillBtn.dataset.option = "autofill";
  actions.append(cancelBtn, clearBtn, autofillBtn);
  dialog.append(title, actions);
  overlay.append(dialog);
  document.body.appendChild(overlay);
  playlistClearModalEl = overlay;

  const closeModal = (result: "clear" | "autofill" | null) => {
    if (!playlistClearModalEl) {
      return;
    }
    playlistClearModalEl.classList.add("hidden");
    const resolve = playlistClearModalResolve;
    playlistClearModalResolve = null;
    if (resolve) {
      resolve(result);
    }
  };

  cancelBtn.addEventListener("click", () => closeModal(null));
  clearBtn.addEventListener("click", () => closeModal("clear"));
  autofillBtn.addEventListener("click", () => closeModal("autofill"));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal(null);
    }
  });
};

const showPlaylistClearModal = async () => {
  ensurePlaylistClearModal();
  if (!playlistClearModalEl) {
    return null;
  }
  if (playlistClearModalResolve) {
    return null;
  }
  const title = playlistClearModalEl.querySelector<HTMLElement>(".playlist-clear-title");
  const cancelButton = playlistClearModalEl.querySelector<HTMLButtonElement>(".confirm-cancel");
  const clearButton = playlistClearModalEl.querySelector<HTMLButtonElement>(
    ".confirm-ok[data-option=\"clear\"]",
  );
  const autofillButton = playlistClearModalEl.querySelector<HTMLButtonElement>(
    ".confirm-ok[data-option=\"autofill\"]",
  );
  if (!title || !cancelButton || !clearButton || !autofillButton) {
    return null;
  }
  title.textContent = t("playlistClearTitle");
  cancelButton.textContent = t("cancel");
  clearButton.textContent = t("playlistClearOnly");
  autofillButton.textContent = t("playlistClearAutofill");
  playlistClearModalEl.classList.remove("hidden");
  return new Promise<"clear" | "autofill" | null>((resolve) => {
    playlistClearModalResolve = resolve;
  });
};

const renderMiniChart = (
  root: HTMLDivElement | null,
  rows: { label: string; value: number }[],
  options?: {
    maxBars?: number;
    includeZero?: boolean;
    className?: string;
  },
) => {
  if (!root) {
    return;
  }
  root.innerHTML = "";
  root.style.removeProperty("--mini-chart-columns");
  root.classList.remove("orchestra", "compact");
  if (options?.className) {
    root.classList.add(options.className);
  }
  const includeZero = options?.includeZero ?? false;
  const maxBars = options?.maxBars ?? Number.POSITIVE_INFINITY;
  const data = rows
    .filter((row) =>
      includeZero
        ? Number.isFinite(row.value) && row.value >= 0
        : Number.isFinite(row.value) && row.value > 0,
    )
    .slice(0, maxBars);
  if (data.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mini-chart-empty";
    empty.textContent = t("playlistStatsNoData");
    root.appendChild(empty);
    return;
  }
  const maxValue = Math.max(...data.map((row) => row.value));
  if (options?.className === "compact") {
    root.style.setProperty("--mini-chart-columns", `${Math.max(1, data.length)}`);
  }
  const ORCHESTRA_LABEL_MAX = "Enrique Rodrigues".length;
  data.forEach((row) => {
    const item = document.createElement("div");
    item.className = "mini-chart-item";
    const bar = document.createElement("div");
    bar.className = "mini-chart-bar";
    if (row.value <= 0) {
      bar.classList.add("is-zero");
      bar.style.height = "0";
    } else {
      bar.style.height = `${computeScaledPercent(row.value, maxValue, {
        minPercent: 4,
      })}%`;
    }
    const label = document.createElement("div");
    label.className = "mini-chart-label";
    const labelText =
      options?.className === "orchestra" && row.label.length > ORCHESTRA_LABEL_MAX
        ? `${row.label.slice(0, ORCHESTRA_LABEL_MAX - 1)}...`
        : row.label;
    label.textContent = labelText;
    label.title =
      options?.className === "orchestra"
        ? `${row.label}: ${formatTime(row.value)}`
        : `${row.label}: ${Math.round(row.value)}`;
    item.append(bar, label);
    root.appendChild(item);
  });
};

const colorForStyleKey = (styleKey: string) => {
  const key = styleKey.toLowerCase();
  if (key.includes("milonga")) {
    return "#1fbf75";
  }
  if (key.includes("vals") || key.includes("waltz")) {
    return "#3d7dff";
  }
  if (key.includes("tango")) {
    return "#ff7847";
  }
  return "#8f9aad";
};

const patternForStyleKey = (styleKey: string) => {
  const key = styleKey.toLowerCase();
  if (key.includes("milonga")) {
    // Diagonal hatch
    return "repeating-linear-gradient(45deg, rgba(0,0,0,0.26) 0 2px, rgba(255,255,255,0) 2px 6px)";
  }
  if (key.includes("vals") || key.includes("waltz")) {
    // Opposite diagonal hatch
    return "repeating-linear-gradient(-45deg, rgba(0,0,0,0.26) 0 2px, rgba(255,255,255,0) 2px 6px)";
  }
  if (key.includes("tango")) {
    // Vertical hatch
    return "repeating-linear-gradient(90deg, rgba(0,0,0,0.2) 0 2px, rgba(255,255,255,0) 2px 6px)";
  }
  // Dot-ish checker for unknown
  return "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, rgba(255,255,255,0) 2px 5px), repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0 2px, rgba(255,255,255,0) 2px 5px)";
};

const renderOrchestraChart = (
  root: HTMLDivElement | null,
  rows: ReturnType<typeof aggregateOrchestraDurations>,
  maxBars = Number.POSITIVE_INFINITY,
) => {
  if (!root) {
    return;
  }
  root.innerHTML = "";
  root.classList.remove("compact");
  root.classList.add("orchestra");
  const data = rows.filter((row) => row.totalSeconds > 0).slice(0, maxBars);
  if (data.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mini-chart-empty";
    empty.textContent = t("playlistStatsNoData");
    root.appendChild(empty);
    return;
  }
  const maxValue = Math.max(...data.map((row) => row.totalSeconds));
  const ORCHESTRA_LABEL_MAX = "Enrique Rodrigues".length;
  data.forEach((row, index) => {
    const item = document.createElement("div");
    item.className = "mini-chart-item orchestra-item";
    const upper = document.createElement("div");
    upper.className = "mini-chart-upper";
    const count = document.createElement("div");
    count.className = "mini-chart-top";
    count.textContent = `${Math.round(row.tandaCount)}`;
    const barWrap = document.createElement("div");
    barWrap.className = "mini-chart-stack-wrap";
    barWrap.style.height = `${computeScaledPercent(row.totalSeconds, maxValue, {
      minPercent: 4,
    })}%`;
    const stack = document.createElement("div");
    stack.className = "mini-chart-stack";
    const styleRows = Object.entries(row.styleSeconds)
      .map(([style, seconds]) => ({ style, seconds }))
      .filter((entry) => entry.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds);
    styleRows.forEach((styleRow) => {
      const segment = document.createElement("div");
      segment.className = "mini-chart-segment";
      const segmentRatio = styleRow.seconds / row.totalSeconds;
      segment.style.height = `${Math.max(4, Math.round(segmentRatio * 100))}%`;
      segment.style.backgroundColor = colorForStyleKey(styleRow.style);
      segment.style.backgroundImage = patternForStyleKey(styleRow.style);
      stack.appendChild(segment);
    });
    barWrap.appendChild(stack);
    upper.append(count, barWrap);
    const label = document.createElement("div");
    label.className = "mini-chart-label";
    label.textContent =
      row.label.length > ORCHESTRA_LABEL_MAX
        ? `${row.label.slice(0, ORCHESTRA_LABEL_MAX - 1)}...`
        : row.label;
    const styleDetail = styleRows
      .map((styleRow) => `${styleRow.style}: ${formatTime(styleRow.seconds)}`)
      .join(", ");
    item.title = `${row.label}: ${formatTime(row.totalSeconds)} (${row.tandaCount} tanda)\n${styleDetail}`;
    item.append(upper, label);
    root.appendChild(item);
  });
};

const setPlaylistStatsModalVisible = (visible: boolean) => {
  if (!playlistStatsModal) {
    return;
  }
  playlistStatsModal.classList.toggle("open", visible);
  playlistStatsModal.setAttribute("aria-hidden", visible ? "false" : "true");
};

const renderPlaylistStats = () => {
  const orchestraEntries: {
    artist: string;
    seconds: number;
    style: string;
    tandaId: string | null;
  }[] = [];
  const yearBuckets = new Map<number, number>();
  const tempoBuckets = new Map<number, number>();
  playlistItems.forEach((item) => {
    if (!item) {
      return;
    }
    const tandaStyleFallback =
      item.kind === "tanda"
        ? (() => {
            const tanda = resolveTandaDraft(item.tandaId);
            if (!tanda || tanda.styles.length === 0) {
              return "";
            }
            const normalized = tanda.styles
              .map((style) => normalizeStyleName(style))
              .filter(Boolean);
            if (normalized.length === 0) {
              return "";
            }
            return normalized[0] ?? "";
          })()
        : "";
    const tracks = resolvePlaylistTracks(item);
    tracks.forEach((track) => {
      const seconds = Math.max(1, Math.round(getEffectiveTrackDurationMs(track) / 1000));
      const orchestra =
        resolveCanonicalArtistName(track.artist_summary || track.artist || "") ||
        t("nowPlayingUnknown");
      const style =
        normalizeStyleName(track.genre ?? "") || tandaStyleFallback || "unknown";
      orchestraEntries.push({
        artist: orchestra,
        seconds,
        style,
        tandaId: item.kind === "tanda" ? item.tandaId : null,
      });
      const year = yearValue(track);
      if (year !== null) {
        yearBuckets.set(year, (yearBuckets.get(year) ?? 0) + 1);
      }
      if (track.bpm !== null && track.bpm !== undefined && Number.isFinite(track.bpm)) {
        const bpm = Math.round(track.bpm);
        tempoBuckets.set(bpm, (tempoBuckets.get(bpm) ?? 0) + 1);
      }
    });
  });
  const orchestraRows = aggregateOrchestraDurations(orchestraEntries);
  const yearRows = buildAdaptiveNumericDistribution(yearBuckets, 30, 30);
  const tempoRows = buildAdaptiveNumericDistribution(tempoBuckets, 30, 30);
  renderOrchestraChart(playlistStatsOrchestraEl, orchestraRows);
  renderMiniChart(playlistStatsYearEl, yearRows, {
    includeZero: true,
    className: "compact",
  });
  renderMiniChart(playlistStatsTempoEl, tempoRows, {
    includeZero: true,
    className: "compact",
  });
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

const buildMoreButton = (
  duplicateStatus?: "partial" | "full",
  duplicateReason?: string,
  options?: {
    duplicateTrackId?: string;
    duplicateTandaTrackIds?: string[];
    allowDuplicateJump?: boolean;
  },
) => {
  const button = document.createElement("button");
  button.className = "action-button";
  button.dataset.action = "row-menu";
  const label = t("actionMore");
  if (duplicateStatus) {
    const duplicateLabel =
      duplicateStatus === "full" ? t("duplicateFull") : t("duplicatePartial");
    button.classList.add("duplicate-menu", duplicateStatus);
    const icon = buildDuplicateIcon(duplicateStatus);
    const allowDuplicateJump = options?.allowDuplicateJump ?? true;
    if (allowDuplicateJump) {
      icon.classList.add("duplicate-jump");
      if (options?.duplicateTrackId) {
        icon.dataset.duplicateTrackId = options.duplicateTrackId;
      }
      if (options?.duplicateTandaTrackIds && options.duplicateTandaTrackIds.length > 0) {
        icon.dataset.duplicateTandaTrackIds = options.duplicateTandaTrackIds.join(",");
        icon.dataset.duplicateStatus = duplicateStatus;
      }
      icon.title = t("duplicateJumpHint");
    } else {
      icon.classList.add("duplicate-indicator");
    }
    button.appendChild(icon);
    const reason = duplicateReason?.trim();
    const composite = reason
      ? `${label} · ${duplicateLabel} · ${reason}`
      : `${label} · ${duplicateLabel}`;
    button.setAttribute("aria-label", composite);
    button.title = reason
      ? `${duplicateLabel}\n${reason}`
      : `${label} · ${duplicateLabel}`;
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

const buildNormalizedTandaKey = (trackIds: string[]) =>
  Array.from(new Set(trackIds.filter(Boolean))).sort().join("|");

const findPlaylistDuplicateIndexForTrack = (trackId: string) => {
  for (let index = 0; index < playlistItems.length; index += 1) {
    const item = playlistItems[index];
    if (!item) {
      continue;
    }
    if (item.kind === "track" && item.track.id === trackId) {
      return index;
    }
    if (item.kind === "tanda") {
      const tanda = resolveTandaDraft(item.tandaId);
      if (tanda && tanda.trackSlots.includes(trackId)) {
        return index;
      }
    }
  }
  return null;
};

const findPlaylistDuplicateIndexForTandaTracks = (
  trackIds: string[],
  status?: "partial" | "full" | null,
) => {
  const wanted = new Set(trackIds.filter(Boolean));
  if (wanted.size === 0) {
    return null;
  }
  const wantedKey = buildNormalizedTandaKey(Array.from(wanted));
  for (let index = 0; index < playlistItems.length; index += 1) {
    const item = playlistItems[index];
    if (!item) {
      continue;
    }
    if (item.kind === "track") {
      if (wanted.has(item.track.id)) {
        return index;
      }
      continue;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      continue;
    }
    const tandaTrackIds = (tanda.trackSlots.filter(Boolean) as string[]);
    if (status === "full") {
      if (buildNormalizedTandaKey(tandaTrackIds) === wantedKey) {
        return index;
      }
      continue;
    }
    if (tandaTrackIds.some((trackId) => wanted.has(trackId))) {
      return index;
    }
  }
  return null;
};

const focusPlaylistIndex = (index: number) => {
  if (!playlistListEl || index < 0 || index >= playlistItems.length) {
    return;
  }
  activateRightTab("playlist-tab");
  window.requestAnimationFrame(() => {
    const row = playlistListEl.querySelector<HTMLElement>(
      `.list-row[data-index="${index}"]`,
    );
    if (!row) {
      return;
    }
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.add("jump-highlight");
    window.setTimeout(() => {
      row.classList.remove("jump-highlight");
    }, 2200);
  });
};

const handleDuplicateJump = (target: HTMLElement) => {
  const jumpTrigger = target.closest<HTMLElement>(".duplicate-jump");
  if (!jumpTrigger) {
    return false;
  }
  const sourceRow = jumpTrigger.closest<HTMLElement>(".list-row");
  const openSourceRowMenu = () => {
    if (!sourceRow) {
      return;
    }
    const menuId = sourceRow.dataset.menuId;
    if (!menuId) {
      return;
    }
    closeDetailMenus();
    closeRowMenus();
    sourceRow.classList.add("menu-open");
    openRowMenuId = menuId;
  };
  const trackId = jumpTrigger.dataset.duplicateTrackId ?? "";
  if (trackId) {
    const index = findPlaylistDuplicateIndexForTrack(trackId);
    if (index !== null) {
      focusPlaylistIndex(index);
    }
    openSourceRowMenu();
    return true;
  }
  const tandaTrackIdsRaw = jumpTrigger.dataset.duplicateTandaTrackIds ?? "";
  const tandaTrackIds = tandaTrackIdsRaw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (tandaTrackIds.length === 0) {
    return false;
  }
  const status = (jumpTrigger.dataset.duplicateStatus ?? "") as
    | "partial"
    | "full"
    | "";
  const index = findPlaylistDuplicateIndexForTandaTracks(
    tandaTrackIds,
    status || null,
  );
  if (index !== null) {
    focusPlaylistIndex(index);
  }
  openSourceRowMenu();
  return true;
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

type PlaylistDuplicateCounts = {
  trackCounts: Map<string, number>;
  tandaCounts: Map<string, number>;
};

const buildTandaDuplicateKey = (trackIds: string[]) =>
  Array.from(new Set(trackIds.filter(Boolean))).sort().join("|");

const buildPlaylistDuplicateCountsFromState = (): PlaylistDuplicateCounts => {
  const trackCounts = new Map<string, number>();
  const tandaCounts = new Map<string, number>();
  playlistItems.forEach((item) => {
    if (!item) {
      return;
    }
    if (item.kind === "track") {
      trackCounts.set(item.track.id, (trackCounts.get(item.track.id) ?? 0) + 1);
      return;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      return;
    }
    const trackIds = tanda.trackSlots.filter(Boolean) as string[];
    trackIds.forEach((trackId) => {
      trackCounts.set(trackId, (trackCounts.get(trackId) ?? 0) + 1);
    });
    const key = buildTandaDuplicateKey(trackIds);
    if (!key) {
      return;
    }
    tandaCounts.set(key, (tandaCounts.get(key) ?? 0) + 1);
  });
  return { trackCounts, tandaCounts };
};

const getDuplicateReasonForTrack = (
  track: TrackRow,
  duplicateStatus?: "partial" | "full",
) => {
  if (!duplicateStatus) {
    return "";
  }
  return t("duplicateReasonTrack", { track: buildTrackLabel(track) });
};

const getDuplicateReasonForTanda = (
  tanda: TandaDraft,
  duplicateStatus?: "partial" | "full",
  duplicateIndex?: PlaylistDuplicateIndex,
) => {
  if (!duplicateStatus) {
    return "";
  }
  if (duplicateStatus === "full") {
    return t("duplicateReasonWholeTanda");
  }
  if (!duplicateIndex) {
    return "";
  }
  const duplicateTracks = (tanda.trackSlots.filter(Boolean) as string[])
    .filter((trackId) => duplicateIndex.trackIds.has(trackId))
    .map((trackId) => trackCache.get(trackId))
    .filter(Boolean) as TrackRow[];
  if (duplicateTracks.length === 0) {
    return "";
  }
  const labels = Array.from(
    new Set(duplicateTracks.map((track) => buildTrackLabel(track))),
  ).slice(0, 4);
  const hasMore = duplicateTracks.length > labels.length;
  const list = hasMore ? `${labels.join("; ")}; ...` : labels.join("; ");
  return t("duplicateReasonTracks", { tracks: list });
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
  if (openRowMenuId) {
    const row = document.querySelector<HTMLElement>(
      `.list-row[data-menu-id="${openRowMenuId}"]`,
    );
    if (row) {
      row.classList.remove("menu-open");
      row.dataset.menuOpen = "0";
      openRowMenuId = null;
      return;
    }
  }
  const openRow = document.querySelector<HTMLElement>(".list-row.menu-open");
  if (openRow) {
    openRow.classList.remove("menu-open");
    openRow.dataset.menuOpen = "0";
  }
  openRowMenuId = null;
};

const closeDetailMenus = () => {
  const line = document.querySelector<HTMLElement>(
    ".tanda-detail-line.detail-menu-open",
  );
  if (line) {
    line.classList.remove("detail-menu-open");
  }
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
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest(".waveform")
    ) {
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
    row.dataset.menuOpen = "0";
    openRowMenuId = null;
    return;
  }
  closeDetailMenus();
  closeRowMenus();
  row.classList.add("menu-open");
  row.dataset.menuOpen = "1";
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
  const origin = shouldHostInPlaylist ? "playlist" : "designer";
  const incomingSource =
    source ??
    resolveTandaDraft(tandaId) ??
    tandaCache.get(tandaId) ??
    clipboardTandas.find((item) => item.id === tandaId) ??
    null;
  // If the designer has no non-empty drafts yet, replace any placeholder empties
  // with the explicitly opened non-empty tanda.
  if (!shouldHostInPlaylist && incomingSource && !isTandaEmpty(incomingSource)) {
    const designerDrafts = tandaDrafts.filter((item) => item.origin !== "playlist");
    const hasNonEmptyDesignerDraft = designerDrafts.some((item) => !isTandaEmpty(item));
    if (!hasNonEmptyDesignerDraft) {
      const emptyIds = new Set(
        designerDrafts.filter((item) => isTandaEmpty(item)).map((item) => item.id),
      );
      if (emptyIds.size > 0) {
        tandaDrafts = tandaDrafts.filter((item) => !emptyIds.has(item.id));
        if (selectedTandaId && emptyIds.has(selectedTandaId)) {
          selectedTandaId = null;
        }
      }
    }
  }
  if (incomingSource) {
    ensureTandaDraft(incomingSource, origin);
  } else {
    const cached = resolveTandaDraft(tandaId);
    if (cached) {
      ensureTandaDraft(cached, origin);
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
  tandaCache.set(tanda.id, { ...cloneTanda(tanda), origin: "designer" });
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

const getHeadphoneActiveTrackId = () => {
  const state = playback.headphone;
  if (!state.active || state.active.paused || !state.currentTrackId) {
    return null;
  }
  return state.currentTrackId;
};

const updateHeadphoneButtonIndicators = () => {
  const activeTrackId = getHeadphoneActiveTrackId();
  document
    .querySelectorAll<HTMLButtonElement>(".headphone-button[data-track-id]")
    .forEach((button) => {
      const trackId = button.dataset.trackId ?? "";
      button.classList.toggle("active", Boolean(activeTrackId) && trackId === activeTrackId);
    });
};

const buildHeadphoneButton = (trackId?: string | null) => {
  const button = document.createElement("button");
  button.className = "headphone-button";
  button.dataset.action = "headphone";
  if (trackId) {
    button.dataset.trackId = trackId;
  }
  const label = t("headphonePreview");
  button.setAttribute("aria-label", label);
  button.title = label;
  if (trackId && getHeadphoneActiveTrackId() === trackId) {
    button.classList.add("active");
  }
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
  duplicateCounts?: PlaylistDuplicateCounts,
) => {
  const activeCollection = context === "clipboard" ? getActiveCollection() : null;
  const canRemoveFromClipboard =
    context === "clipboard" &&
    Boolean(activeCollection && !isReadOnlyCollectionId(activeCollection.id));
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
  row.dataset.menuOpen = "0";
  row.dataset.gainDb =
    track.gain_db !== null && track.gain_db !== undefined
      ? track.gain_db.toString()
      : "";
  row.dataset.context = context;
  const actions = document.createElement("div");
  actions.className = "row-actions";
  if (headphoneAvailable) {
    actions.appendChild(buildHeadphoneButton(track.id));
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
    if (canRemoveFromClipboard) {
      menu.appendChild(
        buildActionButton(
          "actionRemoveClipboard",
          "actionRemoveClipboardShort",
          "remove-clip",
        ),
      );
    }
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
  const trackTargetButton =
    context === "playlist"
      ? buildActionButton(
          "actionMarkPlaylistTrack",
          "actionMarkPlaylistTrackShort",
          "mark-playlist-track-target",
        )
      : null;
  let duplicateStatus: "partial" | "full" | undefined;
  let duplicateReason = "";
  if (context !== "playlist" && duplicateIndex) {
    duplicateStatus = getDuplicateStatusForTrack(track.id, duplicateIndex) ?? undefined;
    duplicateReason = getDuplicateReasonForTrack(track, duplicateStatus);
  } else if (context === "playlist" && duplicateCounts) {
    duplicateStatus = (duplicateCounts.trackCounts.get(track.id) ?? 0) > 1 ? "full" : undefined;
    duplicateReason = getDuplicateReasonForTrack(track, duplicateStatus);
  }
  if (trackTargetButton) {
    actions.appendChild(trackTargetButton);
  }
  actions.append(
    menu,
    buildMoreButton(duplicateStatus, duplicateReason, {
      duplicateTrackId: duplicateStatus ? track.id : undefined,
      allowDuplicateJump: context !== "playlist",
    }),
  );
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
  searchTracksEl.dataset.renderedRows = `${searchState.items.length}`;
  if (searchState.isLoading) {
    searchTracksEl.dataset.state = "loading";
  }
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
  const normalized = tanda.styles.map((style) =>
    canonicalizeStyleForMatching(style),
  );
  const codes = Object.entries(styleMap)
    .filter(([, styles]) =>
      styles.some((style) =>
        normalized.includes(canonicalizeStyleForMatching(style)),
      ),
    )
    .map(([code]) => code);
  if (codes.length > 0) {
    return codes.join("/");
  }
  return "?";
};

const getTandaYearRange = (years: string[]) => {
  const numericYears = years
    .flatMap((year) => Array.from(year.matchAll(/\d{4}/g)).map((match) => match[0]))
    .map((year) => Number.parseInt(year, 10))
    .filter((year) => Number.isFinite(year));
  if (numericYears.length === 0) {
    return years.length > 0 ? years.join(",") : "";
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
  const yearLabel = summary.years.length > 0 ? summary.years.join(",") : "";
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
  const name = (tanda.name || fallbackName || "").trim();
  const tracks = tanda.trackSlots.map((trackId) =>
    trackId ? trackCache.get(trackId) ?? null : null,
  );
  const summary = summarizeTandaTracks(
    tracks.map((track) => {
      if (!track) {
        return null;
      }
      return {
        year: track.year,
        instrumental: track.instrumental ?? null,
      };
    }),
  );
  const yearLabel =
    summary.years.length > 0 ? getTandaYearRange(summary.years) : "";
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
  const details = [yearLabel, bpmLabel, durationLabel, ratingLabel].filter(
    (part) => part && part.trim().length > 0,
  );
  return name ? (details.length > 0 ? `${name} - ${details.join(" - ")}` : name) : details.join(" - ");
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
    const year = track.year?.trim() || "";
    const duration = formatTime(getEffectiveTrackDurationMs(track) / 1000);
    const yearLabel = year ? ` (${year})` : "";
    return [
      {
        text: `${buildTrackLabel(track)}${yearLabel} · ${duration}`,
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
  setSearchUiState("loading", searchRefreshVersion + 1, searchState.total);
  if (pendingSearchFrame !== null) {
    window.cancelAnimationFrame(pendingSearchFrame);
  }
  pendingSearchFrame = window.requestAnimationFrame(() => {
    pendingSearchFrame = null;
    activeSearchTab = "search-tracks";
    updateSearchTabVisibility();
    activatePanelTab(getSearchPanel(), "search-tracks");
  });
  if (pendingSearchRefreshTimer !== null) {
    window.clearTimeout(pendingSearchRefreshTimer);
  }
  // Yield a tick so the query value paints before list fetch/render work starts.
  pendingSearchRefreshTimer = window.setTimeout(() => {
    pendingSearchRefreshTimer = null;
    void refreshSearch();
  }, 0);
};

const buildSearchQueryForTrack = (track: TrackRow) => {
  return dedupeQueryTokens(buildTrackSimilarityQuery(track));
};

const resolveSearchStylesForTrack = (track: TrackRow) => {
  const normalized = normalizeStyleName(track.genre);
  if (!normalized) {
    return [] as string[];
  }
  if (availableStyles.length === 0) {
    return [normalized];
  }
  const match =
    availableStyles.find((style) => normalizeStyleName(style) === normalized) ??
    null;
  return match ? [match] : [];
};

const runSearchForTrack = (track: TrackRow, preferredStyles?: string[]) => {
  const styles = preferredStyles ?? resolveSearchStylesForTrack(track);
  if (styles.length > 0 || selectedStyles.length > 0) {
    selectedStyles = [...styles];
    loadStyles();
  }
  runSearchQuery(buildSearchQueryForTrack(track), true);
};

const resolveSearchStylesForPlaylistIndex = (index: number) => {
  const item = playlistItems[index] ?? null;
  if (item?.kind === "tanda") {
    const tanda = resolveTandaDraft(item.tandaId);
    if (tanda) {
      const tracks = resolvePlaylistTracks(item);
      const tandaStyles = resolveSearchStylesForTanda(tanda, tracks);
      if (tandaStyles.length > 0) {
        return tandaStyles;
      }
    }
  }
  const rule = getRuleForSlot(index);
  if (!rule?.code || rule.code === "*" || rule.code === "ANY") {
    return [] as string[];
  }
  return [...(getPlaylistStyleMap()[rule.code] ?? [])];
};

const getTrackEditorFieldQueryValue = (field: string) => {
  switch (field) {
    case "title":
      return trackEditorTitleInput?.value ?? "";
    case "artist":
      return trackEditorArtistInput?.value ?? "";
    case "singer":
      return trackEditorSingerInput?.value ?? "";
    case "vocal":
      return trackEditorVocalInput?.selectedOptions[0]?.textContent ?? "";
    case "album":
      return trackEditorAlbumInput?.value ?? "";
    case "year":
      return trackEditorYearInput?.value ?? "";
    case "genre":
      return trackEditorGenreInput?.value ?? "";
    case "notes":
      return trackEditorNotesInput?.value ?? "";
    case "bpm":
      return trackEditorBpmInput?.value ?? "";
    default:
      return "";
  }
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

const clearPlaylistFilterTimer = () => {
  if (playlistFilterClearTimer !== undefined) {
    window.clearTimeout(playlistFilterClearTimer);
    playlistFilterClearTimer = undefined;
  }
};

const clearPlaylistFilter = () => {
  clearPlaylistFilterTimer();
  if (playlistFilterText && getPlaylistTargetIndex() !== null) {
    centerPlaylistTargetOnNextRender = true;
  }
  playlistFilterText = "";
  if (playlistFilterInput) {
    playlistFilterInput.value = "";
  }
  renderPlaylist();
};

const schedulePlaylistFilterAutoClear = () => {
  clearPlaylistFilterTimer();
  if (!playlistFilterText) {
    return;
  }
  const runCheck = () => {
    if (!playlistFilterText) {
      clearPlaylistFilterTimer();
      return;
    }
    const remainingMs = computeAutoClearRemainingMs({
      lastInteractionAt: lastUserInteractionAt,
      now: Date.now(),
      idleMs: PLAYLIST_FILTER_AUTO_CLEAR_MS,
    });
    if (remainingMs <= 0) {
      clearPlaylistFilter();
      return;
    }
    playlistFilterClearTimer = window.setTimeout(runCheck, Math.max(remainingMs, 250));
  };
  runCheck();
};

const getPlaylistTrackFilterText = (track: TrackRow) =>
  buildTrackSearchQuery(track).toLowerCase();

const getPlaylistTandaFilterText = (tanda: TandaDraft) =>
  getClipboardTandaFilterText(tanda);

const buildSearchQueryForTanda = (tanda: TandaDraft) => {
  const tracks = tanda.trackSlots
    .map((trackId) => (trackId ? trackCache.get(trackId) ?? null : null))
    .filter(Boolean) as TrackRow[];
  return dedupeQueryTokens(
    buildTandaSearchQuery({
      name: tanda.name,
      tracks,
    }),
  );
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

const runSearchForTanda = (tanda: TandaDraft, preferredStyles?: string[]) => {
  const tracks = tanda.trackSlots
    .map((trackId) => (trackId ? trackCache.get(trackId) ?? null : null))
    .filter(Boolean) as TrackRow[];
  const styles = preferredStyles ?? resolveSearchStylesForTanda(tanda, tracks);
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
    duplicateCounts?: PlaylistDuplicateCounts;
    playlistIndex?: number;
  },
) => {
  const activeCollection = context === "clipboard" ? getActiveCollection() : null;
  const canRemoveFromClipboard =
    context === "clipboard" &&
    Boolean(activeCollection && !isReadOnlyCollectionId(activeCollection.id));
  const row = document.createElement("div");
  row.className = "list-row tanda-row";
  row.dataset.tandaId = tanda.id;
  row.dataset.menuId = `${context}-tanda-${tanda.id}`;
  row.dataset.menuOpen = "0";
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
  if (context !== "playlist") {
    menu.appendChild(
      buildActionButton(
        "actionToggleTanda",
        "actionToggleTandaShort",
        "tanda-toggle",
      ),
    );
  }
  if (context !== "playlist") {
    menu.appendChild(
      buildActionButton(
        "actionSearch",
        "actionSearchShort",
        "search-tanda",
      ),
    );
  }
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
        "actionEditTanda",
        "actionEditTandaShort",
        "tanda-edit",
      ),
    );
    menu.appendChild(
      buildActionButton(
        "actionAddPlaylist",
        "actionAddPlaylistShort",
        "add-playlist-tanda",
      ),
    );
    if (canRemoveFromClipboard) {
      menu.appendChild(
        buildActionButton(
          "actionRemoveClipboard",
          "actionRemoveClipboardShort",
          "remove-clip-tanda",
        ),
      );
    }
  }
  if (context === "playlist") {
    menu.appendChild(
      buildActionButton(
        "actionEditTanda",
        "actionEditTandaShort",
        "tanda-edit",
      ),
    );
    const markButton = buildActionButton(
      "actionMarkPlaylist",
      "actionMarkPlaylistShort",
      "mark-playlist-target",
    );
    if (options?.locked) {
      markButton.disabled = true;
    }
    menu.appendChild(markButton);
    if (
      typeof options?.playlistIndex === "number" &&
      playlistTargetIndex !== null &&
      playlistTargetIndex !== options.playlistIndex
    ) {
      const swapButton = buildActionButton(
        "actionSwapPlaylist",
        "actionSwapPlaylistShort",
        "swap-playlist-target",
      );
      if (options?.locked) {
        swapButton.disabled = true;
      }
      menu.appendChild(swapButton);
    }
    if (options?.allowSendToClipboard && !options?.locked) {
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
      const headphoneButton = buildHeadphoneButton(line.trackId);
      headphoneButton.classList.add("detail-headphone");
      actionWrap.appendChild(headphoneButton);
    }
      const editButton = buildActionButton(
        "actionEditTrack",
        "actionEditTrackShort",
        "edit-track",
      );
      editButton.classList.add("detail-edit");
      menuWrap.appendChild(editButton);
      const searchButton = buildActionButton(
        "actionSearch",
        "actionSearchShort",
        "search-track",
      );
      searchButton.classList.add("detail-search");
      menuWrap.appendChild(searchButton);
      if (context === "playlist" && options?.allowSendToClipboard) {
        const sendButton = buildActionButton(
          "actionSendClipboard",
          "actionSendClipboardShort",
          "send-playlist-tanda-track",
        );
        const playlistIndex = options?.playlistIndex ?? -1;
        const slotLocked =
          line.slotIndex !== undefined && playlistIndex >= 0
            ? isPlaylistTandaSlotLocked(playlistIndex, line.slotIndex)
            : options?.locked ?? false;
        sendButton.disabled = slotLocked;
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
  let duplicateReason = "";
  if (context !== "playlist" && options?.duplicateIndex) {
    const trackIds = tanda.trackSlots.filter(Boolean) as string[];
    duplicateStatus =
      getDuplicateStatusForTanda(trackIds, options.duplicateIndex) ?? undefined;
    duplicateReason = getDuplicateReasonForTanda(
      tanda,
      duplicateStatus,
      options.duplicateIndex,
    );
  } else if (context === "playlist" && options?.duplicateCounts) {
    const trackIds = tanda.trackSlots.filter(Boolean) as string[];
    const tandaKey = buildTandaDuplicateKey(trackIds);
    const isWholeDuplicate =
      tandaKey.length > 0 && (options.duplicateCounts.tandaCounts.get(tandaKey) ?? 0) > 1;
    if (isWholeDuplicate) {
      duplicateStatus = "full";
      duplicateReason = getDuplicateReasonForTanda(tanda, "full");
    } else {
      const duplicateTrackIds = trackIds.filter(
        (trackId) => (options.duplicateCounts!.trackCounts.get(trackId) ?? 0) > 1,
      );
      if (duplicateTrackIds.length > 0) {
        duplicateStatus = "partial";
        const partialIndex: PlaylistDuplicateIndex = {
          trackIds: new Set<string>(duplicateTrackIds),
          tandaKeys: new Set<string>(),
        };
        duplicateReason = getDuplicateReasonForTanda(
          tanda,
          "partial",
          partialIndex,
        );
      }
    }
  }
  actions.append(
    menu,
    buildMoreButton(duplicateStatus, duplicateReason, {
      duplicateTandaTrackIds: duplicateStatus
        ? (tanda.trackSlots.filter(Boolean) as string[])
        : undefined,
      allowDuplicateJump: context !== "playlist",
    }),
  );
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
};

const resolveCanonicalArtistName = (rawArtist: string) =>
  resolveOrchestraCanonical({
    rawArtist,
    entries: orchestraRegistry,
    aliasIndex: orchestraAliasIndex,
  }) ?? summarizeArtistName(rawArtist) ?? rawArtist;

const collectionArtistGroupKey = (track: TrackRow) =>
  normalizeArtistGroupKey(
    resolveCanonicalArtistName(track.artist_summary || track.artist || ""),
  );

const getPlaylistArtistStyleGroups = () => {
  const used = new Set<string>();
  playlistItems.forEach((item) => {
    if (!item) {
      return;
    }
    const tandaStyleFallback =
      item.kind === "tanda"
        ? (() => {
            const tanda = resolveTandaDraft(item.tandaId);
            if (!tanda || tanda.styles.length === 0) {
              return "";
            }
            const normalized = tanda.styles
              .map((style) => normalizeStyleName(style))
              .filter(Boolean);
            return normalized[0] ?? "";
          })()
        : "";
    resolvePlaylistTracks(item).forEach((track) => {
      const artist = collectionArtistGroupKey(track);
      const style = normalizeStyleName(track.genre ?? "") || tandaStyleFallback;
      if (artist && style) {
        used.add(`${artist}|${style}`);
      }
    });
  });
  return used;
};

const buildTopOrLeastCollectionIds = async (least: boolean) => {
  await ensureSmartCollectionCaches();
  const tracks = allTracksForSmartCollections ?? [];
  const tandas = allTandasForSmartCollections ?? [];
  const countForTrack = (id: string) => playCounts.tracks[id] ?? 0;
  const countForTanda = (id: string) => playCounts.tandas[id] ?? 0;
  const trackIds = tracks
    .filter((track) => (least ? true : countForTrack(track.id) > 0))
    .slice()
    .sort((left, right) => {
      const diff = countForTrack(left.id) - countForTrack(right.id);
      const byCount = least ? diff : -diff;
      if (byCount !== 0) {
        return byCount;
      }
      return buildTrackLabel(left).localeCompare(buildTrackLabel(right));
    })
    .slice(0, SMART_COLLECTION_LIMIT)
    .map((track) => track.id);
  const tandaIds = tandas
    .filter((tanda) => (least ? true : countForTanda(tanda.id) > 0))
    .slice()
    .sort((left, right) => {
      const diff = countForTanda(left.id) - countForTanda(right.id);
      const byCount = least ? diff : -diff;
      if (byCount !== 0) {
        return byCount;
      }
      return getTandaSortKey(left).localeCompare(getTandaSortKey(right));
    })
    .slice(0, SMART_COLLECTION_LIMIT)
    .map((tanda) => tanda.id);
  return { trackIds, tandaIds };
};

const buildAvailableCollectionIds = async () => {
  await ensureSmartCollectionCaches();
  const tracks = allTracksForSmartCollections ?? [];
  const tandas = allTandasForSmartCollections ?? [];
  const requiredCount = Math.max(1, getDefaultTandaSize());
  const usedGroups = getPlaylistArtistStyleGroups();
  const eligibleGroups = collectEligibleArtistStyleGroups({
    items: tracks,
    usedGroups,
    requiredCount,
    getArtistGroupKey: collectionArtistGroupKey,
    getStyleKey: (track) => normalizeStyleName(track.genre ?? ""),
    getTitleKey: normalizeTrackTitleForAutofill,
  });
  const trackIds = tracks
    .filter((track) => {
      const artist = collectionArtistGroupKey(track);
      const style = normalizeStyleName(track.genre ?? "");
      const group = artist && style ? `${artist}|${style}` : "";
      return group.length > 0 && eligibleGroups.has(group);
    })
    .slice()
    .sort((left, right) => {
      const leftGroup = collectionArtistGroupKey(left);
      const rightGroup = collectionArtistGroupKey(right);
      const groupOrder = leftGroup.localeCompare(rightGroup);
      if (groupOrder !== 0) {
        return groupOrder;
      }
      return buildTrackLabel(left).localeCompare(buildTrackLabel(right));
    })
    .slice(0, SMART_COLLECTION_LIMIT)
    .map((track) => track.id);
  const tandaIds = tandas
    .filter((tanda) => {
      const tandaTracks = getTandaTracks(tanda);
      const artists = Array.from(new Set(tandaTracks.map(collectionArtistGroupKey)));
      if (artists.length !== 1) {
        return false;
      }
      const styles = Array.from(
        new Set(
          tandaTracks
            .map((track) => normalizeStyleName(track.genre ?? ""))
            .filter(Boolean),
        ),
      );
      const styleFromTracks = styles.length === 1 ? styles[0] ?? "" : "";
      const styleFromTanda = tanda.styles
        .map((style) => normalizeStyleName(style))
        .find(Boolean) ?? "";
      const style = styleFromTracks || styleFromTanda;
      return isTandaArtistStyleAvailable({
        artistGroup: artists[0] ?? "",
        styleGroup: style,
        trackCount: tandaTracks.length,
        requiredCount,
        usedGroups,
      });
    })
    .slice()
    .sort((left, right) => getTandaSortKey(left).localeCompare(getTandaSortKey(right)))
    .slice(0, SMART_COLLECTION_LIMIT)
    .map((tanda) => tanda.id);
  return { trackIds, tandaIds };
};

const getCollectionContentIds = async (collectionId: string) => {
  if (!collectionIsSmart(collectionId)) {
    const collection = clipboardCollections.find((item) => item.id === collectionId);
    return {
      trackIds: collection?.trackIds ?? [],
      tandaIds: collection?.tandaIds ?? [],
    };
  }
  if (collectionId === CLIPBOARD_TOP_ID) {
    return buildTopOrLeastCollectionIds(false);
  }
  if (collectionId === CLIPBOARD_LEAST_ID) {
    return buildTopOrLeastCollectionIds(true);
  }
  return buildAvailableCollectionIds();
};

const renderClipboard = async () => {
  if (!clipTracksEl) {
    return;
  }
  const visibleCollectionIds = getVisibleCollectionIds();
  const visibleTrackIds: string[] = [];
  const visibleTandaIds: string[] = [];
  for (const id of visibleCollectionIds) {
    const content = await getCollectionContentIds(id);
    content.trackIds.forEach((trackId) => {
      if (!visibleTrackIds.includes(trackId)) {
        visibleTrackIds.push(trackId);
      }
    });
    content.tandaIds.forEach((tandaId) => {
      if (!visibleTandaIds.includes(tandaId)) {
        visibleTandaIds.push(tandaId);
      }
    });
  }
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
    const keepRecentOrder =
      activeClipboardCollectionId === CLIPBOARD_NEW_ID &&
      includedClipboardCollectionIds.length === 0;
    const orderedTandas = keepRecentOrder
      ? matchedTandas
      : matchedTandas
          .slice()
          .sort((a, b) => getTandaSortKey(a).localeCompare(getTandaSortKey(b)));
    orderedTandas.forEach((tanda) => {
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
  playlistItems = normalizePlaylistItems(playlistItems);
};

const countPlaylistSequenceMismatches = (items: (PlaylistItem | null)[]) => {
  let mismatches = 0;
  items.forEach((item, index) => {
    if (!item || item.kind !== "tanda") {
      return;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      return;
    }
    const validation = validateTandaForSlot(tanda, index);
    if (!validation.ok && validation.reason) {
      mismatches += 1;
    }
  });
  return mismatches;
};

const maybeRepairLeadingPlaylistSlot = () => {
  if (playlistItems.length === 0 || playlistItems[0] === null) {
    return;
  }
  if (!playlistItems.some((item) => item?.kind === "tanda")) {
    return;
  }
  const currentMismatchCount = countPlaylistSequenceMismatches(playlistItems);
  const candidate = normalizePlaylistItems([null, ...playlistItems]);
  const shiftedMismatchCount = countPlaylistSequenceMismatches(candidate);
  if (shiftedMismatchCount + 1 < currentMismatchCount) {
    playlistItems = candidate;
  }
};

const recomputePlaylistMismatches = () => {
  playlistItems = playlistItems.map((item, index) => {
    if (!item || item.kind !== "tanda") {
      return item;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      return item;
    }
    const validation = validateTandaForSlot(tanda, index);
    const mismatch =
      validation.ok || !validation.reason ? undefined : validation.reason;
    if (item.mismatch === mismatch) {
      return item;
    }
    return { ...item, mismatch };
  });
};

const serializePlaylistItems = (items: (PlaylistItem | null)[]) => {
  const serialized: StoredPlaylistItem[] = items.map((item) => {
    if (!item) {
      return null;
    }
    if (item.kind === "track") {
      return { kind: "track", id: item.track.id };
    }
    const snapshotSource = resolveTandaDraft(item.tandaId);
    const snapshot: PlaylistTandaSnapshot | undefined = snapshotSource
      ? {
          id: snapshotSource.id,
          name: snapshotSource.name,
          styles: [...snapshotSource.styles],
          rating: snapshotSource.rating,
          trackSlots: [...snapshotSource.trackSlots],
          totalDurationMs: snapshotSource.totalDurationMs,
        }
      : undefined;
    return {
      kind: "tanda",
      id: item.tandaId,
      mismatch: item.mismatch,
      snapshot,
    };
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
  const trackIds = collectStoredPlaylistTrackIds(parsed);
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
    if (item.snapshot) {
      const snapshot = item.snapshot;
      const hydrated: TandaDraft = {
        id: item.id,
        name: snapshot.name,
        styles: [...snapshot.styles],
        rating: snapshot.rating,
        trackSlots: [...snapshot.trackSlots],
        totalDurationMs: snapshot.totalDurationMs,
        origin: "playlist",
      };
      ensureTandaDraft(hydrated, "playlist");
      tandaCache.set(hydrated.id, cloneTanda(hydrated));
      return { kind: "tanda", tandaId: hydrated.id, mismatch: item.mismatch };
    }
    const tanda = tandaMap.get(item.id);
    if (tanda) {
      return { kind: "tanda", tandaId: item.id, mismatch: item.mismatch };
    }
    return null;
  });
  maybeRepairLeadingPlaylistSlot();
  playlistSaveSnapshot = serializePlaylistItems(playlistItems);
  clearPlaylistTarget();
  resetCortinaPlans();
};

const renderPlaylist = () => {
  if (!playlistListEl) {
    return;
  }
  normalizePlaylist();
  const targetIndex = getPlaylistTargetIndex();
  const trackTargetIndex = getPlaylistTrackTargetIndex();
  recomputePlaylistMismatches();
  savePlaylistToStorage();
  const fragment = document.createDocumentFragment();
  const duplicateCounts = buildPlaylistDuplicateCountsFromState();
  const openIndex = getOpenPlaylistTandaIndex();
  if (isCortinaEnabled()) {
    const assignedIndices = new Set<number>([
      ...cortinaPlannedByIndex.keys(),
      ...cortinaOverrideByIndex.keys(),
    ]);
    const indices = getUnassignedCortinaRowIndices(playlistItems, assignedIndices).filter(
      (index) => !getCortinaRowTrack(index),
    );
    if (indices.length > 0) {
      void ensureCortinaPlans(indices);
    }
  }
  const startTimes = getPlaylistStartTimes();
  const cortinaStartTimes = getCortinaStartTimes();
  const filterText = normalizeClipboardFilter(playlistFilterText);
  const hasFilter = filterText.length > 0;
  const hideLeadingPlaceholder = !hasFilter && playlistItems[0] === null;
  let visibleItems = 0;
  if (playlistAutofillInProgress && !hasFilter) {
    const loadingRow = document.createElement("div");
    loadingRow.className = "list-row playlist-autofill-row";
    loadingRow.textContent = t("statusPlaylistAutofillRunning");
    fragment.appendChild(loadingRow);
  }
  playlistItems.forEach((item, index) => {
    if (hideLeadingPlaceholder && index === 0 && item === null) {
      return;
    }
    if (hasFilter) {
      if (!item) {
        return;
      }
      if (item.kind === "track") {
        if (!getPlaylistTrackFilterText(item.track).includes(filterText)) {
          return;
        }
      } else {
        const tandaForFilter =
          resolveTandaDraft(item.tandaId) ?? createPlaceholderTanda(item.tandaId);
        if (!getPlaylistTandaFilterText(tandaForFilter).includes(filterText)) {
          return;
        }
      }
    }
    const isLocked = isPlaylistIndexLocked(index);
    const isPlayed =
      appMode === "live" &&
      playlistPlayback.status === "playing" &&
      playlistPlayback.playedThroughIndex >= index;
    const isActive =
      playlistPlayback.status !== "idle" &&
      playlistPlayback.currentIndex === index;
    if (item && item.kind === "track") {
      const row = renderTrackRow(item.track, "playlist", false, undefined, duplicateCounts);
      if (isPlayed) {
        row.classList.add("played");
      }
      if (isLocked) {
        row.classList.add("locked");
      }
      const markButton = row.querySelector<HTMLButtonElement>(
        'button[data-action="mark-playlist-track-target"]',
      );
      if (markButton) {
        markButton.disabled = isLocked;
      }
      if (trackTargetIndex === index) {
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
      row.dataset.index = index.toString();
      applyPulseToRow(row, pulsePlaylistIndices, index);
      fragment.appendChild(row);
      visibleItems += 1;
    } else if (item && item.kind === "tanda") {
      if (isCortinaEnabled() && !hasFilter) {
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
          actions.appendChild(buildHeadphoneButton(cortinaTrack.id));
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
        allowSendToClipboard: true,
        playlistStartTime: startLabel,
        playlistDuration: durationLabel,
        duplicateCounts,
        playlistIndex: index,
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
      if (targetIndex === index) {
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
      visibleItems += 1;
    } else {
      if (hasFilter) {
        return;
      }
      const row = document.createElement("div");
      row.className = "list-row tanda-row playlist-empty-row";
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
      const content = document.createElement("div");
      content.className = "tanda-content";
      const summary = document.createElement("div");
      summary.className = "tanda-summary";
      summary.textContent = t("playlistEmptySlot");
      const hint = document.createElement("span");
      hint.className = "meta";
      hint.textContent = t("playlistEmptyHint");
      content.append(summary, hint);
      const actionsSpacer = document.createElement("span");
      actionsSpacer.className = "row-actions";
      row.append(styleBadge, content, actionsSpacer);
      fragment.appendChild(row);
    }
  });
  if (!hasFilter && isCortinaEnabled() && playlistItems.some((item) => item?.kind === "tanda")) {
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
      actions.appendChild(buildHeadphoneButton(endCortinaTrack.id));
      endRow.appendChild(actions);
    }
    applyPulseToRow(endRow, pulseCortinaIndices, playlistItems.length);
    fragment.appendChild(endRow);
  }
  if (hasFilter && visibleItems === 0) {
    const row = document.createElement("div");
    row.className = "list-row";
    const label = document.createElement("span");
    label.textContent = t("playlistFilterNoMatch");
    row.append(label);
    fragment.appendChild(row);
  }
  playlistListEl.replaceChildren(fragment);
  playlistListEl.dataset.state = activeRightTab === "playlist-tab" ? "visible" : "hidden";
  playlistListEl.dataset.renderedRows = `${visibleItems}`;
  const shouldCenterTarget =
    targetIndex !== null &&
    (centerPlaylistTargetOnNextRender || (!hasFilter && lastRenderedPlaylistHasFilter));
  centerPlaylistTargetOnNextRender = false;
  lastRenderedPlaylistHasFilter = hasFilter;
  if (shouldCenterTarget) {
    requestAnimationFrame(() => {
      scrollPlaylistToIndex(targetIndex);
    });
  }
  updateTabCount(playlistPanel, "playlist-tab", getPlaylistCount());
  updatePlaylistControls();
  renderSearchResults();
  renderTandaSearchResults();
  renderClipboard();
  updateExternalDisplay();
};

const updatePlaylistControls = () => {
  const hasItems = playlistItems.some((item) => item !== null);
  if (playlistStartBtn) {
    if (playlistPlayback.status === "playing") {
      playlistStartBtn.disabled = true;
    } else if (playlistPlayback.status === "paused") {
      playlistStartBtn.disabled = !playlistPlayback.resume;
    } else {
      playlistStartBtn.disabled = !hasItems;
    }
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
    const deadline = performance.now() + ms;
    const tick = () => {
      if (!isPlaylistRunActive(runId)) {
        resolve(false);
        return;
      }
      const remaining = deadline - performance.now();
      if (remaining <= 0) {
        resolve(true);
        return;
      }
      window.setTimeout(tick, Math.min(50, Math.max(10, remaining)));
    };
    tick();
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
  fadeMs: number,
) =>
  new Promise<boolean>((resolve) => {
    const cutoffMs =
      Number.isFinite(durationMs) && durationMs > 0
        ? durationMs + Math.max(0, fadeMs) + 250
        : 20_000;
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (!isPlaylistRunActive(runId)) {
        window.clearInterval(interval);
        resolve(false);
        return;
      }
      if (audio.paused || audio.ended) {
        window.clearInterval(interval);
        resolve(true);
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
      if (Date.now() - start >= cutoffMs) {
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
    cortinaDisplayPhase = "none";
    return true;
  }
  cortinaDisplayPhase = "playing";
  cortinaPlaying = true;
  cortinaAllowFull = false;
  cortinaStopRequested = false;
  cortinaActiveIndex = targetIndex;
  const configuredDurationMs = getCortinaDuration() * 1000;
  const effectiveDurationMs =
    Number.isFinite(configuredDurationMs) && configuredDurationMs > 0
      ? configuredDurationMs
      : 20_000;
  const autoStopFadeMs = Math.max(2000, getStopFadeSeconds() * 1000 + 1000);
  setCortinaControlsVisible(true);
  renderPlaylist();
  const started = await playOnChannel(
    "main",
    track.full_path,
    track.id,
    track,
    track.gain_db ?? null,
    {
      allowToggle: false,
      isCortinaPlayback: true,
      maxDurationSeconds: effectiveDurationMs / 1000,
      autoStopFadeMs,
    },
  );
  if (!started) {
    cortinaDisplayPhase = "none";
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
    cortinaDisplayPhase = "none";
    cortinaPlaying = false;
    cortinaActiveIndex = null;
    setCortinaControlsVisible(false);
    renderPlaylist();
    return false;
  }
  await waitForCortina(activeAudio, runId, effectiveDurationMs, autoStopFadeMs);
  if (!cortinaAllowFull || cortinaStopRequested) {
    if (activeAudio.paused || activeAudio.ended) {
      cortinaDisplayPhase = "after";
      cortinaPlaying = false;
      cortinaActiveIndex = null;
      setCortinaControlsVisible(false);
      renderPlaylist();
      return true;
    }
    if (cortinaStopRequested) {
      if (autoStopFadeMs > 0) {
        await fadeOutAudio(activeAudio, autoStopFadeMs);
      }
      activeAudio.pause();
    } else {
      const settled = await waitForGap(Math.max(300, autoStopFadeMs + 250), runId);
      if (!settled) {
        return false;
      }
      if (!activeAudio.paused && !activeAudio.ended) {
        await fadeOutAudio(activeAudio, Math.max(400, getStopFadeSeconds() * 1000));
        activeAudio.pause();
      }
    }
  } else {
    await waitForAudioEnd(activeAudio, runId);
  }
  cortinaDisplayPhase = "after";
  cortinaPlaying = false;
  cortinaActiveIndex = null;
  setCortinaControlsVisible(false);
  renderPlaylist();
  return true;
};

const runPlaylistPlayback = async (
  resume: boolean,
  options?: {
    skipInitialCortinaGap?: boolean;
    startFromIdle?: boolean;
    suppressLeadInCortinaForSelectedStart?: boolean;
  },
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
  const suppressLeadInCortinaForSelectedStart =
    options?.suppressLeadInCortinaForSelectedStart ?? false;
  const selectedStartIndex = resumeState?.itemIndex ?? null;
  let continuedFromEndCortina = false;
  let leadInCortinaPlayed = false;

  const hasPlayableItems = playlistItems.some((item) => {
    if (!item) {
      return false;
    }
    return resolvePlaylistTracks(item).length > 0;
  });
  if (!resume && hasPlayableItems && isCortinaEnabled()) {
    cortinaDisplayPhase = "about";
    const ok = await playCortina(runId, playlistPlayback.currentIndex);
    if (!ok) {
      return;
    }
    cortinaDisplayPhase = "after";
    const postOk = await waitBeforeTanda(runId);
    if (!postOk) {
      return;
    }
    cortinaDisplayPhase = "none";
  }
  if (
    resume &&
    startFromIdle &&
    isCortinaEnabled() &&
    !suppressLeadInCortinaForSelectedStart
  ) {
    const item = playlistItems[playlistPlayback.currentIndex];
    if (
      item?.kind === "tanda" &&
      playlistPlayback.currentTrackIndex === 0 &&
      !resumeState?.resumeTime
    ) {
      if (skipInitialGapPending) {
        skipInitialGapPending = false;
      } else {
        cortinaDisplayPhase = "about";
        const gapOk = await waitBeforeCortina(runId);
        if (!gapOk) {
          return;
        }
      }
      const ok = await playCortina(runId, playlistPlayback.currentIndex);
      if (!ok) {
        return;
      }
      cortinaDisplayPhase = "after";
      const postOk = await waitBeforeTanda(runId);
      if (!postOk) {
        return;
      }
      cortinaDisplayPhase = "none";
      leadInCortinaPlayed = true;
    }
  }

  let playedAny = false;
  while (isPlaylistRunActive(runId)) {
    if (playlistPlayback.currentIndex >= playlistItems.length) {
      if (playedAny && isCortinaEnabled()) {
        cortinaDisplayPhase = "about";
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
      cortinaDisplayPhase = "none";
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
    const skipLeadInCortinaForSelectedStart = shouldSkipLeadInCortinaForSelectedStart(
      suppressLeadInCortinaForSelectedStart,
      resume,
      startFromIdle,
      playlistPlayback.currentIndex,
      playlistPlayback.currentTrackIndex,
      selectedStartIndex,
    );
    if (
      shouldInsertCortinaBeforeTanda(
        isCortinaEnabled(),
        playlistPlayback.currentIndex,
        playlistPlayback.currentTrackIndex,
        isResumeWithOffset,
        continuedFromEndCortina || leadInCortinaPlayed,
      ) &&
      !skipLeadInCortinaForSelectedStart
    ) {
      if (skipInitialGapPending) {
        skipInitialGapPending = false;
      } else {
        cortinaDisplayPhase = "about";
        const gapOk = await waitBeforeCortina(runId);
        if (!gapOk) {
          return;
        }
      }
      const ok = await playCortina(runId, playlistPlayback.currentIndex);
      if (!ok) {
        return;
      }
      cortinaDisplayPhase = "after";
      const postOk = await waitBeforeTanda(runId);
      if (!postOk) {
        return;
      }
      cortinaDisplayPhase = "none";
    }
    if (continuedFromEndCortina) {
      cortinaDisplayPhase = "after";
      const postOk = await waitBeforeTanda(runId);
      if (!postOk) {
        return;
      }
      cortinaDisplayPhase = "none";
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
      cortinaDisplayPhase = "none";
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
        cortinaDisplayPhase = "none";
        playlistPlayback.activeTrackId = null;
        playlistPlayback.activeTandaId = null;
        playlistPlayback.liveBaseStartMs = null;
        renderPlaylist();
        return;
      }
      const activeAudio = playback.main.active;
      if (!activeAudio) {
        playlistPlayback.status = "idle";
        cortinaDisplayPhase = "none";
        playlistPlayback.liveBaseStartMs = null;
        renderPlaylist();
        return;
      }
      const ended = await waitForAudioEnd(activeAudio, runId);
      if (!ended) {
        return;
      }
      if (appMode === "live") {
        incrementTrackPlayCount(track.id);
      }
      if (index < tracks.length - 1) {
        const ok = await waitForGap(getGapBetweenTracks() * 1000, runId);
        if (!ok) {
          return;
        }
      }
    }
    playedAny = true;
    const stopAfterThisTanda = shouldStopAfterMarkedLastTanda(
      item.kind,
      isCurrentTandaMarkedLast(),
    );
    if (appMode === "live" && item.kind === "tanda") {
      incrementTandaPlayCount(item.tandaId);
    }
    if (appMode === "live") {
      savePlayCounts();
    }
    playlistPlayback.playedThroughIndex = Math.max(
      playlistPlayback.playedThroughIndex,
      playlistPlayback.currentIndex,
    );
    playlistPlayback.currentIndex += 1;
    playlistPlayback.currentTrackIndex = 0;
    playlistPlayback.activeTrackId = null;
    playlistPlayback.activeTandaId = null;
    renderPlaylist();
    if (stopAfterThisTanda) {
      if (isCortinaEnabled()) {
        cortinaDisplayPhase = "about";
        const gapOk = await waitBeforeCortina(runId);
        if (!gapOk) {
          return;
        }
        const ok = await playCortina(runId, playlistPlayback.currentIndex);
        if (!ok) {
          return;
        }
      }
      playlistPlayback.status = "idle";
      cortinaDisplayPhase = "none";
      playlistPlayback.activeTrackId = null;
      playlistPlayback.activeTandaId = null;
      playlistPlayback.resume = null;
      playlistPlayback.liveBaseStartMs = null;
      renderPlaylist();
      return;
    }
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
    await releaseAudioDspRuntime(active);
  }
  playback.main.active = undefined;
  playback.main.currentTrackId = undefined;
  playback.main.track = undefined;
  playback.main.appliedGainDb = null;
  playback.main.isCortinaPlayback = false;
  cortinaDisplayPhase = "none";
  playlistPlayback.activeTrackId = null;
  playlistPlayback.activeTandaId = null;
  renderPlaylist();
};

const normalizeTrackTitleForAutofill = (track: TrackRow) =>
  track.title.trim().toLowerCase();

const getTandaTracks = (tanda: TandaDraft) =>
  tanda.trackSlots
    .map((trackId) => (trackId ? trackCache.get(trackId) ?? null : null))
    .filter((track): track is TrackRow => Boolean(track));

const ensurePlaylistSlot = (index: number) => {
  while (index >= playlistItems.length) {
    playlistItems.push(null);
  }
};

const getPlaylistTotalDurationMs = () => {
  const timeline = buildPlaylistTimeline();
  return computeTimelineTotalMs(timeline.offsets, timeline.entries);
};

const yearValue = (track: TrackRow) => {
  const yearText = typeof track.year === "string" ? track.year : "";
  const match = yearText.match(/\d{4}/);
  if (!match) {
    return null;
  }
  const value = Number.parseInt(match[0], 10);
  return Number.isFinite(value) ? value : null;
};

const artistKey = (track: TrackRow) =>
  (track.artist || track.artist_summary || "").trim().toLowerCase();

const singerKey = (track: TrackRow) => (track.singer ?? "").trim().toLowerCase();

const collectUsedTrackTitles = () => {
  const used = new Set<string>();
  playlistItems.forEach((item) => {
    if (!item) {
      return;
    }
    if (item.kind === "track") {
      used.add(normalizeTrackTitleForAutofill(item.track));
      return;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      return;
    }
    getTandaTracks(tanda).forEach((track) => used.add(normalizeTrackTitleForAutofill(track)));
  });
  return used;
};

const collectSavedAutofillTandas = async () => {
  if (!window.tanda) {
    return [] as TandaDraft[];
  }
  const saved = await window.tanda.listTandas();
  saved.forEach(upsertTandaCache);
  const combined = new Map<string, TandaDraft>();
  for (const tanda of tandaCache.values()) {
    if (!isTandaEmpty(tanda)) {
      combined.set(tanda.id, tanda);
    }
  }
  tandaDrafts.forEach((draft) => {
    if (!isTandaEmpty(draft)) {
      combined.set(draft.id, draft);
    }
  });
  return Array.from(combined.values());
};

const scoreAutofillTanda = (
  tanda: TandaDraft,
  artistCounts: Map<string, number>,
  recentYears: number[],
  recentBpms: number[],
) => {
  const tracks = getTandaTracks(tanda);
  if (tracks.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const artists = Array.from(
    new Set(tracks.map(artistKey).filter((value) => value.length > 0)),
  );
  const artistPenalty = artists.reduce(
    (sum, value) => sum + (artistCounts.get(value) ?? 0),
    0,
  );
  const years = tracks.map(yearValue).filter((value): value is number => value !== null);
  const bpms = tracks
    .map((track) =>
      track.bpm !== null && track.bpm !== undefined ? Math.round(track.bpm) : null,
    )
    .filter((value): value is number => value !== null);
  const yearCenter =
    years.length > 0
      ? years.reduce((sum, value) => sum + value, 0) / years.length
      : null;
  const bpmCenter =
    bpms.length > 0 ? bpms.reduce((sum, value) => sum + value, 0) / bpms.length : null;
  const yearPenalty =
    yearCenter === null || recentYears.length === 0
      ? 0
      : Math.min(...recentYears.map((value) => Math.abs(value - yearCenter))) / 8;
  const bpmPenalty =
    bpmCenter === null || recentBpms.length === 0
      ? 0
      : Math.min(...recentBpms.map((value) => Math.abs(value - bpmCenter))) / 12;
  return artistPenalty * 3 + yearPenalty + bpmPenalty + Math.random();
};

const pickAutofillTandaForSlot = (
  slotIndex: number,
  candidates: TandaDraft[],
  usedTrackTitles: Set<string>,
  usedTandaIds: Set<string>,
  artistCounts: Map<string, number>,
  recentYears: number[],
  recentBpms: number[],
  currentTotalMs: number,
  repeatGapMs: number,
  artistLastPlayedAtMs: Map<string, number>,
) => {
  const asScored = candidates
    .filter((candidate) => !usedTandaIds.has(candidate.id))
    .map((candidate) => {
      const tracks = getTandaTracks(candidate);
      if (tracks.length === 0) {
        return null;
      }
      if (
        tracks.some((track) =>
          usedTrackTitles.has(normalizeTrackTitleForAutofill(track)),
        )
      ) {
        return null;
      }
      const validation = validateTandaForSlot(candidate, slotIndex);
      if (!validation.ok) {
        return null;
      }
      return {
        tanda: candidate,
        score: scoreAutofillTanda(candidate, artistCounts, recentYears, recentBpms),
      };
    })
    .filter(Boolean) as { tanda: TandaDraft; score: number }[];
  if (asScored.length === 0) {
    return null;
  }
  const respectsGap = (tanda: TandaDraft) =>
    areArtistsGapSatisfied({
      items: getTandaTracks(tanda),
      getArtistKey: artistKey,
      currentTotalMs,
      repeatGapMs,
      artistLastPlayedAtMs,
    });
  const usable = asScored.some((entry) => respectsGap(entry.tanda))
    ? asScored.filter((entry) => respectsGap(entry.tanda))
    : asScored;
  usable.sort((left, right) => left.score - right.score);
  const top = usable.slice(0, Math.min(8, usable.length));
  return top[Math.floor(Math.random() * top.length)]?.tanda ?? null;
};

type SimilarityPhase = "strict" | "relax-artist" | "relax-year-bpm" | "style-only";

const pickGeneratedTandaForSlot = (
  slotIndex: number,
  allTracks: TrackRow[],
  usedTrackTitles: Set<string>,
  artistCounts: Map<string, number>,
  currentTotalMs: number,
  repeatGapMs: number,
  artistLastPlayedAtMs: Map<string, number>,
) => {
  const targetCount = Math.max(1, getDefaultPlaylistTandaSize(slotIndex));
  const defaultStyles = getDefaultPlaylistStyles(slotIndex).map(canonicalizeStyleForMatching);
  const styleRequired = defaultStyles.length > 0;
  const pool = allTracks.filter((track) => {
    if (usedTrackTitles.has(normalizeTrackTitleForAutofill(track))) {
      return false;
    }
    if (!styleRequired) {
      return true;
    }
    const style = canonicalizeStyleForMatching(track.genre ?? "");
    return style.length > 0 && defaultStyles.includes(style);
  });
  if (pool.length < targetCount) {
    return null;
  }
  const phases: SimilarityPhase[] = [
    "strict",
    "relax-artist",
    "relax-year-bpm",
    "style-only",
  ];
  for (const phase of phases) {
    const gapModes = repeatGapMs > 0 ? [true, false] : [false];
    for (const enforceGap of gapModes) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const seed = pool[Math.floor(Math.random() * pool.length)] ?? null;
      if (!seed) {
        continue;
      }
      const seedArtist = artistKey(seed);
      const seedYear = yearValue(seed);
      const seedBpm = seed.bpm ?? null;
      const seedSinger = singerKey(seed);
      const seedInstrumental = seed.instrumental;
      const sameArtistPreferred = phase === "strict";
      const matchYearBpm = phase === "strict" || phase === "relax-artist";
      const matchSinger = phase !== "style-only";
      const candidates = pool
        .filter((track) => track.id !== seed.id)
        .filter((track) => normalizeTrackTitleForAutofill(track) !== normalizeTrackTitleForAutofill(seed))
        .filter((track) => {
          if (sameArtistPreferred && seedArtist && artistKey(track) !== seedArtist) {
            return false;
          }
          return true;
        })
        .filter((track) => {
          if (!matchYearBpm) {
            return true;
          }
          const candidateYear = yearValue(track);
          if (seedYear !== null && candidateYear !== null && Math.abs(candidateYear - seedYear) > 6) {
            return false;
          }
          if (
            seedBpm !== null &&
            track.bpm !== null &&
            track.bpm !== undefined &&
            Math.abs(track.bpm - seedBpm) > 8
          ) {
            return false;
          }
          return true;
        })
        .filter((track) => {
          if (!matchSinger) {
            return true;
          }
          if (
            seedInstrumental !== null &&
            track.instrumental !== null &&
            track.instrumental !== seedInstrumental
          ) {
            return false;
          }
          if (seedSinger && singerKey(track) && singerKey(track) !== seedSinger) {
            return false;
          }
          return true;
        })
        .sort((left, right) => {
          const leftArtistPenalty = artistCounts.get(artistKey(left)) ?? 0;
          const rightArtistPenalty = artistCounts.get(artistKey(right)) ?? 0;
          if (leftArtistPenalty !== rightArtistPenalty) {
            return leftArtistPenalty - rightArtistPenalty;
          }
          const leftYear = yearValue(left);
          const rightYear = yearValue(right);
          if (seedYear !== null && leftYear !== null && rightYear !== null) {
            const leftDiff = Math.abs(leftYear - seedYear);
            const rightDiff = Math.abs(rightYear - seedYear);
            if (leftDiff !== rightDiff) {
              return leftDiff - rightDiff;
            }
          }
          return Math.random() - 0.5;
        });
      const chosen: TrackRow[] = [seed];
      for (const candidate of candidates) {
        if (chosen.length >= targetCount) {
          break;
        }
        const duplicateTitle = chosen.some(
          (track) =>
            normalizeTrackTitleForAutofill(track) ===
            normalizeTrackTitleForAutofill(candidate),
        );
        if (duplicateTitle) {
          continue;
        }
        chosen.push(candidate);
      }
      if (chosen.length < targetCount) {
        continue;
      }
      if (
        enforceGap &&
        !areArtistsGapSatisfied({
          items: chosen,
          getArtistKey: artistKey,
          currentTotalMs,
          repeatGapMs,
          artistLastPlayedAtMs,
        })
      ) {
        continue;
      }
      chosen.forEach((track) => trackCache.set(track.id, track));
      const generated: TandaDraft = {
        id: crypto.randomUUID(),
        name: "",
        styles: Array.from(
          new Set(
            collectStylesFromTracks(chosen, availableStyles).concat(
              getDefaultPlaylistStyles(slotIndex),
            ),
          ),
        ),
        rating: 0,
        trackSlots: chosen.map((track) => track.id),
        origin: "playlist",
      };
      while (generated.trackSlots.length < targetCount) {
        generated.trackSlots.push(null);
      }
      const validation = validateTandaForSlot(generated, slotIndex);
      if (!validation.ok) {
        continue;
      }
      ensureTandaDraft(generated, "playlist");
      return generated;
    }
    }
  }
  return null;
};

const registerAutofillUsage = (
  tanda: TandaDraft,
  usedTrackTitles: Set<string>,
  usedTandaIds: Set<string>,
  artistCounts: Map<string, number>,
  recentYears: number[],
  recentBpms: number[],
  artistLastPlayedAtMs: Map<string, number>,
  currentTotalMs: number,
) => {
  usedTandaIds.add(tanda.id);
  const tracks = getTandaTracks(tanda);
  tracks.forEach((track) => {
    usedTrackTitles.add(normalizeTrackTitleForAutofill(track));
    const key = artistKey(track);
    if (key) {
      artistCounts.set(key, (artistCounts.get(key) ?? 0) + 1);
      artistLastPlayedAtMs.set(key, currentTotalMs);
    }
    const year = yearValue(track);
    if (year !== null) {
      recentYears.push(year);
      if (recentYears.length > 40) {
        recentYears.shift();
      }
    }
    if (track.bpm !== null && track.bpm !== undefined) {
      recentBpms.push(Math.round(track.bpm));
      if (recentBpms.length > 40) {
        recentBpms.shift();
      }
    }
  });
};

const createAutofillPlaceholderTandaForSlot = (slotIndex: number) => {
  const targetCount = Math.max(1, getDefaultPlaylistTandaSize(slotIndex));
  const styles = Array.from(new Set(getDefaultPlaylistStyles(slotIndex)));
  const assumedDurationMs = 9 * 60 * 1000;
  const tanda: TandaDraft = {
    id: crypto.randomUUID(),
    name: "",
    styles,
    rating: 0,
    trackSlots: Array.from({ length: targetCount }, () => null),
    totalDurationMs: assumedDurationMs,
    origin: "playlist",
  };
  ensureTandaDraft(tanda, "playlist");
  return tanda;
};

const clearPlaylistState = async () => {
  if (appMode === "live") {
    return false;
  }
  if (playlistPlayback.status === "playing") {
    await stopPlaylistPlayback();
  }
  playlistPlayback.status = "idle";
  playlistPlayback.resume = null;
  playlistPlayback.currentIndex = 0;
  playlistPlayback.currentTrackIndex = 0;
  playlistPlayback.playedThroughIndex = -1;
  cortinaDisplayPhase = "none";
  playlistPlayback.activeTrackId = null;
  playlistPlayback.activeTandaId = null;
  playlistPlayback.liveBaseStartMs = null;
  playlistItems = [null];
  clearPlaylistTarget();
  resetCortinaPlans();
  return true;
};

const clearPlaylist = async () => {
  const cleared = await clearPlaylistState();
  if (!cleared) {
    return;
  }
  renderPlaylist();
  setStatus(t("statusPlaylistCleared"));
};

const clearTandaDesignerDrafts = async () => {
  const playlistDrafts = tandaDrafts.filter((item) => item.origin === "playlist");
  const draft = createEmptyTanda();
  tandaDrafts = [...playlistDrafts, draft];
  selectedTandaId = draft.id;
  selectedStyles = [];
  loadStyles();
  updateSearchTabVisibility();
  await refreshSearch();
  renderTandaDesigner();
};

const clearAndAutofillPlaylist = async () => {
  if (!window.tanda) {
    setStatus(t("statusNoApi"));
    return;
  }
  const cleared = await clearPlaylistState();
  if (!cleared) {
    return;
  }
  // Show the cleared playlist immediately before async autofill work starts.
  playlistAutofillInProgress = true;
  renderPlaylist();
  setStatus(t("statusPlaylistAutofillRunning"));
  try {
    const targetWindowMs = getPlaylistTargetWindowMs();
    const allTracks = await window.tanda.listTracks();
    allTracks.forEach((track) => trackCache.set(track.id, track));
    const candidateTandas = await collectSavedAutofillTandas();
    const usedTrackTitles = collectUsedTrackTitles();
    const usedTandaIds = new Set<string>();
    const artistCounts = new Map<string, number>();
    const artistLastPlayedAtMs = new Map<string, number>();
    const recentYears: number[] = [];
    const recentBpms: number[] = [];
    const repeatGapMs = getPlaylistArtistRepeatGapMinutes() * 60 * 1000;
    let slotIndex = 0;
    let added = 0;
    let blocked = false;

    while (true) {
      const currentTotalMs = getPlaylistTotalDurationMs();
      if (currentTotalMs >= targetWindowMs) {
        break;
      }
      ensurePlaylistSlot(slotIndex);
      const selected =
        pickAutofillTandaForSlot(
          slotIndex,
          candidateTandas,
          usedTrackTitles,
          usedTandaIds,
          artistCounts,
          recentYears,
          recentBpms,
          currentTotalMs,
          repeatGapMs,
          artistLastPlayedAtMs,
        ) ??
        pickGeneratedTandaForSlot(
          slotIndex,
          allTracks,
          usedTrackTitles,
          artistCounts,
          currentTotalMs,
          repeatGapMs,
          artistLastPlayedAtMs,
        );
      if (!selected) {
        const placeholder = createAutofillPlaceholderTandaForSlot(slotIndex);
        placeTandaInPlaylistSlot(placeholder.id, slotIndex, {
          allowCountMismatch: true,
          allowStyleMismatch: true,
        });
        blocked = true;
        added += 1;
        slotIndex += 1;
        if (slotIndex > 300) {
          break;
        }
        continue;
      }
      const candidateDurationMs = getTandaDurationMs(selected);
      if (candidateDurationMs <= 0) {
        const placeholder = createAutofillPlaceholderTandaForSlot(slotIndex);
        placeTandaInPlaylistSlot(placeholder.id, slotIndex, {
          allowCountMismatch: true,
          allowStyleMismatch: true,
        });
        blocked = true;
        added += 1;
        slotIndex += 1;
        if (slotIndex > 300) {
          break;
        }
        continue;
      }
      if (currentTotalMs + candidateDurationMs > targetWindowMs) {
        break;
      }
      ensureTandaDraft(selected, "playlist");
      const placed = placeTandaInPlaylistSlot(selected.id, slotIndex, {
        allowCountMismatch: false,
        allowStyleMismatch: false,
      });
      if (!placed) {
        blocked = true;
        break;
      }
      const projectedTotalMs = getPlaylistTotalDurationMs();
      if (projectedTotalMs > targetWindowMs) {
        playlistItems[slotIndex] = null;
        normalizePlaylist();
        break;
      }
      registerAutofillUsage(
        selected,
        usedTrackTitles,
        usedTandaIds,
        artistCounts,
        recentYears,
        recentBpms,
        artistLastPlayedAtMs,
        currentTotalMs,
      );
      added += 1;
      slotIndex += 1;
      if (slotIndex > 300) {
        break;
      }
    }

    normalizePlaylist();
    if (isCortinaEnabled()) {
      const assignedIndices = new Set<number>([
        ...cortinaPlannedByIndex.keys(),
        ...cortinaOverrideByIndex.keys(),
      ]);
      const missingIndices = getUnassignedCortinaRowIndices(
        playlistItems,
        assignedIndices,
      );
      if (missingIndices.length > 0) {
        await ensureCortinaPlans(missingIndices);
      }
    }
    renderPlaylist();
    const finalMinutes =
      getPlaylistStartTimeMinutes() +
      Math.round(getPlaylistTotalDurationMs() / 60000);
    if (blocked) {
      setStatus(t("statusPlaylistAutofillPartial", { count: added }));
      return;
    }
    setStatus(
      t("statusPlaylistAutofillDone", {
        count: added,
        time: formatClockTime(finalMinutes),
      }),
    );
  } finally {
    playlistAutofillInProgress = false;
    renderPlaylist();
  }
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
  const isMainChannelActivelyPlaying = Boolean(
    playback.main.active && !playback.main.active.paused,
  );
  const wasIdle = shouldTreatClickStartAsIdle(
    playlistPlayback.status,
    isMainChannelActivelyPlaying,
  );
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
  const skipInitialCortinaGap = wasIdle;
  void runPlaylistPlayback(true, {
    skipInitialCortinaGap,
    startFromIdle: wasIdle,
    suppressLeadInCortinaForSelectedStart: appMode === "prep",
  });
};

const renderAllLists = () => {
  renderSearchResults();
  renderTandaSearchResults();
  renderClipboard();
  renderPlaylist();
  renderTandaDesigner();
  updateHeadphoneButtonIndicators();
};

const renderTandaDesigner = () => {
  if (!tandaListEl && !playlistTandaEditorEl) {
    return;
  }
  const designerDrafts = tandaDrafts.filter((item) => item.origin !== "playlist");
  const selectedDesigner = selectedTandaId
    ? designerDrafts.find((item) => item.id === selectedTandaId) ?? null
    : null;
  const nonEmptyDesignerDrafts = designerDrafts.filter((item) => !isTandaEmpty(item));
  const emptyDesignerDrafts = designerDrafts.filter((item) => isTandaEmpty(item));
  let orderedDesignerDrafts: TandaDraft[] = [];
  let designerSelectedId: string | null = selectedDesigner?.id ?? null;

  if (nonEmptyDesignerDrafts.length === 0) {
    let chosenEmpty =
      (selectedDesigner && isTandaEmpty(selectedDesigner)
        ? selectedDesigner
        : emptyDesignerDrafts[0]) ?? null;
    if (!chosenEmpty) {
      chosenEmpty = createEmptyTanda();
      ensureTandaDraft(chosenEmpty, "designer");
      designerDrafts.push(chosenEmpty);
    }
    const remainingNonEmpty = designerDrafts.filter(
      (item) => !isTandaEmpty(item) && item.id !== chosenEmpty?.id,
    );
    orderedDesignerDrafts = chosenEmpty
      ? [chosenEmpty, ...remainingNonEmpty]
      : remainingNonEmpty;
    if (!designerSelectedId) {
      designerSelectedId = chosenEmpty?.id ?? null;
    }
  } else {
    // Do not auto-insert a default empty draft when real tandas already exist.
    // User can explicitly create another empty draft via Add Tanda.
    orderedDesignerDrafts = [...nonEmptyDesignerDrafts, ...emptyDesignerDrafts];
    if (
      !designerSelectedId ||
      !orderedDesignerDrafts.some((item) => item.id === designerSelectedId)
    ) {
      designerSelectedId = nonEmptyDesignerDrafts[0]?.id ?? null;
    }
  }
  if (
    activeRightTab === "tanda-designer-tab" &&
    designerSelectedId &&
    selectedTandaId !== designerSelectedId
  ) {
    selectedTandaId = designerSelectedId;
  }
  const renderInto = (
    container: HTMLDivElement,
    drafts: TandaDraft[],
    selectedId: string | null,
  ) => {
    container.innerHTML = "";
    drafts.forEach((tanda) => {
      const locked = isTandaLocked(tanda.id);
      const card = document.createElement("div");
      card.className = `tanda-card${tanda.id === selectedId ? " selected" : ""}`;
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
    doneButton.disabled = false;
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
    renderInto(tandaListEl, orderedDesignerDrafts, designerSelectedId);
    const designerVisible =
      activeRightTab === "tanda-designer-tab" && tandaEditorHostTab !== "playlist-tab";
    tandaListEl.dataset.state = designerVisible ? "visible" : "hidden";
  }
  if (playlistTandaEditorEl) {
    const resolvePlaylistEditorIndex = () => {
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
      return playlistOpenTandaIndex;
    };
    const openIndex =
      tandaEditorHostTab === "playlist-tab"
        ? resolvePlaylistEditorIndex()
        : getOpenPlaylistTandaIndex();
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
    const playlistSelectedId = playlistDrafts[0]?.id ?? null;
    renderInto(playlistTandaEditorEl, playlistDrafts, playlistSelectedId);
    const shouldShow =
      tandaEditorHostTab === "playlist-tab" &&
      activeRightTab === "playlist-tab" &&
      openIndex !== null &&
      playlistDrafts.length > 0;
    playlistTandaEditorEl.classList.toggle("hidden", !shouldShow);
    playlistTandaEditorEl.dataset.state = shouldShow ? "visible" : "hidden";
  }
};

const addTrackToClipboard = (track: TrackRow) => {
  const target = resolveCollectionForClipboardWrite(
    activeClipboardCollectionId,
    getGeneralCollection()?.id ?? null,
    CLIPBOARD_NEW_ID,
  );
  if (!target.targetCollectionId) {
    return;
  }
  if (target.switchedFromNew) {
    activeClipboardCollectionId = target.nextActiveCollectionId ?? "general";
    includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
      (id) => id !== activeClipboardCollectionId,
    );
    saveClipboardCollections();
    renderClipboardCollections();
  }
  const collection = clipboardCollections.find(
    (item) => item.id === target.targetCollectionId,
  );
  if (!collection) {
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
  if (isReadOnlyCollectionId(collection.id)) {
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
  if (isReadOnlyCollectionId(collection.id)) {
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
  const tandaIds = await window.tanda.listRecentTandas(limit);
  collection.trackIds = ids;
  collection.tandaIds = tandaIds;
  invalidateSmartCollectionsCache();
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
  playlistTargetTandaId = null;
  playlistTrackTargetIndex = null;
  playlistTrackTargetTrackId = null;
};

const clearPlaylistOpenTanda = () => {
  playlistOpenTandaIndex = null;
};

const isTandaInClipboard = (tandaId: string) =>
  clipboardCollections.some((collection) => collection.tandaIds.includes(tandaId));

const cloneTandaWithNewId = (
  tanda: TandaDraft,
  origin?: TandaDraft["origin"],
): TandaDraft => ({
  ...cloneTanda(tanda),
  id: crypto.randomUUID(),
  origin: origin ?? tanda.origin,
});

const ensurePlaylistEditableTanda = (tandaId: string, index: number) => {
  const original = resolveTandaDraft(tandaId);
  if (!original) {
    return null;
  }
  if (!isTandaInClipboard(tandaId)) {
    return original;
  }
  const draft = cloneTandaWithNewId(original, "playlist");
  ensureTandaDraft(draft, "playlist");
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

const retainPlaylistTargetAtIndex = (index: number) => {
  const item = playlistItems[index] ?? null;
  if (item?.kind !== "tanda") {
    clearPlaylistTarget();
    return null;
  }
  playlistTrackTargetIndex = null;
  playlistTrackTargetTrackId = null;
  playlistTargetIndex = index;
  playlistTargetTandaId = item.tandaId;
  return index;
};

const retainPlaylistTrackTargetAtIndex = (index: number) => {
  const item = playlistItems[index] ?? null;
  if (item && item.kind !== "track") {
    clearPlaylistTarget();
    return null;
  }
  playlistTargetIndex = null;
  playlistTargetTandaId = null;
  playlistTrackTargetIndex = index;
  playlistTrackTargetTrackId = item?.kind === "track" ? item.track.id : null;
  return index;
};

const getPlaylistTargetIndex = () => {
  if (playlistTargetTandaId) {
    const resolvedIndex = playlistItems.findIndex(
      (item) => item?.kind === "tanda" && item.tandaId === playlistTargetTandaId,
    );
    if (resolvedIndex >= 0) {
      playlistTargetIndex = resolvedIndex;
      return resolvedIndex;
    }
    if (playlistTargetIndex !== null) {
      return retainPlaylistTargetAtIndex(playlistTargetIndex);
    }
    clearPlaylistTarget();
    return null;
  }
  if (playlistTargetIndex === null) {
    return null;
  }
  return retainPlaylistTargetAtIndex(playlistTargetIndex);
};

const getPlaylistTrackTargetIndex = () => {
  if (playlistTrackTargetTrackId) {
    const resolvedIndex = playlistItems.findIndex(
      (item) => item?.kind === "track" && item.track.id === playlistTrackTargetTrackId,
    );
    if (resolvedIndex >= 0) {
      playlistTrackTargetIndex = resolvedIndex;
      return resolvedIndex;
    }
    if (playlistTrackTargetIndex !== null) {
      const item = playlistItems[playlistTrackTargetIndex] ?? null;
      if (!item || item.kind === "track") {
        return playlistTrackTargetIndex;
      }
      clearPlaylistTarget();
      return null;
    }
    clearPlaylistTarget();
    return null;
  }
  if (playlistTrackTargetIndex === null) {
    return null;
  }
  const item = playlistItems[playlistTrackTargetIndex] ?? null;
  if (!item || item.kind === "track") {
    return playlistTrackTargetIndex;
  }
  clearPlaylistTarget();
  return null;
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

const resolvePlaylistRowIndex = (row: HTMLElement) => {
  const rawIndex = row.dataset.index;
  if (rawIndex) {
    const parsed = Number.parseInt(rawIndex, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  const tandaId = row.dataset.tandaId ?? null;
  if (!tandaId) {
    return -1;
  }
  return playlistItems.findIndex(
    (item) => item?.kind === "tanda" && item.tandaId === tandaId,
  );
};

const appendTrackToPlaylist = (
  track: TrackRow,
  options?: { allowStyleMismatch?: boolean; forcedIndex?: number },
) => {
  normalizePlaylist();
  const targetIndex = getPlaylistTargetIndex();
  const trackTargetIndex = getPlaylistTrackTargetIndex();
  const openIndex = getOpenPlaylistTandaIndex();
  const insertIndex =
    options?.forcedIndex ??
    trackTargetIndex ??
    targetIndex ??
    openIndex ??
    findFirstEmptyPlaylistSlot();
  if (insertIndex < 0) {
    setStatus(t("statusPlaylistNoEmptySlot"));
    return;
  }
  if (isPlaylistIndexLocked(insertIndex)) {
    setStatus(t("statusPlaylistLocked"));
    return;
  }
  if (
    options?.forcedIndex === undefined &&
    trackTargetIndex !== null &&
    insertIndex === trackTargetIndex
  ) {
    const existingTrack = playlistItems[insertIndex];
    if (existingTrack && existingTrack.kind !== "track") {
      clearPlaylistTarget();
      renderPlaylist();
      return;
    }
    playlistItems[insertIndex] = { kind: "track", track };
    trackCache.set(track.id, track);
    markPlaylistPulse(insertIndex);
    retainPlaylistTrackTargetAtIndex(insertIndex);
    renderPlaylist();
    requestAnimationFrame(() => scrollPlaylistToIndex(insertIndex));
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
      retainPlaylistTargetAtIndex(targetIndex);
      centerPlaylistTargetOnNextRender = true;
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
    retainPlaylistTargetAtIndex(targetIndex);
    centerPlaylistTargetOnNextRender = true;
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
  const mappedCanonical = mapped.map((style) =>
    canonicalizeStyleForMatching(style),
  );
  const trackStyle = canonicalizeStyleForMatching(track.genre ?? "");
  return !trackStyle || !mappedCanonical.includes(trackStyle);
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
    origin: "playlist",
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

const getDisplayBackgroundIntervalSec = () => {
  const raw = localStorage.getItem(DISPLAY_BACKGROUND_INTERVAL_KEY);
  const value = raw
    ? Number.parseInt(raw, 10)
    : DEFAULT_DISPLAY_BACKGROUND_INTERVAL_SEC;
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_DISPLAY_BACKGROUND_INTERVAL_SEC;
  }
  return Math.min(600, Math.max(5, value));
};

const getDisplayUseBackgroundImages = () => {
  const raw = localStorage.getItem(DISPLAY_USE_IMAGES_KEY);
  if (raw === null) {
    return true;
  }
  return raw !== "0";
};

const getDisplayImageDimOpacity = () => {
  const raw = localStorage.getItem(DISPLAY_IMAGE_DIM_KEY);
  const value = raw ? Number.parseInt(raw, 10) : Math.round(DEFAULT_DISPLAY_IMAGE_DIM * 100);
  if (!Number.isFinite(value)) {
    return DEFAULT_DISPLAY_IMAGE_DIM;
  }
  return Math.min(0.9, Math.max(0, value / 100));
};

const getDisplayFontScale = () => {
  const raw = localStorage.getItem(DISPLAY_FONT_SCALE_KEY);
  const value = raw ? Number.parseInt(raw, 10) : Math.round(DEFAULT_DISPLAY_FONT_SCALE * 100);
  if (!Number.isFinite(value)) {
    return DEFAULT_DISPLAY_FONT_SCALE;
  }
  return Math.min(2, Math.max(0.7, value / 100));
};

const getDisplayCortinaFontScale = () => {
  const raw = localStorage.getItem(DISPLAY_CORTINA_FONT_SCALE_KEY);
  const value = raw
    ? Number.parseInt(raw, 10)
    : Math.round(DEFAULT_DISPLAY_CORTINA_FONT_SCALE * 100);
  if (!Number.isFinite(value)) {
    return DEFAULT_DISPLAY_CORTINA_FONT_SCALE;
  }
  return Math.min(2.4, Math.max(0.7, value / 100));
};

const getDisplayEdgePaddingVmin = () => {
  const raw = localStorage.getItem(DISPLAY_EDGE_PADDING_KEY);
  const value = raw
    ? Number.parseFloat(raw)
    : DEFAULT_DISPLAY_EDGE_PADDING_VMIN;
  if (!Number.isFinite(value)) {
    return DEFAULT_DISPLAY_EDGE_PADDING_VMIN;
  }
  return Math.min(16, Math.max(1, value));
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
let cortinaPlanPromise: Promise<void> | null = null;
const ensureCortinaPlans = async (indices: number[]) => {
  if (indices.length === 0) {
    return;
  }
  if (cortinaPlanLoading && cortinaPlanPromise) {
    await cortinaPlanPromise;
  }
  const setName = getCortinaSet();
  if (!setName) {
    return;
  }
  cortinaPlanLoading = true;
  cortinaPlanPromise = (async () => {
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
      cortinaPlanPromise = null;
    }
  })();
  await cortinaPlanPromise;
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
      actions.appendChild(buildHeadphoneButton(track.id));
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
    totalDurationMs: 0,
    origin: "designer",
  };
};

const cloneTanda = (tanda: TandaDraft): TandaDraft => ({
  id: tanda.id,
  name: tanda.name,
  styles: [...tanda.styles],
  rating: tanda.rating,
  trackSlots: [...tanda.trackSlots],
  totalDurationMs: tanda.totalDurationMs,
  origin: tanda.origin,
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
  totalDurationMs: 0,
  origin: "playlist",
});

const upsertTandaCache = (tanda: TandaDetail) => {
  tanda.tracks.forEach((track) => trackCache.set(track.id, track));
  tandaCache.set(tanda.id, {
    id: tanda.id,
    name: tanda.name,
    styles: [...tanda.styles],
    rating: tanda.rating,
    trackSlots: [...tanda.track_slots],
    totalDurationMs: tanda.total_duration_ms,
    origin: "designer",
  });
};

const resolveTandaDraft = (tandaId: string) =>
  tandaDrafts.find((tanda) => tanda.id === tandaId) ??
  tandaCache.get(tandaId) ??
  null;

const ensureTandaDraft = (tanda: TandaDraft, origin?: TandaDraft["origin"]) => {
  const existing = tandaDrafts.find((item) => item.id === tanda.id);
  if (existing) {
    if (origin) {
      // Promote playlist-origin drafts when explicitly opened in designer.
      if (!existing.origin || (origin === "designer" && existing.origin !== "designer")) {
        existing.origin = origin;
      }
    }
    return;
  }
  const draft = origin ? { ...tanda, origin } : tanda;
  tandaDrafts = [...tandaDrafts, draft];
};

const isPlaylistIndexLocked = (index: number) => {
  return isPlaylistIndexLockedDuringLive(
    {
      liveMode: appMode === "live",
      playbackStatus: playlistPlayback.status,
      playedThroughIndex: playlistPlayback.playedThroughIndex,
      currentIndex: playlistPlayback.currentIndex,
    },
    index,
  );
};

const isPlaylistTandaSlotLocked = (playlistIndex: number, slotIndex: number) =>
  isPlaylistTandaSlotLockedDuringLive(
    {
      liveMode: appMode === "live",
      playbackStatus: playlistPlayback.status,
      playedThroughIndex: playlistPlayback.playedThroughIndex,
      currentIndex: playlistPlayback.currentIndex,
      currentTrackIndex: playlistPlayback.currentTrackIndex,
    },
    playlistIndex,
    slotIndex,
  );

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
  const target = resolveCollectionForClipboardWrite(
    activeClipboardCollectionId,
    getGeneralCollection()?.id ?? null,
    CLIPBOARD_NEW_ID,
  );
  if (!target.targetCollectionId) {
    return;
  }
  if (target.switchedFromNew) {
    activeClipboardCollectionId = target.nextActiveCollectionId ?? "general";
    includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
      (id) => id !== activeClipboardCollectionId,
    );
    saveClipboardCollections();
    renderClipboardCollections();
  }
  const collection = clipboardCollections.find(
    (item) => item.id === target.targetCollectionId,
  );
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
    retainPlaylistTargetAtIndex(targetIndex);
    centerPlaylistTargetOnNextRender = true;
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
        showAlertAction(
          t("confirmPlaylistSequenceOverride", {
            rule: getSequenceLabel(validation.rule),
            expected: validation.rule.count,
            count: validation.trackCount ?? 0,
          }),
          t("allowOverride"),
          () => {
            placeTandaInPlaylistSlot(tandaId, index, {
              ...options,
              allowCountMismatch: true,
            });
          },
        );
        return false;
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
  if (isReadOnlyCollectionId(collection.id)) {
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
  if (isReadOnlyCollectionId(collection.id)) {
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
const getTopCollectionName = () => t("clipboardCollectionTop");
const getLeastCollectionName = () => t("clipboardCollectionLeast");
const getAvailableCollectionName = () => t("clipboardCollectionAvailable");

const isReadOnlyCollectionId = (id: string) =>
  id === CLIPBOARD_NEW_ID ||
  id === CLIPBOARD_TOP_ID ||
  id === CLIPBOARD_LEAST_ID ||
  id === CLIPBOARD_AVAILABLE_ID;

const isPinnedCollectionId = (id: string) =>
  id === "general" ||
  id === CLIPBOARD_NEW_ID ||
  id === CLIPBOARD_TOP_ID ||
  id === CLIPBOARD_LEAST_ID ||
  id === CLIPBOARD_AVAILABLE_ID;

const defaultCollectionNames = () =>
  (Object.keys(translations) as LanguageKey[]).map(
    (lang) => translations[lang].clipboardCollectionGeneral,
  );

const newCollectionNames = () =>
  (Object.keys(translations) as LanguageKey[]).map(
    (lang) => translations[lang].clipboardCollectionNew,
  );

const topCollectionNames = () =>
  (Object.keys(translations) as LanguageKey[]).map(
    (lang) => translations[lang].clipboardCollectionTop,
  );

const leastCollectionNames = () =>
  (Object.keys(translations) as LanguageKey[]).map(
    (lang) => translations[lang].clipboardCollectionLeast,
  );

const availableCollectionNames = () =>
  (Object.keys(translations) as LanguageKey[]).map(
    (lang) => translations[lang].clipboardCollectionAvailable,
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

const ensureTopCollection = () => {
  const existing = clipboardCollections.find((item) => item.id === CLIPBOARD_TOP_ID);
  if (!existing) {
    const newIndex = clipboardCollections.findIndex((item) => item.id === CLIPBOARD_NEW_ID);
    const insertIndex = newIndex >= 0 ? newIndex + 1 : clipboardCollections.length;
    clipboardCollections.splice(insertIndex, 0, {
      id: CLIPBOARD_TOP_ID,
      name: getTopCollectionName(),
      trackIds: [],
      tandaIds: [],
    });
    return;
  }
  if (topCollectionNames().includes(existing.name)) {
    existing.name = getTopCollectionName();
  }
};

const ensureLeastCollection = () => {
  const existing = clipboardCollections.find((item) => item.id === CLIPBOARD_LEAST_ID);
  if (!existing) {
    const topIndex = clipboardCollections.findIndex((item) => item.id === CLIPBOARD_TOP_ID);
    const insertIndex = topIndex >= 0 ? topIndex + 1 : clipboardCollections.length;
    clipboardCollections.splice(insertIndex, 0, {
      id: CLIPBOARD_LEAST_ID,
      name: getLeastCollectionName(),
      trackIds: [],
      tandaIds: [],
    });
    return;
  }
  if (leastCollectionNames().includes(existing.name)) {
    existing.name = getLeastCollectionName();
  }
};

const ensureAvailableCollection = () => {
  const existing = clipboardCollections.find((item) => item.id === CLIPBOARD_AVAILABLE_ID);
  if (!existing) {
    const leastIndex = clipboardCollections.findIndex((item) => item.id === CLIPBOARD_LEAST_ID);
    const insertIndex = leastIndex >= 0 ? leastIndex + 1 : clipboardCollections.length;
    clipboardCollections.splice(insertIndex, 0, {
      id: CLIPBOARD_AVAILABLE_ID,
      name: getAvailableCollectionName(),
      trackIds: [],
      tandaIds: [],
    });
    return;
  }
  if (availableCollectionNames().includes(existing.name)) {
    existing.name = getAvailableCollectionName();
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

const getPlaylistArtistRepeatGapMinutes = () => {
  const raw = localStorage.getItem(PLAYLIST_ARTIST_REPEAT_GAP_MIN_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_PLAYLIST_ARTIST_REPEAT_GAP_MIN;
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PLAYLIST_ARTIST_REPEAT_GAP_MIN;
  }
  return Math.max(0, Math.min(180, parsed));
};

const loadPlayCounts = () => {
  const raw = localStorage.getItem(PLAY_COUNTS_KEY);
  if (!raw) {
    playCounts = { tracks: {}, tandas: {} };
    return;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PlayCounts>;
    playCounts = {
      tracks: parsed.tracks ?? {},
      tandas: parsed.tandas ?? {},
    };
  } catch {
    playCounts = { tracks: {}, tandas: {} };
  }
};

const savePlayCounts = () => {
  localStorage.setItem(PLAY_COUNTS_KEY, JSON.stringify(playCounts));
};

const clearPlayCounts = () => {
  playCounts = { tracks: {}, tandas: {} };
  savePlayCounts();
  void renderClipboard();
  setStatus(t("statusPlayCountsCleared"));
};

const incrementTrackPlayCount = (trackId: string) => {
  playCounts.tracks[trackId] = (playCounts.tracks[trackId] ?? 0) + 1;
};

const incrementTandaPlayCount = (tandaId: string) => {
  playCounts.tandas[tandaId] = (playCounts.tandas[tandaId] ?? 0) + 1;
};

const invalidateSmartCollectionsCache = () => {
  allTracksForSmartCollections = null;
  allTandasForSmartCollections = null;
};

const ensureSmartCollectionCaches = async () => {
  if (!window.tanda) {
    return;
  }
  if (!allTracksForSmartCollections) {
    allTracksForSmartCollections = await window.tanda.listTracks();
    allTracksForSmartCollections.forEach((track) => trackCache.set(track.id, track));
  }
  if (!allTandasForSmartCollections) {
    const rows = await window.tanda.listTandas();
    rows.forEach(upsertTandaCache);
    allTandasForSmartCollections = rows
      .map((row) => resolveTandaDraft(row.id))
      .filter(Boolean) as TandaDraft[];
  }
};

const collectionIsSmart = (collectionId: string) =>
  collectionId === CLIPBOARD_TOP_ID ||
  collectionId === CLIPBOARD_LEAST_ID ||
  collectionId === CLIPBOARD_AVAILABLE_ID;

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
  ensureTopCollection();
  ensureLeastCollection();
  ensureAvailableCollection();
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
  const preferredActive =
    activeClipboardCollectionId && isReadOnlyCollectionId(activeClipboardCollectionId)
      ? getGeneralCollection()?.id ?? null
      : activeClipboardCollectionId;
  const target = resolveCollectionForClipboardWrite(
    preferredActive,
    getGeneralCollection()?.id ?? null,
    CLIPBOARD_NEW_ID,
  );
  if (!target.targetCollectionId) {
    return false;
  }
  if (target.switchedFromNew) {
    activeClipboardCollectionId = target.nextActiveCollectionId ?? "general";
    includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
      (id) => id !== activeClipboardCollectionId,
    );
    saveClipboardCollections();
    renderClipboardCollections();
  }
  addTrackToCollection(target.targetCollectionId, track);
  selectedClipboardTrackId = track.id;
  selectedClipboardTandaId = null;
  return true;
};

const addTandaToActiveCollection = (tandaId: string) => {
  const preferredActive =
    activeClipboardCollectionId && isReadOnlyCollectionId(activeClipboardCollectionId)
      ? getGeneralCollection()?.id ?? null
      : activeClipboardCollectionId;
  const target = resolveCollectionForClipboardWrite(
    preferredActive,
    getGeneralCollection()?.id ?? null,
    CLIPBOARD_NEW_ID,
  );
  if (!target.targetCollectionId) {
    return false;
  }
  if (target.switchedFromNew) {
    activeClipboardCollectionId = target.nextActiveCollectionId ?? "general";
    includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
      (id) => id !== activeClipboardCollectionId,
    );
    saveClipboardCollections();
    renderClipboardCollections();
  }
  addTandaToCollection(target.targetCollectionId, tandaId);
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
    button.draggable = !isPinnedCollectionId(collection.id);
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
      if (isPinnedCollectionId(collection.id) || !event.dataTransfer) {
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
      if (isReadOnlyCollectionId(collection.id)) {
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
        if (isReadOnlyCollectionId(collection.id)) {
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
      if (isPinnedCollectionId(collection.id)) {
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
        ["general", CLIPBOARD_NEW_ID, CLIPBOARD_TOP_ID, CLIPBOARD_LEAST_ID, CLIPBOARD_AVAILABLE_ID],
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

const rebuildOrchestraAliasIndex = () => {
  orchestraAliasIndex = buildOrchestraAliasIndex(orchestraRegistry);
};

const saveOrchestraRegistry = () => {
  localStorage.setItem(ORCHESTRA_REGISTRY_KEY, JSON.stringify(orchestraRegistry));
  rebuildOrchestraAliasIndex();
  invalidateSmartCollectionsCache();
  void renderClipboard();
};

const loadOrchestraRegistry = () => {
  const raw = localStorage.getItem(ORCHESTRA_REGISTRY_KEY);
  if (!raw) {
    orchestraRegistry = convertSeedToRegistry(ORCHESTRA_SEED_DATA);
    localStorage.setItem(ORCHESTRA_REGISTRY_KEY, JSON.stringify(orchestraRegistry));
    rebuildOrchestraAliasIndex();
    return;
  }
  try {
    const parsed = JSON.parse(raw) as OrchestraRegistryEntry[];
    orchestraRegistry = Array.isArray(parsed)
      ? parsed
          .filter((entry) => entry && typeof entry.canonical === "string")
          .map((entry) => normalizeRegistryEntry(entry))
      : convertSeedToRegistry(ORCHESTRA_SEED_DATA);
  } catch {
    orchestraRegistry = convertSeedToRegistry(ORCHESTRA_SEED_DATA);
  }
  rebuildOrchestraAliasIndex();
};

const renderOrchestraRegistry = () => {
  if (!orchestraListEl) {
    return;
  }
  orchestraListEl.innerHTML = "";
  const normalizedFilter = orchestraFilterText.trim().toLowerCase();
  const visible = orchestraRegistry.filter((entry) => {
    if (!normalizedFilter) {
      return true;
    }
    const haystack = [entry.canonical, ...entry.aliases, ...entry.related]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedFilter);
  });
  visible.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "orchestra-row";
    const canonical = document.createElement("input");
    canonical.type = "text";
    canonical.value = entry.canonical;
    canonical.placeholder = t("orchestraCanonicalLabel");
    canonical.addEventListener("change", () => {
      entry.canonical = canonical.value.trim();
    });
    const aliases = document.createElement("textarea");
    aliases.rows = 2;
    aliases.value = entry.aliases.join(", ");
    aliases.placeholder = t("orchestraAliasesLabel");
    aliases.addEventListener("change", () => {
      entry.aliases = aliases.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    });
    const related = document.createElement("input");
    related.type = "text";
    related.value = entry.related.join(", ");
    related.placeholder = t("orchestraRelatedLabel");
    related.addEventListener("change", () => {
      entry.related = related.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = t("orchestraDelete");
    remove.addEventListener("click", () => {
      orchestraRegistry = orchestraRegistry.filter((item) => item.id !== entry.id);
      saveOrchestraRegistry();
      renderOrchestraRegistry();
    });
    row.append(canonical, aliases, related, remove);
    orchestraListEl.appendChild(row);
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
    { label: t("diagnosticsPathsPlaybackLog"), value: paths.playbackLogPath },
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

const renderPlaybackDiagnosticsLog = async () => {
  if (!diagnosticsPlaybackLogResult || !window.tanda?.getDiagnosticsLogs) {
    return;
  }
  diagnosticsPlaybackLogResult.textContent = t("statusWaveformLoading");
  try {
    const payload = await window.tanda.getDiagnosticsLogs({
      kind: "playback",
      limit: 160,
    });
    diagnosticsPlaybackLogResult.textContent =
      payload.lines.length > 0
        ? payload.lines.join("\n")
        : t("diagnosticsPlaybackLogEmpty");
  } catch (error) {
    diagnosticsPlaybackLogResult.textContent = t("diagnosticsPlaybackLogFailed", {
      message: error instanceof Error ? error.message : t("statusUnknownError"),
    });
  }
};

const clearDiagnosticsLogs = async () => {
  if (!diagnosticsPlaybackLogResult || !window.tanda?.clearDiagnosticsLogs) {
    return;
  }
  diagnosticsPlaybackLogResult.textContent = t("statusWaveformLoading");
  try {
    await window.tanda.clearDiagnosticsLogs();
    diagnosticsPlaybackLogResult.textContent = t("diagnosticsLogsCleared");
  } catch (error) {
    diagnosticsPlaybackLogResult.textContent = t("diagnosticsLogsClearFailed", {
      message: error instanceof Error ? error.message : t("statusUnknownError"),
    });
  }
};

const runAudioOutputProbe = async () => {
  if (!diagnosticsOutputProbeResult) {
    return;
  }
  diagnosticsOutputProbeResult.textContent = t("statusWaveformLoading");
  try {
    let devices = await navigator.mediaDevices.enumerateDevices();
    if (devices.every((device) => device.kind !== "audiooutput" || !device.label)) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch {
        // continue with best-effort labels/devices
      }
    }
    const outputs = devices.filter((device) => device.kind === "audiooutput");
    if (outputs.length === 0) {
      diagnosticsOutputProbeResult.textContent = t("diagnosticsOutputProbeNoDevices");
      return;
    }
    const probe = new Audio();
    const setSink = probe.setSinkId as ((sinkId: string) => Promise<void>) | undefined;
    if (!setSink) {
      diagnosticsOutputProbeResult.textContent = t(
        "diagnosticsOutputProbeUnsupported",
      );
      return;
    }
    const lines: string[] = [];
    for (const output of outputs) {
      const label = output.label || "(unlabeled)";
      const group = output.groupId || "-";
      const id = output.deviceId || "-";
      try {
        await setSink.call(probe, output.deviceId);
        lines.push(`PASS  ${label} | group=${group} | id=${id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lines.push(`FAIL  ${label} | group=${group} | id=${id} | ${message}`);
      }
    }
    probe.pause();
    probe.src = "";
    diagnosticsOutputProbeResult.textContent = lines.join("\n");
  } catch (error) {
    diagnosticsOutputProbeResult.textContent = t("diagnosticsOutputProbeError", {
      message: error instanceof Error ? error.message : t("statusUnknownError"),
    });
  }
};

const renderDiagnosticsDataReadiness = async () => {
  if (!diagnosticsDataReadinessEl || !window.tanda?.getDiagnosticsDataReadiness) {
    return;
  }
  diagnosticsDataReadinessEl.textContent = t("statusWaveformLoading");
  try {
    const summary = await window.tanda.getDiagnosticsDataReadiness();
    const rows: { label: string; value: number }[] = [
      { label: t("diagnosticsReadinessTotalTracks"), value: summary.totalTracks },
      {
        label: t("diagnosticsReadinessMissingDuration"),
        value: summary.missingDuration,
      },
      {
        label: t("diagnosticsReadinessMissingLoudness"),
        value: summary.missingLoudness,
      },
      {
        label: t("diagnosticsReadinessMissingTrimSignals"),
        value: summary.missingTrimSignals,
      },
      {
        label: t("diagnosticsReadinessAnalysisErrors"),
        value: summary.analysisErrors,
      },
      {
        label: t("diagnosticsReadinessMissingWaveforms"),
        value: summary.missingWaveforms,
      },
    ];
    diagnosticsDataReadinessEl.innerHTML = "";
    rows.forEach((row) => {
      const line = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = `${row.label}:`;
      const value = document.createElement("span");
      value.textContent = `${row.value}`;
      line.append(label, document.createTextNode(" "), value);
      diagnosticsDataReadinessEl.appendChild(line);
    });
  } catch (error) {
    diagnosticsDataReadinessEl.textContent = t("diagnosticsPlaybackLogFailed", {
      message: error instanceof Error ? error.message : t("statusUnknownError"),
    });
  }
};

const verifyLegacyReadiness = async () => {
  if (!legacyReadinessResult || !window.tanda?.getDiagnosticsDataReadiness) {
    return;
  }
  legacyReadinessResult.textContent = t("legacyReadinessRunning");
  try {
    const summary = await window.tanda.getDiagnosticsDataReadiness();
    const decision = evaluateDataReadiness(summary);
    const statusText =
      decision.status === "pass"
        ? t("legacyReadinessPass")
        : decision.status === "warn"
          ? t("legacyReadinessWarn")
          : t("legacyReadinessFail");
    const summaryText = t("legacyReadinessSummary", {
      status: statusText,
      total: summary.totalTracks,
      missingDuration: summary.missingDuration,
      missingLoudness: summary.missingLoudness,
      missingTrimSignals: summary.missingTrimSignals,
      analysisErrors: summary.analysisErrors,
      missingWaveforms: summary.missingWaveforms,
    });
    legacyReadinessResult.textContent = summaryText;
    setStatus(statusText);
  } catch (error) {
    legacyReadinessResult.textContent = t("diagnosticsPlaybackLogFailed", {
      message: error instanceof Error ? error.message : t("statusUnknownError"),
    });
  }
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
  void showConfirmModal(message, actionLabel).then((confirmed) => {
    if (confirmed) {
      onAction();
    }
  });
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

const canonicalizeStyleForMatching = (style: string) => {
  const normalized = normalizeStyleName(style);
  if (!normalized) {
    return "";
  }
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join(" ");
};

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

const updateSearchCount = async (
  paramsOverride?: ReturnType<typeof getSearchParams>,
) => {
  if (!window.tanda) {
    return;
  }
  const params = paramsOverride ?? getSearchParams();
  searchState.total = await window.tanda.searchTrackCount(params);
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

const updateJumpIndex = async (
  paramsOverride?: ReturnType<typeof getSearchParams>,
) => {
  if (!window.tanda) {
    return;
  }
  if (searchState.sortBy === "score") {
    renderJumpIndex([]);
    return;
  }
  const params = paramsOverride ?? getSearchParams();
  const available = await window.tanda.searchJumpIndex({
    ...params,
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
  paramsOverride?: ReturnType<typeof getSearchParams>,
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
  setSearchUiState("loading", searchRefreshVersion, searchState.total);
  try {
    const params = paramsOverride ?? getSearchParams();
    const rows = await window.tanda.searchTracks({
      ...params,
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
    setSearchUiState("idle", searchRefreshVersion, searchState.total);
  }
};

const refreshSearch = async () => {
  const refreshVersion = ++searchRefreshVersion;
  setSearchUiState("loading", refreshVersion, 0);
  const params = getSearchParams();
  updateSearchSortDefaults();
  // Avoid stale tab labels from previous searches while the new request is loading.
  searchState.total = 0;
  await loadSearchPage(0, "replace", params);
  if (refreshVersion !== searchRefreshVersion) {
    return;
  }
  if (searchListBody) {
    searchListBody.scrollTop = 0;
  }
  await updateSearchCount(params);
  if (refreshVersion !== searchRefreshVersion) {
    return;
  }
  updateTabCount(searchTracksEl?.closest(".panel") ?? null, "search-tracks", searchState.total);
  await updateJumpIndex(params);
  if (refreshVersion !== searchRefreshVersion) {
    return;
  }
  if (searchState.total > 0 && searchState.items.length === 0) {
    await loadSearchPage(0, "replace", params);
    if (refreshVersion !== searchRefreshVersion) {
      return;
    }
  }
  if (activeSearchTab === "search-tandas") {
    void loadTandaSearchResults();
    setSearchUiState("idle", refreshVersion, searchState.total);
    return;
  }
  window.setTimeout(() => {
    if (refreshVersion !== searchRefreshVersion) {
      return;
    }
    void loadTandaSearchResults();
  }, 250);
  setSearchUiState("idle", refreshVersion, searchState.total);
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

const setSettingsOpen = async (open: boolean) => {
  if (open && isTrackEditorOpen()) {
    if (!(await confirmTrackEditorDiscardIfDirty())) {
      return;
    }
    setTrackEditorOpen(false);
    clearTrackEditorState();
  }
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
    kind.textContent =
      root.kind === "music"
        ? t("rootMusic")
        : root.kind === "cortina"
          ? t("rootCortina")
          : t("rootBackground");
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
    if (legacyReadinessResult && !legacyReadinessResult.textContent) {
      legacyReadinessResult.textContent = "";
    }
  } else {
    legacyImportRootPath = null;
    legacyImportDescription.textContent = "";
    if (legacyReadinessResult) {
      legacyReadinessResult.textContent = "";
    }
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
  loadPlayCounts();
  loadOrchestraRegistry();
  loadClipboardCollections();
  invalidateSmartCollectionsCache();
  await refreshNewCollectionTracks();
  renderClipboardCollections();
  await renderClipboard();

  if (themeToggle) {
    const themeOrder = [
      "dark-alt",
      "dark-red",
      "dark-green",
      "dark-classic",
      "dark",
      "light",
      "light-alt",
    ] as const;
    const applyTheme = (theme: (typeof themeOrder)[number]) => {
      document.body.classList.toggle("theme-light", theme === "light");
      document.body.classList.toggle("theme-dark", theme === "dark");
      document.body.classList.toggle("theme-dark-alt", theme === "dark-alt");
      document.body.classList.toggle("theme-dark-red", theme === "dark-red");
      document.body.classList.toggle("theme-dark-green", theme === "dark-green");
      document.body.classList.toggle("theme-dark-classic", theme === "dark-classic");
      document.body.classList.toggle("theme-light-alt", theme === "light-alt");
      localStorage.setItem("tanda-theme", theme);
    };
    const savedTheme = localStorage.getItem("tanda-theme") as
      | (typeof themeOrder)[number]
      | null;
    applyTheme(savedTheme && themeOrder.includes(savedTheme) ? savedTheme : "dark-alt");
    themeToggle.addEventListener("click", () => {
      const current =
        themeOrder.find((theme) =>
          document.body.classList.contains(`theme-${theme}`),
        ) ?? "dark-alt";
      const next =
        themeOrder[(themeOrder.indexOf(current) + 1) % themeOrder.length];
      applyTheme(next);
    });
  }

  if (closeAppBtn) {
    closeAppBtn.addEventListener("click", async () => {
      const isHeadphonePlaying =
        playback.headphone.active && !playback.headphone.active.paused;
      const isMainPlaying = playback.main.active && !playback.main.active.paused;
      if (isHeadphonePlaying || isMainPlaying) {
        const confirmClose = await showConfirmModal(
          t("confirmCloseWhilePlaying"),
          t("closeApp"),
        );
        if (!confirmClose) {
          return;
        }
      }
      allowAppClose = true;
      await window.tanda?.closeApp();
    });
  }

  clipboardClearBtn?.addEventListener("click", async () => {
    const result = await showClipboardClearModal();
    if (!result) {
      return;
    }
    const { collections: updated, removedIds } = applyClipboardClear(
      clipboardCollections,
      {
        selectedIds: result.selectedIds,
        removeEmpty: result.removeEmpty,
        protectedIds: [
          "general",
          CLIPBOARD_NEW_ID,
          CLIPBOARD_TOP_ID,
          CLIPBOARD_LEAST_ID,
          CLIPBOARD_AVAILABLE_ID,
        ],
      },
    );
    clipboardCollections = updated;
    includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
      (id) => clipboardCollections.some((collection) => collection.id === id),
    );
    if (
      activeClipboardCollectionId &&
      !clipboardCollections.some((collection) => collection.id === activeClipboardCollectionId)
    ) {
      activeClipboardCollectionId = getGeneralCollection()?.id ?? "general";
    }
    if (
      activeClipboardCollectionId === "general" ||
      result.selectedIds.includes(activeClipboardCollectionId ?? "")
    ) {
      selectedClipboardTrackId = null;
      selectedClipboardTandaId = null;
    }
    saveClipboardCollections();
    renderClipboardCollections();
    renderClipboard();
    if (removedIds.length > 0 || result.selectedIds.length > 0) {
      setStatus(t("statusClipboardCleared"));
    }
  });

  if (clipboardFilterInput) {
    clipboardFilterInput.value = clipboardFilterText;
    clipboardFilterInput.addEventListener("input", () => {
      clipboardFilterText = clipboardFilterInput.value;
      void renderClipboard();
    });
  }

  if (playlistFilterInput) {
    playlistFilterInput.value = playlistFilterText;
    playlistFilterInput.addEventListener("input", () => {
      markUserInteraction();
      playlistFilterText = playlistFilterInput.value;
      schedulePlaylistFilterAutoClear();
      if (getPlaylistTargetIndex() !== null) {
        centerPlaylistTargetOnNextRender = true;
      }
      renderPlaylist();
    });
    playlistFilterInput.addEventListener("keydown", () => {
      markUserInteraction();
      schedulePlaylistFilterAutoClear();
    });
    playlistFilterInput.addEventListener("search", () => {
      markUserInteraction();
      playlistFilterText = playlistFilterInput.value;
      if (!playlistFilterText) {
        clearPlaylistFilterTimer();
      } else {
        schedulePlaylistFilterAutoClear();
      }
      if (getPlaylistTargetIndex() !== null) {
        centerPlaylistTargetOnNextRender = true;
      }
      renderPlaylist();
    });
  }

  playlistClearBtn?.addEventListener("click", async () => {
    if (activeRightTab === "tanda-designer-tab") {
      await clearTandaDesignerDrafts();
      return;
    }
    const selection = await showPlaylistClearModal();
    if (!selection) {
      return;
    }
    if (selection === "autofill") {
      await clearAndAutofillPlaylist();
      return;
    }
    await clearPlaylist();
  });

  playlistStatsBtn?.addEventListener("click", () => {
    renderPlaylistStats();
    setPlaylistStatsModalVisible(true);
  });
  playlistStatsCloseBtn?.addEventListener("click", () => {
    setPlaylistStatsModalVisible(false);
  });
  playlistStatsModal?.addEventListener("click", (event) => {
    if (event.target === playlistStatsModal) {
      setPlaylistStatsModalVisible(false);
    }
  });

  window.tanda?.onAppCloseRequest(() => {
    const isHeadphonePlaying =
      playback.headphone.active && !playback.headphone.active.paused;
    const isMainPlaying = playback.main.active && !playback.main.active.paused;
    if (isHeadphonePlaying || isMainPlaying) {
      void showConfirmModal(
        t("confirmCloseWhilePlaying"),
        t("closeApp"),
      ).then((confirmClose) => {
        if (!confirmClose) {
          void window.tanda?.respondToCloseRequest(false);
          return;
        }
        allowAppClose = true;
        void window.tanda?.respondToCloseRequest(true);
      });
      return;
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
      ensureTopCollection();
      ensureLeastCollection();
      ensureAvailableCollection();
      saveClipboardCollections();
      renderClipboardCollections();
      renderOrchestraRegistry();
      await renderDiagnosticsPaths();
      await ensureDefaultStyles("language");
      await loadStyles();
      renderAllLists();
      updateExternalDisplay();
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

  if (cortinaLevelPercentInput) {
    cortinaLevelPercentInput.value = getCortinaLevelPercent().toString();
    cortinaLevelPercentInput.addEventListener("change", () => {
      const next = Number.parseInt(cortinaLevelPercentInput.value, 10);
      if (!Number.isFinite(next)) {
        cortinaLevelPercentInput.value = getCortinaLevelPercent().toString();
        return;
      }
      const clamped = Math.min(100, Math.max(0, next));
      localStorage.setItem(CORTINA_LEVEL_PERCENT_KEY, clamped.toString());
      cortinaLevelPercentInput.value = clamped.toString();
    });
  }

  if (playlistLastTandaToggle) {
    playlistLastTandaToggle.checked = isCurrentTandaMarkedLast();
    playlistLastTandaToggle.addEventListener("change", () => {
      localStorage.setItem(
        PLAYLIST_LAST_TANDA_KEY,
        playlistLastTandaToggle.checked ? "1" : "0",
      );
      updateExternalDisplay();
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
      cortinaOverrideByIndex.clear();
      resetCortinaPlans();
      await resetCortinaQueue();
      await ensureCortinaPlans(getCortinaRowIndices(playlistItems));
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

  if (displayBackgroundIntervalInput) {
    displayBackgroundIntervalInput.value =
      getDisplayBackgroundIntervalSec().toString();
    displayBackgroundIntervalInput.addEventListener("change", () => {
      const next = Number.parseInt(displayBackgroundIntervalInput.value, 10);
      if (!Number.isFinite(next) || next <= 0) {
        displayBackgroundIntervalInput.value =
          getDisplayBackgroundIntervalSec().toString();
        return;
      }
      const clamped = Math.min(600, Math.max(5, next));
      localStorage.setItem(DISPLAY_BACKGROUND_INTERVAL_KEY, clamped.toString());
      displayBackgroundIntervalInput.value = clamped.toString();
      updateExternalDisplay();
    });
  }

  if (displayUseImagesInput) {
    displayUseImagesInput.checked = getDisplayUseBackgroundImages();
    displayUseImagesInput.addEventListener("change", () => {
      localStorage.setItem(
        DISPLAY_USE_IMAGES_KEY,
        displayUseImagesInput.checked ? "1" : "0",
      );
      updateExternalDisplay();
    });
  }

  if (displayImageDimInput) {
    displayImageDimInput.value = Math.round(getDisplayImageDimOpacity() * 100).toString();
    displayImageDimInput.addEventListener("change", () => {
      const next = Number.parseInt(displayImageDimInput.value, 10);
      if (!Number.isFinite(next)) {
        displayImageDimInput.value = Math.round(getDisplayImageDimOpacity() * 100).toString();
        return;
      }
      const clamped = Math.min(90, Math.max(0, next));
      localStorage.setItem(DISPLAY_IMAGE_DIM_KEY, clamped.toString());
      displayImageDimInput.value = clamped.toString();
      updateExternalDisplay();
    });
  }

  if (displayBaseFontSizeInput) {
    displayBaseFontSizeInput.value = Math.round(getDisplayFontScale() * 100).toString();
    displayBaseFontSizeInput.addEventListener("change", () => {
      const next = Number.parseInt(displayBaseFontSizeInput.value, 10);
      if (!Number.isFinite(next)) {
        displayBaseFontSizeInput.value = Math.round(getDisplayFontScale() * 100).toString();
        return;
      }
      const clamped = Math.min(200, Math.max(70, next));
      localStorage.setItem(DISPLAY_FONT_SCALE_KEY, clamped.toString());
      displayBaseFontSizeInput.value = clamped.toString();
      updateExternalDisplay();
    });
  }

  if (displayCortinaFontSizeInput) {
    displayCortinaFontSizeInput.value = Math.round(getDisplayCortinaFontScale() * 100).toString();
    displayCortinaFontSizeInput.addEventListener("change", () => {
      const next = Number.parseInt(displayCortinaFontSizeInput.value, 10);
      if (!Number.isFinite(next)) {
        displayCortinaFontSizeInput.value = Math.round(
          getDisplayCortinaFontScale() * 100,
        ).toString();
        return;
      }
      const clamped = Math.min(240, Math.max(70, next));
      localStorage.setItem(DISPLAY_CORTINA_FONT_SCALE_KEY, clamped.toString());
      displayCortinaFontSizeInput.value = clamped.toString();
      updateExternalDisplay();
    });
  }

  if (displayEdgePaddingInput) {
    displayEdgePaddingInput.value = getDisplayEdgePaddingVmin().toString();
    displayEdgePaddingInput.addEventListener("change", () => {
      const next = Number.parseFloat(displayEdgePaddingInput.value);
      if (!Number.isFinite(next)) {
        displayEdgePaddingInput.value = getDisplayEdgePaddingVmin().toString();
        return;
      }
      const clamped = Math.min(16, Math.max(1, next));
      localStorage.setItem(DISPLAY_EDGE_PADDING_KEY, clamped.toString());
      displayEdgePaddingInput.value = clamped.toString();
      updateExternalDisplay();
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

  if (playlistEndTimeInput) {
    playlistEndTimeInput.value = getPlaylistEndTimeInput();
    playlistEndTimeInput.addEventListener("change", () => {
      const raw = playlistEndTimeInput.value.trim();
      if (!raw.match(/^(\d{1,2}):(\d{2})$/)) {
        playlistEndTimeInput.value = getPlaylistEndTimeInput();
        return;
      }
      localStorage.setItem(PLAYLIST_END_TIME_KEY, raw);
    });
  }

  if (playlistArtistRepeatGapInput) {
    playlistArtistRepeatGapInput.value = getPlaylistArtistRepeatGapMinutes().toString();
    playlistArtistRepeatGapInput.addEventListener("change", () => {
      const next = Number.parseInt(playlistArtistRepeatGapInput.value, 10);
      if (!Number.isFinite(next)) {
        playlistArtistRepeatGapInput.value = getPlaylistArtistRepeatGapMinutes().toString();
        return;
      }
      const clamped = Math.max(0, Math.min(180, next));
      localStorage.setItem(PLAYLIST_ARTIST_REPEAT_GAP_MIN_KEY, clamped.toString());
      playlistArtistRepeatGapInput.value = clamped.toString();
    });
  }

  clearPlayCountsBtn?.addEventListener("click", async () => {
    const confirmed = await showConfirmModal(t("confirmClearPlayCounts"));
    if (!confirmed) {
      return;
    }
    clearPlayCounts();
  });

  orchestraAddBtn?.addEventListener("click", () => {
    orchestraRegistry.push(
      normalizeRegistryEntry({
        canonical: "",
        aliases: [],
        related: [],
      }),
    );
    renderOrchestraRegistry();
  });
  orchestraResetBtn?.addEventListener("click", async () => {
    const confirmed = await showConfirmModal(t("confirmOrchestraRegistryReset"));
    if (!confirmed) {
      return;
    }
    orchestraRegistry = convertSeedToRegistry(ORCHESTRA_SEED_DATA);
    saveOrchestraRegistry();
    renderOrchestraRegistry();
    setStatus(t("statusOrchestraRegistryReset"));
  });
  orchestraSaveBtn?.addEventListener("click", () => {
    const hasInvalid = orchestraRegistry.some((entry) => !entry.canonical.trim());
    if (hasInvalid) {
      setStatus(t("statusOrchestraRegistryInvalid"));
      return;
    }
    orchestraRegistry = orchestraRegistry.map((entry) =>
      normalizeRegistryEntry(entry),
    );
    saveOrchestraRegistry();
    renderOrchestraRegistry();
    setStatus(t("statusOrchestraRegistrySaved"));
  });
  orchestraFilterInput?.addEventListener("input", () => {
    orchestraFilterText = orchestraFilterInput.value;
    renderOrchestraRegistry();
  });

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

  if (playlistSequenceInput) {
    playlistSequenceInput.value = getPlaylistSequenceInput();
    playlistSequenceInput.addEventListener("change", () => {
      localStorage.setItem("tanda-playlist-sequence", playlistSequenceInput.value);
      recomputePlaylistMismatches();
      renderPlaylist();
    });
  }

  if (playlistStyleMapInput) {
    playlistStyleMapInput.value = getPlaylistStyleMapInput();
    playlistStyleMapInput.addEventListener("change", () => {
      localStorage.setItem("tanda-playlist-style-map", playlistStyleMapInput.value);
      recomputePlaylistMismatches();
      renderPlaylist();
      updateExternalDisplay();
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
      const selected = mainOutputSelect.value || DEFAULT_OUTPUT_ID;
      const verified = await verifyOutputSelection("main", selected);
      if (!verified) {
        await ensureAudioOutputs();
        renderAllLists();
        return;
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
        const verified = await verifyOutputSelection(
          "headphone",
          headphoneOutputSelect.value,
        );
        if (!verified) {
          await ensureAudioOutputs();
          renderAllLists();
          return;
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
  trackEditor?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>(
      "button.track-editor-search-field[data-track-editor-search-field]",
    );
    if (!button || !searchInput) {
      return;
    }
    const field = button.dataset.trackEditorSearchField;
    if (!field) {
      return;
    }
    const fieldValue = getTrackEditorFieldQueryValue(field).trim();
    if (!fieldValue) {
      return;
    }
    const nextQuery = appendQueryTokens(searchInput.value, fieldValue);
    runSearchQuery(nextQuery, true);
  });
  trackEditorResetBtn?.addEventListener("click", () => {
    resetTrackEditorFields();
  });
  trackEditorCloseBtn?.addEventListener("click", async () => {
    if (!(await confirmTrackEditorDiscardIfDirty())) {
      return;
    }
    setTrackEditorOpen(false);
    clearTrackEditorState();
  });
  trackEditorSaveBtn?.addEventListener("click", async () => {
    if (!window.tanda || !trackEditorState.track) {
      return;
    }
    const payload = getTrackEditorDraftPayload();
    if (!payload) {
      return;
    }
    try {
      const updated = await window.tanda.updateTrack(payload);
      if (!updated) {
        setStatus(t("statusTrackUpdateFailed"));
        return;
      }
      updateTrackCaches(updated);
      setStatus(t("statusTrackUpdated"));
      setTrackEditorOpen(false);
      clearTrackEditorState();
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

  closeSettingsBtn?.addEventListener("click", () => {
    void setSettingsOpen(false);
  });
  openSettingsBtn?.addEventListener("click", () => {
    void setSettingsOpen(true);
  });
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
  openDisplayBtn?.addEventListener("click", async () => {
    if (!window.tanda?.openDisplay) {
      setStatus(t("statusNoApi"));
      return;
    }
    await window.tanda.openDisplay();
    updateExternalDisplay();
  });
  nowPlayingSection?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest(".now-playing-boost") ||
      target.closest("#waveform-container") ||
      target.closest("#track-editor-waveform-container")
    ) {
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
    seekToWaveformPosition(event, waveformContainer);
  });
  trackEditorWaveformContainer?.addEventListener("click", (event) => {
    event.stopPropagation();
    seekToWaveformPosition(event, trackEditorWaveformContainer);
  });
  openDiagnosticsMain?.addEventListener("click", () => {
    void setSettingsOpen(true);
    activateSettingsTab("diagnostics");
  });
  openDiagnosticsSettings?.addEventListener("click", () => {
    void setSettingsOpen(true);
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
  diagnosticsPlaybackLogBtn?.addEventListener("click", () => {
    void renderPlaybackDiagnosticsLog();
  });
  diagnosticsClearLogsBtn?.addEventListener("click", () => {
    void clearDiagnosticsLogs();
  });
  diagnosticsOutputProbeBtn?.addEventListener("click", () => {
    void runAudioOutputProbe();
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
    if (playlistPlayback.status === "paused" && playlistPlayback.resume) {
      resumePlaylistPlayback();
      return;
    }
    startPlaylistPlayback();
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

  addBackgroundsBtn?.addEventListener("click", async () => {
    const selected = await window.tanda?.pickRoot("background");
    if (!selected) {
      return;
    }
    await window.tanda?.addRoot("background", selected);
    setStatus(t("statusAddedBackground", { path: selected }));
    await renderRoots();
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
    const confirmed = await showConfirmModal(
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
    cortinaDisplayPhase = "none";
    playlistPlayback.activeTrackId = null;
    playlistPlayback.activeTandaId = null;
    playlistPlayback.liveBaseStartMs = null;
    clearPlaylistTarget();
    resetCortinaPlans();
    localStorage.removeItem(PLAYLIST_STORAGE_KEY);
    await renderRoots();
    await renderDataLocation();
    await updateLegacyImport(result.path);
    await renderDiagnosticsDataReadiness();
    renderClipboard();
    renderPlaylist();
    refreshSearch();
  });

  const updateScanIssues = (errors: { filePath: string; message: string }[]) => {
    if (progressLabel) {
      progressLabel.textContent = t("statusScanIssues", {
        count: errors.length,
      });
    }
    if (progressLabelSettings) {
      progressLabelSettings.textContent = t("statusScanIssues", {
        count: errors.length,
      });
    }
    if (errorList) {
      errorList.innerHTML = "";
      errors.slice(0, 50).forEach((error) => {
        const li = document.createElement("li");
        li.textContent = `${error.filePath}: ${error.message}`;
        errorList.appendChild(li);
      });
      if (errors.length > 50) {
        const li = document.createElement("li");
        li.textContent = t("scanIssuesMore", {
          count: errors.length - 50,
        });
        errorList.appendChild(li);
      }
    }
  };

  legacyImportButton?.addEventListener("click", async () => {
    if (!window.tanda || !legacyImportRootPath) {
      return;
    }
    const confirmed = await showConfirmModal(
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
    if (result.missingFiles) {
      updateScanIssues(result.missingFiles);
    }
    await loadTandaDrafts();
    await refreshNewCollectionTracks();
    await loadCortinaSets();
    await updateLegacyImport(result.rootPath);
    await refreshSearch();
    await renderDiagnosticsDataReadiness();
    renderAllLists();
  });
  legacyReadinessButton?.addEventListener("click", () => {
    void verifyLegacyReadiness();
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
      updateScanIssues(summary.errors);
      await loadStyles();
      await loadCortinaSets();
      if (kind === "music") {
        await refreshNewCollectionTracks();
      }
      await refreshSearch();
      await renderDiagnosticsDataReadiness();
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
    const confirmed = await showConfirmModal(
      t("confirmEraseDatabase"),
      t("eraseDatabase"),
    );
    if (!confirmed) {
      return;
    }
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
    if (handleDuplicateJump(target)) {
      return;
    }
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
    if (editAction === "search-track" && editTrackId) {
      const track = trackCache.get(editTrackId);
      if (track) {
        runSearchForTrack(track);
      }
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
    if (handleDuplicateJump(target)) {
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
      runSearchForTrack(track);
      closeRowMenus();
      return;
    }
    if (action === "headphone" && headphoneAvailable) {
      await playOnChannel(
        "headphone",
        data.filePath,
        data.trackId,
        track,
        data.gainDb,
      );
      updateHeadphoneButtonIndicators();
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
    if (handleDuplicateJump(target)) {
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
    if (editAction === "search-track" && editTrackId) {
      const track = trackCache.get(editTrackId);
      if (track) {
        runSearchForTrack(track);
      }
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
        ).then((started) => {
          if (started && isTrackEditorOpen()) {
            openTrackEditor(track.id);
          }
        });
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
    if (handleDuplicateJump(target)) {
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
      runSearchForTrack(clipTrack);
      closeRowMenus();
      return;
    }
    if (action === "headphone" && headphoneAvailable) {
      await playOnChannel(
        "headphone",
        data.filePath,
        data.trackId,
        clipTrack,
        data.gainDb,
      );
      updateHeadphoneButtonIndicators();
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
    if (target.closest("#playlist-tanda-editor")) {
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
          const playlistIndex = resolvePlaylistRowIndex(row);
          const preferredStyles =
            playlistIndex >= 0 ? resolveSearchStylesForPlaylistIndex(playlistIndex) : undefined;
          runSearchForTanda(tanda, preferredStyles);
        }
      }
      closeRowMenus();
      return;
    }
    if (action === "search-track") {
      const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
      const detailTrackId = detailLine?.dataset.trackId ?? null;
      const playlistIndex = resolvePlaylistRowIndex(row);
      const data = getTrackDataFromRow(row);
      const track = detailTrackId
        ? trackCache.get(detailTrackId) ?? resolveTrackById(detailTrackId)
        : data
          ? resolveTrackById(data.trackId)
          : null;
      if (track) {
        const preferredStyles =
          playlistIndex >= 0 ? resolveSearchStylesForPlaylistIndex(playlistIndex) : undefined;
        runSearchForTrack(track, preferredStyles);
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
      const index = resolvePlaylistRowIndex(row);
      if (index < 0) {
        setStatus(t("statusPlaylistSwapInvalid"));
        return;
      }
      if (isPlaylistIndexLocked(index)) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      if (getPlaylistTargetIndex() === index) {
        clearPlaylistTarget();
      } else {
        if (retainPlaylistTargetAtIndex(index) !== null) {
          applyPlaylistTargetStyles(index);
          centerPlaylistTargetOnNextRender = true;
        }
      }
      renderPlaylist();
      closeRowMenus();
      return;
    }
    if (action === "mark-playlist-track-target") {
      const index = resolvePlaylistRowIndex(row);
      if (index < 0) {
        return;
      }
      if (isPlaylistIndexLocked(index)) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      if (getPlaylistTrackTargetIndex() === index) {
        clearPlaylistTarget();
      } else {
        if (retainPlaylistTrackTargetAtIndex(index) !== null) {
          applyPlaylistTargetStyles(index);
          centerPlaylistTargetOnNextRender = true;
        }
      }
      renderPlaylist();
      closeRowMenus();
      return;
    }
    if (action === "swap-playlist-target") {
      const index = resolvePlaylistRowIndex(row);
      const targetIndex = getPlaylistTargetIndex();
      if (index < 0 || targetIndex === null || targetIndex === index) {
        setStatus(t("statusPlaylistSwapInvalid"));
        return;
      }
      if (isPlaylistIndexLocked(index) || isPlaylistIndexLocked(targetIndex)) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      const attemptSwap = (
        options?: { allowStyleMismatch?: boolean; allowCountMismatch?: boolean },
      ) => {
        const currentItem = playlistItems[index];
        const targetItem = playlistItems[targetIndex];
        if (!currentItem || !targetItem) {
          setStatus(t("statusPlaylistSwapInvalid"));
          return;
        }
        if (currentItem.kind !== "tanda" || targetItem.kind !== "tanda") {
          setStatus(t("statusPlaylistSwapInvalid"));
          return;
        }
        const currentTanda = resolveTandaDraft(currentItem.tandaId);
        const targetTanda = resolveTandaDraft(targetItem.tandaId);
        if (!currentTanda || !targetTanda) {
          setStatus(t("statusPlaylistSwapInvalid"));
          return;
        }
        const currentValidation = validateTandaForSlot(currentTanda, targetIndex);
        const targetValidation = validateTandaForSlot(targetTanda, index);
        const countIssue =
          currentValidation.reason === "count" || targetValidation.reason === "count";
        if (countIssue && !options?.allowCountMismatch) {
          const ruleForCount = currentValidation.rule ?? targetValidation.rule;
          showAlertAction(
            t("confirmPlaylistSequenceOverride", {
              rule: ruleForCount ? getSequenceLabel(ruleForCount) : "?",
              expected: ruleForCount?.count ?? 0,
              count:
                currentValidation.trackCount ?? targetValidation.trackCount ?? 0,
            }),
            t("allowOverride"),
            () => {
              attemptSwap({ ...options, allowCountMismatch: true });
            },
          );
          return;
        }
        const styleIssue =
          currentValidation.reason === "style" || targetValidation.reason === "style";
        if (styleIssue && !options?.allowStyleMismatch) {
          const ruleForStyle = currentValidation.rule ?? targetValidation.rule;
          showAlertAction(
            t("confirmPlaylistSequenceStyleOverride", {
              rule: ruleForStyle ? getSequenceLabel(ruleForStyle) : "?",
              tanda: getTandaSequenceLabel(currentTanda),
            }),
            t("allowOverride"),
            () => {
              attemptSwap({ ...options, allowStyleMismatch: true });
            },
          );
          return;
        }
        const currentMismatch =
          currentValidation.reason === "style"
            ? "style"
            : currentValidation.reason === "count"
              ? "count"
              : undefined;
        const targetMismatch =
          targetValidation.reason === "style"
            ? "style"
            : targetValidation.reason === "count"
              ? "count"
              : undefined;
        playlistItems[index] = { ...targetItem, mismatch: targetMismatch };
        playlistItems[targetIndex] = { ...currentItem, mismatch: currentMismatch };
        if (playlistOpenTandaIndex === index) {
          playlistOpenTandaIndex = targetIndex;
        } else if (playlistOpenTandaIndex === targetIndex) {
          playlistOpenTandaIndex = index;
        }
        retainPlaylistTargetAtIndex(targetIndex);
        centerPlaylistTargetOnNextRender = true;
        markPlaylistPulse(index);
        markPlaylistPulse(targetIndex);
        renderPlaylist();
        closeRowMenus();
      };
      attemptSwap();
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
      if (index >= 0) {
        playlistOpenTandaIndex = index;
      }
      const effectiveId = source.id;
      openTandaInDesigner(effectiveId, source, "playlist-tab");
      closeRowMenus();
      return;
    }
    const data = getTrackDataFromRow(row);
    if (action === "headphone" && headphoneAvailable && data) {
      const playlistTrack = resolveTrackById(data.trackId);
      await playOnChannel(
        "headphone",
        data.filePath,
        data.trackId,
        playlistTrack,
        data.gainDb,
      );
      updateHeadphoneButtonIndicators();
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
      // Keep this slot as the next single-track replacement target.
      retainPlaylistTrackTargetAtIndex(index);
      normalizePlaylist();
      renderPlaylist();
      renderClipboard();
      closeRowMenus();
      return;
    }
    if (action === "send-playlist-tanda-track") {
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
      if (isPlaylistTandaSlotLocked(index, slotIndex)) {
        setStatus(t("statusPlaylistLocked"));
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
    if (selectedClipboardTrackId && detailLine && playlistItem?.kind === "tanda") {
      const slotIndexRaw = detailLine.dataset.slotIndex ?? "";
      const slotIndex = Number.parseInt(slotIndexRaw, 10);
      if (!Number.isFinite(slotIndex) || slotIndex < 0) {
        return;
      }
      if (isPlaylistTandaSlotLocked(index, slotIndex)) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      const activeCollection = getActiveCollection();
      const clipTrack = clipboardTracks.find(
        (track) => track.id === selectedClipboardTrackId,
      );
      if (!clipTrack || !activeCollection?.trackIds.includes(clipTrack.id)) {
        setStatus(t("statusClipboardReadonlyRemove"));
        return;
      }
      const tanda = ensurePlaylistEditableTanda(playlistItem.tandaId, index);
      if (!tanda || slotIndex >= tanda.trackSlots.length) {
        return;
      }
      const replacedTrackId = tanda.trackSlots[slotIndex] ?? null;
      tanda.trackSlots[slotIndex] = clipTrack.id;
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
      const selectedIndex = activeCollection.trackIds.indexOf(clipTrack.id);
      if (selectedIndex >= 0) {
        if (replacedTrackId && !activeCollection.trackIds.includes(replacedTrackId)) {
          activeCollection.trackIds[selectedIndex] = replacedTrackId;
        } else {
          activeCollection.trackIds = activeCollection.trackIds.filter(
            (id) => id !== clipTrack.id,
          );
        }
      }
      trackCache.set(clipTrack.id, clipTrack);
      selectedClipboardTrackId = null;
      saveClipboardCollections();
      markPlaylistPulse(index);
      renderClipboard();
      renderPlaylist();
      return;
    }
    const mainActive = playback.main.active;
    const isMainPlaying = !!mainActive && !mainActive.paused;
    if (!selectedClipboardTrackId || detailLine) {
      if (appMode !== "live") {
        return;
      }
      if (isMainPlaying) {
        return;
      }
      startPlaylistFrom(index, detailTrackId);
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
  if (orchestraFilterInput) {
    orchestraFilterInput.value = orchestraFilterText;
  }
  renderOrchestraRegistry();
  ensureCortinaDurationDefault();
  await renderDiagnosticsPaths();
  await renderPlaybackDiagnosticsLog();
  await renderDiagnosticsDataReadiness();
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
  window.setInterval(updateNowPlayingDisplay, 200);
  window.setInterval(maybeAutoCenterPlaylist, 5000);
};

init().catch((error) => {
  setStatus(error instanceof Error ? error.message : t("statusUnknownError"));
});
