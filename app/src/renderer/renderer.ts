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
  validateTandaForRule,
  type SequenceEntry,
  type StyleMap,
} from "../shared/playlist-sequence.js";
import {
  buildFamilyStyleIndex,
  composeStyleLabel,
  deriveFamiliesFromStyles,
  expandStyleFilters,
  formatStylePillLabel,
  parseStyleFamilies,
  serializeStyleFamilies,
  splitStyleLabel,
  styleFamilyMapFromFamilies,
  type StyleFamily,
} from "../shared/style-families.js";
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
  parseClockMinutes,
} from "../shared/playlist-window.js";
import { reorderClipboardCollections } from "../shared/clipboard-order.js";
import {
  moveTandaToCollection,
  moveTrackToCollection,
} from "../shared/clipboard-move.js";
import { applyClipboardClear } from "../shared/clipboard-clear.js";
import { resolveCollectionForClipboardWrite } from "../shared/clipboard-target.js";
import { computeTrimmedEnd } from "../shared/audio-trim.js";
import {
  resolveBaseDurationSeconds,
  resolveClampedCurrentSeconds,
  resolveDisplayDurationSeconds,
  resolveEffectiveDurationSeconds,
  resolveProgressRatio,
  toDisplayStyleLabel,
  resolveWaveformSeekTargetSeconds,
} from "../shared/now-playing.js";
import {
  isCompressionControlLockedForPrep,
  shouldUseCompressionSource,
} from "../shared/audio-compression.js";
import { resolveCompressionSliderUiState } from "../shared/compression-ui.js";
import {
  applyGainStepGuard,
  gainDbToLinear,
  resolvePlaybackNormalization,
} from "../shared/audio-normalization.js";
import { computeFadeDurationMs } from "../shared/audio-fade.js";
import {
  clampNumber,
  computeDynamicsFrame,
  computeParallelMixGains,
  resolveWetCompensation,
  computeTrackLevelerFrame,
  computeUpwardLiftDb,
  depthPercentToMix,
  dbToLinear,
  linearToDb,
  smoothToward,
} from "../shared/audio-dynamics.js";
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
import { basenameForDisplay } from "../shared/path-display.js";
import {
  collectStoredPlaylistTrackIds,
  type PlaylistTandaSnapshot,
  type StoredPlaylistItem,
} from "../shared/playlist-storage.js";
import {
  aggregateOrchestraDurations,
  areArtistsGapSatisfied,
  buildAdaptiveNumericDistribution,
  buildAdaptiveStyleNumericDistribution,
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
import {
  SUPPORTED_LANGUAGES,
  translate,
  translations,
  type LanguageKey,
} from "./i18n.js";
import { resolveTrackEditorPathLines } from "./track-editor-path.js";
import { setSearchUiState as setSearchUiStateView } from "./modules/search-view.js";
import {
  buildTrackLabel as buildTrackLabelView,
  getNowPlayingState as getNowPlayingStateView,
} from "./modules/playback-view.js";
import { createWaveformController } from "./modules/waveform-view.js";
import {
  resolveCurrentProgressText,
  resolveNextTandaLabel,
  resolveNextTandaStyle,
} from "./modules/display-view.js";
import { createSearchController } from "./controllers/search-controller.js";
import { createSettingsDiagnosticsController } from "./controllers/settings-diagnostics-controller.js";
import { createPlaybackCompressionController } from "./controllers/playback-compression-controller.js";
import { createPlaylistRuntimeController } from "./controllers/playlist-runtime-controller.js";
import { computeTapTempoBpm } from "./modules/track-editor-view.js";
import {
  buildClipboardTandaFilterText,
  normalizeClipboardFilter,
} from "./modules/clipboard-view.js";
import { resolvePlaylistWindowMs } from "./modules/playlist-view.js";
import { resolveOutputModeValue } from "./modules/settings-view.js";
import {
  createRendererUiStore,
  type SearchState,
  type OutputMode,
  type RightPanelTab,
  type SearchTab,
} from "../shared/state/renderer-ui-store.js";

const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const addMusicBtn = document.querySelector<HTMLButtonElement>("#add-music");
const addCortinaBtn = document.querySelector<HTMLButtonElement>("#add-cortina");
const addBackgroundsBtn =
  document.querySelector<HTMLButtonElement>("#add-backgrounds");
const scanMusicBtn =
  document.querySelector<HTMLButtonElement>("#scan-music");
const scanCortinasBtn =
  document.querySelector<HTMLButtonElement>("#scan-cortinas");
const precomputeCompressedBtn =
  document.querySelector<HTMLButtonElement>("#precompute-compressed");
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
const legacyStylesButton =
  document.querySelector<HTMLButtonElement>("#legacy-styles-button");
const legacyStylesResult =
  document.querySelector<HTMLDivElement>("#legacy-styles-result");
const legacyStyleTools =
  document.querySelector<HTMLDivElement>("#legacy-style-tools");
const legacyStyleMappingEl =
  document.querySelector<HTMLDivElement>("#legacy-style-mapping");
const legacyStyleMappingBody =
  document.querySelector<HTMLTableSectionElement>("#legacy-style-mapping-body");
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
const searchDiversityBtn =
  document.querySelector<HTMLButtonElement>("#search-diversity");
const searchDiversityModal =
  document.querySelector<HTMLElement>("#search-diversity-modal");
const searchDiversityCloseBtn =
  document.querySelector<HTMLButtonElement>("#search-diversity-close");
const searchDiversityOrchestraEl =
  document.querySelector<HTMLDivElement>("#search-diversity-orchestra");
const searchDiversityYearEl =
  document.querySelector<HTMLDivElement>("#search-diversity-year");
const searchDiversityTempoEl =
  document.querySelector<HTMLDivElement>("#search-diversity-tempo");
const searchDiversityStyleEl =
  document.querySelector<HTMLDivElement>("#search-diversity-style");
const searchDiversitySummaryEl =
  document.querySelector<HTMLDivElement>("#search-diversity-summary");
const searchDiversityOpportunitiesEl =
  document.querySelector<HTMLDivElement>("#search-diversity-opportunities");
const searchDiversityStyleGapsEl =
  document.querySelector<HTMLDivElement>("#search-diversity-style-gaps");
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
const styleFamilyCodeInput =
  document.querySelector<HTMLInputElement>("#style-family-code-input");
const styleFamilyBaseInput =
  document.querySelector<HTMLInputElement>("#style-family-base-input");
const styleFamilyVariantsInput =
  document.querySelector<HTMLInputElement>("#style-family-variants-input");
const styleFamilyAddBtn = document.querySelector<HTMLButtonElement>("#style-family-add");
const styleFamilyList = document.querySelector<HTMLDivElement>("#style-family-list");
const modeSelect = document.querySelector<HTMLSelectElement>("#mode-select");
const mainOutputSelect =
  document.querySelector<HTMLSelectElement>("#main-output-select");
const headphoneOutputSelect =
  document.querySelector<HTMLSelectElement>("#headphone-output-select");
const cortinaLevelPercentInput =
  document.querySelector<HTMLInputElement>("#cortina-level-percent");
const audioDynamicsEnabledInput =
  document.querySelector<HTMLInputElement>("#audio-dynamics-enabled");
const audioDynamicsLiftThresholdInput =
  document.querySelector<HTMLInputElement>("#audio-dynamics-lift-threshold");
const audioDynamicsMaxLiftInput =
  document.querySelector<HTMLInputElement>("#audio-dynamics-max-lift");
const audioDynamicsRatioInput =
  document.querySelector<HTMLInputElement>("#audio-dynamics-ratio");
const audioDynamicsAttackInput =
  document.querySelector<HTMLInputElement>("#audio-dynamics-attack");
const audioDynamicsReleaseInput =
  document.querySelector<HTMLInputElement>("#audio-dynamics-release");
const audioDynamicsGateThresholdInput =
  document.querySelector<HTMLInputElement>("#audio-dynamics-gate-threshold");
const audioDynamicsLimiterCeilingInput =
  document.querySelector<HTMLInputElement>("#audio-dynamics-limiter-ceiling");
const audioDynamicsLimiterReleaseInput =
  document.querySelector<HTMLInputElement>("#audio-dynamics-limiter-release");
const audioDynamicsRampInput =
  document.querySelector<HTMLInputElement>("#audio-dynamics-ramp");
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
const nowPlayingDynamicsControl =
  document.querySelector<HTMLDivElement>("#now-playing-dynamics");
const nowPlayingDynamicsMixInput =
  document.querySelector<HTMLInputElement>("#now-playing-dynamics-mix");
const nowPlayingDynamicsMixValue =
  document.querySelector<HTMLSpanElement>("#now-playing-dynamics-mix-value");
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
const trackEditorPathHint =
  document.querySelector<HTMLDivElement>("#track-editor-path");
const trackEditorCompressedPathHint =
  document.querySelector<HTMLDivElement>("#track-editor-compressed-path");

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
const AUDIO_DYNAMICS_ENABLED_KEY = "tanda-audio-dynamics-enabled";
const AUDIO_DYNAMICS_DEPTH_KEY = "tanda-audio-dynamics-depth";
const AUDIO_DYNAMICS_LIFT_THRESHOLD_KEY = "tanda-audio-dynamics-lift-threshold";
const AUDIO_DYNAMICS_MAX_LIFT_KEY = "tanda-audio-dynamics-max-lift";
const AUDIO_DYNAMICS_RATIO_KEY = "tanda-audio-dynamics-ratio";
const AUDIO_DYNAMICS_ATTACK_KEY = "tanda-audio-dynamics-attack";
const AUDIO_DYNAMICS_RELEASE_KEY = "tanda-audio-dynamics-release";
const AUDIO_DYNAMICS_GATE_THRESHOLD_KEY = "tanda-audio-dynamics-gate-threshold";
const AUDIO_DYNAMICS_LIMITER_CEILING_KEY = "tanda-audio-dynamics-limiter-ceiling";
const AUDIO_DYNAMICS_LIMITER_RELEASE_KEY = "tanda-audio-dynamics-limiter-release";
const AUDIO_DYNAMICS_RAMP_KEY = "tanda-audio-dynamics-ramp";
const DEFAULT_AUDIO_DYNAMICS_ENABLED = true;
const DEFAULT_AUDIO_DYNAMICS_DEPTH = 0;
const DEFAULT_AUDIO_DYNAMICS_LIFT_THRESHOLD = -60;
const DEFAULT_AUDIO_DYNAMICS_MAX_LIFT = 15;
const DEFAULT_AUDIO_DYNAMICS_RATIO = 5;
const DEFAULT_AUDIO_DYNAMICS_ATTACK = 35;
const DEFAULT_AUDIO_DYNAMICS_RELEASE = 3000;
const DEFAULT_AUDIO_DYNAMICS_GATE_THRESHOLD = -65;
const DEFAULT_AUDIO_DYNAMICS_LIMITER_CEILING = -1;
const DEFAULT_AUDIO_DYNAMICS_LIMITER_RELEASE = 260;
const DEFAULT_AUDIO_DYNAMICS_RAMP = 800;
const DEFAULT_CORTINA_LEVEL_PERCENT = 100;
const PLAYLIST_LAST_TANDA_KEY = "tanda-playlist-current-last";
const PLAYLIST_END_TIME_KEY = "tanda-playlist-end-time";
const DEFAULT_PLAYLIST_END_TIME = "03:00";

let searchState: SearchState<TrackRow> = {
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
let searchRefreshVersion = 0;
let searchController: ReturnType<typeof createSearchController<TrackRow>> | null = null;
let settingsDiagnosticsController:
  | ReturnType<typeof createSettingsDiagnosticsController>
  | null = null;
const applySearchUiState = (state: "idle" | "loading", token?: number, count?: number) =>
  setSearchUiStateView({
    searchListBody,
    searchTracksEl,
    state,
    token,
    count,
  });
applySearchUiState("idle", 0, 0);
let clipboardTracks: TrackRow[] = [];
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
let styleDefinitions: Array<{ name: string; aliases: string[] }> = [];
let styleFamilies: StyleFamily[] = [];
let familyStyleIndex = new Map<string, string[]>();
let legacyStyleRows: Array<{
  value: string;
  normalized: string;
  count: number;
  mappedTo: string;
}> = [];
let styleVariantMenuEl: HTMLDivElement | null = null;
let collectionTargetMenuEl: HTMLDivElement | null = null;

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
const STYLE_FAMILIES_KEY = "tanda-style-families";
const STYLE_VARIANT_LONG_PRESS_MS = 1000;
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

let activeRightTab: RightPanelTab = "playlist-tab";
let activeSearchTab: SearchTab = "search-tracks";
let playlistFilterText = "";
let clipboardFilterText = "";
let playlistFilterClearTimer: number | undefined;
const PLAYLIST_FILTER_AUTO_CLEAR_MS = 30_000;
let lastRenderedPlaylistHasFilter = false;
let centerPlaylistTargetOnNextRender = false;
let appMode: OutputMode = "prep";

const rendererUiStore = createRendererUiStore({
  appMode,
  activeRightTab,
  activeSearchTab,
  playlistFilterText,
  clipboardFilterText,
  search: searchState,
});

const syncRendererUiLocals = () => {
  const state = rendererUiStore.getState();
  appMode = state.appMode;
  activeRightTab = state.activeRightTab;
  activeSearchTab = state.activeSearchTab;
  playlistFilterText = state.playlistFilterText;
  clipboardFilterText = state.clipboardFilterText;
  searchState = state.search as SearchState<TrackRow>;
};

const setAppModeState = (mode: OutputMode) => {
  rendererUiStore.dispatch({ type: "set_app_mode", appMode: mode });
  syncRendererUiLocals();
};

const setActiveRightTabState = (tab: RightPanelTab) => {
  rendererUiStore.dispatch({ type: "set_right_tab", tab });
  syncRendererUiLocals();
};

const setActiveSearchTabState = (tab: SearchTab) => {
  rendererUiStore.dispatch({ type: "set_search_tab", tab });
  syncRendererUiLocals();
};

const setPlaylistFilterTextState = (value: string) => {
  rendererUiStore.dispatch({ type: "set_playlist_filter", value });
  syncRendererUiLocals();
};

const setClipboardFilterTextState = (value: string) => {
  rendererUiStore.dispatch({ type: "set_clipboard_filter", value });
  syncRendererUiLocals();
};

const setSearchState = (next: SearchState<TrackRow>) => {
  rendererUiStore.dispatch({ type: "set_search", search: next });
  syncRendererUiLocals();
};

const patchSearchState = (patch: Partial<SearchState<TrackRow>>) => {
  rendererUiStore.dispatch({ type: "patch_search", patch });
  syncRendererUiLocals();
};

type OutputChannel = "main" | "headphone";

type PlaybackState = {
  active?: HTMLAudioElement;
  compressedActive?: HTMLAudioElement;
  currentTrackId?: string;
  track?: TrackRow;
  appliedGainDb?: number | null;
  isCortinaPlayback?: boolean;
  usingCompressedSource?: boolean;
  activeSourcePath?: string;
  originalSourcePath?: string;
  compressedSourcePath?: string;
  wetCompensationGain?: number;
  wetCompensationReferenceRatio?: number;
};

const playback: Record<OutputChannel, PlaybackState> = {
  main: {},
  headphone: {},
};
const playRequestVersion: Record<OutputChannel, number> = {
  main: 0,
  headphone: 0,
};
const lastAppliedGainDbByChannel: Record<OutputChannel, number | null> = {
  main: null,
  headphone: null,
};
const compressedSourceCache = new Map<string, string>();
const compressedSourceRequests = new Map<string, Promise<string | null>>();
const compressedSourceErrorByTrackId = new Map<string, string>();
const trackedCompressedCompanions = new Set<HTMLAudioElement>();
let compressionPrefetchTimer: number | null = null;
let compressionPrefetchInFlight = false;
const prefetchedCortinaTrackIds = new Set<string>();
const MAX_GAIN_ONLY_STEP_DB = 4;
const MAX_GAIN_ONLY_STEP_DB_NON_LIVE = 24;

let waveformTrackId: string | null = null;
let openRowMenuId: string | null = null;
let playlistOpenTandaIndex: number | null = null;
let tandaEditorHostTab: RightPanelTab = "tanda-designer-tab";
let scanRequestInFlight = false;
let searchDiversityRenderInFlight = false;
let precomputeCompressionInProgress = false;

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

const DEFAULT_PLAYLIST_SEQUENCE = "3t 3t 3w";
const DEFAULT_STYLE_FAMILIES = "T=Tango:Nuevo, Traditional\nW=Waltz\nM=Milonga";
const DEFAULT_PLAYLIST_START_TIME = "20:00";
const getLanguage = () =>
  (localStorage.getItem("tanda-language") as LanguageKey) || "en";

const t = (key: string, params?: Record<string, string | number>) => {
  return translate(getLanguage(), key, params);
};

const renderLanguageOptions = () => {
  if (!languageSelect) {
    return;
  }
  const current = getLanguage();
  languageSelect.innerHTML = "";
  SUPPORTED_LANGUAGES.forEach((code) => {
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
  // Keep cross-track normalization effective up to the configured gain-db cap.
  // +12 dB is ~3.98x linear, so allow 4x here instead of clipping at 2x.
  return gainDbToLinear(gainDb, 4);
};
const audioLevels = new WeakMap<HTMLAudioElement, number>();
const DSP_MAX_WET_MIX = 1;
type AudioDynamicsConfig = {
  enabled: boolean;
  mode: "upward" | "track-leveler";
  depth: number;
  liftThresholdDb: number;
  maxLiftDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  gateThresholdDb: number;
  limiterCeilingDb: number;
  limiterReleaseMs: number;
  rampMs: number;
};

type AudioDspRuntime = {
  source: MediaElementAudioSourceNode;
  inputGain: GainNode;
  dryGain: GainNode;
  liftGain: GainNode;
  limiter: DynamicsCompressorNode;
  wetGain: GainNode;
  mixGain: GainNode;
  analyser: AnalyserNode;
  outputAnalyser: AnalyserNode;
  isRunning: boolean;
  currentLiftDb: number;
  detectorDb: number;
  peakDb: number;
  levelerMeanDb: number;
  lastUpdateMs: number;
  updateRafId: number | null;
};

let sharedAudioContext: AudioContext | null = null;
const audioDspRuntimes = new WeakMap<HTMLAudioElement, AudioDspRuntime>();
const audioSampleBuffer = new Float32Array(2048);
const levelMatchSampleBuffer = new Float32Array(1024);
let mainWetMixCurrent = 0;
let mainWetMixTarget = 0;
let mainWetMixRafId: number | null = null;

const runMainWetMixSmoother = () => {
  if (mainWetMixRafId !== null) {
    return;
  }
  const step = () => {
    const delta = mainWetMixTarget - mainWetMixCurrent;
    if (Math.abs(delta) < 0.002) {
      mainWetMixCurrent = mainWetMixTarget;
      mainWetMixRafId = null;
      applyDynamicLevelToChannel("main");
      return;
    }
    // ~220ms full-scale slew at 60fps.
    mainWetMixCurrent += delta * 0.075;
    applyDynamicLevelToChannel("main");
    mainWetMixRafId = window.requestAnimationFrame(step);
  };
  mainWetMixRafId = window.requestAnimationFrame(step);
};

const configureRuntimePassThrough = (runtime: AudioDspRuntime) => {
  const now = runtime.inputGain.context.currentTime;
  runtime.dryGain.gain.cancelScheduledValues(now);
  runtime.wetGain.gain.cancelScheduledValues(now);
  runtime.dryGain.gain.setValueAtTime(1, now);
  runtime.wetGain.gain.setValueAtTime(0, now);
};

const sampleRuntimeRms = (audio: HTMLAudioElement) => {
  const runtime = audioDspRuntimes.get(audio);
  if (!runtime) {
    return 0;
  }
  runtime.outputAnalyser.getFloatTimeDomainData(levelMatchSampleBuffer);
  let sum = 0;
  for (let i = 0; i < levelMatchSampleBuffer.length; i += 1) {
    const sample = levelMatchSampleBuffer[i] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / levelMatchSampleBuffer.length);
};

const getSharedAudioContext = () => {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
};

const ensureSharedAudioContextRunning = async () => {
  const context = getSharedAudioContext();
  if (context.state === "running") {
    return true;
  }
  try {
    await context.resume();
  } catch {
    return false;
  }
  const nextState = context.state as AudioContextState;
  return nextState === "running";
};

const getAudioDynamicsConfig = (): AudioDynamicsConfig => ({
  enabled: localStorage.getItem(AUDIO_DYNAMICS_ENABLED_KEY) === "1",
  mode: "track-leveler",
  depth: parseSettingNumber(AUDIO_DYNAMICS_DEPTH_KEY, DEFAULT_AUDIO_DYNAMICS_DEPTH, 0, 100),
  // Compressor profile is now fixed at code level for a single predictable behavior.
  // Only enable toggle and now-playing mix depth remain user-adjustable.
  liftThresholdDb: DEFAULT_AUDIO_DYNAMICS_LIFT_THRESHOLD,
  maxLiftDb: DEFAULT_AUDIO_DYNAMICS_MAX_LIFT,
  ratio: DEFAULT_AUDIO_DYNAMICS_RATIO,
  attackMs: DEFAULT_AUDIO_DYNAMICS_ATTACK,
  releaseMs: DEFAULT_AUDIO_DYNAMICS_RELEASE,
  gateThresholdDb: DEFAULT_AUDIO_DYNAMICS_GATE_THRESHOLD,
  limiterCeilingDb: DEFAULT_AUDIO_DYNAMICS_LIMITER_CEILING,
  limiterReleaseMs: DEFAULT_AUDIO_DYNAMICS_LIMITER_RELEASE,
  rampMs: DEFAULT_AUDIO_DYNAMICS_RAMP,
});

const getAudioDynamicsDepthPercent = () =>
  parseSettingNumber(AUDIO_DYNAMICS_DEPTH_KEY, DEFAULT_AUDIO_DYNAMICS_DEPTH, 0, 100);

const isCompressionRequestedForChannel = (
  channel: OutputChannel,
  options?: PlayOptions,
) => {
  const config = getAudioDynamicsConfig();
  return shouldUseCompressionSource({
    channel,
    isCortinaPlayback: options?.isCortinaPlayback ?? false,
    enabled: config.enabled,
    depthPercent: config.depth,
  });
};

const buildCompressedSourceRequestKey = (
  track: TrackRow,
  config: AudioDynamicsConfig,
) =>
  [
    track.id,
    track.full_path,
    track.loudness_db ?? "null",
    config.mode,
    config.liftThresholdDb,
    config.maxLiftDb,
    config.ratio,
    config.attackMs,
    config.releaseMs,
    config.gateThresholdDb,
    config.limiterCeilingDb,
    config.limiterReleaseMs,
  ].join("|");

const resolveCompressedPathForTrack = (track: TrackRow): string | null => {
  if (playback.main.track?.id === track.id) {
    const activePath = playback.main.compressedSourcePath?.trim() ?? "";
    if (activePath) {
      return activePath;
    }
  }
  const requestKey = buildCompressedSourceRequestKey(track, getAudioDynamicsConfig());
  const cachedPath = compressedSourceCache.get(requestKey)?.trim() ?? "";
  return cachedPath || null;
};

const requestCompressedSource = async (
  track: TrackRow,
  config: AudioDynamicsConfig,
) => {
  if (!window.tanda) {
    return null;
  }
  const renderDepthPercent = 100;
  const requestKey = buildCompressedSourceRequestKey(track, config);
  const cached = compressedSourceCache.get(requestKey);
  if (cached) {
    return cached;
  }
  const pending = compressedSourceRequests.get(requestKey);
  if (pending) {
    return pending;
  }
  const request = (async () => {
    const result = await window.tanda!.renderCompressedTrack({
      trackId: track.id,
      filePath: track.full_path,
      loudnessDb: track.loudness_db,
      depthPercent: renderDepthPercent,
      mode: config.mode,
      liftThresholdDb: config.liftThresholdDb,
      maxLiftDb: config.maxLiftDb,
      ratio: config.ratio,
      attackMs: config.attackMs,
      releaseMs: config.releaseMs,
      gateThresholdDb: config.gateThresholdDb,
      limiterCeilingDb: config.limiterCeilingDb,
      limiterReleaseMs: config.limiterReleaseMs,
    });
    if (!result?.ok || !result.filePath) {
      const reason = result?.error?.trim() || "unknown render error";
      compressedSourceErrorByTrackId.set(track.id, reason);
      void window.tanda?.logPlaybackDiagnostic?.({
        channel: "main",
        mode: appMode,
        trackId: track.id,
        title: track.title ?? "",
        artist: track.artist ?? "",
        playlistStatus: playlistPlayback.status,
        playlistIndex: playlistPlayback.currentIndex,
        trackIndex: playlistPlayback.currentTrackIndex,
        gainSource: "none",
        gainDb: track.gain_db ?? null,
        loudnessDb: track.loudness_db ?? null,
        linearGain: 1,
        correctionDb: 0,
        driftDb: 0,
        targetLoudnessDb: -16,
        expectedOutputLoudnessDb: null,
        outputRouteMethod: "compression-render",
        outputRouteError: reason,
        attemptedOutputDeviceIds: [],
      });
      return null;
    }
    compressedSourceErrorByTrackId.delete(track.id);
    compressedSourceCache.set(requestKey, result.filePath);
    return result.filePath;
  })();
  compressedSourceRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    compressedSourceRequests.delete(requestKey);
  }
};

const resolveDynamicRuntimeConfig = (config: AudioDynamicsConfig): AudioDynamicsConfig => {
  const depthMix = depthPercentToMix(config.depth);
  if (!config.enabled || depthMix <= 0) {
    return config;
  }
  const lerp = (from: number, to: number) => from + (to - from) * depthMix;
  return {
    ...config,
    // At higher depths, move toward stronger upward leveling behavior.
    liftThresholdDb: lerp(config.liftThresholdDb, -10),
    maxLiftDb: lerp(config.maxLiftDb, 54),
    ratio: lerp(config.ratio, 24),
    gateThresholdDb: lerp(config.gateThresholdDb, -70),
    attackMs: lerp(config.attackMs, 10),
    releaseMs: lerp(config.releaseMs, 450),
    limiterReleaseMs: lerp(config.limiterReleaseMs, 180),
  };
};

const renderNowPlayingDynamicsControl = () => {
  const enabled = localStorage.getItem(AUDIO_DYNAMICS_ENABLED_KEY) === "1";
  const depth = enabled ? getAudioDynamicsDepthPercent() : 0;
  nowPlayingDynamicsControl?.classList.toggle("hidden", !enabled);
  const mainActive = Boolean(playback.main.active && !playback.main.active.paused);
  const mainTrackLoaded = Boolean(playback.main.track);
  const compressedReady = Boolean(playback.main.compressedActive);
  const lockForPrepPlayback = isCompressionControlLockedForPrep({
    appMode,
    isMainPlaying: mainActive,
    usingCompressedSource: Boolean(playback.main.usingCompressedSource),
  });
  const sliderState = resolveCompressionSliderUiState({
    enabled,
    storedDepthPercent: depth,
    isMainActive: mainActive,
    hasMainTrack: mainTrackLoaded,
    compressedReady,
    prepLock: lockForPrepPlayback,
  });
  if (nowPlayingDynamicsMixInput) {
    nowPlayingDynamicsMixInput.value = sliderState.displayedDepthPercent.toString();
    nowPlayingDynamicsMixInput.disabled = sliderState.disabled;
  }
  if (nowPlayingDynamicsMixValue) {
    nowPlayingDynamicsMixValue.textContent = `${sliderState.displayedDepthPercent}%`;
  }
};

const isDynamicsAvailableForChannel = (
  channel: OutputChannel,
  requestedOutputDeviceId: string | null,
) => {
  if (channel !== "main") {
    return false;
  }
  return !requestedOutputDeviceId || requestedOutputDeviceId === DEFAULT_OUTPUT_ID;
};

const applyDynamicsWetDry = (
  runtime: AudioDspRuntime,
  config: AudioDynamicsConfig,
  immediate = false,
) => {
  const context = runtime.inputGain.context;
  const now = context.currentTime;
  const mixGains = computeParallelMixGains({
    enabled: config.enabled,
    depthPercent: config.depth,
  });
  const wetTarget = clampNumber(mixGains.wet, 0, DSP_MAX_WET_MIX);
  const dryTarget = clampNumber(mixGains.dry, 0, 1);
  const rampSeconds = immediate ? 0 : Math.max(0.02, config.rampMs / 1000);
  runtime.wetGain.gain.cancelScheduledValues(now);
  runtime.dryGain.gain.cancelScheduledValues(now);
  runtime.wetGain.gain.setValueAtTime(runtime.wetGain.gain.value, now);
  runtime.dryGain.gain.setValueAtTime(runtime.dryGain.gain.value, now);
  runtime.wetGain.gain.linearRampToValueAtTime(wetTarget, now + rampSeconds);
  runtime.dryGain.gain.linearRampToValueAtTime(dryTarget, now + rampSeconds);
};

const applyDynamicsToRuntime = (runtime: AudioDspRuntime, config: AudioDynamicsConfig) => {
  const runtimeConfig = resolveDynamicRuntimeConfig(config);
  runtime.limiter.threshold.value = runtimeConfig.limiterCeilingDb;
  runtime.limiter.knee.value = 0;
  runtime.limiter.ratio.value = 20;
  runtime.limiter.attack.value = 0.003;
  runtime.limiter.release.value = Math.max(0.01, runtimeConfig.limiterReleaseMs / 1000);
  applyDynamicsWetDry(runtime, config);
};

const updateRuntimeLift = (runtime: AudioDspRuntime) => {
  if (!runtime.isRunning) {
    return;
  }
  const context = runtime.inputGain.context;
  const config = resolveDynamicRuntimeConfig(getAudioDynamicsConfig());
  runtime.analyser.getFloatTimeDomainData(audioSampleBuffer);
  let sum = 0;
  for (let i = 0; i < audioSampleBuffer.length; i += 1) {
    const sample = audioSampleBuffer[i] ?? 0;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / audioSampleBuffer.length);
  const inputDb = linearToDb(rms);
  const nowMs = performance.now();
  const frameMs = Math.max(1, nowMs - runtime.lastUpdateMs);
  runtime.lastUpdateMs = nowMs;
  if (config.mode === "track-leveler") {
    const nextState = computeTrackLevelerFrame(
      {
        detectorDb: runtime.detectorDb,
        peakDb: runtime.peakDb,
        meanDb: runtime.levelerMeanDb,
        liftDb: runtime.currentLiftDb,
      },
      inputDb,
      frameMs,
      {
        maxLiftDb: config.maxLiftDb,
        upwardRatio: config.ratio,
        gateThresholdDb: config.gateThresholdDb,
        limiterCeilingDb: config.limiterCeilingDb,
        attackMs: config.attackMs,
        releaseMs: config.releaseMs,
      },
    );
    runtime.detectorDb = nextState.detectorDb;
    runtime.peakDb = nextState.peakDb;
    runtime.levelerMeanDb = nextState.meanDb;
    runtime.currentLiftDb = nextState.liftDb;
  } else {
    const nextState = computeDynamicsFrame(
      {
        detectorDb: runtime.detectorDb,
        peakDb: runtime.peakDb,
        liftDb: runtime.currentLiftDb,
      },
      inputDb,
      frameMs,
      {
        liftThresholdDb: config.liftThresholdDb,
        maxLiftDb: config.maxLiftDb,
        upwardRatio: config.ratio,
        gateThresholdDb: config.gateThresholdDb,
        attackMs: config.attackMs,
        releaseMs: config.releaseMs,
      },
    );
    runtime.detectorDb = nextState.detectorDb;
    runtime.peakDb = nextState.peakDb;
    runtime.currentLiftDb = nextState.liftDb;
  }
  runtime.liftGain.gain.setValueAtTime(dbToLinear(runtime.currentLiftDb), context.currentTime);
  runtime.updateRafId = window.requestAnimationFrame(() => updateRuntimeLift(runtime));
};

const ensureAudioDspRuntime = (audio: HTMLAudioElement) => {
  const existing = audioDspRuntimes.get(audio);
  if (existing) {
    return existing;
  }
  const context = getSharedAudioContext();
  const source = context.createMediaElementSource(audio);
  const inputGain = context.createGain();
  const dryGain = context.createGain();
  const liftGain = context.createGain();
  const limiter = context.createDynamicsCompressor();
  const wetGain = context.createGain();
  const mixGain = context.createGain();
  const analyser = context.createAnalyser();
  const outputAnalyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.05;
  outputAnalyser.fftSize = 1024;
  outputAnalyser.smoothingTimeConstant = 0.08;

  source.connect(inputGain);
  inputGain.connect(dryGain);
  inputGain.connect(liftGain);
  inputGain.connect(analyser);
  liftGain.connect(limiter);
  limiter.connect(wetGain);
  dryGain.connect(mixGain);
  wetGain.connect(mixGain);
  mixGain.connect(outputAnalyser);
  mixGain.connect(context.destination);

  const runtime: AudioDspRuntime = {
    source,
    inputGain,
    dryGain,
    liftGain,
    limiter,
    wetGain,
    mixGain,
    analyser,
    outputAnalyser,
    isRunning: true,
    currentLiftDb: 0,
    detectorDb: -120,
    peakDb: -120,
    levelerMeanDb: -120,
    lastUpdateMs: performance.now(),
    updateRafId: null,
  };
  // Main/wet playback now uses offline-rendered compression, so runtime should
  // remain transparent and only provide gain + analyser plumbing.
  configureRuntimePassThrough(runtime);
  audio.volume = Math.min(1, Math.max(0, audio.volume || 1));
  runtime.updateRafId = null;
  runtime.isRunning = false;
  audioDspRuntimes.set(audio, runtime);
  return runtime;
};

const releaseAudioDspRuntime = async (audio: HTMLAudioElement) => {
  const runtime = audioDspRuntimes.get(audio);
  if (!runtime) {
    return;
  }
  runtime.isRunning = false;
  if (runtime.updateRafId !== null) {
    window.cancelAnimationFrame(runtime.updateRafId);
    runtime.updateRafId = null;
  }
  runtime.source.disconnect();
  runtime.inputGain.disconnect();
  runtime.dryGain.disconnect();
  runtime.liftGain.disconnect();
  runtime.limiter.disconnect();
  runtime.wetGain.disconnect();
  runtime.mixGain.disconnect();
  runtime.analyser.disconnect();
  runtime.outputAnalyser.disconnect();
  audioDspRuntimes.delete(audio);
  const level = audioLevels.get(audio);
  audio.volume = Math.min(1, Math.max(0, level ?? audio.volume ?? 1));
};

const setAudioLevel = (audio: HTMLAudioElement, level: number) => {
  const safe = Math.max(0, level);
  audioLevels.set(audio, safe);
  const runtime = audioDspRuntimes.get(audio);
  if (runtime) {
    // When routed through WebAudio runtime, keep media element at unity and
    // apply program level only once via runtime input gain.
    runtime.inputGain.gain.setValueAtTime(safe, runtime.inputGain.context.currentTime);
    audio.volume = 1;
    return;
  }
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
  const runtime = audioDspRuntimes.get(audio);
  if (!runtime) {
    return;
  }
  await ensureSharedAudioContextRunning();
  setAudioLevel(audio, getAudioLevel(audio));
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
  if (trackEditorPathHint) {
    trackEditorPathHint.textContent = "";
    trackEditorPathHint.title = "";
  }
  if (trackEditorCompressedPathHint) {
    trackEditorCompressedPathHint.textContent = "";
    trackEditorCompressedPathHint.title = "";
  }
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
  trackEditorGenreInput.innerHTML = "";
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = t("styleNone");
  trackEditorGenreInput.appendChild(emptyOption);
  styleFamilies.forEach((family) => {
    const group = document.createElement("optgroup");
    group.label = family.base;
    const rootOption = document.createElement("option");
    rootOption.value = family.base;
    rootOption.textContent = family.base;
    group.appendChild(rootOption);
    family.variants.forEach((variant) => {
      const style = composeStyleLabel(family.base, variant);
      if (!style) {
        return;
      }
      const option = document.createElement("option");
      option.value = style;
      option.textContent = style;
      group.appendChild(option);
    });
    trackEditorGenreInput.appendChild(group);
  });
  const knownStyles = new Set(
    Array.from(trackEditorGenreInput.querySelectorAll("option"))
      .map((option) => option.value)
      .filter(Boolean),
  );
  availableStyles.forEach((style) => {
    if (!style || knownStyles.has(style)) {
      return;
    }
    const option = document.createElement("option");
    option.value = style;
    option.textContent = style;
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
  if (trackEditorPathHint || trackEditorCompressedPathHint) {
    const compressionEnabled = getAudioDynamicsConfig().enabled;
    const compressedPath = compressionEnabled
      ? resolveCompressedPathForTrack(track)
      : null;
    const pathLines = resolveTrackEditorPathLines({
      originalPath: track.full_path ?? "",
      compressionEnabled,
      compressedPath,
      compressedLabel: t("trackEditorCompressedPathLabel"),
      pendingLabel: t("audioDynamicsPathPending"),
    });
    if (trackEditorPathHint) {
      trackEditorPathHint.textContent = pathLines.originalLine;
      trackEditorPathHint.title = pathLines.originalLine;
    }
    if (trackEditorCompressedPathHint) {
      trackEditorCompressedPathHint.textContent = pathLines.compressedLine;
      trackEditorCompressedPathHint.title = pathLines.compressedLine;
    }
  }
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
  patchSearchState({
    items: searchState.items.map((item) => (item.id === track.id ? track : item)),
  });
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
  const bpm = computeTapTempoBpm(trackEditorState.taps);
  if (bpm !== null) {
    trackEditorBpmInput.value = `${bpm}`;
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

const getStyleFamiliesInput = () =>
  localStorage.getItem(STYLE_FAMILIES_KEY) ?? DEFAULT_STYLE_FAMILIES;

const getStyleFamilies = () => parseStyleFamilies(getStyleFamiliesInput());

const getPlaylistStyleMapFromFamilies = (): StyleMap => {
  const parsed = getStyleFamilies();
  if (parsed.length === 0) {
    return styleFamilyMapFromFamilies(parseStyleFamilies(DEFAULT_STYLE_FAMILIES));
  }
  return styleFamilyMapFromFamilies(parsed);
};

const getPlaylistStartTimeInput = () =>
  localStorage.getItem("tanda-playlist-start-time") ?? DEFAULT_PLAYLIST_START_TIME;
const getPlaylistEndTimeInput = () =>
  localStorage.getItem(PLAYLIST_END_TIME_KEY) ?? DEFAULT_PLAYLIST_END_TIME;

const getPlaylistSequence = (): SequenceEntry[] =>
  parseSequence(getPlaylistSequenceInput());

const getPlaylistStyleMap = (): StyleMap => getPlaylistStyleMapFromFamilies();

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
const stopCompressedCompanion = async (state: PlaybackState) => {
  const wet = state.compressedActive;
  if (!wet) {
    return;
  }
  wet.pause();
  wet.currentTime = 0;
  await releaseAudioDspRuntime(wet);
  trackedCompressedCompanions.delete(wet);
  state.compressedActive = undefined;
  state.usingCompressedSource = false;
  state.activeSourcePath = undefined;
  state.compressedSourcePath = undefined;
  state.wetCompensationGain = 1;
  state.wetCompensationReferenceRatio = undefined;
};

const stopAllCompressedCompanions = async () => {
  const companions = Array.from(trackedCompressedCompanions);
  for (const wet of companions) {
    wet.pause();
    wet.currentTime = 0;
    await releaseAudioDspRuntime(wet);
    trackedCompressedCompanions.delete(wet);
  }
};

const syncCompressedCompanion = (state: PlaybackState) => {
  const dry = state.active;
  const wet = state.compressedActive;
  if (!dry || !wet) {
    return;
  }
  const drift = (dry.currentTime ?? 0) - (wet.currentTime ?? 0);
  const driftSeconds = Math.abs(drift);
  if (driftSeconds > 0.12) {
    wet.currentTime = dry.currentTime ?? 0;
    wet.playbackRate = 1;
  }
  if (dry.paused) {
    if (!wet.paused) {
      wet.pause();
    }
    wet.playbackRate = 1;
    return;
  }
  if (driftSeconds > 0.01) {
    const correction = clampNumber(drift * 0.6, -0.04, 0.04);
    wet.playbackRate = 1 + correction;
  } else if (Math.abs(wet.playbackRate - 1) > 0.001) {
    wet.playbackRate = 1;
  }
  if (wet.paused) {
    void wet.play().catch(() => undefined);
  }
  // Track relative wet vs dry level and gently compensate so 100% wet does not
  // drop perceived level compared with dry.
  const dryRms = sampleRuntimeRms(dry);
  const wetRms = sampleRuntimeRms(wet);
  if (dryRms > 0.0001 && wetRms > 0.0001) {
    const result = resolveWetCompensation({
      dryRms,
      wetRms,
      wetMix: clampNumber(mainWetMixCurrent, 0, 1),
      previousReferenceRatio: state.wetCompensationReferenceRatio,
      frameMs: 16,
    });
    state.wetCompensationReferenceRatio = result.referenceRatio;
    const desired = result.targetGain;
    const current = state.wetCompensationGain ?? 1;
    state.wetCompensationGain = smoothToward(current, desired, 220, 480, 16);
  } else if (typeof state.wetCompensationGain !== "number") {
    state.wetCompensationGain = 1;
  }
};

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
  const wet = state.compressedActive;
  if (channel === "main" && wet) {
    const mix = computeParallelMixGains({
      enabled: localStorage.getItem(AUDIO_DYNAMICS_ENABLED_KEY) === "1",
      depthPercent: getAudioDynamicsDepthPercent(),
    });
    if (Math.abs(mainWetMixTarget - mix.wet) > 0.001) {
      mainWetMixTarget = mix.wet;
      runMainWetMixSmoother();
    }
    const wetMix = clampNumber(mainWetMixCurrent, 0, 1);
    const dryMix = clampNumber(1 - wetMix, 0, 1);
    const wetCompGain = clampNumber(state.wetCompensationGain ?? 1, 0.7, 4);
    setAudioLevel(state.active, targetVolume * dryMix);
    setAudioLevel(wet, targetVolume * wetMix * wetCompGain);
    syncCompressedCompanion(state);
    return;
  }
  state.wetCompensationGain = 1;
  state.wetCompensationReferenceRatio = undefined;
  mainWetMixCurrent = 0;
  mainWetMixTarget = 0;
  setAudioLevel(state.active, targetVolume);
};
const syncDynamicsRuntimeForChannel = async (channel: OutputChannel) => {
  applyDynamicLevelToChannel(channel);
};

const syncDynamicsRuntimeForActivePlayback = async () => {
  await syncDynamicsRuntimeForChannel("main");
  const main = playback.main;
  if (main.active && main.track && !main.isCortinaPlayback && !main.compressedActive) {
    void ensureMainCompressedCompanion(main, main.track);
  }
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

const getPlaylistTargetWindowMs = () =>
  resolvePlaylistWindowMs({
    startInput: getPlaylistStartTimeInput().trim() || DEFAULT_PLAYLIST_START_TIME,
    endInput: getPlaylistEndTimeInput().trim() || DEFAULT_PLAYLIST_END_TIME,
    defaultStartMinutes: 20 * 60,
    defaultEndMinutes: 3 * 60,
  });

const resolveNowPlayingTrackLabel = (track?: TrackRow) =>
  buildTrackLabelView(track, t("nowPlayingUnknown"));

const resolveNowPlayingState = () =>
  getNowPlayingStateView({
    headphone: playback.headphone,
    main: playback.main,
  });

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

const waveformController = createWaveformController({
  widgets: waveformWidgets,
  api: window.tanda,
  translate: (key) => t(key),
  setStatus: (message) => {
    if (statusEl) {
      statusEl.textContent = message;
    }
  },
});

const updateWaveformSource = async (trackId: string | null) => {
  if (!trackId) {
    waveformTrackId = null;
  } else {
    waveformTrackId = trackId;
  }
  await waveformController.updateSource(trackId);
};

const getDisplayPlaylistItems = () =>
  playlistItems.map((item) => {
    if (!item) {
      return null;
    }
    if (item.kind === "track") {
      return { kind: "track" as const };
    }
    return { kind: "tanda" as const, tandaId: item.tandaId };
  });

const getCurrentProgressText = () =>
  resolveCurrentProgressText({
    playbackStatus: playlistPlayback.status,
    currentIndex: playlistPlayback.currentIndex,
    currentTrackIndex: playlistPlayback.currentTrackIndex,
    playlistItems: getDisplayPlaylistItems(),
    resolveTandaTrackCount: (tandaId) => {
      const tanda = resolveTandaDraft(tandaId);
      if (!tanda) {
        return 0;
      }
      return tanda.trackSlots.filter(Boolean).length;
    },
    translatePlayingTrack: (index, count) => t("displayPlayingTrack", { index, count }),
  });

const getNextTandaStyle = () =>
  resolveNextTandaStyle({
    isMarkedLast: isCurrentTandaMarkedLast(),
    playbackStatus: playlistPlayback.status,
    resumeItemIndex: playlistPlayback.resume?.itemIndex ?? null,
    currentIndex: playlistPlayback.currentIndex,
    playlistItems: getDisplayPlaylistItems(),
    resolveTandaStyle: (tandaId) => resolveTandaDraft(tandaId)?.styles?.[0] ?? null,
    shouldShowDisplayNextTanda: (status) => shouldShowDisplayNextTanda(status),
  });

const isFinalCortinaForMarkedLast = (isMarkedLast: boolean, nextStyle: string) =>
  isMarkedLast && cortinaDisplayPhase !== "none" && !nextStyle;

const getNextTandaLabel = () =>
  (() => {
    const nextStyle = getNextTandaStyle();
    const isMarkedLast = isCurrentTandaMarkedLast();
    return resolveNextTandaLabel({
      isMarkedLast: isFinalCortinaForMarkedLast(isMarkedLast, nextStyle),
      nextStyle,
      translateLast: () => t("displayThisIsLastTanda"),
      translateNext: (style) => t("displayNextTanda", { style }),
    });
  })();

const updateExternalDisplay = () => {
  if (!window.tanda?.updateDisplay) {
    return;
  }
  const nextStyle = getNextTandaStyle();
  const isMarkedLast = isCurrentTandaMarkedLast();
  const showFinalCortinaMessage = isFinalCortinaForMarkedLast(isMarkedLast, nextStyle);
  const cortinaHeadline = showFinalCortinaMessage
    ? t("displayNoMoreTandas")
    : t("cortinaRowLabel");
  const cortinaSubline = showFinalCortinaMessage
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
  const active = resolveNowPlayingState();
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
  const active = resolveNowPlayingState();
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
    renderNowPlayingDynamicsControl();
    updateExternalDisplay();
    return;
  }

  const { channel, state } = active;
  const track = state.track;
  const { startOffsetMs, endTrimMs } = getAdjustedTrimValues(track ?? null);
  const baseDurationMs = track?.duration_ms ?? 0;
  const audioDurationSeconds = Number.isFinite(state.active?.duration ?? NaN)
    ? state.active?.duration ?? 0
    : 0;
  const baseDurationSeconds = resolveBaseDurationSeconds({
    audioDurationSeconds,
    baseDurationMs,
  });
  const effectiveDurationSeconds = resolveEffectiveDurationSeconds({
    baseDurationSeconds,
    startOffsetMs,
    endTrimMs,
  });
  const cortinaDisplayDurationSeconds = resolveDisplayDurationSeconds({
    effectiveDurationSeconds,
    cortinaPlaying,
    cortinaAllowFull,
    hasTrack: Boolean(track),
    channel,
    cortinaDurationSeconds: getCortinaDuration(),
  });
  const clampedCurrent = resolveClampedCurrentSeconds({
    currentTimeSeconds: state.active?.currentTime ?? 0,
    startOffsetMs,
    displayDurationSeconds: cortinaDisplayDurationSeconds,
  });

  nowPlayingTrack.textContent = resolveNowPlayingTrackLabel(track);
  nowPlayingSource.textContent =
    channel === "headphone"
      ? t("nowPlayingHeadphone")
      : t("nowPlayingMain");
  nowPlayingTime.textContent = t("nowPlayingTime", {
    current: formatTime(clampedCurrent),
    duration: formatTime(cortinaDisplayDurationSeconds),
  });
  const progress = resolveProgressRatio({
    currentTimeSeconds: Math.max(0, state.active?.currentTime ?? 0),
    durationSeconds: baseDurationSeconds,
  });
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
  renderNowPlayingDynamicsControl();
  updateExternalDisplay();
};

const seekToWaveformPosition = (
  event: MouseEvent,
  container: HTMLDivElement | null = waveformContainer,
) => {
  const active = resolveNowPlayingState();
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
  const targetSeconds = resolveWaveformSeekTargetSeconds({
    ratio,
    baseDurationMs,
    activeAudioDurationSeconds: Number.isFinite(active.state.active.duration ?? NaN)
      ? active.state.active.duration ?? 0
      : 0,
  });
  if (targetSeconds === null) {
    return;
  }
  active.state.active.currentTime = targetSeconds;
  if (active.state.compressedActive) {
    active.state.compressedActive.currentTime = active.state.active.currentTime;
  }
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
      selectedStyles = toBaseStyleFilters(tanda.styles);
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
  const active = resolveNowPlayingState();
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
  fromPlaylist?: boolean;
};

const resolveNextLiveTrackForCompression = () => {
  if (playlistPlayback.status !== "playing") {
    return null;
  }
  for (let playlistIndex = playlistPlayback.currentIndex; playlistIndex < playlistItems.length; playlistIndex += 1) {
    const item = playlistItems[playlistIndex];
    if (!item) {
      continue;
    }
    if (item.kind === "track") {
      if (playlistIndex === playlistPlayback.currentIndex) {
        continue;
      }
      return item.track;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      continue;
    }
    const startSlot =
      playlistIndex === playlistPlayback.currentIndex &&
      playlistPlayback.activeTandaId === item.tandaId
        ? playlistPlayback.currentTrackIndex + 1
        : 0;
    for (let slot = startSlot; slot < tanda.trackSlots.length; slot += 1) {
      const trackId = tanda.trackSlots[slot];
      if (!trackId) {
        continue;
      }
      const track = trackCache.get(trackId);
      if (track) {
        return track;
      }
    }
  }
  return null;
};

const resolveFirstPlaylistTrackForCompression = () => {
  for (const item of playlistItems) {
    if (!item) {
      continue;
    }
    if (item.kind === "track") {
      return item.track;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      continue;
    }
    for (const trackId of tanda.trackSlots) {
      if (!trackId) {
        continue;
      }
      const track = trackCache.get(trackId);
      if (track) {
        return track;
      }
    }
  }
  return null;
};

const resolvePlaylistCompressionCandidates = () => {
  const candidates: TrackRow[] = [];
  const seen = new Set<string>();
  const pushUnique = (track: TrackRow | null) => {
    if (!track || seen.has(track.id)) {
      return;
    }
    seen.add(track.id);
    candidates.push(track);
  };
  pushUnique(resolveFirstPlaylistTrackForCompression());
  pushUnique(resolveNextLiveTrackForCompression());
  return candidates;
};

const prefetchNextPlaylistCompression = async () => {
  const config = getAudioDynamicsConfig();
  if (!config.enabled) {
    return;
  }
  if (compressionPrefetchInFlight) {
    return;
  }
  compressionPrefetchInFlight = true;
  try {
    const tracks = resolvePlaylistCompressionCandidates();
    for (const track of tracks) {
      await requestCompressedSource(track, config);
    }
    if (window.tanda) {
      if (cortinaSets.length === 0) {
        await loadCortinaSets();
      }
      for (const setName of cortinaSets) {
        const setTracks = await loadCortinaTracks(setName);
        for (const track of setTracks) {
          if (prefetchedCortinaTrackIds.has(track.id)) {
            continue;
          }
          prefetchedCortinaTrackIds.add(track.id);
          await requestCompressedSource(track, config);
        }
      }
    }
  } finally {
    compressionPrefetchInFlight = false;
  }
};

const scheduleCompressionPrefetch = () => {
  if (compressionPrefetchTimer !== null) {
    window.clearTimeout(compressionPrefetchTimer);
  }
  compressionPrefetchTimer = window.setTimeout(() => {
    compressionPrefetchTimer = null;
    void prefetchNextPlaylistCompression();
  }, 120);
};

const playbackCompressionController = createPlaybackCompressionController({
  getAudioDynamicsConfig,
  requestCompressedSource,
  setStatus: (message) => {
    if (statusEl) {
      statusEl.textContent = message;
    }
  },
  translate: t,
  isCompressionRequestedForChannel: (channel, options) =>
    isCompressionRequestedForChannel(channel, options as PlayOptions | undefined),
  stopCompressedCompanion,
  ensureAudioDspRuntime,
  releaseAudioDspRuntime,
  applyOutputDevice,
  applyDynamicLevelToMain: () => applyDynamicLevelToChannel("main"),
  updateNowPlayingDisplay,
  resolveOutputDeviceIdForMain: () => resolveOutputDeviceIdForChannel("main"),
  appMode: () => appMode,
  playlistState: () => ({
    status: playlistPlayback.status,
    index: playlistPlayback.currentIndex,
    trackIndex: playlistPlayback.currentTrackIndex,
  }),
  logPlaybackDiagnostic: (payload) => {
    void window.tanda?.logPlaybackDiagnostic?.(payload as Parameters<
      NonNullable<typeof window.tanda>["logPlaybackDiagnostic"]
    >[0]);
  },
});

const resolvePlaybackSource = async (
  channel: OutputChannel,
  track: TrackRow | null,
  originalPath: string,
  options?: PlayOptions,
) =>
  playbackCompressionController.resolvePlaybackSource(
    channel,
    track,
    originalPath,
    options,
  );

const ensureMainCompressedCompanion = async (
  state: PlaybackState,
  track: TrackRow | null,
) => playbackCompressionController.ensureMainCompressedCompanion(state, track);

const playOnChannel = async (
  channel: OutputChannel,
  filePath: string,
  trackId: string,
  track: TrackRow | null,
  gainDb: number | null | undefined,
  options?: PlayOptions,
): Promise<boolean> => {
  const requestVersion = ++playRequestVersion[channel];
  const isStaleRequest = () => playRequestVersion[channel] !== requestVersion;
  const discardAudio = async (audio: HTMLAudioElement | undefined) => {
    if (!audio) {
      return;
    }
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Ignore cleanup errors for stale requests.
    }
    await releaseAudioDspRuntime(audio);
  };
  const state = playback[channel];
  if (isStaleRequest()) {
    return false;
  }
  const allowToggle = options?.allowToggle !== false;
  if (state.currentTrackId === trackId && state.active) {
    if (!allowToggle) {
      if (Number.isFinite(options?.startAtSeconds)) {
        state.active.currentTime = Math.max(0, options?.startAtSeconds ?? 0);
        if (state.compressedActive) {
          state.compressedActive.currentTime = state.active.currentTime;
        }
      }
      if (state.active.paused) {
        try {
          await state.active.play();
          if (state.compressedActive) {
            await state.compressedActive.play().catch(() => undefined);
          }
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
    await stopCompressedCompanion(state);
    state.currentTrackId = undefined;
    state.active = undefined;
    state.track = undefined;
    state.appliedGainDb = null;
    state.isCortinaPlayback = false;
    state.usingCompressedSource = false;
    state.activeSourcePath = undefined;
    state.originalSourcePath = undefined;
    state.compressedSourcePath = undefined;
    lastAppliedGainDbByChannel[channel] = null;
    updateNowPlayingDisplay();
    return false;
  }

  if (
    channel === "main" &&
    options?.fromPlaylist !== true &&
    track &&
    isCompressionRequestedForChannel(channel, options)
  ) {
    await requestCompressedSource(track, getAudioDynamicsConfig());
    if (isStaleRequest()) {
      return false;
    }
  }
  const source =
    channel === "main"
      ? { filePath, compressed: false }
      : await resolvePlaybackSource(channel, track, filePath, options);
  if (isStaleRequest()) {
    return false;
  }
  const next = new Audio();
  next.loop = false;
  if (channel === "main") {
    ensureAudioDspRuntime(next);
  }
  const normalization = resolvePlaybackNormalization(gainDb, track?.loudness_db);
  let appliedGainDb = normalization.gainDb;
  let stepCorrectionDb = 0;
  if (normalization.source === "gain" && normalization.loudnessDb === null) {
    const maxStepDb =
      appMode === "live" ? MAX_GAIN_ONLY_STEP_DB : MAX_GAIN_ONLY_STEP_DB_NON_LIVE;
    const stepGuard = applyGainStepGuard(
      normalization.gainDb,
      lastAppliedGainDbByChannel[channel],
      maxStepDb,
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
  if (isStaleRequest()) {
    await discardAudio(next);
    return false;
  }
  next.src = source.filePath;
  const postAttachRouting = await applyOutputDevice(next, requestedOutputDeviceId);
  if (isStaleRequest()) {
    await discardAudio(next);
    return false;
  }
  const outputRouting =
    postAttachRouting.appliedDeviceId || !preAttachRouting.appliedDeviceId
      ? postAttachRouting
      : preAttachRouting;
  if (requestedOutputDeviceId && !outputRouting.appliedDeviceId) {
    await discardAudio(next);
    await stopCompressedCompanion(state);
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

  const previous = state.active;
  const previousCompressed = state.compressedActive;
  const previousStateSnapshot = {
    active: state.active,
    compressedActive: state.compressedActive,
    currentTrackId: state.currentTrackId,
    track: state.track,
    appliedGainDb: state.appliedGainDb,
    isCortinaPlayback: state.isCortinaPlayback,
    usingCompressedSource: state.usingCompressedSource,
    activeSourcePath: state.activeSourcePath,
    originalSourcePath: state.originalSourcePath,
    compressedSourcePath: state.compressedSourcePath,
    wetCompensationGain: state.wetCompensationGain,
    wetCompensationReferenceRatio: state.wetCompensationReferenceRatio,
  };
  state.active = next;
  state.compressedActive = undefined;
  state.currentTrackId = trackId;
  state.track = track ?? undefined;
  state.appliedGainDb = appliedGainDb;
  state.isCortinaPlayback = options?.isCortinaPlayback ?? false;
  state.usingCompressedSource = source.compressed;
  state.activeSourcePath = source.filePath;
  state.originalSourcePath = track?.full_path ?? filePath;
  state.compressedSourcePath = source.compressed ? source.filePath : undefined;
  void updateWaveformSource(trackId);
  if (isStaleRequest()) {
    await discardAudio(next);
    if (state.active === next) {
      state.active = previousStateSnapshot.active;
      state.compressedActive = previousStateSnapshot.compressedActive;
      state.currentTrackId = previousStateSnapshot.currentTrackId;
      state.track = previousStateSnapshot.track;
      state.appliedGainDb = previousStateSnapshot.appliedGainDb;
      state.isCortinaPlayback = previousStateSnapshot.isCortinaPlayback;
      state.usingCompressedSource = previousStateSnapshot.usingCompressedSource;
      state.activeSourcePath = previousStateSnapshot.activeSourcePath;
      state.originalSourcePath = previousStateSnapshot.originalSourcePath;
      state.compressedSourcePath = previousStateSnapshot.compressedSourcePath;
      state.wetCompensationGain = previousStateSnapshot.wetCompensationGain;
      state.wetCompensationReferenceRatio =
        previousStateSnapshot.wetCompensationReferenceRatio;
      updateNowPlayingDisplay();
    }
    return false;
  }
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
      void stopCompressedCompanion(state);
      state.active = undefined;
      state.currentTrackId = undefined;
      state.track = undefined;
      state.appliedGainDb = null;
      state.isCortinaPlayback = false;
      state.usingCompressedSource = false;
      state.activeSourcePath = undefined;
      state.originalSourcePath = undefined;
      state.compressedSourcePath = undefined;
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
    if (state.compressedActive && !state.compressedActive.paused) {
      state.compressedActive.pause();
    }
    updateNowPlayingDisplay();
  });
  next.addEventListener("timeupdate", () => {
    syncCompressedCompanion(state);
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
    if (isStaleRequest()) {
      await discardAudio(next);
      if (state.active === next) {
        state.active = previousStateSnapshot.active;
        state.compressedActive = previousStateSnapshot.compressedActive;
        state.currentTrackId = previousStateSnapshot.currentTrackId;
        state.track = previousStateSnapshot.track;
        state.appliedGainDb = previousStateSnapshot.appliedGainDb;
        state.isCortinaPlayback = previousStateSnapshot.isCortinaPlayback;
        state.usingCompressedSource = previousStateSnapshot.usingCompressedSource;
        state.activeSourcePath = previousStateSnapshot.activeSourcePath;
        state.originalSourcePath = previousStateSnapshot.originalSourcePath;
        state.compressedSourcePath = previousStateSnapshot.compressedSourcePath;
        state.wetCompensationGain = previousStateSnapshot.wetCompensationGain;
        state.wetCompensationReferenceRatio =
          previousStateSnapshot.wetCompensationReferenceRatio;
        updateNowPlayingDisplay();
      }
      return false;
    }
    fadeBetween(previous, next, targetVolume);
    if (previousCompressed) {
      void fadeOutAudio(previousCompressed, 600).then(() => {
        previousCompressed.pause();
        previousCompressed.currentTime = 0;
        void releaseAudioDspRuntime(previousCompressed);
      });
    }
    lastAppliedGainDbByChannel[channel] = appliedGainDb;
    if (channel === "main") {
      if (options?.fromPlaylist) {
        void prefetchNextPlaylistCompression();
      }
      void ensureMainCompressedCompanion(state, track);
    }
    updateNowPlayingDisplay();
    return true;
  } catch (error) {
    // If new playback cannot start, restore prior channel state so we do not
    // orphan already-playing audio and lose control of stop/pause operations.
    await releaseAudioDspRuntime(next);
    if (state.active === next) {
      state.active = previousStateSnapshot.active;
      state.compressedActive = previousStateSnapshot.compressedActive;
      state.currentTrackId = previousStateSnapshot.currentTrackId;
      state.track = previousStateSnapshot.track;
      state.appliedGainDb = previousStateSnapshot.appliedGainDb;
      state.isCortinaPlayback = previousStateSnapshot.isCortinaPlayback;
      state.usingCompressedSource = previousStateSnapshot.usingCompressedSource;
      state.activeSourcePath = previousStateSnapshot.activeSourcePath;
      state.originalSourcePath = previousStateSnapshot.originalSourcePath;
      state.compressedSourcePath = previousStateSnapshot.compressedSourcePath;
      state.wetCompensationGain = previousStateSnapshot.wetCompensationGain;
      state.wetCompensationReferenceRatio =
        previousStateSnapshot.wetCompensationReferenceRatio;
      updateNowPlayingDisplay();
    }
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
    await stopCompressedCompanion(state);
    return;
  }
  if (fadeMs > 0) {
    await fadeOutAudio(active, fadeMs);
    if (state.compressedActive) {
      await fadeOutAudio(state.compressedActive, fadeMs);
    }
  }
  active.pause();
  active.currentTime = 0;
  await releaseAudioDspRuntime(active);
  await stopCompressedCompanion(state);
  state.active = undefined;
  state.currentTrackId = undefined;
  state.track = undefined;
  state.appliedGainDb = null;
  state.isCortinaPlayback = false;
  state.usingCompressedSource = false;
  state.activeSourcePath = undefined;
  state.originalSourcePath = undefined;
  state.compressedSourcePath = undefined;
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

const renderStyleDistributionChart = (
  root: HTMLDivElement | null,
  rows: Array<{ label: string; value: number; styleValues: Record<string, number> }>,
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
  const maxValue = Math.max(...data.map((row) => row.value), 1);
  if (options?.className === "compact") {
    root.style.setProperty("--mini-chart-columns", `${Math.max(1, data.length)}`);
  }
  data.forEach((row) => {
    const item = document.createElement("div");
    item.className = "mini-chart-item";
    const upper = document.createElement("div");
    upper.className = "mini-chart-upper";
    upper.classList.add("single-bar");
    const barWrap = document.createElement("div");
    barWrap.className = "mini-chart-stack-wrap";
    const stack = document.createElement("div");
    stack.className = "mini-chart-stack";
    if (row.value <= 0) {
      barWrap.style.height = "0";
      stack.classList.add("is-zero");
    } else {
      barWrap.style.height = `${computeScaledPercent(row.value, maxValue, {
        minPercent: 4,
      })}%`;
      const styleRows = Object.entries(row.styleValues)
        .filter(([, value]) => value > 0)
        .sort((left, right) => right[1] - left[1]);
      styleRows.forEach(([style, value]) => {
        const segment = document.createElement("div");
        segment.className = "mini-chart-segment";
        segment.style.flex = `${value} 1 0`;
        segment.style.backgroundColor = colorForStyleKey(style);
        segment.style.backgroundImage = patternForStyleKey(style);
        stack.appendChild(segment);
      });
    }
    barWrap.appendChild(stack);
    upper.appendChild(barWrap);
    const label = document.createElement("div");
    label.className = "mini-chart-label";
    label.textContent = row.label;
    const details = Object.entries(row.styleValues)
      .filter(([, value]) => value > 0)
      .sort((left, right) => right[1] - left[1])
      .map(([style, value]) => `${toDisplayStyleLabel(style)}: ${Math.round(value)}`)
      .join(", ");
    item.title = details ? `${row.label}: ${Math.round(row.value)} (${details})` : `${row.label}: ${Math.round(row.value)}`;
    item.append(upper, label);
    root.appendChild(item);
  });
};

const renderSearchDiversityOrchestraTable = (
  root: HTMLDivElement | null,
  rows: Array<{
    artist: string;
    tandaTotal: number;
    tandaStyles: Record<string, number>;
    availableTracks: number;
    availableStyles: Record<string, number>;
    availableYearCount: number;
    availableTempoCount: number;
  }>,
  onSearchArtist: (artist: string) => void,
) => {
  if (!root) {
    return;
  }
  root.innerHTML = "";
  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mini-chart-empty";
    empty.textContent = t("playlistStatsNoData");
    root.appendChild(empty);
    return;
  }
  const table = document.createElement("table");
  table.className = "diversity-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const artistTh = document.createElement("th");
  artistTh.textContent = t("searchDiversityColOrchestra");
  const tandaTh = document.createElement("th");
  tandaTh.textContent = t("searchDiversityColTandas");
  const availableTh = document.createElement("th");
  availableTh.textContent = t("searchDiversityColAvailableTracks");
  const stylesTh = document.createElement("th");
  stylesTh.textContent = t("searchDiversityColStyles");
  const opportunityTh = document.createElement("th");
  opportunityTh.textContent = t("searchDiversityColOpportunity");
  const actionTh = document.createElement("th");
  actionTh.textContent = t("colActions");
  headRow.append(artistTh, tandaTh, availableTh, stylesTh, opportunityTh, actionTh);
  head.appendChild(headRow);
  const body = document.createElement("tbody");
  rows.slice(0, 120).forEach((row) => {
    const tr = document.createElement("tr");
    const artistTd = document.createElement("td");
    artistTd.textContent = row.artist;
    const totalTd = document.createElement("td");
    totalTd.textContent = `${row.tandaTotal}`;
    const availableTd = document.createElement("td");
    availableTd.textContent = `${row.availableTracks}`;
    const stylesTd = document.createElement("td");
    stylesTd.textContent = Object.entries(row.tandaStyles)
      .sort((left, right) => right[1] - left[1])
      .map(([style, count]) => `${style}: ${count}`)
      .join(", ");
    const opportunityTd = document.createElement("td");
    const missingStyles = Object.entries(row.availableStyles)
      .filter(([style]) => (row.tandaStyles[style] ?? 0) === 0)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 2)
      .map(([style]) => toDisplayStyleLabel(style));
    if (row.tandaTotal === 0 && row.availableTracks > 0) {
      opportunityTd.textContent = t("searchDiversityOpportunityNoTandas");
    } else if (missingStyles.length > 0) {
      opportunityTd.textContent = t("searchDiversityOpportunityStyles", {
        styles: missingStyles.join(", "),
      });
    } else if (row.availableYearCount > 4 || row.availableTempoCount > 6) {
      opportunityTd.textContent = t("searchDiversityOpportunityVariety");
    } else {
      opportunityTd.textContent = t("searchDiversityOpportunityLow");
    }
    const actionTd = document.createElement("td");
    const searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.className = "action-button";
    searchBtn.textContent = t("actionSearchShort");
    searchBtn.title = t("searchDiversityActionSearchArtist");
    searchBtn.setAttribute("aria-label", t("searchDiversityActionSearchArtist"));
    searchBtn.addEventListener("click", () => {
      onSearchArtist(row.artist);
    });
    actionTd.appendChild(searchBtn);
    tr.append(artistTd, totalTd, availableTd, stylesTd, opportunityTd, actionTd);
    body.appendChild(tr);
  });
  table.append(head, body);
  const wrap = document.createElement("div");
  wrap.className = "diversity-table-wrap";
  wrap.appendChild(table);
  root.appendChild(wrap);
};

const renderSearchDiversityOpportunityTable = (
  root: HTMLDivElement | null,
  rows: Array<{
    artist: string;
    tandaTotal: number;
    availableTracks: number;
    missingStyles: string[];
  }>,
  onSearchArtist: (artist: string) => void,
) => {
  if (!root) {
    return;
  }
  root.innerHTML = "";
  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mini-chart-empty";
    empty.textContent = t("searchDiversityNoOpportunities");
    root.appendChild(empty);
    return;
  }
  const table = document.createElement("table");
  table.className = "diversity-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const orchestraTh = document.createElement("th");
  orchestraTh.textContent = t("searchDiversityColOrchestra");
  const tracksTh = document.createElement("th");
  tracksTh.textContent = t("searchDiversityColAvailableTracks");
  const tandasTh = document.createElement("th");
  tandasTh.textContent = t("searchDiversityColTandas");
  const suggestionTh = document.createElement("th");
  suggestionTh.textContent = t("searchDiversityColSuggestion");
  const actionTh = document.createElement("th");
  actionTh.textContent = t("colActions");
  headRow.append(orchestraTh, tracksTh, tandasTh, suggestionTh, actionTh);
  head.appendChild(headRow);
  const body = document.createElement("tbody");
  rows.slice(0, 40).forEach((row) => {
    const tr = document.createElement("tr");
    const orchestraTd = document.createElement("td");
    orchestraTd.textContent = row.artist;
    const tracksTd = document.createElement("td");
    tracksTd.textContent = `${row.availableTracks}`;
    const tandasTd = document.createElement("td");
    tandasTd.textContent = `${row.tandaTotal}`;
    const suggestionTd = document.createElement("td");
    if (row.tandaTotal === 0) {
      suggestionTd.textContent = t("searchDiversitySuggestionCreateFirst");
    } else if (row.missingStyles.length > 0) {
      suggestionTd.textContent = t("searchDiversitySuggestionStyle", {
        styles: row.missingStyles.slice(0, 2).join(", "),
      });
    } else {
      suggestionTd.textContent = t("searchDiversitySuggestionExpand");
    }
    const actionTd = document.createElement("td");
    const searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.className = "action-button";
    searchBtn.textContent = t("actionSearchShort");
    searchBtn.title = t("searchDiversityActionSearchArtist");
    searchBtn.setAttribute("aria-label", t("searchDiversityActionSearchArtist"));
    searchBtn.addEventListener("click", () => {
      onSearchArtist(row.artist);
    });
    actionTd.appendChild(searchBtn);
    tr.append(orchestraTd, tracksTd, tandasTd, suggestionTd, actionTd);
    body.appendChild(tr);
  });
  table.append(head, body);
  const wrap = document.createElement("div");
  wrap.className = "diversity-table-wrap";
  wrap.appendChild(table);
  root.appendChild(wrap);
};

const renderSearchDiversityStyleGapList = (
  root: HTMLDivElement | null,
  rows: Array<{ style: string; tandaCount: number; availableCount: number }>,
) => {
  if (!root) {
    return;
  }
  root.innerHTML = "";
  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mini-chart-empty";
    empty.textContent = t("searchDiversityNoStyleGaps");
    root.appendChild(empty);
    return;
  }
  const table = document.createElement("table");
  table.className = "diversity-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const styleTh = document.createElement("th");
  styleTh.textContent = t("styleLabel");
  const availableTh = document.createElement("th");
  availableTh.textContent = t("searchDiversityColAvailableTracks");
  const tandasTh = document.createElement("th");
  tandasTh.textContent = t("searchDiversityColTandas");
  headRow.append(styleTh, availableTh, tandasTh);
  head.appendChild(headRow);
  const body = document.createElement("tbody");
  rows.slice(0, 20).forEach((row) => {
    const tr = document.createElement("tr");
    const styleTd = document.createElement("td");
    styleTd.textContent = toDisplayStyleLabel(row.style);
    const availableTd = document.createElement("td");
    availableTd.textContent = `${row.availableCount}`;
    const tandasTd = document.createElement("td");
    tandasTd.textContent = `${row.tandaCount}`;
    tr.append(styleTd, availableTd, tandasTd);
    body.appendChild(tr);
  });
  table.append(head, body);
  const wrap = document.createElement("div");
  wrap.className = "diversity-table-wrap";
  wrap.appendChild(table);
  root.appendChild(wrap);
};

const setSearchDiversityModalVisible = (visible: boolean) => {
  if (!searchDiversityModal) {
    return;
  }
  searchDiversityModal.classList.toggle("open", visible);
  searchDiversityModal.setAttribute("aria-hidden", visible ? "false" : "true");
};

const renderSearchDiversityStats = async () => {
  const stats = await window.tanda?.getSearchDiversityStats?.();
  if (!stats) {
    return;
  }
  const tandaByOrchestra = new Map<
    string,
    { tandaTotal: number; tandaStyles: Record<string, number> }
  >();
  stats.orchestraRows.forEach((row) => {
    const canonical =
      resolveCanonicalArtistName(row.artist || "") || row.artist || t("nowPlayingUnknown");
    const existing = tandaByOrchestra.get(canonical) ?? { tandaTotal: 0, tandaStyles: {} };
    Object.entries(row.styles).forEach(([style, count]) => {
      existing.tandaStyles[style] = (existing.tandaStyles[style] ?? 0) + count;
      existing.tandaTotal += count;
    });
    tandaByOrchestra.set(canonical, existing);
  });
  const availableByOrchestra = new Map<
    string,
    { trackCount: number; styles: Record<string, number>; yearCount: number; tempoCount: number }
  >();
  stats.availableOrchestraRows.forEach((row) => {
    const canonical =
      resolveCanonicalArtistName(row.artist || "") || row.artist || t("nowPlayingUnknown");
    availableByOrchestra.set(canonical, {
      trackCount: row.trackCount,
      styles: row.styles,
      yearCount: row.yearCount,
      tempoCount: row.tempoCount,
    });
  });
  orchestraRegistry.forEach((entry) => {
    const canonical = entry.canonical.trim();
    if (!canonical) {
      return;
    }
    if (!tandaByOrchestra.has(canonical)) {
      tandaByOrchestra.set(canonical, { tandaTotal: 0, tandaStyles: {} });
    }
    if (!availableByOrchestra.has(canonical)) {
      availableByOrchestra.set(canonical, {
        trackCount: 0,
        styles: {},
        yearCount: 0,
        tempoCount: 0,
      });
    }
  });
  const orchestraRows = Array.from(
    new Set([...tandaByOrchestra.keys(), ...availableByOrchestra.keys()]),
  )
    .map((artist) => {
      const tanda = tandaByOrchestra.get(artist) ?? { tandaTotal: 0, tandaStyles: {} };
      const available = availableByOrchestra.get(artist) ?? {
        trackCount: 0,
        styles: {},
        yearCount: 0,
        tempoCount: 0,
      };
      return {
        artist,
        tandaTotal: tanda.tandaTotal,
        tandaStyles: tanda.tandaStyles,
        availableTracks: available.trackCount,
        availableStyles: available.styles,
        availableYearCount: available.yearCount,
        availableTempoCount: available.tempoCount,
      };
    })
    .sort((left, right) => {
      if (right.tandaTotal !== left.tandaTotal) {
        return right.tandaTotal - left.tandaTotal;
      }
      return left.artist.localeCompare(right.artist);
    });
  const populatedOrchestraRows = orchestraRows.filter(
    (row) => row.tandaTotal > 0 || row.availableTracks > 0,
  );
  renderSearchDiversityOrchestraTable(
    searchDiversityOrchestraEl,
    populatedOrchestraRows,
    (artist) => {
      const escapedArtist = artist.replace(/"/g, '\\"');
      runSearchQuery(`artist: "${escapedArtist}"`, true);
      setSearchDiversityModalVisible(false);
      void setSettingsOpen(false);
    },
  );

  const opportunityRows = orchestraRows
    .filter((row) => row.availableTracks > 0)
    .map((row) => ({
      artist: row.artist,
      tandaTotal: row.tandaTotal,
      availableTracks: row.availableTracks,
      missingStyles: Object.entries(row.availableStyles)
        .filter(([style]) => (row.tandaStyles[style] ?? 0) === 0)
        .sort((left, right) => right[1] - left[1])
        .map(([style]) => toDisplayStyleLabel(style)),
      score:
        (row.tandaTotal === 0 ? 1_000 : 0) +
        row.availableTracks * 10 +
        Object.keys(row.availableStyles).length * 5 -
        row.tandaTotal * 4,
    }))
    .sort((left, right) => right.score - left.score);
  renderSearchDiversityOpportunityTable(searchDiversityOpportunitiesEl, opportunityRows, (artist) => {
    const escapedArtist = artist.replace(/"/g, '\\"');
    runSearchQuery(`artist: "${escapedArtist}"`, true);
    setSearchDiversityModalVisible(false);
    void setSettingsOpen(false);
  });

  const yearBuckets = new Map<number, number>(stats.yearBuckets);
  const yearStyleBuckets = new Map<number, Record<string, number>>(
    (stats.yearStyleBuckets ?? []).map(([year, stylePairs]) => [
      year,
      Object.fromEntries(stylePairs),
    ]),
  );
  const tempoBuckets = new Map<number, number>(stats.tempoBuckets);
  const tempoStyleBuckets = new Map<number, Record<string, number>>(
    (stats.tempoStyleBuckets ?? []).map(([tempo, stylePairs]) => [
      tempo,
      Object.fromEntries(stylePairs),
    ]),
  );
  const styleCounts = new Map<string, number>(stats.styleBuckets);
  const availableStyleCounts = new Map<string, number>(stats.availableStyleBuckets);
  const availableYearBuckets = new Map<number, number>(stats.availableYearBuckets);
  const availableTempoBuckets = new Map<number, number>(stats.availableTempoBuckets);
  const yearRows = buildAdaptiveNumericDistribution(yearBuckets, 40, 30);
  const yearStyleRows = buildAdaptiveStyleNumericDistribution(yearStyleBuckets, 40, 30);
  const tempoRows = buildAdaptiveNumericDistribution(tempoBuckets, 40, 30);
  const tempoStyleRows = buildAdaptiveStyleNumericDistribution(tempoStyleBuckets, 40, 30);
  const styleRows = Array.from(styleCounts.entries())
    .map(([label, value]) => ({ label: toDisplayStyleLabel(label), value }))
    .sort((left, right) => right.value - left.value);
  renderStyleDistributionChart(
    searchDiversityYearEl,
    yearStyleRows.length > 0
      ? yearStyleRows
      : yearRows.map((row) => ({ label: row.label, value: row.value, styleValues: {} })),
    {
      includeZero: true,
      className: "compact",
    },
  );
  renderStyleDistributionChart(
    searchDiversityTempoEl,
    tempoStyleRows.length > 0
      ? tempoStyleRows
      : tempoRows.map((row) => ({ label: row.label, value: row.value, styleValues: {} })),
    {
      includeZero: true,
      className: "compact",
    },
  );
  renderMiniChart(searchDiversityStyleEl, styleRows, {
    includeZero: true,
  });
  const styleGapRows = Array.from(availableStyleCounts.entries())
    .map(([style, availableCount]) => ({
      style,
      availableCount,
      tandaCount: styleCounts.get(style) ?? 0,
      gap: availableCount - (styleCounts.get(style) ?? 0),
    }))
    .filter((row) => row.availableCount > 0 && (row.tandaCount === 0 || row.gap >= 5))
    .sort((left, right) => right.gap - left.gap);
  renderSearchDiversityStyleGapList(searchDiversityStyleGapsEl, styleGapRows);

  if (searchDiversitySummaryEl) {
    const missingOrchestras = orchestraRows.filter(
      (row) => row.tandaTotal === 0 && row.availableTracks > 0,
    ).length;
    const missingStyles = styleGapRows.filter((row) => row.tandaCount === 0).length;
    searchDiversitySummaryEl.textContent = t("searchDiversitySummaryText", {
      missingOrchestras,
      missingStyles,
      yearRange: `${availableYearBuckets.size}/${yearBuckets.size}`,
      tempoRange: `${availableTempoBuckets.size}/${tempoBuckets.size}`,
    });
  }
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
  return t("duplicateReasonTrack", { track: resolveNowPlayingTrackLabel(track) });
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
    new Set(duplicateTracks.map((track) => resolveNowPlayingTrackLabel(track))),
  ).slice(0, 4);
  const hasMore = duplicateTracks.length > labels.length;
  const list = hasMore ? `${labels.join("; ")}; ...` : labels.join("; ");
  return t("duplicateReasonTracks", { tracks: list });
};

const markUserInteraction = () => {
  lastUserInteractionAt = Date.now();
  void ensureSharedAudioContextRunning();
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

const closeStyleVariantMenu = () => {
  if (!styleVariantMenuEl) {
    return;
  }
  styleVariantMenuEl.remove();
  styleVariantMenuEl = null;
};

const closeCollectionTargetMenu = () => {
  if (!collectionTargetMenuEl) {
    return;
  }
  collectionTargetMenuEl.remove();
  collectionTargetMenuEl = null;
};

const openStyleVariantMenu = (
  x: number,
  y: number,
  baseStyle: string,
  family: StyleFamily,
) => {
  closeStyleVariantMenu();
  const menu = document.createElement("div");
  menu.className = "style-variant-menu";
  menu.setAttribute("role", "menu");
  family.variants.forEach((variant) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "style-variant-menu-item";
    item.setAttribute("role", "menuitem");
    item.textContent = variant;
    item.addEventListener("click", () => {
      const styleValue = composeStyleLabel(baseStyle, variant);
      if (!styleValue) {
        return;
      }
      selectedStyles = [
        ...selectedStyles.filter((value) => {
          const parts = splitStyleLabel(value);
          return parts.base !== baseStyle && value !== baseStyle;
        }),
        styleValue,
      ];
      loadStyles();
      refreshSearch();
      renderClipboard();
      closeStyleVariantMenu();
    });
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  const { innerWidth, innerHeight } = window;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, Math.max(8, innerWidth - rect.width - 8));
  const top = Math.min(y, Math.max(8, innerHeight - rect.height - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  styleVariantMenuEl = menu;
};

const getTandaMoveTargets = () => {
  const general = clipboardCollections.find((collection) => collection.id === "general");
  const custom = clipboardCollections.filter(
    (collection) => !isPinnedCollectionId(collection.id),
  );
  return [general, ...custom].filter(Boolean) as ClipboardCollection[];
};

const moveTandaBetweenClipboardCollections = (
  tandaId: string,
  targetCollectionId: string,
) => {
  clipboardCollections = moveTandaToCollection(
    clipboardCollections,
    tandaId,
    targetCollectionId,
    [CLIPBOARD_NEW_ID, CLIPBOARD_TOP_ID, CLIPBOARD_LEAST_ID, CLIPBOARD_AVAILABLE_ID],
  );
  activeClipboardCollectionId = targetCollectionId;
  includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
    (id) => id !== targetCollectionId,
  );
  selectedClipboardTandaId = tandaId;
  selectedClipboardTrackId = null;
  saveClipboardCollections();
  renderClipboardCollections();
  renderClipboard();
};

const openTandaMoveTargetMenu = (
  x: number,
  y: number,
  tandaId: string,
  targets: ClipboardCollection[],
) => {
  closeCollectionTargetMenu();
  const menu = document.createElement("div");
  menu.className = "style-variant-menu";
  menu.setAttribute("role", "menu");
  targets.forEach((collection) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "style-variant-menu-item";
    item.setAttribute("role", "menuitem");
    item.textContent = collection.name;
    item.addEventListener("click", () => {
      moveTandaBetweenClipboardCollections(tandaId, collection.id);
      closeCollectionTargetMenu();
    });
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  const { innerWidth, innerHeight } = window;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, Math.max(8, innerWidth - rect.width - 8));
  const top = Math.min(y, Math.max(8, innerHeight - rect.height - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  collectionTargetMenuEl = menu;
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
  const active = resolveNowPlayingState();
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
  if (codes.length === 1) {
    return codes[0];
  }
  if (codes.length > 1) {
    return `${codes[0]}+`;
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
        text: `${resolveNowPlayingTrackLabel(track)}${yearLabel} · ${duration}`,
        trackId: track.id,
        slotIndex,
      },
    ];
  });
};

const getSearchPanel = () => searchTracksEl?.closest(".panel") ?? null;

const getSearchController = () => {
  if (searchController) {
    return searchController;
  }
  searchController = createSearchController<TrackRow>({
    searchPageSize: SEARCH_PAGE_SIZE,
    getWindowApi: () =>
      window.tanda
        ? {
            searchTracks: window.tanda.searchTracks,
            searchTrackCount: window.tanda.searchTrackCount,
            searchJumpIndex: window.tanda.searchJumpIndex,
            searchJumpToPrefix: window.tanda.searchJumpToPrefix,
          }
        : null,
    getState: () => searchState,
    setState: setSearchState,
    patchState: patchSearchState,
    getSearchParams,
    applySearchUiState,
    getRefreshVersion: () => searchRefreshVersion,
    incrementRefreshVersion: () => ++searchRefreshVersion,
    setTrackInCache: (track) => trackCache.set(track.id, track),
    renderSearchResults,
    updateSearchSortDefaults,
    updateTabCount: (count) =>
      updateTabCount(searchTracksEl?.closest(".panel") ?? null, "search-tracks", count),
    updateJumpIndex: (params) => updateJumpIndex(params as ReturnType<typeof getSearchParams>),
    loadTandaSearchResults,
    getActiveSearchTab: () => activeSearchTab,
    getSearchListBody: () => searchListBody,
    getSearchListMetrics: () =>
      searchListBody
        ? {
            scrollTop: searchListBody.scrollTop,
            clientHeight: searchListBody.clientHeight,
            scrollHeight: searchListBody.scrollHeight,
          }
        : null,
    setSearchListScrollTop: (top) => {
      if (searchListBody) {
        searchListBody.scrollTop = top;
      }
    },
  });
  return searchController;
};

const runSearchQuery = (query: string, allowEmpty = false) => {
  if (!searchInput) {
    return;
  }
  const controller = getSearchController();
  controller.runSearchQuery(query, allowEmpty, {
    setInputValue: (value) => {
      searchInput.value = value;
    },
    schedule: (fn) => {
      if (pendingSearchRefreshTimer !== null) {
        window.clearTimeout(pendingSearchRefreshTimer);
      }
      pendingSearchRefreshTimer = window.setTimeout(() => {
        pendingSearchRefreshTimer = null;
        fn();
      }, 0);
    },
    setActiveSearchTracksTab: () => {
      setActiveSearchTabState("search-tracks");
      updateSearchTabVisibility();
      activatePanelTab(getSearchPanel(), "search-tracks");
    },
  });
};

const buildSearchQueryForTrack = (track: TrackRow) => {
  return dedupeQueryTokens(buildTrackSimilarityQuery(track));
};

const resolveSearchStylesForTrack = (track: TrackRow) => {
  const normalized = normalizeStyleName(track.genre);
  if (!normalized) {
    return [] as string[];
  }
  const { base } = splitStyleLabel(normalized);
  return [base || normalized];
};

const runSearchForTrack = (track: TrackRow, preferredStyles?: string[]) => {
  const styles = preferredStyles ?? resolveSearchStylesForTrack(track);
  if (styles.length > 0 || selectedStyles.length > 0) {
    selectedStyles = toBaseStyleFilters(styles);
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
  return [...(getPlaylistStyleMap()[rule.code] ?? [])]
    .map((style) => splitStyleLabel(style).base || normalizeStyleName(style))
    .filter(Boolean);
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

const getClipboardTrackFilterText = (track: TrackRow) =>
  buildTrackSearchQuery(track).toLowerCase();

const getClipboardTandaFilterText = (tanda: TandaDraft) => {
  return buildClipboardTandaFilterText({
    tandaName: tanda.name ?? "",
    styles: tanda.styles,
    trackIds: tanda.trackSlots,
    resolveTrackText: (trackId) => {
      const track = trackCache.get(trackId);
      if (!track) {
        return null;
      }
      return buildTrackSearchQuery(track) || null;
    },
  });
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
  setPlaylistFilterTextState("");
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
  Array.from(
    new Set(
      resolveTandaSearchStyles({
    tandaStyles: tanda.styles,
    tracks,
    availableStyles,
      }).map((style) => splitStyleLabel(style).base || normalizeStyleName(style)),
    ),
  ).filter(Boolean);

const runSearchForTanda = (tanda: TandaDraft, preferredStyles?: string[]) => {
  const tracks = tanda.trackSlots
    .map((trackId) => (trackId ? trackCache.get(trackId) ?? null : null))
    .filter(Boolean) as TrackRow[];
  const styles = preferredStyles ?? resolveSearchStylesForTanda(tanda, tracks);
  if (styles.length > 0 || selectedStyles.length > 0) {
    selectedStyles = toBaseStyleFilters(styles);
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
          "actionMoveCollection",
          "actionMoveCollectionShort",
          "move-clip-tanda-collection",
        ),
      );
    }
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
    .filter((track) => countForTrack(track.id) > 0)
    .slice()
    .sort((left, right) => {
      const diff = countForTrack(left.id) - countForTrack(right.id);
      const byCount = least ? diff : -diff;
      if (byCount !== 0) {
        return byCount;
      }
      return resolveNowPlayingTrackLabel(left).localeCompare(resolveNowPlayingTrackLabel(right));
    })
    .slice(0, SMART_COLLECTION_LIMIT)
    .map((track) => track.id);
  const tandaIds = tandas
    .filter((tanda) => countForTanda(tanda.id) > 0)
    .slice()
    .sort((left, right) => {
      const diff = countForTanda(left.id) - countForTanda(right.id);
      const byCount = least ? diff : -diff;
      if (byCount !== 0) {
        return byCount;
      }
      const ratingDiff = (right.rating ?? 0) - (left.rating ?? 0);
      if (ratingDiff !== 0) {
        return ratingDiff;
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
      return resolveNowPlayingTrackLabel(left).localeCompare(resolveNowPlayingTrackLabel(right));
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
          styleMatchesFilter(track.genre ?? "", forcedStyles),
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
    const styleFilter = getActiveStyleFilter().map((style) => normalizeStyleName(style));
    const filteredTandas = clipboardTandas.filter((tanda) => {
      if (sizeFilter && tanda.trackSlots.filter(Boolean).length !== sizeFilter) {
        return false;
      }
      if (styleFilter.length === 0) {
        return true;
      }
      return tanda.styles.some((style) => styleMatchesFilter(style, styleFilter));
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
          ? resolveNowPlayingTrackLabel(cortinaTrack)
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
      ? resolveNowPlayingTrackLabel(endCortinaTrack)
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
  scheduleCompressionPrefetch();
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
      fromPlaylist: true,
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
  const activeCompanion = playback.main.compressedActive;
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
        await Promise.all([
          fadeOutAudio(activeAudio, autoStopFadeMs),
          activeCompanion && !activeCompanion.paused
            ? fadeOutAudio(activeCompanion, autoStopFadeMs)
            : Promise.resolve(),
        ]);
      }
      activeAudio.pause();
    } else {
      const settled = await waitForGap(Math.max(300, autoStopFadeMs + 250), runId);
      if (!settled) {
        return false;
      }
      if (!activeAudio.paused && !activeAudio.ended) {
        const fadeMs = Math.max(400, getStopFadeSeconds() * 1000);
        await Promise.all([
          fadeOutAudio(activeAudio, fadeMs),
          activeCompanion && !activeCompanion.paused
            ? fadeOutAudio(activeCompanion, fadeMs)
            : Promise.resolve(),
        ]);
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
        { allowToggle: false, startAtSeconds: resumeSeconds, fromPlaylist: true },
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

const playlistRuntimeController = createPlaylistRuntimeController({
  getPlaylistPlayback: () => ({
    status: playlistPlayback.status,
    currentIndex: playlistPlayback.currentIndex,
    currentTrackIndex: playlistPlayback.currentTrackIndex,
    activeTrackId: playlistPlayback.activeTrackId,
    activeTandaId: playlistPlayback.activeTandaId,
    resume: playlistPlayback.resume,
    liveBaseStartMs: playlistPlayback.liveBaseStartMs,
  }),
  setPlaylistPlayback: (next) => {
    Object.assign(playlistPlayback, next);
  },
  runPlaylistPlayback,
  getMainPlayback: () => playback.main,
  setMainPlayback: (next) => {
    Object.assign(playback.main, next);
  },
  getStopFadeSeconds,
  fadeOutAudio,
  releaseAudioDspRuntime,
  stopCompressedCompanion: () => stopCompressedCompanion(playback.main),
  setCortinaDisplayPhase: (phase) => {
    cortinaDisplayPhase = phase;
  },
  renderPlaylist,
});

const startPlaylistPlayback = () => playlistRuntimeController.startPlaylistPlayback();

const resumePlaylistPlayback = () => playlistRuntimeController.resumePlaylistPlayback();

const stopPlaylistPlayback = async () => playlistRuntimeController.stopPlaylistPlayback();

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
        selectedStyles = toBaseStyleFilters(tanda.styles);
        setActiveTanda(tanda.id);
      });
      styleOptions.appendChild(anyButton);
      availableStyles.forEach((style) => {
        const button = document.createElement("button");
        button.textContent = formatStylePillLabel(style, styleFamilies);
        button.title = style;
        button.classList.toggle("active", tanda.styles.includes(style));
        button.disabled = locked;
        button.addEventListener("click", () => {
          if (tanda.styles.includes(style)) {
            tanda.styles = tanda.styles.filter((value) => value !== style);
          } else {
            tanda.styles = [...tanda.styles, style];
          }
          selectedStyles = toBaseStyleFilters(tanda.styles);
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
        label.textContent = track ? resolveNowPlayingTrackLabel(track) : t("tandaPlaceholder");
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
      selectedStyles = toBaseStyleFilters(tanda.styles);
    }
  } else {
    const rule = getRuleForSlot(index);
    if (rule?.code && rule.code !== "*" && rule.code !== "ANY") {
      selectedStyles = toBaseStyleFilters(getPlaylistStyleMap()[rule.code] ?? []);
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
  toBaseStyleFilters(getDefaultStylesForRule(getRuleForSlot(slotIndex), getPlaylistStyleMap()));

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
      setStatus(t("statusCortinaSelected", { title: resolveNowPlayingTrackLabel(track) }));
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
    selectedStyles = toBaseStyleFilters(tanda.styles);
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
    selectedStyles = toBaseStyleFilters(tanda.styles);
  }
  if (selectedTandaId !== tanda.id) {
    selectedTandaId = tanda.id;
    selectedStyles = toBaseStyleFilters(tanda.styles);
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

const formatAlertErrorMessage = (message: string) => {
  const compact = message.replace(/\s+/g, " ").trim();
  if (!compact) {
    return t("statusUnknownError");
  }
  return compact.length > 220 ? `${compact.slice(0, 217)}...` : compact;
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

const getBaseStyles = () => {
  const bases = styleFamilies.map((family) => family.base).filter(Boolean);
  if (bases.length > 0) {
    return bases;
  }
  return Array.from(new Set(availableStyles.map((style) => splitStyleLabel(style).base).filter(Boolean)));
};

const getSelectableStyles = () => {
  const expanded = Object.values(getPlaylistStyleMap()).flat();
  if (expanded.length > 0) {
    return Array.from(new Set(expanded.map((style) => normalizeStyleName(style)).filter(Boolean)));
  }
  return availableStyles;
};

const syncStylesFromFamilies = async () => {
  if (!window.tanda) {
    return;
  }
  const desired = new Set<string>();
  styleFamilies.forEach((family) => {
    const base = normalizeStyleName(family.base);
    if (!base) {
      return;
    }
    desired.add(base);
    family.variants.forEach((variant) => {
      const composed = composeStyleLabel(base, variant);
      if (composed) {
        desired.add(composed);
      }
    });
  });
  for (const style of Array.from(desired)) {
    await window.tanda.addStyle(style);
  }
};

const setStyleFamilies = async (families: StyleFamily[]) => {
  styleFamilies = families
    .map((family) => ({
      code: family.code.trim().toUpperCase(),
      base: normalizeStyleName(family.base),
      variants: family.variants
        .map((variant) => normalizeStyleName(variant))
        .filter(Boolean),
    }))
    .filter((family) => family.code && family.base);
  localStorage.setItem(STYLE_FAMILIES_KEY, serializeStyleFamilies(styleFamilies));
  await syncStylesFromFamilies();
  await loadStyles();
  await refreshLegacyStyleRows();
  renderTandaDesigner();
  refreshSearch();
};

const renderStyleFamilyList = () => {
  if (!styleFamilyList) {
    return;
  }
  styleFamilyList.innerHTML = "";
  if (styleFamilies.length === 0) {
    styleFamilyList.textContent = t("styleEmpty");
    return;
  }
  styleFamilies.forEach((family) => {
    const row = document.createElement("div");
    row.className = "style-family-row";

    const code = document.createElement("span");
    code.className = "code";
    code.textContent = family.code;

    const base = document.createElement("span");
    base.className = "base";
    base.textContent = family.base;

    const variants = document.createElement("span");
    variants.className = "variants";
    variants.textContent =
      family.variants.length > 0
        ? family.variants.join(" · ")
        : family.base;

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = t("styleFamilyEdit");
    edit.addEventListener("click", () => {
      if (styleFamilyCodeInput) {
        styleFamilyCodeInput.value = family.code;
      }
      if (styleFamilyBaseInput) {
        styleFamilyBaseInput.value = family.base;
      }
      if (styleFamilyVariantsInput) {
        styleFamilyVariantsInput.value = family.variants.join(", ");
      }
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = t("styleRemove");
    remove.setAttribute("aria-label", t("styleRemoveLabel", { style: family.base }));
    remove.addEventListener("click", async () => {
      const next = styleFamilies.filter((item) => item.code !== family.code);
      await setStyleFamilies(next);
    });
    row.append(code, base, variants, edit, remove);
    styleFamilyList.appendChild(row);
  });
};

const mapLegacyStyleToCanonical = async (
  legacyStyle: string,
  canonicalStyle: string,
) => {
  if (!window.tanda) {
    return;
  }
  const target = canonicalStyle.trim();
  if (!target) {
    return;
  }
  const definitions = await window.tanda.listStyleDefinitions();
  const current = definitions.find((definition) => definition.name === target);
  const aliases = current?.aliases ?? [];
  const normalizedLegacy = normalizeStyleName(legacyStyle);
  const alreadyMapped =
    normalizeStyleName(target).toLowerCase() === normalizedLegacy.toLowerCase() ||
    aliases.some(
      (alias) => normalizeStyleName(alias).toLowerCase() === normalizedLegacy.toLowerCase(),
    );
  if (alreadyMapped) {
    return;
  }
  const definition = [target, ...aliases, legacyStyle].join(";");
  await window.tanda.addStyle(definition);
};

const refreshLegacyStyleRows = async () => {
  if (!window.tanda || !legacyImportRootPath) {
    return;
  }
  const result = await window.tanda.listLegacyStyles(legacyImportRootPath);
  if (!result.ok) {
    return;
  }
  legacyStyleRows = result.styles;
  if (legacyStylesResult) {
    const mappedCount = legacyStyleRows.filter((entry) => entry.mappedTo).length;
    legacyStylesResult.textContent = t("legacyStylesSummary", {
      total: legacyStyleRows.length,
      mapped: mappedCount,
      unmapped: Math.max(0, legacyStyleRows.length - mappedCount),
    });
  }
  renderLegacyStyleMappingTable();
};

const renderLegacyStyleMappingTable = () => {
  if (!legacyStyleMappingEl || !legacyStyleMappingBody) {
    return;
  }
  legacyStyleMappingBody.innerHTML = "";
  if (legacyStyleRows.length === 0) {
    legacyStyleMappingEl.classList.add("hidden");
    return;
  }
  legacyStyleMappingEl.classList.remove("hidden");
  legacyStyleRows.forEach((entry) => {
    const row = document.createElement("tr");

    const valueCell = document.createElement("td");
    valueCell.textContent = entry.value;

    const countCell = document.createElement("td");
    countCell.textContent = entry.count.toString();

    const mappedCell = document.createElement("td");
    mappedCell.textContent = entry.mappedTo || t("legacyStylesUnmapped");

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "legacy-style-mapping-actions";
    const primaryActions = document.createElement("div");
    primaryActions.className = "legacy-style-actions-primary";
    const secondaryActions = document.createElement("div");
    secondaryActions.className = "legacy-style-actions-secondary hidden";
    const select = document.createElement("select");
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = t("legacyStylesMapSelect");
    select.appendChild(empty);
    getSelectableStyles().forEach((style) => {
      const option = document.createElement("option");
      option.value = style;
      option.textContent = style;
      select.appendChild(option);
    });
    select.value = entry.mappedTo || "";
    select.addEventListener("change", () => {
      const selected = select.value;
      if (!selected) {
        return;
      }
      void mapLegacyStyleToCanonical(entry.value, selected).then(async () => {
        await loadStyles();
        await refreshLegacyStyleRows();
      });
    });

    const addCode = document.createElement("input");
    addCode.type = "text";
    addCode.maxLength = 3;
    addCode.value = (entry.value.trim().slice(0, 1).toUpperCase() || "X").replace(
      /[^A-Z0-9]/g,
      "",
    );
    addCode.title = t("styleFamilyCodePlaceholder");
    addCode.setAttribute("aria-label", t("styleFamilyCodePlaceholder"));

    const addBase = document.createElement("input");
    addBase.type = "text";
    addBase.value = entry.mappedTo || normalizeStyleName(entry.value);
    addBase.title = t("styleFamilyBasePlaceholder");
    addBase.setAttribute("aria-label", t("styleFamilyBasePlaceholder"));

    const addAlias = document.createElement("input");
    addAlias.type = "text";
    addAlias.value = entry.value;
    addAlias.title = t("legacyStylesColValue");
    addAlias.setAttribute("aria-label", t("legacyStylesColValue"));

    const addNewBtn = document.createElement("button");
    addNewBtn.type = "button";
    addNewBtn.textContent = t("legacyStylesAddAsNew");
    const toggleAddNewBtn = document.createElement("button");
    toggleAddNewBtn.type = "button";
    toggleAddNewBtn.textContent = t("legacyStylesAddAsNew");
    toggleAddNewBtn.addEventListener("click", () => {
      const opening = secondaryActions.classList.contains("hidden");
      secondaryActions.classList.toggle("hidden", !opening);
      toggleAddNewBtn.textContent = opening ? t("cancel") : t("legacyStylesAddAsNew");
    });
    addNewBtn.addEventListener("click", async () => {
      const code = addCode.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const base = normalizeStyleName(addBase.value);
      const alias = addAlias.value.trim();
      if (!code || !base) {
        return;
      }
      const baseParts = splitStyleLabel(base);
      const incoming = {
        code,
        base: baseParts.base || normalizeStyleName(base),
        variants: baseParts.variant ? [baseParts.variant] : [],
      };
      const existing = styleFamilies.find((family) => family.code === code);
      const nextFamilies = styleFamilies.filter((family) => family.code !== code);
      if (existing && existing.base === incoming.base) {
        nextFamilies.push({
          code,
          base: existing.base,
          variants: Array.from(new Set(existing.variants.concat(incoming.variants))),
        });
      } else {
        nextFamilies.push(incoming);
      }
      await setStyleFamilies(nextFamilies);
      await mapLegacyStyleToCanonical(entry.value, base);
      if (alias && normalizeStyleName(alias) !== normalizeStyleName(entry.value)) {
        await mapLegacyStyleToCanonical(alias, base);
      }
      await refreshLegacyStyleRows();
    });
    primaryActions.append(select, toggleAddNewBtn);
    secondaryActions.append(addCode, addBase, addAlias, addNewBtn);
    actions.append(primaryActions, secondaryActions);
    actionsCell.appendChild(actions);

    row.append(valueCell, countCell, mappedCell, actionsCell);
    legacyStyleMappingBody.appendChild(row);
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

const getSettingsDiagnosticsController = () => {
  if (settingsDiagnosticsController) {
    return settingsDiagnosticsController;
  }
  if (
    !window.tanda?.getDiagnosticsLogs ||
    !window.tanda?.clearDiagnosticsLogs ||
    !window.tanda?.getDiagnosticsDataReadiness
  ) {
    return null;
  }
  settingsDiagnosticsController = createSettingsDiagnosticsController({
    translate: t,
    getDiagnosticsLogs: window.tanda.getDiagnosticsLogs,
    clearDiagnosticsLogs: window.tanda.clearDiagnosticsLogs,
    getDiagnosticsDataReadiness: window.tanda.getDiagnosticsDataReadiness,
  });
  return settingsDiagnosticsController;
};

const renderPlaybackDiagnosticsLog = async () => {
  if (!diagnosticsPlaybackLogResult) {
    return;
  }
  const controller = getSettingsDiagnosticsController();
  if (!controller) {
    return;
  }
  await controller.renderPlaybackDiagnosticsLog(diagnosticsPlaybackLogResult);
};

const clearDiagnosticsLogs = async () => {
  if (!diagnosticsPlaybackLogResult) {
    return;
  }
  const controller = getSettingsDiagnosticsController();
  if (!controller) {
    return;
  }
  await controller.clearPlaybackDiagnosticsLog(diagnosticsPlaybackLogResult);
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
  if (!legacyReadinessResult) {
    return;
  }
  const controller = getSettingsDiagnosticsController();
  if (!controller) {
    return;
  }
  const statusText = await controller.verifyLegacyReadiness(legacyReadinessResult);
  if (statusText) {
    setStatus(statusText);
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

const toBaseStyleFilters = (styles: string[]) =>
  Array.from(
    new Set(
      styles
        .map((style) => splitStyleLabel(style).base || normalizeStyleName(style))
        .filter(Boolean),
    ),
  );

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
  styleDefinitions = await window.tanda.listStyleDefinitions();
  styleFamilies = getStyleFamilies();
  if (styleFamilies.length === 0) {
    const derived = deriveFamiliesFromStyles(availableStyles);
    if (derived.length > 0) {
      styleFamilies = derived;
      localStorage.setItem(STYLE_FAMILIES_KEY, serializeStyleFamilies(styleFamilies));
    } else {
      styleFamilies = parseStyleFamilies(DEFAULT_STYLE_FAMILIES);
      localStorage.setItem(STYLE_FAMILIES_KEY, DEFAULT_STYLE_FAMILIES);
    }
  }
  const desiredStyles = new Set(
    Object.values(styleFamilyMapFromFamilies(styleFamilies)).flat().map((style) =>
      normalizeStyleName(style),
    ),
  );
  const existingStyles = new Set(availableStyles.map((style) => normalizeStyleName(style)));
  const missingStyles = Array.from(desiredStyles).filter((style) => !existingStyles.has(style));
  if (missingStyles.length > 0) {
    for (const style of missingStyles) {
      await window.tanda.addStyle(style);
    }
    availableStyles = await window.tanda.listStyles();
    styleDefinitions = await window.tanda.listStyleDefinitions();
  }
  familyStyleIndex = buildFamilyStyleIndex(availableStyles);
  closeStyleVariantMenu();
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
  getBaseStyles().forEach((style) => {
    const button = document.createElement("button");
    const selectedVariantStyle = selectedStyles.reduce<string | null>((found, selectedStyle) => {
      if (found) {
        return found;
      }
      const parts = splitStyleLabel(selectedStyle);
      return parts.base === style && parts.variant ? selectedStyle : null;
    }, null);
    button.textContent = selectedVariantStyle
      ? formatStylePillLabel(selectedVariantStyle, styleFamilies)
      : style;
    button.classList.toggle(
      "active",
      selectedStyles.includes(style) ||
        selectedStyles.some((selected) => splitStyleLabel(selected).base === style),
    );
    let longPressTimer: number | null = null;
    const clearLongPress = () => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };
    button.addEventListener("click", () => {
      if (button.dataset.longPressHandled === "1") {
        button.dataset.longPressHandled = "0";
        return;
      }
      const hasBase = selectedStyles.some(
        (value) => splitStyleLabel(value).base === style || value === style,
      );
      if (hasBase) {
        selectedStyles = selectedStyles.filter(
          (value) => splitStyleLabel(value).base !== style && value !== style,
        );
      } else {
        selectedStyles = [...selectedStyles, style];
      }
      loadStyles();
      refreshSearch();
      renderClipboard();
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const family = styleFamilies.find((item) => item.base === style);
      if (!family || family.variants.length === 0) {
        return;
      }
      clearLongPress();
      openStyleVariantMenu(event.clientX, event.clientY, style, family);
    });
    button.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }
      const family = styleFamilies.find((item) => item.base === style);
      if (!family || family.variants.length === 0) {
        return;
      }
      clearLongPress();
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null;
        const rect = button.getBoundingClientRect();
        button.dataset.longPressHandled = "1";
        openStyleVariantMenu(
          rect.left + Math.min(rect.width - 8, 24),
          rect.bottom + 4,
          style,
          family,
        );
      }, STYLE_VARIANT_LONG_PRESS_MS);
    });
    button.addEventListener("mouseup", clearLongPress);
    button.addEventListener("mouseleave", clearLongPress);
    button.addEventListener("touchstart", () => {
      const family = styleFamilies.find((item) => item.base === style);
      if (!family || family.variants.length === 0) {
        return;
      }
      clearLongPress();
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null;
        const rect = button.getBoundingClientRect();
        button.dataset.longPressHandled = "1";
        openStyleVariantMenu(
          rect.left + Math.min(rect.width - 8, 24),
          rect.bottom + 4,
          style,
          family,
        );
      }, STYLE_VARIANT_LONG_PRESS_MS);
    });
    button.addEventListener("touchend", clearLongPress);
    button.addEventListener("touchcancel", clearLongPress);
    styleOptions.appendChild(button);
  });
  renderStyleFamilyList();
  renderLegacyStyleMappingTable();
  if (trackEditorState.track) {
    fillTrackEditorFields(trackEditorState.track);
  }
};

let searchTimer: number | undefined;

const getActiveStyleFilter = () => {
  return selectedStyles;
};

const getExpandedStyleFilter = () => {
  const active = getActiveStyleFilter();
  const baseStyles = active.filter((style) => !splitStyleLabel(style).variant);
  const explicitVariants = active
    .filter((style) => splitStyleLabel(style).variant)
    .map((style) => normalizeStyleName(style))
    .filter(Boolean);
  return Array.from(
    new Set([
      ...expandStyleFilters(baseStyles, familyStyleIndex),
      ...explicitVariants,
    ]),
  );
};

const styleMatchesFilter = (style: string, filters: string[]) => {
  const normalized = normalizeStyleName(style);
  if (!normalized) {
    return false;
  }
  if (filters.includes(normalized)) {
    return true;
  }
  const { base } = splitStyleLabel(normalized);
  return base ? filters.includes(base) : false;
};

const getSearchParams = () => {
  const config = getSearchConfig();
  return {
    query: searchInput?.value?.trim() ?? "",
    styles: getExpandedStyleFilter(),
    minScore: config.minScore,
    bpmRange: config.bpmRange,
  };
};

const updateSearchSortDefaults = () => {
  const query = searchInput?.value?.trim() ?? "";
  setSearchState({
    ...searchState,
    ...applySearchSortDefaults(query, searchState),
  });
  updateSortButtons();
};

const updateSearchCount = async (
  paramsOverride?: ReturnType<typeof getSearchParams>,
) => {
  if (!window.tanda) {
    return;
  }
  const params = paramsOverride ?? getSearchParams();
  patchSearchState({ total: await window.tanda.searchTrackCount(params) });
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
  await getSearchController().loadSearchPage(offset, mode, paramsOverride);
};

const refreshSearch = async () => {
  await getSearchController().refreshSearch();
};

const jumpToPrefix = async (prefix: string) => {
  await getSearchController().jumpToPrefix(prefix);
};

const handleSearchScroll = async () => {
  await getSearchController().handleSearchScroll();
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
    if (legacyStylesResult && !legacyStylesResult.textContent) {
      legacyStylesResult.textContent = "";
    }
    legacyStyleTools?.classList.remove("hidden");
    renderLegacyStyleMappingTable();
  } else {
    legacyImportRootPath = null;
    legacyImportDescription.textContent = "";
    if (legacyReadinessResult) {
      legacyReadinessResult.textContent = "";
    }
    if (legacyStylesResult) {
      legacyStylesResult.textContent = "";
    }
    legacyStyleTools?.classList.add("hidden");
    legacyStyleRows = [];
    renderLegacyStyleMappingTable();
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
    showAlert(
      t("statusRendererErrorDetail", {
        message: formatAlertErrorMessage(message),
      }),
    );
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
    showAlert(
      t("statusRendererErrorDetail", {
        message: formatAlertErrorMessage(message),
      }),
    );
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
      setClipboardFilterTextState(clipboardFilterInput.value);
      void renderClipboard();
    });
  }

  if (playlistFilterInput) {
    playlistFilterInput.value = playlistFilterText;
    playlistFilterInput.addEventListener("input", () => {
      markUserInteraction();
      setPlaylistFilterTextState(playlistFilterInput.value);
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
      setPlaylistFilterTextState(playlistFilterInput.value);
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
  searchDiversityBtn?.addEventListener("click", () => {
    if (searchDiversityRenderInFlight) {
      return;
    }
    searchDiversityRenderInFlight = true;
    searchDiversityBtn.disabled = true;
    setSearchDiversityModalVisible(true);
    void renderSearchDiversityStats()
      .catch((error) => {
        setStatus(
          t("statusPrecomputeCompressionFailed", {
            message: error instanceof Error ? error.message : t("statusUnknownError"),
          }),
        );
      })
      .finally(() => {
        searchDiversityRenderInFlight = false;
        searchDiversityBtn.disabled = false;
      });
  });
  searchDiversityCloseBtn?.addEventListener("click", () => {
    setSearchDiversityModalVisible(false);
  });
  searchDiversityModal?.addEventListener("click", (event) => {
    if (event.target === searchDiversityModal) {
      setSearchDiversityModalVisible(false);
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

  if (audioDynamicsEnabledInput) {
    audioDynamicsEnabledInput.checked = getAudioDynamicsConfig().enabled;
    audioDynamicsEnabledInput.addEventListener("change", () => {
      localStorage.setItem(
        AUDIO_DYNAMICS_ENABLED_KEY,
        audioDynamicsEnabledInput.checked ? "1" : "0",
      );
      localStorage.setItem(AUDIO_DYNAMICS_DEPTH_KEY, "0");
      renderNowPlayingDynamicsControl();
      if (audioDynamicsEnabledInput.checked) {
        scheduleCompressionPrefetch();
      }
      void syncDynamicsRuntimeForActivePlayback();
    });
  }
  renderNowPlayingDynamicsControl();
  if (nowPlayingDynamicsControl) {
    const stopNowPlayingPropagation = (event: Event) => {
      event.stopPropagation();
    };
    nowPlayingDynamicsControl.addEventListener("pointerdown", stopNowPlayingPropagation);
    nowPlayingDynamicsControl.addEventListener("mousedown", stopNowPlayingPropagation);
    nowPlayingDynamicsControl.addEventListener("touchstart", stopNowPlayingPropagation);
    nowPlayingDynamicsControl.addEventListener("click", stopNowPlayingPropagation);
  }
  if (nowPlayingDynamicsMixInput) {
    nowPlayingDynamicsMixInput.value = getAudioDynamicsDepthPercent().toString();
    nowPlayingDynamicsMixInput.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    nowPlayingDynamicsMixInput.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    nowPlayingDynamicsMixInput.addEventListener("touchstart", (event) => {
      event.stopPropagation();
    });
    nowPlayingDynamicsMixInput.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    nowPlayingDynamicsMixInput.addEventListener("input", () => {
      const next = Number.parseInt(nowPlayingDynamicsMixInput.value, 10);
      const clamped = Number.isFinite(next) ? Math.min(100, Math.max(0, next)) : 0;
      localStorage.setItem(AUDIO_DYNAMICS_DEPTH_KEY, clamped.toString());
      if (nowPlayingDynamicsMixValue) {
        nowPlayingDynamicsMixValue.textContent = `${clamped}%`;
      }
      if (clamped > 0) {
        scheduleCompressionPrefetch();
      }
      void syncDynamicsRuntimeForActivePlayback();
    });
  }
  if (audioDynamicsLiftThresholdInput) {
    audioDynamicsLiftThresholdInput.value = getAudioDynamicsConfig().liftThresholdDb.toString();
    audioDynamicsLiftThresholdInput.addEventListener("change", () => {
      const next = Number.parseFloat(audioDynamicsLiftThresholdInput.value);
      if (!Number.isFinite(next)) {
        audioDynamicsLiftThresholdInput.value =
          getAudioDynamicsConfig().liftThresholdDb.toString();
        return;
      }
      const clamped = Math.min(-5, Math.max(-80, next));
      localStorage.setItem(AUDIO_DYNAMICS_LIFT_THRESHOLD_KEY, clamped.toString());
      audioDynamicsLiftThresholdInput.value = clamped.toString();
      void syncDynamicsRuntimeForActivePlayback();
    });
  }
  if (audioDynamicsMaxLiftInput) {
    audioDynamicsMaxLiftInput.value = getAudioDynamicsConfig().maxLiftDb.toString();
    audioDynamicsMaxLiftInput.addEventListener("change", () => {
      const next = Number.parseFloat(audioDynamicsMaxLiftInput.value);
      if (!Number.isFinite(next)) {
        audioDynamicsMaxLiftInput.value = getAudioDynamicsConfig().maxLiftDb.toString();
        return;
      }
      const clamped = Math.min(60, Math.max(0, next));
      localStorage.setItem(AUDIO_DYNAMICS_MAX_LIFT_KEY, clamped.toString());
      audioDynamicsMaxLiftInput.value = clamped.toString();
      void syncDynamicsRuntimeForActivePlayback();
    });
  }
  if (audioDynamicsRatioInput) {
    audioDynamicsRatioInput.value = getAudioDynamicsConfig().ratio.toString();
    audioDynamicsRatioInput.addEventListener("change", () => {
      const next = Number.parseFloat(audioDynamicsRatioInput.value);
      if (!Number.isFinite(next)) {
        audioDynamicsRatioInput.value = getAudioDynamicsConfig().ratio.toString();
        return;
      }
      const clamped = Math.min(24, Math.max(1, next));
      localStorage.setItem(AUDIO_DYNAMICS_RATIO_KEY, clamped.toString());
      audioDynamicsRatioInput.value = clamped.toString();
      void syncDynamicsRuntimeForActivePlayback();
    });
  }
  if (audioDynamicsAttackInput) {
    audioDynamicsAttackInput.value = getAudioDynamicsConfig().attackMs.toString();
    audioDynamicsAttackInput.addEventListener("change", () => {
      const next = Number.parseFloat(audioDynamicsAttackInput.value);
      if (!Number.isFinite(next)) {
        audioDynamicsAttackInput.value = getAudioDynamicsConfig().attackMs.toString();
        return;
      }
      const clamped = Math.min(1000, Math.max(1, next));
      localStorage.setItem(AUDIO_DYNAMICS_ATTACK_KEY, clamped.toString());
      audioDynamicsAttackInput.value = clamped.toString();
      void syncDynamicsRuntimeForActivePlayback();
    });
  }
  if (audioDynamicsReleaseInput) {
    audioDynamicsReleaseInput.value = getAudioDynamicsConfig().releaseMs.toString();
    audioDynamicsReleaseInput.addEventListener("change", () => {
      const next = Number.parseFloat(audioDynamicsReleaseInput.value);
      if (!Number.isFinite(next)) {
        audioDynamicsReleaseInput.value = getAudioDynamicsConfig().releaseMs.toString();
        return;
      }
      const clamped = Math.min(3000, Math.max(10, next));
      localStorage.setItem(AUDIO_DYNAMICS_RELEASE_KEY, clamped.toString());
      audioDynamicsReleaseInput.value = clamped.toString();
      void syncDynamicsRuntimeForActivePlayback();
    });
  }
  if (audioDynamicsGateThresholdInput) {
    audioDynamicsGateThresholdInput.value = getAudioDynamicsConfig().gateThresholdDb.toString();
    audioDynamicsGateThresholdInput.addEventListener("change", () => {
      const next = Number.parseFloat(audioDynamicsGateThresholdInput.value);
      if (!Number.isFinite(next)) {
        audioDynamicsGateThresholdInput.value =
          getAudioDynamicsConfig().gateThresholdDb.toString();
        return;
      }
      const clamped = Math.min(-10, Math.max(-120, next));
      localStorage.setItem(AUDIO_DYNAMICS_GATE_THRESHOLD_KEY, clamped.toString());
      audioDynamicsGateThresholdInput.value = clamped.toString();
      void syncDynamicsRuntimeForActivePlayback();
    });
  }
  if (audioDynamicsLimiterCeilingInput) {
    audioDynamicsLimiterCeilingInput.value = getAudioDynamicsConfig().limiterCeilingDb.toString();
    audioDynamicsLimiterCeilingInput.addEventListener("change", () => {
      const next = Number.parseFloat(audioDynamicsLimiterCeilingInput.value);
      if (!Number.isFinite(next)) {
        audioDynamicsLimiterCeilingInput.value =
          getAudioDynamicsConfig().limiterCeilingDb.toString();
        return;
      }
      const clamped = Math.min(-0.1, Math.max(-6, next));
      localStorage.setItem(AUDIO_DYNAMICS_LIMITER_CEILING_KEY, clamped.toString());
      audioDynamicsLimiterCeilingInput.value = clamped.toString();
      void syncDynamicsRuntimeForActivePlayback();
    });
  }
  if (audioDynamicsLimiterReleaseInput) {
    audioDynamicsLimiterReleaseInput.value = getAudioDynamicsConfig().limiterReleaseMs.toString();
    audioDynamicsLimiterReleaseInput.addEventListener("change", () => {
      const next = Number.parseFloat(audioDynamicsLimiterReleaseInput.value);
      if (!Number.isFinite(next)) {
        audioDynamicsLimiterReleaseInput.value =
          getAudioDynamicsConfig().limiterReleaseMs.toString();
        return;
      }
      const clamped = Math.min(2000, Math.max(10, next));
      localStorage.setItem(AUDIO_DYNAMICS_LIMITER_RELEASE_KEY, clamped.toString());
      audioDynamicsLimiterReleaseInput.value = clamped.toString();
      void syncDynamicsRuntimeForActivePlayback();
    });
  }
  if (audioDynamicsRampInput) {
    audioDynamicsRampInput.value = getAudioDynamicsConfig().rampMs.toString();
    audioDynamicsRampInput.addEventListener("change", () => {
      const next = Number.parseFloat(audioDynamicsRampInput.value);
      if (!Number.isFinite(next)) {
        audioDynamicsRampInput.value = getAudioDynamicsConfig().rampMs.toString();
        return;
      }
      const clamped = Math.min(3000, Math.max(50, next));
      localStorage.setItem(AUDIO_DYNAMICS_RAMP_KEY, clamped.toString());
      audioDynamicsRampInput.value = clamped.toString();
      void syncDynamicsRuntimeForActivePlayback();
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
      prefetchedCortinaTrackIds.clear();
      cortinaOverrideByIndex.clear();
      resetCortinaPlans();
      await resetCortinaQueue();
      await ensureCortinaPlans(getCortinaRowIndices(playlistItems));
      renderPlaylist();
      scheduleCompressionPrefetch();
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

  if (styleFamilyAddBtn) {
    styleFamilyAddBtn.addEventListener("click", async () => {
      const code = styleFamilyCodeInput?.value?.trim().toUpperCase() ?? "";
      const base = styleFamilyBaseInput?.value?.trim() ?? "";
      const variants = (styleFamilyVariantsInput?.value ?? "")
        .split(/[;,/]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      if (!code || !base) {
        return;
      }
      const next = styleFamilies.filter((family) => family.code !== code);
      next.push({ code, base, variants });
      await setStyleFamilies(next);
      if (styleFamilyCodeInput) {
        styleFamilyCodeInput.value = "";
      }
      if (styleFamilyBaseInput) {
        styleFamilyBaseInput.value = "";
      }
      if (styleFamilyVariantsInput) {
        styleFamilyVariantsInput.value = "";
      }
      recomputePlaylistMismatches();
      renderPlaylist();
      updateExternalDisplay();
      setStatus(t("statusStyleAdded", { style: base }));
    });
  }

  [styleFamilyCodeInput, styleFamilyBaseInput, styleFamilyVariantsInput].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      styleFamilyAddBtn?.click();
    });
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
    setAppModeState(resolveOutputModeValue(savedMode));
    modeSelect.value = appMode;
    document.body.classList.toggle("mode-live", appMode === "live");
    modeSelect.addEventListener("change", () => {
      const nextMode = resolveOutputModeValue(modeSelect.value);
      setAppModeState(nextMode);
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
    const currentFile = basenameForDisplay(progress.filePath);
    const progressText = currentFile
      ? t("statusScanProgressWithFile", {
          current: progress.current,
          total: progress.total,
          root: progress.rootLabel,
          file: currentFile,
        })
      : t("statusScanProgress", {
          current: progress.current,
          total: progress.total,
          root: progress.rootLabel,
        });
    if (progressEl) {
      progressEl.max = progress.total || 1;
      progressEl.value = progress.current;
    }
    if (progressLabel) {
      progressLabel.textContent = progressText;
    }
    if (progressElSettings) {
      progressElSettings.max = progress.total || 1;
      progressElSettings.value = progress.current;
    }
    if (progressLabelSettings) {
      progressLabelSettings.textContent = progressText;
    }
  });

  window.tanda.onPrecomputeCompressedProgress((progress) => {
    if (!precomputeCompressionInProgress) {
      return;
    }
    if (progressElSettings) {
      progressElSettings.max = Math.max(1, progress.total || 1);
      progressElSettings.value = Math.min(progress.current, progress.total || progress.current);
    }
    if (progressLabelSettings) {
      progressLabelSettings.textContent = t("statusPrecomputeCompressionProgress", {
        current: progress.current,
        total: progress.total,
        rendered: progress.rendered,
        cached: progress.cached,
        failed: progress.failed,
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
    const active = resolveNowPlayingState();
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
    const active = resolveNowPlayingState();
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
  legacyStylesButton?.addEventListener("click", async () => {
    if (!window.tanda || !legacyImportRootPath || !legacyStylesResult) {
      return;
    }
    legacyStylesResult.textContent = t("legacyStylesLoading");
    const result = await window.tanda.listLegacyStyles(legacyImportRootPath);
    if (!result.ok) {
      legacyStylesResult.textContent = t("legacyStylesUnavailable");
      legacyStyleRows = [];
      renderLegacyStyleMappingTable();
      return;
    }
    if (result.styles.length === 0) {
      legacyStylesResult.textContent = t("legacyStylesNoneFound");
      legacyStyleRows = [];
      renderLegacyStyleMappingTable();
      return;
    }
    await refreshLegacyStyleRows();
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

  precomputeCompressedBtn?.addEventListener("click", async () => {
    if (!window.tanda) {
      setStatus(t("statusNoApi"));
      return;
    }
    const config = getAudioDynamicsConfig();
    setStatus(t("statusPrecomputeCompressionRunning"));
    precomputeCompressionInProgress = true;
    if (progressElSettings) {
      progressElSettings.max = 1;
      progressElSettings.value = 0;
    }
    if (progressLabelSettings) {
      progressLabelSettings.textContent = t("statusPrecomputeCompressionRunning");
    }
    precomputeCompressedBtn.disabled = true;
    try {
      const result = await window.tanda.precomputeCompressedTracks({
        mode: config.mode,
        liftThresholdDb: config.liftThresholdDb,
        maxLiftDb: config.maxLiftDb,
        ratio: config.ratio,
        attackMs: config.attackMs,
        releaseMs: config.releaseMs,
        gateThresholdDb: config.gateThresholdDb,
        limiterCeilingDb: config.limiterCeilingDb,
        limiterReleaseMs: config.limiterReleaseMs,
      });
      if (!result?.ok) {
        setStatus(
          t("statusPrecomputeCompressionFailed", {
            message: result?.error ?? t("statusUnknownError"),
          }),
        );
        return;
      }
      setStatus(
        t("statusPrecomputeCompressionDone", {
          rendered: result.rendered,
          cached: result.cached,
          failed: result.failed,
        }),
      );
      scheduleCompressionPrefetch();
    } catch (error) {
      setStatus(
        t("statusPrecomputeCompressionFailed", {
          message: error instanceof Error ? error.message : t("statusUnknownError"),
        }),
      );
    } finally {
      precomputeCompressionInProgress = false;
      precomputeCompressedBtn.disabled = false;
    }
  });

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
        patchSearchState({
          sortDir: searchState.sortDir === "asc" ? "desc" : "asc",
        });
      } else {
        patchSearchState({ sortBy: sort, sortDir: "asc" });
      }
      patchSearchState({ sortMode: "manual" });
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
    if (action === "move-clip-tanda-collection") {
      const targets = getTandaMoveTargets();
      if (targets.length === 0) {
        closeRowMenus();
        return;
      }
      if (targets.length === 1) {
        moveTandaBetweenClipboardCollections(tandaId, targets[0].id);
        closeRowMenus();
        return;
      }
      const actionButton = target.closest<HTMLButtonElement>(
        'button[data-action="move-clip-tanda-collection"]',
      );
      if (actionButton) {
        const rect = actionButton.getBoundingClientRect();
        openTandaMoveTargetMenu(rect.left, rect.bottom + 4, tandaId, targets);
      } else {
        openTandaMoveTargetMenu(event.clientX, event.clientY, tandaId, targets);
      }
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
    if (!target?.closest(".style-variant-menu")) {
      closeStyleVariantMenu();
      closeCollectionTargetMenu();
    }
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
        setActiveSearchTabState(tabId as SearchTab);
        updateSearchTabVisibility();
      }
      if (tabId === "tanda-designer-tab" || tabId === "playlist-tab") {
        setActiveRightTabState(tabId as RightPanelTab);
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
        selectedStyles = toBaseStyleFilters(mappedStyles);
        loadStyles();
        updateSearchTabVisibility();
        refreshSearch();
        activatePanelTab(getSearchPanel(), "search-tracks");
        setActiveSearchTabState("search-tracks");
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
        selectedStyles = toBaseStyleFilters(tanda.styles);
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
