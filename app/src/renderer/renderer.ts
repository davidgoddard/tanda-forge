import { matchesRating, normalizeRatingFilter, type RatingFilter, type RatingSnapshot } from "../shared/rating-filter.js";
import {
  buildTandaArtistSortKey,
  deriveInstrumental,
  normalizeStyleName,
  summarizeArtistName,
  summarizeTrackArtist,
  restoreEquivalentArtistSpelling,
  summarizeTandaTracks,
  collectStylesFromTracks,
} from "../shared/tanda-utils.js";
import { applySearchSortDefaults } from "../shared/search-sort.js";
import {
  belongsToSavedTanda,
  getSavedTandaId,
} from "./tanda-deletion.js";
import type {
  AudioSimilarityReport,
  AudioSimilarityMember,
  AudioSimilarityMetadataChange,
  AudioSimilarityAuditionTrack,
  AudioSimilarityRelationshipType,
} from "../shared/audio-similarity.js";
import {
  appendQueryTokens,
  buildTrackSimilarityQuery,
  buildTrackSearchQuery,
  dedupeQueryTokens,
} from "../shared/search-query.js";
import {
  selectTandaVariantStyle,
  toggleTandaBaseStyle,
} from "../shared/tanda-style-selection.js";
import {
  buildTandaSearchQuery,
  resolveTrackSearchStyles,
  resolveTandaSearchStyles,
} from "../shared/tanda-search.js";
import {
  formatSequenceRule,
  getSequenceRule,
  parseSequence,
  validateSequenceCodes,
  validateSequenceSyntax,
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
  sortBaseStyles,
  parseStyleFamilies,
  serializeStyleFamilies,
  splitStyleLabel,
  styleFamilyMapFromFamilies,
  type StyleFamily,
} from "../shared/style-families.js";
import {
  getLegacyStyleMapping,
  parseLegacyStyleMappingState,
  setLegacyStyleMapping,
  type LegacyStyleMappingState,
} from "../shared/legacy-style-mappings.js";
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
import type { DisplayUpdatePayload, LibraryRoot, SystemBackupStatus } from "../shared/types.js";
import { createDisplayLagScheduler } from "./modules/display-lag.js";
import {
  createCalibrationClickWav,
  createCalibrationPulseLoop,
} from "./modules/av-lag-calibration.js";
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
  COMPRESSION_TAIL_RESET_LEAD_SECONDS,
  isCompressionControlLockedForPrep,
  shouldAutoResetCompressionMixNearEnd,
  shouldResetCompressionMixForNewTrack,
  shouldWarmCompressionInBackground,
  shouldUseCompressionSource,
} from "../shared/audio-compression.js";
import { resolveCompressionSliderUiState } from "../shared/compression-ui.js";
import {
  applyGainStepGuard,
  gainDbToLinear,
  resolvePlaybackNormalization,
} from "../shared/audio-normalization.js";
import { computeFadeDurationMs } from "../shared/audio-fade.js";
import { createLightingNotifier, createLightingPlaybackNotifier } from "../shared/lighting-notifier.js";
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
import { requiresPlaybackTranscode } from "../shared/audio-playback-source.js";
import {
  dedupeAudioOutputs,
  getOutputCandidateIds,
  resolveRequestedOutputDeviceId,
  resolveStoredOutputDevice,
  type AudioOutputDevice,
} from "../shared/audio-outputs.js";
import {
  clampLastTandaOffset,
  decrementLastTandaRemainingCount,
  resolveLastTandaRemainingCount,
  resolveContinuationIndexAfterEndCortina,
  resolveOverlapFadeMs,
  resolveScheduledTransitionTimeSeconds,
  shouldEnablePlaylistStart,
  shouldPauseAfterMarkedPerformanceStop,
  shouldEnablePlaylistStop,
  shouldPlayStandaloneTrackFromClick,
  shouldPreservePausedPerformanceResumeOnStop,
  shouldContinueAfterEndCortina,
  shouldInsertCortinaBeforeTanda,
  shouldSkipLeadInCortinaForSelectedStart,
  shouldStartPlaylistFromClick,
  shouldStopAfterMarkedLastTanda,
  shouldTreatClickStartAsIdle,
  shouldUseOverlapForGapMs,
} from "../shared/playlist-flow.js";
import { computeAutoClearRemainingMs } from "../shared/playlist-filter.js";
import { normalizePlaylistItems } from "../shared/playlist-normalize.js";
import { computeScaledPercent } from "../shared/chart-scale.js";
import { basenameForDisplay } from "../shared/path-display.js";
import {
  collectStoredPlaylistTrackIds,
  parseStoredPlaylistState,
  type PlaylistTandaSnapshot,
  serializeStoredPlaylistState,
  type StoredCortinaAssignment,
  type StoredPlaylistItem,
  type StoredPlaylistState,
} from "../shared/playlist-storage.js";
import { tandaContentsMatch } from "../shared/playlist-tanda-variant.js";
import { scoreTandaTrackCohesion } from "../shared/playlist-auto-generation.js";
import { resolveSearchResultTanda } from "../shared/tanda-search-resolution.js";
import {
  PLAYLIST_EXPORT_VERSION,
  type PlaylistExportManifest,
  type PortableTrackRef,
} from "../shared/library-transfer.js";
import {
  aggregateOrchestraDurations,
  areArtistsGapSatisfied,
  buildAdaptiveNumericDistribution,
  buildAdaptiveStyleNumericDistribution,
  findTandaPurityIssues,
  filterByArtistRepeatGap,
  type TandaPurityIssue,
  collectEligibleArtistStyleGroups,
  isTandaArtistStyleAvailable,
  normalizeAvailabilityStyleGroup,
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
  getDisplayBoardPlayingState as getDisplayBoardPlayingStateView,
  getNowPlayingState as getNowPlayingStateView,
} from "./modules/playback-view.js";
import { createWaveformController } from "./modules/waveform-view.js";
import {
  resolveCurrentProgressText,
  resolveLastTandaCountdownText,
  resolveNextTandaLabel,
  resolveNextTandaStyle,
  resolveTandaDisplayStyle,
} from "./modules/display-view.js";
import { shouldIgnoreNowPlayingSectionClick } from "./modules/now-playing-interactions.js";
import { createSearchController } from "./controllers/search-controller.js";
import { createSettingsCatalogController } from "./controllers/settings-catalog-controller.js";
import { createSettingsDiagnosticsController } from "./controllers/settings-diagnostics-controller.js";
import { createSettingsGeneralController } from "./controllers/settings-general-controller.js";
import { createAppRuntimeController } from "./controllers/app-runtime-controller.js";
import { createLibraryListInteractionsController } from "./controllers/library-list-interactions-controller.js";
import { createPanelInteractionsController } from "./controllers/panel-interactions-controller.js";
import { createPlaylistInteractionsController } from "./controllers/playlist-interactions-controller.js";
import { createSettingsLibraryController } from "./controllers/settings-library-controller.js";
import { createSettingsPlaylistController } from "./controllers/settings-playlist-controller.js";
import { createSettingsSearchAudioController } from "./controllers/settings-search-audio-controller.js";
import { createSettingsShellController } from "./controllers/settings-shell-controller.js";
import { createPlaybackCompressionController } from "./controllers/playback-compression-controller.js";
import { createPlaylistRuntimeController } from "./controllers/playlist-runtime-controller.js";
import {
  computeTapTempoBpm,
  formatTrackEditorBpm,
  trackEditorDraftDiffers,
  type TrackEditorDraft,
} from "./modules/track-editor-view.js";
import {
  buildClipboardTandaFilterText,
  normalizeClipboardFilter,
} from "./modules/clipboard-view.js";
import {
  matchesPlaylistFilter,
  resetPlaylistLastTandaState,
  resetPlaylistToggleState,
  resolvePlaylistWindowMs,
} from "./modules/playlist-view.js";
import {
  activateSettingsTab,
  pulseSettingsSection,
  resolveOutputModeValue,
  scrollSettingsContentTo,
} from "./modules/settings-view.js";
import {
  deriveLibraryWorkflow,
  getLibraryWorkflowGuidanceKey,
  resolveLibraryWorkflowExpandedStep,
  type LibraryWorkflowReadiness,
  type LibraryWorkflowStepKey,
} from "./modules/library-workflow.js";
import { pulseStyleFamilyEditFields } from "./modules/style-family-view.js";
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
const refreshStoredMetadataBtn =
  document.querySelector<HTMLButtonElement>("#refresh-stored-metadata");
const refreshStoredMetadataResult =
  document.querySelector<HTMLDivElement>("#refresh-stored-metadata-result");
const startupFlowBtn =
  document.querySelector<HTMLButtonElement>("#startup-flow-button");
const startupFlowResult =
  document.querySelector<HTMLDivElement>("#startup-flow-result");
const startupFlowPhaseItems = Array.from(
  document.querySelectorAll<HTMLElement>("#startup-flow-phases .startup-flow-phase"),
);
const startupFlowPhaseDetail =
  document.querySelector<HTMLDivElement>("#startup-flow-phase-detail");
const startupFlowProgressLabel =
  document.querySelector<HTMLDivElement>("#startup-flow-progress-label");
const startupFlowEta =
  document.querySelector<HTMLDivElement>("#startup-flow-eta");
const startupFlowProgressEl =
  document.querySelector<HTMLProgressElement>("#startup-flow-progress");
const precomputeCompressedBtn =
  document.querySelector<HTMLButtonElement>("#precompute-compressed");
const verifyCachedFilesBtn =
  document.querySelector<HTMLButtonElement>("#verify-cached-files");
const clearCachedFilesBtn =
  document.querySelector<HTMLButtonElement>("#clear-cached-files");
const cacheVerifyResult =
  document.querySelector<HTMLDivElement>("#cache-verify-result");
const precomputeCompressedResult =
  document.querySelector<HTMLDivElement>("#precompute-compressed-result");
const precomputeProgressElSettings =
  document.querySelector<HTMLProgressElement>("#precompute-progress-settings");
const precomputeProgressLabelSettings =
  document.querySelector<HTMLDivElement>("#precompute-progress-label-settings");
const openDiagnosticsPrecompute =
  document.querySelector<HTMLButtonElement>("#open-diagnostics-precompute");
const precomputeCompressedShortcutBtn =
  document.querySelector<HTMLButtonElement>("#precompute-compressed-shortcut");
const derivedCachesSection = document.querySelector<HTMLElement>("#derived-caches-section");
const errorList = document.querySelector<HTMLUListElement>("#error-list");
const diagnosticsPathsEl =
  document.querySelector<HTMLDivElement>("#diagnostics-paths");
const diagnosticsFfmpegToolsPickBtn =
  document.querySelector<HTMLButtonElement>("#diagnostics-ffmpeg-tools-pick");
const diagnosticsFfmpegToolsClearBtn =
  document.querySelector<HTMLButtonElement>("#diagnostics-ffmpeg-tools-clear");
const diagnosticsFfmpegToolsResult =
  document.querySelector<HTMLDivElement>("#diagnostics-ffmpeg-tools-result");
const diagnosticsWaveformBtn =
  document.querySelector<HTMLButtonElement>("#diagnostics-waveform");
const diagnosticsWaveformResult =
  document.querySelector<HTMLDivElement>("#diagnostics-waveform-result");
const diagnosticsDataReadinessEl =
  document.querySelector<HTMLDivElement>("#diagnostics-data-readiness");
const diagnosticsTrackLengthIssuesEl =
  document.querySelector<HTMLDivElement>("#diagnostics-track-length-issues");
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
let confirmModalTitle: HTMLDivElement | null = null;
let confirmModalMessage: HTMLDivElement | null = null;
let confirmModalOk: HTMLButtonElement | null = null;
let confirmModalCancel: HTMLButtonElement | null = null;
let confirmModalResolve: ((value: boolean) => void) | null = null;
let releaseUpdatePromptShown = false;
let clipboardClearModalEl: HTMLDivElement | null = null;
let clipboardClearModalResolve:
  | ((value: { selectedIds: string[]; removeEmpty: boolean } | null) => void)
  | null = null;
let playlistClearModalEl: HTMLDivElement | null = null;
let playlistClearModalResolve:
  | ((value: "clear" | "autofill" | "generate" | null) => void)
  | null = null;
const progressEl = document.querySelector<HTMLProgressElement>("#scan-progress");
const progressLabel = document.querySelector<HTMLDivElement>("#progress-label");
const progressElSettings =
  document.querySelector<HTMLProgressElement>("#scan-progress-settings");
const progressLabelSettings =
  document.querySelector<HTMLDivElement>("#progress-label-settings");
const settingsPanel = document.querySelector<HTMLElement>("#settings-panel");
const audioSimilarityPage = document.querySelector<HTMLElement>("#audio-similarity-page");
const openAudioSimilarityBtn = document.querySelector<HTMLButtonElement>("#open-audio-similarity");
const closeAudioSimilarityBtn = document.querySelector<HTMLButtonElement>("#close-audio-similarity");
const generateAudioSimilarityBtn = document.querySelector<HTMLButtonElement>("#generate-audio-similarity");
const cancelAudioSimilarityBtn = document.querySelector<HTMLButtonElement>("#cancel-audio-similarity");
const audioSimilaritySearch = document.querySelector<HTMLInputElement>("#audio-similarity-search");
const audioSimilarityStatus = document.querySelector<HTMLElement>("#audio-similarity-status");
const audioSimilaritySummary = document.querySelector<HTMLElement>("#audio-similarity-summary");
const audioSimilarityGroups = document.querySelector<HTMLElement>("#audio-similarity-groups");
const settingsContent = document.querySelector<HTMLElement>(".settings-content");
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
const legacyImportResult =
  document.querySelector<HTMLDivElement>("#legacy-import-result");
const legacyReadinessButton =
  document.querySelector<HTMLButtonElement>("#legacy-readiness-button");
const legacyReadinessResult =
  document.querySelector<HTMLDivElement>("#legacy-readiness-result");
const libraryWorkflowGuidance =
  document.querySelector<HTMLDivElement>("#library-workflow-guidance");
const libraryWorkflowDetail =
  document.querySelector<HTMLDivElement>("#library-workflow-detail");
const libraryWorkflowEmptyDetail =
  document.querySelector<HTMLDivElement>(".library-workflow-detail-empty");
const libraryWorkflowShell =
  document.querySelector<HTMLDivElement>(".library-workflow-shell");
const libraryWorkflowSteps = Array.from(
  document.querySelectorAll<HTMLElement>("#library-workflow .library-workflow-step"),
);
const libraryWorkflowStepToggles = Array.from(
  document.querySelectorAll<HTMLButtonElement>(
    "#library-workflow .library-workflow-step-toggle",
  ),
);
const libraryWorkflowStepMarkers = Array.from(
  document.querySelectorAll<HTMLButtonElement>(
    "#library-workflow .library-workflow-step-marker[data-step-expand]",
  ),
);
const libraryWorkflowPanels = new Map<
  LibraryWorkflowStepKey,
  HTMLDivElement | null
>([
  [
    "roots",
    document.querySelector<HTMLDivElement>("#library-workflow-panel-roots"),
  ],
  [
    "legacy-styles",
    document.querySelector<HTMLDivElement>("#library-workflow-panel-legacy-styles"),
  ],
  [
    "legacy-import",
    document.querySelector<HTMLDivElement>("#library-workflow-panel-legacy-import"),
  ],
  [
    "analysis",
    document.querySelector<HTMLDivElement>("#library-workflow-panel-analysis"),
  ],
  [
    "verify",
    document.querySelector<HTMLDivElement>("#library-workflow-panel-verify"),
  ],
]);
const libraryRootsSection =
  document.querySelector<HTMLDivElement>("#library-roots-section");
const libraryRootsDoneButton =
  document.querySelector<HTMLButtonElement>("#library-roots-done");
const styleFamiliesSection =
  document.querySelector<HTMLDivElement>("#style-families-section");
const legacyStyleReviewSection =
  document.querySelector<HTMLDivElement>("#legacy-style-review-section");
const libraryLegacyImportSection =
  document.querySelector<HTMLDivElement>("#library-legacy-import-section");
const libraryStartupFlowSection =
  document.querySelector<HTMLDivElement>("#library-startup-flow-section");
const libraryVerifySection =
  document.querySelector<HTMLDivElement>("#library-verify-section");
const libraryScanSection =
  document.querySelector<HTMLDivElement>("#library-scan-section");
const legacyStylesButton =
  document.querySelector<HTMLButtonElement>("#legacy-styles-button");
const legacyStylesResult =
  document.querySelector<HTMLDivElement>("#legacy-styles-result");
const legacyStyleReviewDoneButton =
  document.querySelector<HTMLButtonElement>("#legacy-style-review-done");
const legacyStyleTools =
  document.querySelector<HTMLDivElement>("#legacy-style-tools");
const legacyStyleMappingEl =
  document.querySelector<HTMLDivElement>("#legacy-style-mapping");
const legacyStyleMappingBody =
  document.querySelector<HTMLTableSectionElement>("#legacy-style-mapping-body");
const exportSystemBtn =
  document.querySelector<HTMLButtonElement>("#export-system-data");
const importSystemBtn =
  document.querySelector<HTMLButtonElement>("#import-system-data");
const systemTransferResult =
  document.querySelector<HTMLDivElement>("#system-transfer-result");
const systemTransferProgress =
  document.querySelector<HTMLDivElement>("#system-transfer-progress");
const exportTandasBtn =
  document.querySelector<HTMLButtonElement>("#export-tandas-data");
const tandaExportResult =
  document.querySelector<HTMLDivElement>("#tanda-export-result");
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
const undeleteTracksList = document.querySelector<HTMLDivElement>("#undelete-tracks-list");
const undeleteTracksButton = document.querySelector<HTMLButtonElement>("#undelete-tracks-button");
const undeleteTracksResult = document.querySelector<HTMLDivElement>("#undelete-tracks-result");
let ratingFilter: RatingFilter = { mode: "any", stars: 1 };
let clipboardRenderVersion = 0;
let tandaSearchVersion = 0;
const ratingModeKeys = {
  any: "ratingFilterAny", unrated: "ratingFilterUnrated", atLeast: "ratingFilterAtLeast",
  exactly: "ratingFilterExactly", atMost: "ratingFilterAtMost",
};
const renderRatingFilter = () => {
  const summary = document.querySelector<HTMLElement>("#rating-filter-summary");
  if (summary) {
    summary.textContent = ratingFilter.mode === "any" ? t("ratingFilterLabel") : t("ratingFilterActive", {
      comparison: t(ratingModeKeys[ratingFilter.mode]),
      stars: ratingFilter.mode === "unrated" ? "" : "★".repeat(ratingFilter.stars),
    });
  }
  const mode = document.querySelector<HTMLSelectElement>("#rating-filter-mode");
  if (mode) mode.value = ratingFilter.mode;
  document.querySelector("#rating-filter-clear")?.classList.toggle("hidden", ratingFilter.mode === "any");
  const stars = document.querySelector("#rating-filter-stars");
  if (stars) {
    stars.replaceChildren();
    for (let count = 1; count <= 5; count++) {
      const button = document.createElement("button");
      button.type = "button";
      const hasStars = ratingFilter.mode !== "any" && ratingFilter.mode !== "unrated";
      button.textContent = hasStars && count <= ratingFilter.stars ? "★" : "☆";
      button.setAttribute("aria-label", t("ratingFilterStarCount", { count }));
      button.setAttribute("aria-pressed", String(ratingFilter.mode !== "any" && ratingFilter.mode !== "unrated" && count === ratingFilter.stars));
      button.addEventListener("click", () => {
        setRatingFilter({ mode: ratingFilter.mode === "any" || ratingFilter.mode === "unrated" ? "atLeast" : ratingFilter.mode, stars: count });
        // Keep the popup open for keyboard users selecting another star.
        stars.querySelectorAll<HTMLButtonElement>("button")[count - 1]?.focus();
      });
      stars.appendChild(button);
    }
  }
};
const setRatingFilter = (next: RatingFilter) => {
  ratingFilter = normalizeRatingFilter(next);
  tandaSearchVersion += 1;
  renderRatingFilter();
  void Promise.all([refreshSearch(), renderClipboard()]).catch(() => {
    setStatus(t("ratingFilterFailed"));
  });
};
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
const playlistDuplicateFocusStatus =
  document.querySelector<HTMLDivElement>("#playlist-duplicate-focus-status");
const playlistDuplicateFocusClear =
  document.querySelector<HTMLButtonElement>("#playlist-duplicate-focus-clear");
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
const playlistStatsPurityEl =
  document.querySelector<HTMLDivElement>("#playlist-stats-purity");
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
const playlistSaveBtn =
  document.querySelector<HTMLButtonElement>("#playlist-save-button");
const playlistImportBtn =
  document.querySelector<HTMLButtonElement>("#playlist-import-button");
const playlistTransferResult =
  document.querySelector<HTMLDivElement>("#playlist-transfer-result");
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
const displayLagInput = document.querySelector<HTMLInputElement>("#display-av-lag");
const displayLagValue = document.querySelector<HTMLOutputElement>("#display-av-lag-value");
const displayLagCalibrateBtn = document.querySelector<HTMLButtonElement>("#display-av-lag-calibrate");
const displayLagModal = document.querySelector<HTMLElement>("#display-av-lag-modal");
const displayLagModalClose = document.querySelector<HTMLButtonElement>("#display-av-lag-modal-close");
const displayLagModalInput = document.querySelector<HTMLInputElement>("#display-av-lag-modal-input");
const displayLagModalValue = document.querySelector<HTMLOutputElement>("#display-av-lag-modal-value");
const displayLagToggle = document.querySelector<HTMLButtonElement>("#display-av-lag-toggle");
const displayLagStatus = document.querySelector<HTMLElement>("#display-av-lag-status");
const displayLagFlash = document.querySelector<HTMLElement>("#display-av-lag-flash");
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
const playlistLastTandaCountInput =
  document.querySelector<HTMLInputElement>("#playlist-last-tanda-count");
const playlistPerformanceStopToggle =
  document.querySelector<HTMLInputElement>("#playlist-performance-stop");
const searchButton = document.querySelector<HTMLButtonElement>("#search-button");
const alertBanner = document.querySelector<HTMLDivElement>("#alert-banner");
const openLibrarySetupMain =
  document.querySelector<HTMLButtonElement>("#open-library-setup-main");
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
const trackEditorDeleteBtn =
  document.querySelector<HTMLButtonElement>("#track-editor-delete");
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
type TrackTandaUsage = import("../shared/types").TrackTandaUsage;

type TandaDetail = {
  id: string;
  name: string;
  styles: string[];
  rating: number;
  instrumental: boolean;
  total_duration_ms: number;
  slot_count: number;
  legacy_source_id?: string | null;
  legacy_source_path?: string | null;
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
  slot_count: number;
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
const DEFAULT_SEARCH_MIN_SCORE = 0.19;
const DEFAULT_SEARCH_BPM_RANGE = 5;
const CORTINA_SET_KEY = "tanda-cortina-set";
const DEFAULT_CORTINA_SET_ID = "__default__";
const CORTINA_DURATION_KEY = "tanda-cortina-duration";
const DEFAULT_CORTINA_DURATION = 40;
const DISPLAY_BACKGROUND_INTERVAL_KEY = "tanda-display-background-interval";
const DISPLAY_AV_LAG_KEY = "tanda-display-av-lag";
const DEFAULT_DISPLAY_BACKGROUND_INTERVAL_SEC = 20;
const DISPLAY_USE_IMAGES_KEY = "tanda-display-use-images";
const DISPLAY_IMAGE_DIM_KEY = "tanda-display-image-dim";
const DEFAULT_DISPLAY_IMAGE_DIM = 0.35;
const DISPLAY_FONT_SCALE_KEY = "tanda-display-font-scale";
const DEFAULT_DISPLAY_FONT_SCALE = 1.15;
const DISPLAY_CORTINA_FONT_SCALE_KEY = "tanda-display-cortina-font-scale";
const DEFAULT_DISPLAY_CORTINA_FONT_SCALE = 1;
const DISPLAY_EDGE_PADDING_KEY = "tanda-display-edge-padding-vmin";
const DEFAULT_DISPLAY_EDGE_PADDING_VMIN = 8;
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
const PLAYLIST_LAST_TANDA_COUNT_KEY = "tanda-playlist-current-last-count";
const PLAYLIST_PERFORMANCE_STOP_KEY = "tanda-playlist-performance-stop";
const PLAYLIST_END_TIME_KEY = "tanda-playlist-end-time";
const DEFAULT_PLAYLIST_LAST_TANDA_COUNT = 1;
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
let cortinaStopPromise: Promise<void> | null = null;
let cortinaAutoStopRevision = 0;
let cortinaActiveIndex: number | null = null;
let cortinaOverrideTrack: TrackRow | null = null;
const cortinaOverrideByIndex = new Map<number, TrackRow>();
let cortinaModalSetValue: string | null = null;
let cortinaSetsLoaded = false;
type CortinaDisplayPhase = "none" | "about" | "playing" | "after";
let cortinaDisplayPhase: CortinaDisplayPhase = "none";
let isMarkedLastFinalCortinaActive = false;
let isPerformanceStopFinalCortinaActive = false;
let isPausedForPerformanceStop = false;
let lastPausedPerformanceStopCortinaLabel: string | null = null;
let holdCortinaDisplayWhenIdle = false;
let holdPerformanceStopDisplayBlankWhenIdle = false;
let markedLastTandaRemainingCount: number | null = null;
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

const updateE2eRuntimeSnapshot = () => {
  const mainActive = playback.main.active;
  (
    window as Window & {
      __e2eRuntimeSnapshot?: {
        pausedForPerformanceStop: boolean;
        performanceStopCortinaLabel: string;
        playlistStatus: "idle" | "paused" | "playing";
        playlistStartDisabled: boolean;
        playlistStopDisabled: boolean;
        mainSourcePath: string;
        mainCurrentTime: number;
        mainPaused: boolean;
        mainEnded: boolean;
        mainIsCortinaPlayback: boolean;
        mainVolume: number;
        nowPlayingTrack: string;
        cortinaAllowFull: boolean;
        cortinaPlaying: boolean;
        configuredCortinaDuration: number;
        configuredStopFade: number;
      };
    }
  ).__e2eRuntimeSnapshot = {
    pausedForPerformanceStop: isPausedForPerformanceStop,
    performanceStopCortinaLabel: lastPausedPerformanceStopCortinaLabel ?? "",
    playlistStatus: playlistPlayback.status,
    playlistStartDisabled: Boolean(playlistStartBtn?.disabled),
    playlistStopDisabled: Boolean(playlistStopBtn?.disabled),
    mainSourcePath: playback.main.activeSourcePath ?? "",
    mainCurrentTime: mainActive?.currentTime ?? 0,
    mainPaused: mainActive?.paused ?? true,
    mainEnded: mainActive?.ended ?? false,
    mainIsCortinaPlayback: Boolean(playback.main.isCortinaPlayback),
    mainVolume: mainActive ? getAudioLevel(mainActive) : 0,
    nowPlayingTrack: nowPlayingTrack?.textContent?.trim().toLowerCase() ?? "",
    cortinaAllowFull,
    cortinaPlaying,
    configuredCortinaDuration: getCortinaDuration(),
    configuredStopFade: getStopFadeSeconds(),
  };
};
let pendingCortinaTargetIndex: number | null = null;
const pulsePlaylistIndices = new Set<number>();
const pulseCortinaIndices = new Set<number>();
const pulseClipboardTrackIds = new Set<string>();
const pulseClipboardTandaIds = new Set<string>();
let legacyImportRootPath: string | null = null;
let libraryWorkflowRoots: LibraryRoot[] = [];
let libraryWorkflowLegacyStylesReviewed = false;
let libraryWorkflowLegacyImported = false;
let libraryWorkflowAnalysisCompleted = false;
let libraryWorkflowReadiness: LibraryWorkflowReadiness = "idle";
let libraryWorkflowExpandedStep: LibraryWorkflowStepKey | null = null;
let libraryWorkflowExpandedStepTouched = false;
let libraryWorkflowInitialExpansionApplied = false;
let tandaEditorReturnTab: RightPanelTab | null = null;

let selectedClipboardTrackId: string | null = null;
let selectedClipboardTandaId: string | null = null;
let selectedStyles: string[] = [];
let availableStyles: string[] = [];
let styleDefinitions: Array<{ name: string; aliases: string[] }> = [];
let styleFamilies: StyleFamily[] = [];
let familyStyleIndex = new Map<string, string[]>();
let legacyStyleMappings: LegacyStyleMappingState = {};
let legacyStyleRows: Array<{
  value: string;
  normalized: string;
  count: number;
  mappedTo: string;
}> = [];
let libraryWorkflowPanelsMounted = false;
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
const READ_ONLY_CLIPBOARD_COLLECTION_IDS = [
  CLIPBOARD_NEW_ID,
  CLIPBOARD_TOP_ID,
  CLIPBOARD_LEAST_ID,
  CLIPBOARD_AVAILABLE_ID,
] as const;
const DEFAULT_NEW_LIMIT = 100;
const SMART_COLLECTION_LIMIT = 100;
const PLAY_COUNTS_KEY = "tanda-play-counts";
const PLAYLIST_ARTIST_REPEAT_GAP_MIN_KEY = "tanda-playlist-artist-repeat-gap-min";
const DEFAULT_PLAYLIST_ARTIST_REPEAT_GAP_MIN = 30;
const STYLE_FAMILIES_KEY = "tanda-style-families";
const LEGACY_STYLE_MAPPINGS_KEY = "tanda-legacy-style-mappings-v1";
const STYLE_VARIANT_LONG_PRESS_MS = 1000;
const ORCHESTRA_REGISTRY_KEY = "tanda-orchestra-registry-v1";
const CORTINA_ANY_ID = "__any__";
const TANDA_SEARCH_SIZE_KEY = "tanda-search-size";

legacyStyleMappings = parseLegacyStyleMappingState(
  localStorage.getItem(LEGACY_STYLE_MAPPINGS_KEY),
);

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
  masterTandaId?: string | null;
  playlistUnsaved?: boolean;
  autoGenerated?: boolean;
  legacySourcePath?: string | null;
};

let tandaDrafts: TandaDraft[] = [];
const tandaCache = new Map<string, TandaDraft>();
let selectedTandaId: string | null = null;
let clipboardTandas: TandaDraft[] = [];
let tandaSearchResults: TandaSearchRow[] = [];

let activeRightTab: RightPanelTab = "playlist-tab";
let activeSearchTab: SearchTab = "search-tracks";
let playlistFilterText = "";
let playlistFilterOrchestra: string | null = null;
let playlistFilterTandaIds: Set<string> | null = null;
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
  compressionTailAutoResetApplied?: boolean;
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
const playableSourceCache = new Map<string, string>();
const playableSourceRequests = new Map<string, Promise<string | null>>();
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
let searchDiversityRenderInFlight = false;
let systemBackupStatus: SystemBackupStatus = { state: "idle", path: "" };

type TrackEditorState = {
  track: TrackRow | null;
  baselineDraft: TrackEditorDraft | null;
  taps: number[];
  tapTimeoutId: number | null;
};

const trackEditorState: TrackEditorState = {
  track: null,
  baselineDraft: null,
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

const DEFAULT_PLAYLIST_SEQUENCE = "3t 3t 3w 3t 3t 3m";
const DEFAULT_STYLE_FAMILIES =
  "T=Tango:Traditional, Contemporary, Alternative, Electro\nW=Waltz:Traditional, Contemporary, Alternative, Electro\nM=Milonga:Traditional, Contemporary, Alternative, Electro\nO=Other";
const DEFAULT_PLAYLIST_START_TIME = "20:00";
const getLanguage = () =>
  (localStorage.getItem("tanda-language") as LanguageKey) || "en";
let appVersion = "—";

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
    element.textContent =
      key === "appSubtitle" ? t(key, { version: appVersion }) : t(key);
  });
  document
    .querySelectorAll<HTMLButtonElement>(".track-editor-search-field")
    .forEach((button) => {
      const label = t("actionSearch");
      button.title = label;
      button.setAttribute("aria-label", label);
    });
  renderRatingFilter();
  renderLanguageOptions();
  updateSortButtons();
  updateNowPlayingDisplay();
  renderLibraryWorkflow();
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

const setMainCompressionDepthPercent = (depthPercent: number) => {
  const clamped = Math.min(100, Math.max(0, Math.round(depthPercent)));
  localStorage.setItem(AUDIO_DYNAMICS_DEPTH_KEY, clamped.toString());
  if (nowPlayingDynamicsMixInput) {
    nowPlayingDynamicsMixInput.value = clamped.toString();
  }
  if (nowPlayingDynamicsMixValue) {
    nowPlayingDynamicsMixValue.textContent = `${clamped}%`;
  }
  renderNowPlayingDynamicsControl();
  if (clamped > 0) {
    scheduleCompressionPrefetch();
  }
  void syncDynamicsRuntimeForActivePlayback();
};

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

const renderTrackEditorPathHints = (
  track: TrackRow,
  compressionEnabled: boolean,
  compressedPath: string | null,
) => {
  if (!trackEditorPathHint && !trackEditorCompressedPathHint) {
    return;
  }
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
};

const refreshTrackEditorCompressedPath = async (track: TrackRow) => {
  const config = getAudioDynamicsConfig();
  const compressionEnabled = config.enabled;
  renderTrackEditorPathHints(track, compressionEnabled, resolveCompressedPathForTrack(track));
  if (!compressionEnabled || !window.tanda) {
    return;
  }
  const result = await window.tanda.getCompressedTrackPath({
    trackId: track.id,
    filePath: track.full_path,
    loudnessDb: track.loudness_db,
    depthPercent: 100,
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
  if (trackEditorState.track?.id !== track.id) {
    return;
  }
  const compressedPath = result?.ok ? result.filePath?.trim() || null : null;
  renderTrackEditorPathHints(track, compressionEnabled, compressedPath);
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
      logPlaybackDiagnostic({
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
    if (trackEditorState.track?.id === track.id) {
      renderTrackEditorPathHints(track, getAudioDynamicsConfig().enabled, result.filePath);
    }
    return result.filePath;
  })();
  compressedSourceRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    compressedSourceRequests.delete(requestKey);
  }
};

const buildPlayableSourceRequestKey = (
  track: TrackRow | null,
  originalPath: string,
) => `${track?.id ?? "path"}:${originalPath}`;

const requestPlayableSource = async (
  track: TrackRow | null,
  originalPath: string,
) => {
  if (!window.tanda) {
    return null;
  }
  const requestKey = buildPlayableSourceRequestKey(track, originalPath);
  const cached = playableSourceCache.get(requestKey);
  if (cached) {
    return cached;
  }
  const pending = playableSourceRequests.get(requestKey);
  if (pending) {
    return pending;
  }
  const request = (async () => {
    const result = await window.tanda!.renderPlayableTrack({
      trackId: track?.id,
      filePath: originalPath,
    });
    if (!result?.ok || !result.filePath) {
      const reason = result?.error?.trim() || "unknown playable render error";
      logPlaybackDiagnostic({
        channel: "main",
        mode: appMode,
        trackId: track?.id ?? "",
        title: track?.title ?? "",
        artist: track?.artist ?? "",
        playlistStatus: playlistPlayback.status,
        playlistIndex: playlistPlayback.currentIndex,
        trackIndex: playlistPlayback.currentTrackIndex,
        gainSource: "none",
        gainDb: track?.gain_db ?? null,
        loudnessDb: track?.loudness_db ?? null,
        linearGain: 1,
        correctionDb: 0,
        driftDb: 0,
        targetLoudnessDb: -16,
        expectedOutputLoudnessDb: null,
        outputRouteMethod: "playable-render",
        outputRouteError: reason,
        attemptedOutputDeviceIds: [],
      });
      return null;
    }
    playableSourceCache.set(requestKey, result.filePath);
    return result.filePath;
  })();
  playableSourceRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    playableSourceRequests.delete(requestKey);
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

const shouldUseAudioDspForOutput = (
  channel: OutputChannel,
  requestedOutputDeviceId: string | null,
) => isDynamicsAvailableForChannel(channel, requestedOutputDeviceId);

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
  trackEditorState.baselineDraft = null;
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

const getTrackEditorDraftPayload = (): TrackEditorDraft | null => {
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
  const original = trackEditorState.baselineDraft;
  const draft = getTrackEditorDraftPayload();
  return trackEditorDraftDiffers(original, draft);
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
  trackEditorBpmInput.value = formatTrackEditorBpm(track.bpm);
  trackEditorState.baselineDraft = getTrackEditorDraftPayload();
  renderTrackEditorPathHints(
    track,
    getAudioDynamicsConfig().enabled,
    resolveCompressedPathForTrack(track),
  );
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
  void refreshTrackEditorCompressedPath(track);
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
  formatSequenceRule(rule);

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
    return Math.max(0, durationMs + gaps);
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
      Math.max(0, trackDurationsMs.reduce((total, value) => total + value, 0) + gaps);
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
  parseSettingNumber("tanda-gap-between-tracks", 2, -30, 30);
const getGapBeforeTanda = () =>
  parseSettingNumber("tanda-gap-before-tanda", 4, -30, 30);
const getGapBeforeCortina = () =>
  parseSettingNumber("tanda-gap-before-cortina", 1, -30, 30);
const getStopFadeSeconds = () =>
  parseSettingNumber("tanda-stop-fade", 2, 0, 30);
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
  state.compressionTailAutoResetApplied = undefined;
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
const isCurrentTandaMarkedPerformanceStop = () =>
  localStorage.getItem(PLAYLIST_PERFORMANCE_STOP_KEY) === "1";
const getPlaylistLastTandaCount = () =>
  clampLastTandaOffset(
    Number.parseInt(
      localStorage.getItem(PLAYLIST_LAST_TANDA_COUNT_KEY) ??
        DEFAULT_PLAYLIST_LAST_TANDA_COUNT.toString(),
      10,
    ),
  );
const syncMarkedLastTandaRemainingCount = () => {
  markedLastTandaRemainingCount = isCurrentTandaMarkedLast()
    ? resolveLastTandaRemainingCount(getPlaylistLastTandaCount())
    : null;
};
const getMarkedLastTandaRemainingCount = () =>
  isCurrentTandaMarkedLast()
    ? (markedLastTandaRemainingCount ?? resolveLastTandaRemainingCount(getPlaylistLastTandaCount()))
    : null;
const isCurrentTandaFinalLastCountdown = () =>
  shouldStopAfterMarkedLastTanda("tanda", getMarkedLastTandaRemainingCount());

const isMainPlaybackActive = () => Boolean(playback.main.active && !playback.main.active.paused);

const resolveFirstPlayablePlaylistPosition = (startIndex: number) => {
  for (let itemIndex = Math.max(0, startIndex); itemIndex < playlistItems.length; itemIndex += 1) {
    const item = playlistItems[itemIndex];
    if (!item) {
      continue;
    }
    const tracks = resolvePlaylistTracks(item);
    if (tracks.length === 0) {
      continue;
    }
    return {
      itemIndex,
      trackIndex: 0,
      trackId: tracks[0].id,
    };
  }
  return null;
};
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

const resolveDisplayBoardPlayingState = () =>
  getDisplayBoardPlayingStateView({
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
    isMarkedLast: isCurrentTandaFinalLastCountdown(),
    isFinalCortinaPhase:
      isMarkedLastFinalCortinaActive &&
      (cortinaDisplayPhase !== "none" || holdCortinaDisplayWhenIdle),
    useCurrentIndexAsNext: cortinaDisplayPhase !== "none",
    playbackStatus: playlistPlayback.status,
    resumeItemIndex: playlistPlayback.resume?.itemIndex ?? null,
    currentIndex: playlistPlayback.currentIndex,
    playlistItems: getDisplayPlaylistItems(),
    resolveTandaStyle: (tandaId) => {
      const tanda = resolveTandaDraft(tandaId);
      if (!tanda) {
        return null;
      }
      return resolveTandaDisplayStyle({
        trackStyles: tanda.trackSlots.map((trackId) =>
          trackId ? trackCache.get(trackId)?.genre : null,
        ),
        tandaStyles: tanda.styles,
      });
    },
    shouldShowDisplayNextTanda: (status) => shouldShowDisplayNextTanda(status),
  });

const getNextTandaArtistSummary = () => {
  if (!shouldShowDisplayNextTanda(playlistPlayback.status)) {
    return "";
  }
  let startIndex = 0;
  if (playlistPlayback.status === "playing") {
    startIndex = cortinaDisplayPhase !== "none"
      ? playlistPlayback.currentIndex
      : playlistPlayback.currentIndex + 1;
  } else if (playlistPlayback.status === "paused" && playlistPlayback.resume) {
    startIndex = playlistPlayback.resume.itemIndex;
  }
  for (let i = Math.max(0, startIndex); i < playlistItems.length; i += 1) {
    const item = playlistItems[i];
    if (!item || item.kind !== "tanda") {
      continue;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      continue;
    }
    const normalizedArtists = Array.from(
      new Set(
        tanda.trackSlots
          .filter(Boolean)
          .map((trackId) => trackCache.get(trackId ?? "") ?? null)
          .filter((track): track is TrackRow => Boolean(track))
          .map((track) => summarizeTrackArtist(track))
          .filter((artist) => artist.length > 0),
      ),
    );
    if (normalizedArtists.length === 0) {
      return t("tandaUnknownArtist");
    }
    if (normalizedArtists.length === 1) {
      return normalizedArtists[0] ?? "";
    }
    return t("displayVariousArtists");
  }
  return "";
};

const getDisplayTrackArtist = (track: TrackRow) =>
  summarizeTrackArtist(track) || t("tandaUnknownArtist");

const getDisplayTrackSinger = (track: TrackRow) => {
  const singer = track.singer?.trim() ?? "";
  if (!singer) {
    return "";
  }
  return t("displaySinger", { singer });
};

const shouldSuppressPerformanceStopDisplayText = () => {
  if (!isCurrentTandaMarkedPerformanceStop()) {
    return false;
  }
  if (holdPerformanceStopDisplayBlankWhenIdle && holdCortinaDisplayWhenIdle && !isMainPlaybackActive()) {
    return true;
  }
  if (
    isPerformanceStopFinalCortinaActive &&
    (cortinaDisplayPhase !== "none" || holdCortinaDisplayWhenIdle)
  ) {
    return true;
  }
  if (playlistPlayback.status !== "playing") {
    return false;
  }
  const activeItem = playlistItems[playlistPlayback.currentIndex];
  return Boolean(activeItem && activeItem.kind === "tanda" && cortinaDisplayPhase === "none");
};

const isFinalCortinaForMarkedLast = (isMarkedLast: boolean, nextStyle: string) =>
  isMarkedLast &&
  isMarkedLastFinalCortinaActive &&
  (cortinaDisplayPhase !== "none" || holdCortinaDisplayWhenIdle) &&
  !nextStyle;

const getNextTandaLabel = () =>
  (() => {
    if (shouldSuppressPerformanceStopDisplayText()) {
      return "";
    }
    const nextStyle = getNextTandaStyle();
    const nextArtist = getNextTandaArtistSummary();
    const isMarkedLast = isCurrentTandaFinalLastCountdown();
    const activeItem = playlistItems[playlistPlayback.currentIndex];
    const forceLastLabel =
      isMarkedLast &&
      !isMarkedLastFinalCortinaActive &&
      playlistPlayback.status === "playing" &&
      !!activeItem &&
      activeItem.kind === "tanda";
    return resolveNextTandaLabel({
      isMarkedLast: isFinalCortinaForMarkedLast(isMarkedLast, nextStyle),
      nextStyle,
      nextArtist,
      forceLastLabel,
      translateLast: () => t("displayThisIsLastTanda"),
      useCurrentLabel: cortinaDisplayPhase !== "none" || holdCortinaDisplayWhenIdle,
      translateCurrent: (style) => t("displayNowTanda", { style, artist: nextArtist }),
      translateNext: (style, artist) => t("displayNextTanda", { style, artist }),
    });
  })();

const getLastTandaCountdownLabel = () => {
  if (!isCurrentTandaMarkedLast() || playlistPlayback.status !== "playing") {
    return "";
  }
  const activeItem = playlistItems[playlistPlayback.currentIndex];
  if (!activeItem || activeItem.kind !== "tanda" || cortinaDisplayPhase !== "none") {
    return "";
  }
  return resolveLastTandaCountdownText({
    remainingTandas: getMarkedLastTandaRemainingCount(),
    translateCount: (count) => t(`displayLastTandas${count}`),
  });
};

const updateExternalDisplay = () => {
  if (!window.tanda?.updateDisplay) {
    return;
  }
  const setE2eDisplaySnapshot = (payload: DisplayUpdatePayload) => {
    (
      window as Window & {
        __e2eDisplaySnapshot?: DisplayUpdatePayload;
      }
    ).__e2eDisplaySnapshot = payload;
  };
  const nextStyle = getNextTandaStyle();
  const nextArtist = getNextTandaArtistSummary();
  const isMarkedLast = isCurrentTandaMarkedLast();
  const showFinalCortinaMessage = isFinalCortinaForMarkedLast(isMarkedLast, nextStyle);
  const suppressPerformanceStopText = shouldSuppressPerformanceStopDisplayText();
  const cortinaHeadline = showFinalCortinaMessage
    ? t("displayNoMoreTandas")
    : t("cortinaRowLabel");
  const cortinaSubline = showFinalCortinaMessage || suppressPerformanceStopText
    ? ""
    : nextStyle
      ? t("displayNowTanda", { style: nextStyle, artist: nextArtist })
      : "";
  if (cortinaDisplayPhase !== "none") {
    holdCortinaDisplayWhenIdle = true;
    const payload: DisplayUpdatePayload = {
      title: cortinaHeadline,
      artist: cortinaSubline,
      singer: "",
      progressText: "",
      nextTandaHintText: "",
      nextTandaText: "",
      backgroundIntervalSec: getDisplayBackgroundIntervalSec(),
      useBackgroundImages: getDisplayUseBackgroundImages(),
      imageDimOpacity: getDisplayImageDimOpacity(),
      fontScale: getDisplayFontScale(),
      cortinaFontScale: getDisplayCortinaFontScale(),
      edgePaddingVmin: getDisplayEdgePaddingVmin(),
      mode: "cortina",
    };
    setE2eDisplaySnapshot(payload);
    const signature = JSON.stringify(payload);
    if (signature === lastDisplayPayloadSignature) {
      return;
    }
    lastDisplayPayloadSignature = signature;
    displayLagScheduler.schedule(payload);
    return;
  }
  const active = resolveDisplayBoardPlayingState();
  if (!active) {
    if (holdCortinaDisplayWhenIdle) {
      const payload: DisplayUpdatePayload = {
        title: cortinaHeadline,
        artist: cortinaSubline,
        singer: "",
        progressText: "",
        nextTandaHintText: "",
        nextTandaText: "",
        backgroundIntervalSec: getDisplayBackgroundIntervalSec(),
        useBackgroundImages: getDisplayUseBackgroundImages(),
        imageDimOpacity: getDisplayImageDimOpacity(),
        fontScale: getDisplayFontScale(),
        cortinaFontScale: getDisplayCortinaFontScale(),
        edgePaddingVmin: getDisplayEdgePaddingVmin(),
        mode: "cortina",
      };
      setE2eDisplaySnapshot(payload);
      const signature = JSON.stringify(payload);
      if (signature === lastDisplayPayloadSignature) {
        return;
      }
      lastDisplayPayloadSignature = signature;
      displayLagScheduler.schedule(payload);
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
    setE2eDisplaySnapshot(payload);
    const signature = JSON.stringify(payload);
    if (signature === lastDisplayPayloadSignature) {
      return;
    }
    lastDisplayPayloadSignature = signature;
    displayLagScheduler.schedule(payload);
    return;
  }
  const track = active?.state.track ?? null;
  if (!track) {
    return;
  }
  holdCortinaDisplayWhenIdle = false;
  const title = track?.title?.trim() || t("nowPlayingUnknown");
  const artist = getDisplayTrackArtist(track);
  const singer = getDisplayTrackSinger(track);
  const payload: DisplayUpdatePayload = {
    title,
    artist,
    singer,
    progressText: getCurrentProgressText(),
    nextTandaHintText: getLastTandaCountdownLabel(),
    nextTandaText: getNextTandaLabel(),
    backgroundIntervalSec: getDisplayBackgroundIntervalSec(),
    useBackgroundImages: getDisplayUseBackgroundImages(),
    imageDimOpacity: getDisplayImageDimOpacity(),
    fontScale: getDisplayFontScale(),
    cortinaFontScale: getDisplayCortinaFontScale(),
    edgePaddingVmin: getDisplayEdgePaddingVmin(),
    mode: "normal",
  };
  setE2eDisplaySnapshot(payload);
  const signature = JSON.stringify(payload);
  if (signature === lastDisplayPayloadSignature) {
    return;
  }
  lastDisplayPayloadSignature = signature;
  displayLagScheduler.schedule(payload);
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
    updatePlaylistControls();
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
  updatePlaylistControls();
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
    const hostedPlaylistItem = playlistOpenTandaIndex !== null
      ? playlistItems[playlistOpenTandaIndex]
      : null;
    const isHostedPlaylistDraft =
      tandaEditorHostTab === "playlist-tab" &&
      hostedPlaylistItem?.kind === "tanda" &&
      hostedPlaylistItem.tandaId === tanda.id;
    const wasPlaylistVariant =
      tanda.playlistUnsaved === true &&
      (tanda.origin === "playlist" || isHostedPlaylistDraft);
    const existingId = wasPlaylistVariant ? tanda.masterTandaId ?? tanda.id : tanda.id;
    const [persistedMaster] = await window.tanda.getTandasByIds([existingId]);
    let savedId = existingId;
    if (persistedMaster && !tandaContentsMatch(tanda, {
      name: persistedMaster.name,
      styles: persistedMaster.styles,
      rating: persistedMaster.rating,
      trackSlots: persistedMaster.track_slots,
    })) {
      const choice = await showTandaSaveChoiceModal();
      if (!choice) return;
      if (choice === "new") savedId = crypto.randomUUID();
    }
    const saved = await window.tanda.saveTanda({
      id: savedId,
      name: tanda.name,
      styles: tanda.styles,
      rating: tanda.rating,
      instrumental,
      total_duration_ms: totalDurationMs,
      track_slots: tanda.trackSlots,
    });
    invalidateTrackTandaUsage();
    upsertTandaCache(saved);
    if (wasPlaylistVariant) {
      playlistItems = playlistItems.map((item) =>
        item?.kind === "tanda" && item.tandaId === tanda.id
          ? { ...item, tandaId: saved.id }
          : item,
      );
      if (isHostedPlaylistDraft && playlistOpenTandaIndex !== null) {
        const current = playlistItems[playlistOpenTandaIndex];
        if (current?.kind === "tanda") {
          playlistItems[playlistOpenTandaIndex] = {
            ...current,
            tandaId: saved.id,
          };
        }
      }
      if (tanda.id !== saved.id) {
        tandaCache.delete(tanda.id);
      }
    }
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
    const savedTandaId = getSavedTandaId(tanda);
    if (wasPlaylistHosted) {
      const choice = await showPlaylistTandaDeleteModal(savedTandaId !== null);
      if (!choice) return;
      if (choice === "remove") {
        const openIndex = playlistOpenTandaIndex;
        if (openIndex !== null && playlistItems[openIndex]?.kind === "tanda") {
          playlistItems[openIndex] = null;
          normalizePlaylist();
          clearPlaylistTarget();
        }
        if (tanda.playlistUnsaved) {
          tandaCache.delete(tanda.id);
          tandaDrafts = tandaDrafts.filter((item) => item.id !== tanda.id);
        }
        clearPlaylistOpenTanda();
        activateRightTab("playlist-tab");
        setStatus(t("statusTandaRemovedFromPlaylist"));
        renderTandaDesigner();
        renderPlaylist();
        return;
      }
    } else {
      const confirmed = await showConfirmModal(t("confirmDeleteTanda"));
      if (!confirmed) return;
    }
    const databaseTandaId = savedTandaId ?? tandaId;
    if (window.tanda && savedTandaId) {
      await window.tanda.deleteTanda(databaseTandaId);
      invalidateTrackTandaUsage();
    }
    const removedFromPlaylist = playlistItems.reduce((count, item, index) => {
      if (item?.kind !== "tanda") {
        return count;
      }
      if (!belongsToSavedTanda(resolveTandaDraft(item.tandaId), item.tandaId, databaseTandaId)) {
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
      collection.tandaIds = collection.tandaIds.filter((id) => id !== databaseTandaId);
    });
    if (selectedClipboardTandaId === databaseTandaId) {
      selectedClipboardTandaId = null;
    }
    saveClipboardCollections();
    tandaCache.delete(databaseTandaId);
    tandaCache.delete(tandaId);
    tandaDrafts = tandaDrafts.filter((item) =>
      item.id !== tandaId && item.id !== databaseTandaId && item.masterTandaId !== databaseTandaId
    );
    if (selectedTandaId === tandaId || selectedTandaId === databaseTandaId) {
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
  if (durationMs <= 0) {
    setAudioLevel(from, 0);
    from.pause();
    from.currentTime = 0;
    void releaseAudioDspRuntime(from);
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
  const rawLabel =
    channel === "main"
      ? localStorage.getItem("tanda-main-output-label")
      : localStorage.getItem("tanda-headphone-output-label");
  const rawGroup =
    channel === "main"
      ? localStorage.getItem("tanda-main-output-group")
      : localStorage.getItem("tanda-headphone-output-group");
  const resolved = resolveRequestedOutputDeviceId(audioOutputs, {
    selectedId,
    storedId: rawId,
    storedLabel: rawLabel,
    storedGroup: rawGroup,
  });
  if (resolved) {
    persistOutputDeviceSelection(channel, resolved);
  }
  return resolved;
};

const getOutputChannelLabel = (channel: OutputChannel) =>
  channel === "headphone" ? t("nowPlayingHeadphone") : t("nowPlayingMain");

let calibrationAudio: HTMLAudioElement | null = null;
let calibrationAudioUrl: string | null = null;
const calibrationFlashTimers = new Set<number>();

const clearCalibrationFlashTimers = () => {
  calibrationFlashTimers.forEach((timer) => window.clearTimeout(timer));
  calibrationFlashTimers.clear();
  displayLagFlash?.classList.remove("active");
};

const pulseAvLagCalibration = () => {
  if (!calibrationAudio || !displayLagFlash) {
    return;
  }
  calibrationAudio.currentTime = 0;
  void calibrationAudio.play().catch(() => {
    if (displayLagStatus) {
      displayLagStatus.textContent = t("displayAvLagPlaybackError");
    }
  });
  const flashTimer = window.setTimeout(() => {
    calibrationFlashTimers.delete(flashTimer);
    displayLagFlash.classList.add("active");
    const offTimer = window.setTimeout(() => {
      calibrationFlashTimers.delete(offTimer);
      displayLagFlash.classList.remove("active");
    }, 140);
    calibrationFlashTimers.add(offTimer);
  }, getDisplayLagSeconds() * 1000);
  calibrationFlashTimers.add(flashTimer);
};

const avLagCalibrationLoop = createCalibrationPulseLoop(pulseAvLagCalibration);

const setAvLagCalibrationRunningUi = (running: boolean) => {
  if (displayLagToggle) {
    displayLagToggle.textContent = t(running ? "displayAvLagStop" : "displayAvLagStart");
    displayLagToggle.dataset.running = running ? "true" : "false";
  }
  if (displayLagStatus) {
    displayLagStatus.textContent = t(running ? "displayAvLagRunning" : "displayAvLagStopped");
  }
};

const stopAvLagCalibration = () => {
  avLagCalibrationLoop.stop();
  calibrationAudio?.pause();
  clearCalibrationFlashTimers();
  setAvLagCalibrationRunningUi(false);
};

const closeAvLagCalibration = () => {
  stopAvLagCalibration();
  displayLagModal?.classList.remove("open");
  displayLagModal?.setAttribute("aria-hidden", "true");
};

const openAvLagCalibration = () => {
  const value = getDisplayLagSeconds().toFixed(3);
  if (displayLagModalInput) {
    displayLagModalInput.value = value;
  }
  if (displayLagModalValue) {
    displayLagModalValue.value = value;
    displayLagModalValue.textContent = value;
  }
  setAvLagCalibrationRunningUi(false);
  displayLagModal?.classList.add("open");
  displayLagModal?.setAttribute("aria-hidden", "false");
};

const startAvLagCalibration = async () => {
  if (!calibrationAudio) {
    calibrationAudioUrl = URL.createObjectURL(createCalibrationClickWav());
    calibrationAudio = new Audio(calibrationAudioUrl);
    calibrationAudio.preload = "auto";
    calibrationAudio.load();
  }
  const requestedOutputDeviceId = resolveOutputDeviceIdForChannel("main");
  const routing = await applyOutputDevice(calibrationAudio, requestedOutputDeviceId);
  if (routing.method === "failed" || routing.method === "unsupported") {
    if (displayLagStatus) {
      displayLagStatus.textContent = t("displayAvLagRoutingError");
    }
    return;
  }
  if (calibrationAudio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise<void>((resolve, reject) => {
      let timeout = 0;
      const ready = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error("Calibration audio failed to load"));
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        calibrationAudio?.removeEventListener("loadeddata", ready);
        calibrationAudio?.removeEventListener("error", failed);
      };
      calibrationAudio?.addEventListener("loadeddata", ready, { once: true });
      calibrationAudio?.addEventListener("error", failed, { once: true });
      timeout = window.setTimeout(failed, 2000);
    }).catch(() => undefined);
  }
  if (calibrationAudio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    if (displayLagStatus) {
      displayLagStatus.textContent = t("displayAvLagPlaybackError");
    }
    return;
  }
  avLagCalibrationLoop.start();
  setAvLagCalibrationRunningUi(true);
};

const getOutputDeviceLabel = (deviceId: string | null) => {
  if (!deviceId || deviceId === DEFAULT_OUTPUT_ID) {
    return t("outputDefault");
  }
  return (
    audioOutputs.find((output) => output.deviceId === deviceId)?.label ??
    deviceId
  );
};

const getOutputDeviceById = (deviceId: string | null) => {
  if (!deviceId || deviceId === DEFAULT_OUTPUT_ID) {
    return null;
  }
  return audioOutputs.find((output) => output.deviceId === deviceId) ?? null;
};

const getOutputChannelStorageSnapshot = (channel: OutputChannel) => ({
  selectedOutputDeviceId:
    channel === "main"
      ? mainOutputSelect?.value ?? null
      : headphoneOutputSelect?.value ?? null,
  storedOutputDeviceId:
    channel === "main"
      ? localStorage.getItem("tanda-main-output")
      : localStorage.getItem("tanda-headphone-output"),
  storedOutputDeviceLabel:
    channel === "main"
      ? localStorage.getItem("tanda-main-output-label")
      : localStorage.getItem("tanda-headphone-output-label"),
  storedOutputDeviceGroup:
    channel === "main"
      ? localStorage.getItem("tanda-main-output-group")
      : localStorage.getItem("tanda-headphone-output-group"),
});

const buildOutputDiagnostics = (
  channel: OutputChannel,
  requestedDeviceId: string | null,
  appliedDeviceId: string | null,
) => {
  const snapshot = getOutputChannelStorageSnapshot(channel);
  const selectedDevice = getOutputDeviceById(snapshot.selectedOutputDeviceId);
  const requestedDevice = getOutputDeviceById(requestedDeviceId);
  const appliedDevice = getOutputDeviceById(appliedDeviceId);
  return {
    selectedOutputDeviceId: snapshot.selectedOutputDeviceId,
    selectedOutputDeviceLabel:
      snapshot.selectedOutputDeviceId === DEFAULT_OUTPUT_ID
        ? t("outputDefault")
        : selectedDevice?.label ?? null,
    selectedOutputDeviceGroup: selectedDevice?.groupId ?? null,
    storedOutputDeviceId: snapshot.storedOutputDeviceId,
    storedOutputDeviceLabel: snapshot.storedOutputDeviceLabel,
    storedOutputDeviceGroup: snapshot.storedOutputDeviceGroup,
    requestedOutputDeviceId: requestedDeviceId,
    requestedOutputDeviceLabel:
      requestedDeviceId === DEFAULT_OUTPUT_ID
        ? t("outputDefault")
        : requestedDevice?.label ?? null,
    requestedOutputDeviceGroup: requestedDevice?.groupId ?? null,
    appliedOutputDeviceId: appliedDeviceId,
    appliedOutputDeviceLabel:
      appliedDeviceId === DEFAULT_OUTPUT_ID
        ? t("outputDefault")
        : appliedDevice?.label ?? null,
    appliedOutputDeviceGroup: appliedDevice?.groupId ?? null,
    availableOutputDevices: audioOutputs.map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
      groupId: device.groupId,
    })),
  };
};

const logPlaybackDiagnostic = (
  payload: Parameters<
    NonNullable<typeof window.tanda>["logPlaybackDiagnostic"]
  >[0],
) => {
  const pending = window.tanda?.logPlaybackDiagnostic?.(payload);
  if (!pending) {
    return;
  }
  void pending.finally(() => {
    if (!diagnosticsPlaybackLogResult) {
      return;
    }
    void renderPlaybackDiagnosticsLog();
  });
};

const formatOutputRoutingFailure = (
  channel: OutputChannel,
  requestedDeviceId: string | null,
  error: string | null,
) =>
  t("outputRoutingFailedDetail", {
    channel: getOutputChannelLabel(channel),
    device: getOutputDeviceLabel(requestedDeviceId),
    message:
      error ??
      (channel === "headphone"
        ? "headphone routing unavailable"
        : "main output routing unavailable"),
  });

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
  transitionFadeMs?: number;
};

const notifyLighting = createLightingNotifier((input, init) => fetch(input, init));
const notifyLightingPlayback = createLightingPlaybackNotifier((input, init) => fetch(input, init));

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
  requestPlayableSource,
  setStatus: (message) => {
    if (statusEl) {
      statusEl.textContent = message;
    }
  },
  translate: t,
  requiresPlaybackTranscode,
  isCompressionRequestedForChannel: (channel, options) =>
    isCompressionRequestedForChannel(channel, options as PlayOptions | undefined),
  stopCompressedCompanion,
  ensureAudioDspRuntime,
  releaseAudioDspRuntime,
  applyOutputDevice,
  applyDynamicLevelToMain: () => applyDynamicLevelToChannel("main"),
  updateNowPlayingDisplay,
  resolveOutputDeviceIdForMain: () => resolveOutputDeviceIdForChannel("main"),
  shouldUseAudioDspForMainOutput: (deviceId) =>
    shouldUseAudioDspForOutput("main", deviceId),
  appMode: () => appMode,
  playlistState: () => ({
    status: playlistPlayback.status,
    index: playlistPlayback.currentIndex,
    trackIndex: playlistPlayback.currentTrackIndex,
  }),
  logPlaybackDiagnostic: (payload) =>
    logPlaybackDiagnostic(
      payload as Parameters<NonNullable<typeof window.tanda>["logPlaybackDiagnostic"]>[0],
    ),
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
  if (
    shouldResetCompressionMixForNewTrack({
      channel,
      previousTrackId: state.currentTrackId,
      nextTrackId: trackId,
    })
  ) {
    setMainCompressionDepthPercent(0);
  }
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
      if (channel === "main") notifyLighting(Boolean(options?.isCortinaPlayback));
      if (channel === "main") notifyLightingPlayback.start(
        state.active,
        state.originalSourcePath ?? filePath,
        options?.isCortinaPlayback ? "cortina" : "tango",
      );
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
    state.compressionTailAutoResetApplied = undefined;
    if (channel === "main") notifyLightingPlayback.stop();
    lastAppliedGainDbByChannel[channel] = null;
    updateNowPlayingDisplay();
    return false;
  }

  if (
    track &&
    shouldWarmCompressionInBackground({
      channel,
      fromPlaylist: options?.fromPlaylist === true,
      compressionRequested: isCompressionRequestedForChannel(channel, options),
    })
  ) {
    void requestCompressedSource(track, getAudioDynamicsConfig());
  }
  const source = await resolvePlaybackSource(channel, track, filePath, options);
  if (isStaleRequest()) {
    return false;
  }
  const requestedOutputDeviceId = resolveOutputDeviceIdForChannel(channel);
  const next = new Audio();
  next.loop = false;
  if (shouldUseAudioDspForOutput(channel, requestedOutputDeviceId)) {
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
    logPlaybackDiagnostic({
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
        ...buildOutputDiagnostics(
          channel,
          requestedOutputDeviceId,
          outputRouting.appliedDeviceId,
        ),
      outputRouteMethod: outputRouting.method,
      outputRouteError: outputRouting.error,
      attemptedOutputDeviceIds: [
        ...preAttachRouting.attemptedDeviceIds,
        ...postAttachRouting.attemptedDeviceIds,
      ],
    });
    setStatus(
      formatOutputRoutingFailure(
        channel,
        requestedOutputDeviceId,
        outputRouting.error,
      ),
    );
    return false;
  }
  logPlaybackDiagnostic({
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
    ...buildOutputDiagnostics(
      channel,
      requestedOutputDeviceId,
      outputRouting.appliedDeviceId,
    ),
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
    compressionTailAutoResetApplied: state.compressionTailAutoResetApplied,
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
  state.compressionTailAutoResetApplied = false;
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
      state.compressionTailAutoResetApplied =
        previousStateSnapshot.compressionTailAutoResetApplied;
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
    if (channel === "main" && options?.isCortinaPlayback && state.active === next) {
      notifyLighting(false);
    }
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
      state.compressionTailAutoResetApplied = undefined;
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
    if (channel === "main" && options?.isCortinaPlayback && state.active === next) {
      notifyLighting(false);
    }
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
    const autoStopCanBeCancelled =
      Boolean(options?.isCortinaPlayback) &&
      durationCutoffSeconds !== null &&
      (trimmedEndSeconds === null || durationCutoffSeconds <= trimmedEndSeconds + 0.001);
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
        const autoStopRevision = cortinaAutoStopRevision;
        const remainingMs = Math.max(
          0,
          (effectiveEndSeconds - next.currentTime) * 1000,
        );
        const shouldCancelAutoStop = () =>
          (autoStopCanBeCancelled && cortinaAllowFull) ||
          autoStopRevision !== cortinaAutoStopRevision;
        if (autoStopFadeMs > 0 || isTrimmedEarly) {
          const preferredFadeMs = autoStopFadeMs > 0 ? autoStopFadeMs : 140;
          const fadeMs = computeFadeDurationMs(preferredFadeMs, remainingMs);
          if (fadeMs > 0) {
            const completed = await fadeOutAudio(next, fadeMs, shouldCancelAutoStop);
            if (!completed) {
              trimHandled = false;
              setAudioLevel(next, targetVolume);
              updateNowPlayingDisplay();
              return;
            }
          }
        }
        if (shouldCancelAutoStop()) {
          trimHandled = false;
          setAudioLevel(next, targetVolume);
          updateNowPlayingDisplay();
          return;
        }
        setAudioLevel(next, 0);
        next.currentTime = effectiveEndSeconds ?? next.currentTime;
        next.pause();
        next.dispatchEvent(new Event("ended"));
      };
      void finalize();
      return;
    }
    if (
      channel === "main" &&
      !state.compressionTailAutoResetApplied &&
      shouldAutoResetCompressionMixNearEnd({
        enabled: localStorage.getItem(AUDIO_DYNAMICS_ENABLED_KEY) === "1",
        depthPercent: getAudioDynamicsDepthPercent(),
        currentTimeSeconds: next.currentTime ?? 0,
        startAtSeconds: startAt,
        effectiveEndSeconds,
        leadSeconds: COMPRESSION_TAIL_RESET_LEAD_SECONDS,
      })
    ) {
      state.compressionTailAutoResetApplied = true;
      setMainCompressionDepthPercent(0);
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
        state.compressionTailAutoResetApplied =
          previousStateSnapshot.compressionTailAutoResetApplied;
        updateNowPlayingDisplay();
      }
      return false;
    }
    if (channel === "main") notifyLighting(Boolean(options?.isCortinaPlayback));
    if (channel === "main") notifyLightingPlayback.start(
      next,
      state.originalSourcePath ?? filePath,
      options?.isCortinaPlayback ? "cortina" : "tango",
    );
    const transitionFadeMs =
      Number.isFinite(options?.transitionFadeMs) && (options?.transitionFadeMs ?? 0) > 0
        ? options?.transitionFadeMs ?? 0
        : 600;
    fadeBetween(previous, next, targetVolume, transitionFadeMs);
    if (previousCompressed) {
      if (transitionFadeMs <= 0) {
        previousCompressed.pause();
        previousCompressed.currentTime = 0;
        void releaseAudioDspRuntime(previousCompressed);
      } else {
        void fadeOutAudio(previousCompressed, transitionFadeMs).then(() => {
          previousCompressed.pause();
          previousCompressed.currentTime = 0;
          void releaseAudioDspRuntime(previousCompressed);
        });
      }
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
      state.compressionTailAutoResetApplied =
        previousStateSnapshot.compressionTailAutoResetApplied;
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
    if (!shouldPlayStandaloneTrackFromClick(appMode, isMainPlaybackActive())) {
      return false;
    }
    const confirmed = await showConfirmModal(
      t("confirmLivePerformanceTrackPlay", { title: track.title }),
      t("playNow"),
    );
    if (!confirmed) {
      return false;
    }
    cortinaDisplayPhase = "none";
    holdCortinaDisplayWhenIdle = false;
    isPerformanceStopFinalCortinaActive = false;
    holdPerformanceStopDisplayBlankWhenIdle = false;
    return playOnChannel(
      "main",
      data.filePath,
      data.trackId,
      track,
      data.gainDb,
      {
        ...options,
        allowToggle: false,
      },
    );
  }
  const started = await playOnChannel(
    "main",
    data.filePath,
    data.trackId,
    track,
    data.gainDb,
    {
      transitionFadeMs: options?.fromPlaylist ? options.transitionFadeMs : 0,
      ...options,
    },
  );
  if (started && (appMode === "edit" || isTrackEditorOpen())) {
    openTrackEditor(track.id);
  }
  return started;
};

const fadeOutAudio = async (
  audio: HTMLAudioElement,
  durationMs: number,
  shouldCancel?: () => boolean,
) => {
  const startVolume = getAudioLevel(audio);
  const start = performance.now();
  return new Promise<boolean>((resolve) => {
    const step = () => {
      if (shouldCancel?.()) {
        resolve(false);
        return;
      }
      const elapsed = performance.now() - start;
      const t = Math.min(1, durationMs > 0 ? elapsed / durationMs : 1);
      setAudioLevel(audio, Math.max(0, startVolume * (1 - t)));
      if (t >= 1) {
        resolve(true);
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
  if (channel === "main") notifyLightingPlayback.stop();
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
  state.compressionTailAutoResetApplied = undefined;
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
    (storedMain === DEFAULT_OUTPUT_ID || !hasStoredMain ? DEFAULT_OUTPUT_ID : null);
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

  if (mainId !== null) {
    if (mainId !== storedMain || !hasStoredMain) {
      persistOutputDeviceSelection("main", mainId);
    }
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
  const title = document.createElement("div");
  title.className = "confirm-title hidden";
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
  dialog.append(title, message, actions);
  overlay.append(dialog);
  document.body.appendChild(overlay);
  confirmModalEl = overlay;
  confirmModalTitle = title;
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
  options?: {
    title?: string;
    cancelLabel?: string;
  },
) => {
  ensureConfirmModal();
  if (
    !confirmModalEl ||
    !confirmModalMessage ||
    !confirmModalOk ||
    !confirmModalCancel ||
    !confirmModalTitle
  ) {
    return false;
  }
  if (confirmModalResolve) {
    return false;
  }
  const titleText = options?.title?.trim() ?? "";
  confirmModalTitle.textContent = titleText;
  confirmModalTitle.classList.toggle("hidden", titleText.length === 0);
  confirmModalMessage.textContent = message;
  confirmModalOk.textContent = confirmLabel ?? t("confirmOk");
  confirmModalCancel.textContent = options?.cancelLabel ?? t("cancel");
  confirmModalEl.classList.remove("hidden");
  return new Promise<boolean>((resolve) => {
    confirmModalResolve = resolve;
  });
};

type TandaSaveChoice = "new" | "replace" | null;

const showTandaSaveChoiceModal = async (): Promise<TandaSaveChoice> => {
  const overlay = document.createElement("div");
  overlay.className = "confirm-modal";
  const dialog = document.createElement("div");
  dialog.className = "confirm-dialog";
  const title = document.createElement("div");
  title.className = "confirm-title";
  title.textContent = t("tandaSaveChoiceTitle");
  const message = document.createElement("div");
  message.className = "confirm-message";
  message.textContent = t("tandaSaveChoiceMessage");
  const actions = document.createElement("div");
  actions.className = "confirm-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "confirm-cancel";
  cancel.textContent = t("cancel");
  const saveNew = document.createElement("button");
  saveNew.type = "button";
  saveNew.className = "tanda-save-new";
  saveNew.textContent = t("tandaSaveAsNew");
  const replace = document.createElement("button");
  replace.type = "button";
  replace.className = "confirm-ok tanda-save-replace";
  replace.textContent = t("tandaReplaceExisting");
  actions.append(cancel, saveNew, replace);
  dialog.append(title, message, actions);
  overlay.append(dialog);
  document.body.appendChild(overlay);
  return new Promise((resolve) => {
    const close = (result: TandaSaveChoice) => {
      overlay.remove();
      resolve(result);
    };
    cancel.addEventListener("click", () => close(null));
    saveNew.addEventListener("click", () => close("new"));
    replace.addEventListener("click", () => close("replace"));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(null);
    });
  });
};

type PlaylistTandaDeleteChoice = "remove" | "delete" | null;

const showPlaylistTandaDeleteModal = async (
  canDeleteSavedTanda: boolean,
): Promise<PlaylistTandaDeleteChoice> => {
  const overlay = document.createElement("div");
  overlay.className = "confirm-modal";
  const dialog = document.createElement("div");
  dialog.className = "confirm-dialog playlist-tanda-delete-dialog";
  const title = document.createElement("div");
  title.className = "confirm-title";
  title.textContent = t("playlistTandaDeleteTitle");
  const message = document.createElement("div");
  message.className = "confirm-message";
  message.textContent = t(canDeleteSavedTanda
    ? "playlistTandaDeleteMessage"
    : "playlistTandaDeleteUnsavedMessage");
  const actions = document.createElement("div");
  actions.className = "confirm-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "confirm-cancel";
  cancel.textContent = t("cancel");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = t("playlistTandaRemoveOnly");
  const deleteSaved = document.createElement("button");
  deleteSaved.type = "button";
  deleteSaved.className = "danger";
  deleteSaved.textContent = t("playlistTandaDeleteSaved");
  deleteSaved.disabled = !canDeleteSavedTanda;
  actions.append(cancel, remove, deleteSaved);
  dialog.append(title, message, actions);
  overlay.append(dialog);
  document.body.appendChild(overlay);
  return new Promise((resolve) => {
    const close = (result: PlaylistTandaDeleteChoice) => {
      overlay.remove();
      resolve(result);
    };
    cancel.addEventListener("click", () => close(null));
    remove.addEventListener("click", () => close("remove"));
    deleteSaved.addEventListener("click", () => close("delete"));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(null);
    });
  });
};

const showDeleteTrackModal = async (): Promise<boolean | null> => {
  const overlay = document.createElement("div");
  overlay.className = "confirm-modal";
  const dialog = document.createElement("div");
  dialog.className = "confirm-dialog";
  const title = document.createElement("div");
  title.className = "confirm-title";
  title.textContent = t("trackEditorDeleteTitle");
  const message = document.createElement("div");
  message.className = "confirm-message";
  message.textContent = t("trackEditorDeleteMessage");
  const fileOption = document.createElement("label");
  fileOption.className = "confirm-checkbox";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  const optionText = document.createElement("span");
  optionText.textContent = t("trackEditorDeleteFileOption");
  fileOption.append(checkbox, optionText);
  const actions = document.createElement("div");
  actions.className = "confirm-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "confirm-cancel";
  cancel.textContent = t("cancel");
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "danger";
  confirm.textContent = t("trackEditorDelete");
  actions.append(cancel, confirm);
  dialog.append(title, message, fileOption, actions);
  overlay.append(dialog);
  document.body.appendChild(overlay);
  return new Promise((resolve) => {
    const close = (result: boolean | null) => { overlay.remove(); resolve(result); };
    cancel.addEventListener("click", () => close(null));
    confirm.addEventListener("click", () => close(checkbox.checked));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(null); });
  });
};

const maybeShowReleaseUpdatePopup = async () => {
  if (
    releaseUpdatePromptShown ||
    !window.tanda?.getReleaseUpdateInfo ||
    !window.tanda?.openReleasePage
  ) {
    return;
  }
  try {
    const update = await window.tanda.getReleaseUpdateInfo();
    if (!update || releaseUpdatePromptShown) {
      return;
    }
    releaseUpdatePromptShown = true;
    const openReleasePage = await showConfirmModal(
      t("releaseUpdateMessage", {
        version: update.latestVersion,
      }),
      t("releaseUpdateOpen"),
      {
        title: t("releaseUpdateTitle"),
        cancelLabel: t("releaseUpdateLater"),
      },
    );
    if (!openReleasePage) {
      return;
    }
    const result = await window.tanda.openReleasePage(update.releasesUrl);
    if (!result.ok) {
      setStatus(
        t("releaseUpdateOpenFailed", {
          message: result.error ?? t("statusUnknownError"),
        }),
      );
    }
  } catch {}
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
  const help = document.createElement("div");
  help.className = "confirm-message playlist-clear-help";
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
  const generateBtn = document.createElement("button");
  generateBtn.type = "button";
  generateBtn.className = "confirm-ok";
  generateBtn.dataset.option = "generate";
  actions.append(cancelBtn, clearBtn, autofillBtn, generateBtn);
  dialog.append(title, help, actions);
  overlay.append(dialog);
  document.body.appendChild(overlay);
  playlistClearModalEl = overlay;

  const closeModal = (result: "clear" | "autofill" | "generate" | null) => {
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
  generateBtn.addEventListener("click", () => closeModal("generate"));
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
  const help = playlistClearModalEl.querySelector<HTMLElement>(".playlist-clear-help");
  const cancelButton = playlistClearModalEl.querySelector<HTMLButtonElement>(".confirm-cancel");
  const clearButton = playlistClearModalEl.querySelector<HTMLButtonElement>(
    ".confirm-ok[data-option=\"clear\"]",
  );
  const autofillButton = playlistClearModalEl.querySelector<HTMLButtonElement>(
    ".confirm-ok[data-option=\"autofill\"]",
  );
  const generateButton = playlistClearModalEl.querySelector<HTMLButtonElement>(
    ".confirm-ok[data-option=\"generate\"]",
  );
  if (!title || !help || !cancelButton || !clearButton || !autofillButton || !generateButton) {
    return null;
  }
  title.textContent = t("playlistClearTitle");
  help.textContent = t("playlistClearGenerateHelp");
  cancelButton.textContent = t("cancel");
  clearButton.textContent = t("playlistClearOnly");
  autofillButton.textContent = t("playlistClearAutofill");
  generateButton.textContent = t("playlistClearGenerate");
  generateButton.title = t("playlistClearGenerateHelp");
  playlistClearModalEl.classList.remove("hidden");
  return new Promise<"clear" | "autofill" | "generate" | null>((resolve) => {
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

const resolveStyleColorGroup = (styleKey: string) => {
  const key = normalizeStyleName(styleKey).toLowerCase();
  const base = normalizeStyleName(splitStyleLabel(styleKey).base || "").toLowerCase();
  const source = `${base} ${key}`.trim();
  if (
    source.includes("milonga") ||
    base === "m" ||
    key === "m" ||
    key.startsWith("m - ")
  ) {
    return "milonga";
  }
  if (
    source.includes("vals") ||
    source.includes("waltz") ||
    base === "w" ||
    key === "w" ||
    key.startsWith("w - ")
  ) {
    return "waltz";
  }
  if (
    source.includes("tango") ||
    base === "t" ||
    key === "t" ||
    key.startsWith("t - ")
  ) {
    return "tango";
  }
  return "other";
};

const colorForStyleKey = (styleKey: string) => {
  const group = resolveStyleColorGroup(styleKey);
  if (group === "milonga") {
    return "#1fbf75";
  }
  if (group === "waltz") {
    return "#3d7dff";
  }
  if (group === "tango") {
    return "#ff7847";
  }
  return "#8f9aad";
};

const patternForStyleKey = (styleKey: string) => {
  const group = resolveStyleColorGroup(styleKey);
  if (group === "milonga") {
    // Diagonal hatch
    return "repeating-linear-gradient(45deg, rgba(0,0,0,0.26) 0 2px, rgba(255,255,255,0) 2px 6px)";
  }
  if (group === "waltz") {
    // Opposite diagonal hatch
    return "repeating-linear-gradient(-45deg, rgba(0,0,0,0.26) 0 2px, rgba(255,255,255,0) 2px 6px)";
  }
  if (group === "tango") {
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
  onSelectOrchestra?: (orchestra: string) => void,
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
    if (onSelectOrchestra) {
      item.classList.add("interactive");
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.addEventListener("click", () => {
        onSelectOrchestra(row.label);
      });
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectOrchestra(row.label);
        }
      });
    }
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
  const yearStyleBuckets = new Map<number, Record<string, number>>();
  const tempoBuckets = new Map<number, number>();
  const tempoStyleBuckets = new Map<number, Record<string, number>>();
  const purityTandaIds = new Map<TandaPurityIssue, Set<string>>([
    ["mixedVocal", new Set()],
    ["multipleArtists", new Set()],
    ["multipleSingers", new Set()],
    ["multipleStyles", new Set()],
  ]);
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
    if (item.kind === "tanda") {
      findTandaPurityIssues(tracks.map((track) => ({
        artist: resolveCanonicalArtistName(track.artist_summary || track.artist || ""),
        singer: track.singer,
        instrumental: track.instrumental,
        style: normalizeStyleName(track.genre ?? ""),
      }))).forEach((issue) => purityTandaIds.get(issue)?.add(item.tandaId));
    }
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
        const yearStyles = yearStyleBuckets.get(year) ?? {};
        yearStyles[style] = (yearStyles[style] ?? 0) + 1;
        yearStyleBuckets.set(year, yearStyles);
      }
      if (track.bpm !== null && track.bpm !== undefined && Number.isFinite(track.bpm)) {
        const bpm = Math.round(track.bpm);
        tempoBuckets.set(bpm, (tempoBuckets.get(bpm) ?? 0) + 1);
        const tempoStyles = tempoStyleBuckets.get(bpm) ?? {};
        tempoStyles[style] = (tempoStyles[style] ?? 0) + 1;
        tempoStyleBuckets.set(bpm, tempoStyles);
      }
    });
  });
  const orchestraRows = aggregateOrchestraDurations(orchestraEntries);
  const yearRows = buildAdaptiveNumericDistribution(yearBuckets, 30, 30);
  const yearStyleRows = buildAdaptiveStyleNumericDistribution(yearStyleBuckets, 30, 30);
  const tempoRows = buildAdaptiveNumericDistribution(tempoBuckets, 30, 30);
  const tempoStyleRows = buildAdaptiveStyleNumericDistribution(tempoStyleBuckets, 30, 30);
  if (playlistStatsPurityEl) {
    playlistStatsPurityEl.replaceChildren();
    const allIssueIds = new Set(
      Array.from(purityTandaIds.values()).flatMap((ids) => Array.from(ids)),
    );
    const categories: Array<{ key: string; ids: Set<string> }> = [
      { key: "playlistStatsPurityAny", ids: allIssueIds },
      { key: "playlistStatsPurityMixedVocal", ids: purityTandaIds.get("mixedVocal")! },
      { key: "playlistStatsPurityMultiArtist", ids: purityTandaIds.get("multipleArtists")! },
      { key: "playlistStatsPurityMultiSinger", ids: purityTandaIds.get("multipleSingers")! },
      { key: "playlistStatsPurityMultiStyle", ids: purityTandaIds.get("multipleStyles")! },
    ];
    categories.forEach(({ key, ids }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "purity-chart-item";
      button.disabled = ids.size === 0;
      button.title = t("playlistStatsPurityFilterHint");
      const count = document.createElement("strong");
      count.textContent = ids.size.toString();
      const label = document.createElement("span");
      label.textContent = t(key);
      button.append(count, label);
      button.addEventListener("click", () => {
        playlistFilterTandaIds = new Set(ids);
        playlistFilterOrchestra = null;
        setPlaylistFilterTextState(t(key));
        if (playlistFilterInput) playlistFilterInput.value = t(key);
        activateRightTab("playlist-tab");
        renderPlaylist();
        setPlaylistStatsModalVisible(false);
      });
      playlistStatsPurityEl.appendChild(button);
    });
  }
  renderOrchestraChart(playlistStatsOrchestraEl, orchestraRows, Number.POSITIVE_INFINITY, (orchestra) => {
    setPlaylistFilterTextState(orchestra);
    playlistFilterOrchestra = orchestra;
    playlistFilterTandaIds = null;
    if (playlistFilterInput) {
      playlistFilterInput.value = orchestra;
    }
    activateRightTab("playlist-tab");
    renderPlaylist();
    setPlaylistStatsModalVisible(false);
  });
  renderStyleDistributionChart(
    playlistStatsYearEl,
    yearStyleRows.length > 0
      ? yearStyleRows
      : yearRows.map((row) => ({ label: row.label, value: row.value, styleValues: {} })),
    {
      includeZero: true,
      className: "compact",
    },
  );
  renderStyleDistributionChart(
    playlistStatsTempoEl,
    tempoStyleRows.length > 0
      ? tempoStyleRows
      : tempoRows.map((row) => ({ label: row.label, value: row.value, styleValues: {} })),
    {
      includeZero: true,
      className: "compact",
    },
  );
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

const canonicalDuplicateTrackId = (trackId: string) =>
  [...(similarityEquivalentTrackIds.get(trackId) ?? new Set([trackId]))].sort()[0] ?? trackId;

const buildCanonicalTandaKey = (trackIds: string[]) =>
  buildNormalizedTandaKey(trackIds.map(canonicalDuplicateTrackId));

const handleTandaDetailTrackClick = async (
  context: "search" | "clipboard" | "playlist",
  trackId: string,
  playlistIndex?: number,
) => {
  const track = trackCache.get(trackId) ?? resolveTrackById(trackId);
  if (!track) {
    return;
  }
  if (context === "playlist") {
    if (appMode === "edit") {
      await playTrackForMode(track, {
        filePath: track.full_path,
        trackId: track.id,
        gainDb: track.gain_db ?? null,
      });
      return;
    }
    if (!Number.isFinite(playlistIndex ?? NaN) || (playlistIndex ?? -1) < 0) {
      return;
    }
    const isMainPlaying = Boolean(playback.main.active && !playback.main.active.paused);
    if (!shouldStartPlaylistFromClick(appMode, isMainPlaying)) {
      return;
    }
    startPlaylistFrom(playlistIndex ?? -1, trackId);
    return;
  }
  await playTrackForMode(track, {
    filePath: track.full_path,
    trackId: track.id,
    gainDb: track.gain_db ?? null,
  });
};

const findPlaylistDuplicateLocationForTrack = (trackId: string) => {
  const wanted = similarityEquivalentTrackIds.get(trackId) ?? new Set([trackId]);
  for (let index = 0; index < playlistItems.length; index += 1) {
    const item = playlistItems[index];
    if (!item) {
      continue;
    }
    if (item.kind === "track" && wanted.has(item.track.id)) {
      return { index, trackId: item.track.id };
    }
    if (item.kind === "tanda") {
      const tanda = resolveTandaDraft(item.tandaId);
      const matchedTrackId = tanda?.trackSlots.find((candidate) => Boolean(candidate && wanted.has(candidate)));
      if (matchedTrackId) {
        return { index, trackId: matchedTrackId };
      }
    }
  }
  return null;
};

const findPlaylistDuplicateLocationForTandaTracks = (
  trackIds: string[],
  status?: "partial" | "full" | null,
) => {
  const wanted = new Set(trackIds.filter(Boolean));
  if (wanted.size === 0) {
    return null;
  }
  const wantedCanonicalIds = new Set(Array.from(wanted, canonicalDuplicateTrackId));
  const wantedKey = buildCanonicalTandaKey(Array.from(wanted));
  for (let index = 0; index < playlistItems.length; index += 1) {
    const item = playlistItems[index];
    if (!item) {
      continue;
    }
    if (item.kind === "track") {
      if (status !== "full"
        && wantedCanonicalIds.has(canonicalDuplicateTrackId(item.track.id))) {
        return { index, trackIds: [item.track.id] };
      }
      continue;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      continue;
    }
    const tandaTrackIds = (tanda.trackSlots.filter(Boolean) as string[]);
    const matchingTrackIds = tandaTrackIds.filter((trackId) =>
      wantedCanonicalIds.has(canonicalDuplicateTrackId(trackId)));
    if (status === "full") {
      if (buildCanonicalTandaKey(tandaTrackIds) === wantedKey) {
        return { index, trackIds: matchingTrackIds };
      }
      continue;
    }
    if (matchingTrackIds.length > 0) {
      return { index, trackIds: matchingTrackIds };
    }
  }
  return null;
};

const DUPLICATE_JUMP_HIGHLIGHT_DELAY_MS = 650;
const DUPLICATE_JUMP_HIGHLIGHT_DURATION_MS = 2800;

const focusPlaylistIndex = (
  index: number,
  trackIds?: string | string[],
  highlightTanda = false,
) => {
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
    const matchedTrackIds = typeof trackIds === "string" ? [trackIds] : trackIds ?? [];
    if (matchedTrackIds.length > 0 && !row.classList.contains("expanded")) {
      toggleTandaRow(row);
    }
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => {
      const matchedTracks = matchedTrackIds
        .map((trackId) => row.querySelector<HTMLElement>(
          `.tanda-detail-line[data-track-id="${CSS.escape(trackId)}"]`,
        ))
        .filter((track): track is HTMLElement => Boolean(track));
      const target = matchedTracks[0] ?? row;
      if (!target) return;
      row.classList.remove("jump-highlight");
      matchedTracks.forEach((track) => track.classList.remove("track-jump-highlight"));
      // Restart animation after scroll settles so feedback is visible on arrival.
      void target.offsetWidth;
      if (highlightTanda || matchedTracks.length === 0) row.classList.add("jump-highlight");
      matchedTracks.forEach((track) => track.classList.add("track-jump-highlight"));
    }, DUPLICATE_JUMP_HIGHLIGHT_DELAY_MS);
    window.setTimeout(() => {
      row.classList.remove("jump-highlight");
      row.querySelectorAll(".track-jump-highlight").forEach((element) =>
        element.classList.remove("track-jump-highlight"));
    }, DUPLICATE_JUMP_HIGHLIGHT_DELAY_MS + DUPLICATE_JUMP_HIGHLIGHT_DURATION_MS);
  });
};

const handleDuplicateJump = (target: HTMLElement) => {
  const jumpTrigger = target.closest<HTMLElement>(".duplicate-jump");
  if (!jumpTrigger) {
    return false;
  }
  if (suppressDuplicateJumpClick) {
    suppressDuplicateJumpClick = false;
    return true;
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
    const location = findPlaylistDuplicateLocationForTrack(trackId);
    if (location) {
      focusPlaylistIndex(location.index, location.trackId);
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
  const location = findPlaylistDuplicateLocationForTandaTracks(
    tandaTrackIds,
    status || null,
  );
  if (location) {
    focusPlaylistIndex(location.index, location.trackIds, true);
  }
  openSourceRowMenu();
  return true;
};

let duplicateFocusTimer: number | null = null;
let suppressDuplicateJumpClick = false;
let playlistDuplicateFocusTrackIds: Set<string> | null = null;
const cancelPlaylistDuplicateFocusTimer = () => {
  if (duplicateFocusTimer !== null) window.clearTimeout(duplicateFocusTimer);
  duplicateFocusTimer = null;
};
const clearPlaylistDuplicateFocus = () => {
  const wasFocused = playlistDuplicateFocusTrackIds !== null;
  cancelPlaylistDuplicateFocusTimer();
  suppressDuplicateJumpClick = false;
  playlistDuplicateFocusTrackIds = null;
  playlistDuplicateFocusStatus?.classList.add("hidden");
  if (wasFocused) renderPlaylist();
};

const startPlaylistDuplicateFocus = (trigger: HTMLElement, immediate = false) => {
  clearPlaylistDuplicateFocus();
  const rawIds = trigger.dataset.duplicateTrackId
    ? [trigger.dataset.duplicateTrackId]
    : (trigger.dataset.duplicateTandaTrackIds ?? "").split(",").filter(Boolean);
  const targetIds = new Set<string>();
  rawIds.forEach((trackId) =>
    (similarityEquivalentTrackIds.get(trackId) ?? new Set([trackId]))
      .forEach((equivalent) => targetIds.add(equivalent)));
  if (targetIds.size === 0) return;
  const apply = () => {
    playlistDuplicateFocusTrackIds = targetIds;
    renderPlaylist();
    const firstMatch = playlistListEl?.querySelector<HTMLElement>(".list-row[data-index]");
    if (firstMatch) {
      playlistDuplicateFocusStatus?.classList.remove("hidden");
      suppressDuplicateJumpClick = true;
      window.requestAnimationFrame(() => {
        firstMatch.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
    duplicateFocusTimer = null;
  };
  duplicateFocusTimer = immediate ? window.setTimeout(apply, 0) : window.setTimeout(apply, 450);
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
  return buildPlaylistDuplicateIndex(sources, similarityEquivalentTrackIds);
};

type PlaylistDuplicateCounts = {
  trackCounts: Map<string, number>;
  tandaCounts: Map<string, number>;
};

const buildTandaDuplicateKey = (trackIds: string[]) =>
  Array.from(new Set(trackIds.filter(Boolean).map((trackId) =>
    [...(similarityEquivalentTrackIds.get(trackId) ?? new Set([trackId]))].sort()[0],
  ))).sort().join("|");

const buildPlaylistDuplicateCountsFromState = (): PlaylistDuplicateCounts => {
  const trackCounts = new Map<string, number>();
  const tandaCounts = new Map<string, number>();
  playlistItems.forEach((item) => {
    if (!item) {
      return;
    }
    if (item.kind === "track") {
      const equivalents = similarityEquivalentTrackIds.get(item.track.id) ?? new Set([item.track.id]);
      equivalents.forEach((trackId) =>
        trackCounts.set(trackId, (trackCounts.get(trackId) ?? 0) + 1));
      return;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      return;
    }
    const trackIds = tanda.trackSlots.filter(Boolean) as string[];
    trackIds.forEach((trackId) => {
      const equivalents = similarityEquivalentTrackIds.get(trackId) ?? new Set([trackId]);
      equivalents.forEach((equivalent) =>
        trackCounts.set(equivalent, (trackCounts.get(equivalent) ?? 0) + 1));
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
  const applyVariantSelection = (variant: string) => {
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
    closeStyleVariantMenu();
    void loadStyles().then(() => {
      void refreshSearch();
      renderClipboard();
    });
  };
  const menu = document.createElement("div");
  menu.className = "style-variant-menu";
  menu.setAttribute("role", "menu");
  family.variants.forEach((variant) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "style-variant-menu-item";
    item.setAttribute("role", "menuitem");
    item.textContent = variant;
    let applied = false;
    const applyOnce = () => {
      if (applied) {
        return;
      }
      applied = true;
      applyVariantSelection(variant);
    };
    item.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyOnce();
    });
    item.addEventListener("pointerup", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyOnce();
    });
    item.addEventListener("mouseup", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyOnce();
    });
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyOnce();
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

const openTandaStyleVariantMenu = (
  x: number,
  y: number,
  baseStyle: string,
  family: StyleFamily,
  onSelectVariant: (styleValue: string) => void,
) => {
  closeStyleVariantMenu();
  const menu = document.createElement("div");
  menu.className = "style-variant-menu";
  menu.setAttribute("role", "menu");
  family.variants.forEach((variant) => {
    const styleValue = composeStyleLabel(baseStyle, variant);
    if (!styleValue) {
      return;
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = "style-variant-menu-item";
    item.setAttribute("role", "menuitem");
    item.textContent = variant;
    let applied = false;
    const applyOnce = () => {
      if (applied) {
        return;
      }
      applied = true;
      closeStyleVariantMenu();
      // Applying a tanda style rebuilds the designer (and therefore the button
      // that opened this menu). Let the native pointer gesture finish before
      // replacing that DOM; doing it from pointerdown can leave Electron/macOS
      // stuck dispatching the remainder of the gesture to detached controls.
      window.setTimeout(() => onSelectVariant(styleValue), 0);
    };
    item.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyOnce();
    });
    item.addEventListener("pointerup", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyOnce();
    });
    item.addEventListener("mouseup", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyOnce();
    });
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyOnce();
    });
    menu.appendChild(item);
  });
  if (menu.childElementCount === 0) {
    return;
  }
  document.body.appendChild(menu);
  const { innerWidth, innerHeight } = window;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, Math.max(8, innerWidth - rect.width - 8));
  const top = Math.min(y, Math.max(8, innerHeight - rect.height - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  styleVariantMenuEl = menu;
};

const getClipboardMoveTargets = (excludeCollectionId: string | null = null) => {
  const general = clipboardCollections.find((collection) => collection.id === "general");
  const custom = clipboardCollections.filter(
    (collection) => !isPinnedCollectionId(collection.id),
  );
  return [general, ...custom].filter((collection) =>
    Boolean(collection && collection.id !== excludeCollectionId),
  ) as ClipboardCollection[];
};

const moveTrackBetweenClipboardCollections = (
  trackId: string,
  targetCollectionId: string,
) => {
  const activeCollection = getActiveCollection();
  if (activeCollection && isReadOnlyCollectionId(activeCollection.id)) {
    const track = resolveTrackById(trackId);
    if (!track) {
      return;
    }
    addTrackToCollection(targetCollectionId, track);
    activeClipboardCollectionId = targetCollectionId;
    includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
      (id) => id !== targetCollectionId,
    );
    selectedClipboardTrackId = trackId;
    selectedClipboardTandaId = null;
    saveClipboardCollections();
    renderClipboardCollections();
    renderClipboard();
    return;
  }
  clipboardCollections = moveTrackToCollection(
    clipboardCollections,
    trackId,
    targetCollectionId,
    [CLIPBOARD_NEW_ID, CLIPBOARD_TOP_ID, CLIPBOARD_LEAST_ID, CLIPBOARD_AVAILABLE_ID],
  );
  activeClipboardCollectionId = targetCollectionId;
  includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
    (id) => id !== targetCollectionId,
  );
  selectedClipboardTrackId = trackId;
  selectedClipboardTandaId = null;
  saveClipboardCollections();
  renderClipboardCollections();
  renderClipboard();
};

const moveTandaBetweenClipboardCollections = (
  tandaId: string,
  targetCollectionId: string,
) => {
  const activeCollection = getActiveCollection();
  if (activeCollection && isReadOnlyCollectionId(activeCollection.id)) {
    addTandaToCollection(targetCollectionId, tandaId);
    activeClipboardCollectionId = targetCollectionId;
    includedClipboardCollectionIds = includedClipboardCollectionIds.filter(
      (id) => id !== targetCollectionId,
    );
    selectedClipboardTandaId = tandaId;
    selectedClipboardTrackId = null;
    saveClipboardCollections();
    renderClipboardCollections();
    renderClipboard();
    return;
  }
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

const openTrackMoveTargetMenu = (
  x: number,
  y: number,
  trackId: string,
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
      moveTrackBetweenClipboardCollections(trackId, collection.id);
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
  const savedMaster = tanda.masterTandaId
    ? tandaCache.get(tanda.masterTandaId) ?? null
    : null;
  const restoredToMaster =
    returnTab === "playlist-tab" &&
    tanda.playlistUnsaved === true &&
    savedMaster !== null &&
    tandaContentsMatch(tanda, savedMaster);
  if (restoredToMaster && tanda.masterTandaId) {
    const masterTandaId = tanda.masterTandaId;
    playlistItems = playlistItems.map((item) =>
      item?.kind === "tanda" && item.tandaId === tanda.id
        ? { ...item, tandaId: masterTandaId }
        : item,
    );
    tandaCache.delete(tanda.id);
  } else {
    tandaCache.set(tanda.id, {
      ...cloneTanda(tanda),
      origin: returnTab === "playlist-tab" ? "playlist" : "designer",
    });
  }
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

const trackTandaUsageCache = new Map<string, TrackTandaUsage>();
const pendingTrackTandaUsageIds = new Set<string>();
let trackTandaUsageTimer: number | null = null;

const applyTrackTandaUsageToRows = (usage: TrackTandaUsage) => {
  const escape = typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape
    : (value: string) => value.replace(/["\\]/g, "\\$&");
  const count = usage.tandaIds.length;
  document.querySelectorAll<HTMLElement>(
    `.track-row[data-track-id="${escape(usage.trackId)}"]`,
  ).forEach((row) => {
    const primary = row.querySelector<HTMLElement>(".track-primary");
    let badge = primary?.querySelector<HTMLElement>(".track-tanda-count") ?? null;
    if (count > 0 && primary && !badge) {
      badge = document.createElement("span");
      badge.className = "track-tanda-count";
      primary.appendChild(badge);
    }
    if (badge) {
      if (count === 0) badge.remove();
      else {
        badge.textContent = `${count}`;
        badge.title = t("trackTandaCount", { count });
        badge.setAttribute("aria-label", badge.title);
      }
    }
    const menu = row.querySelector<HTMLElement>(":scope > .row-actions > .row-menu");
    let action = menu?.querySelector<HTMLButtonElement>('[data-action="find-track-tandas"]') ?? null;
    if (count > 0 && menu && !action) {
      action = buildActionButton("actionFindTandas", "actionFindTandasShort", "find-track-tandas");
      const searchAction = menu.querySelector('[data-action="search-track"]');
      searchAction?.after(action);
    } else if (count === 0) action?.remove();
  });
  document.querySelectorAll<HTMLElement>(
    `.tanda-detail-line[data-track-id="${escape(usage.trackId)}"]`,
  ).forEach((line) => {
    const menu = line.querySelector<HTMLElement>(".tanda-detail-menu");
    let action = menu?.querySelector<HTMLButtonElement>('[data-action="find-track-tandas"]') ?? null;
    if (count > 0 && menu && !action) {
      action = buildActionButton("actionFindTandas", "actionFindTandasShort", "find-track-tandas");
      action.classList.add("detail-search");
      menu.querySelector('[data-action="search-track"]')?.after(action);
    } else if (count === 0) action?.remove();
  });
};

const queueTrackTandaUsage = (trackId: string) => {
  const cached = trackTandaUsageCache.get(trackId);
  if (cached) {
    window.setTimeout(() => applyTrackTandaUsageToRows(cached), 0);
    return;
  }
  pendingTrackTandaUsageIds.add(trackId);
  if (trackTandaUsageTimer !== null) return;
  trackTandaUsageTimer = window.setTimeout(async () => {
    trackTandaUsageTimer = null;
    const ids = [...pendingTrackTandaUsageIds];
    pendingTrackTandaUsageIds.clear();
    if (!window.tanda || ids.length === 0) return;
    const chunks = Array.from(
      { length: Math.ceil(ids.length / 250) },
      (_, index) => ids.slice(index * 250, (index + 1) * 250),
    );
    const rows = (await Promise.all(
      chunks.map((chunk) => window.tanda!.getTrackTandaUsage(chunk)),
    )).flat();
    rows.forEach((usage) => {
      trackTandaUsageCache.set(usage.trackId, usage);
      applyTrackTandaUsageToRows(usage);
    });
  }, 0);
};

const invalidateTrackTandaUsage = () => {
  trackTandaUsageCache.clear();
  document.querySelectorAll<HTMLElement>(".track-row[data-track-id], .tanda-detail-line[data-track-id]")
    .forEach((row) => {
      const trackId = row.dataset.trackId;
      if (trackId) queueTrackTandaUsage(trackId);
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
  const canMoveAcrossCollections = context === "clipboard" && Boolean(activeCollection);
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
  queueTrackTandaUsage(track.id);
  const actions = document.createElement("div");
  actions.className = "row-actions";
  const tandaCount = trackTandaUsageCache.get(track.id)?.tandaIds.length ?? 0;
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
  if (tandaCount > 0) {
    menu.appendChild(
      buildActionButton(
        "actionFindTandas",
        "actionFindTandasShort",
        "find-track-tandas",
      ),
    );
  }
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
    if (canMoveAcrossCollections) {
      menu.appendChild(
        buildActionButton(
          "actionMoveCollection",
          "actionMoveCollectionShort",
          "move-clip-track-collection",
        ),
      );
    }
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
  const primaryLabel = document.createElement("span");
  primaryLabel.className = "track-primary-label";
  primaryLabel.textContent = `${track.title}${artist}`;
  primary.title = primaryLabel.textContent;
  primary.appendChild(primaryLabel);
  if (tandaCount > 0) {
    const tandaCountBadge = document.createElement("span");
    tandaCountBadge.className = "track-tanda-count";
    tandaCountBadge.textContent = `${tandaCount}`;
    tandaCountBadge.title = t("trackTandaCount", { count: tandaCount });
    tandaCountBadge.setAttribute("aria-label", tandaCountBadge.title);
    primary.appendChild(tandaCountBadge);
  }
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
  const rawName = (tanda.name || fallbackName || "").trim();
  const tracks = tanda.trackSlots.map((trackId) =>
    trackId ? trackCache.get(trackId) ?? null : null,
  );
  const summary = summarizeTandaTracks(
    tracks.map((track) => {
      if (!track) {
        return null;
      }
      const artist = summarizeTrackArtist(track);
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
  const name = restoreEquivalentArtistSpelling(
    rawName,
    summary.artists.map((artist) => artist.name),
  );
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
      const artist = summarizeTrackArtist(track);
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
  const rawName = (tanda.name || fallbackName || "").trim();
  const tracks = tanda.trackSlots.map((trackId) =>
    trackId ? trackCache.get(trackId) ?? null : null,
  );
  const summary = summarizeTandaTracks(
    tracks.map((track) => {
      if (!track) {
        return null;
      }
      return {
        artist: summarizeTrackArtist(track),
        year: track.year,
        instrumental: track.instrumental ?? null,
      };
    }),
  );
  const name = restoreEquivalentArtistSpelling(
    rawName,
    summary.artists.map((artist) => artist.name),
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

const runSearchQuery = (
  query: string,
  allowEmpty = false,
  preferredTab?: SearchTab,
) => {
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
    setActiveSearchTab: (tab) => {
      setActiveSearchTabState(tab);
      updateSearchTabVisibility();
      activatePanelTab(getSearchPanel(), tab);
    },
  }, preferredTab);
};

const buildSearchQueryForTrack = (track: TrackRow) => {
  return dedupeQueryTokens(buildTrackSimilarityQuery(track));
};

const resolveSearchStylesForTrack = (track: TrackRow) => {
  return resolveTrackSearchStyles({
    trackStyle: track.genre,
    availableStyles,
  });
};

const runSearchForTrack = (track: TrackRow, preferredStyles?: string[]) => {
  const styles = preferredStyles ?? resolveSearchStylesForTrack(track);
  if (styles.length > 0 || selectedStyles.length > 0) {
    selectedStyles = toBaseStyleFilters(styles);
    loadStyles();
  }
  runSearchQuery(buildSearchQueryForTrack(track), true, "search-tracks");
};

const runFindTandasForTrack = async (track: TrackRow) => {
  if (!window.tanda || !searchInput) return;
  const usage = trackTandaUsageCache.get(track.id)
    ?? (await window.tanda.getTrackTandaUsage([track.id]))[0];
  if (!usage) return;
  trackTandaUsageCache.set(track.id, usage);
  const ids = [track.id, ...usage.recordingTrackIds.filter((id) => id !== track.id)];
  const tracks = await window.tanda.getTracksByIds(ids);
  const order = new Map(ids.map((id, index) => [id, index]));
  tracks.sort((left, right) => (order.get(left.id) ?? ids.length) - (order.get(right.id) ?? ids.length));
  tracks.forEach((item) => trackCache.set(item.id, item));
  const matchingTandas = await window.tanda.getTandasByIds(usage.tandaIds);
  matchingTandas.forEach(upsertTandaCache);
  tandaSearchResults = matchingTandas.map((tanda) => ({
    id: tanda.id,
    name: tanda.name,
    styles: [...tanda.styles],
    rating: tanda.rating,
    instrumental: tanda.instrumental,
    total_duration_ms: tanda.total_duration_ms,
    slot_count: tanda.slot_count,
    track_count: tanda.track_slots.filter(Boolean).length,
  }));
  searchInput.value = track.title;
  selectedStyles = [];
  loadStyles();
  setSearchState({
    ...searchState,
    items: tracks,
    total: tracks.length,
    offsetStart: 0,
    isLoading: false,
    lastQuery: track.title,
  });
  renderSearchResults();
  renderTandaSearchResults();
  setActiveSearchTabState("search-tandas");
  updateSearchTabVisibility();
  activatePanelTab(getSearchPanel(), "search-tandas");
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
  if (!rule?.code) {
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
  playlistFilterOrchestra = null;
  playlistFilterTandaIds = null;
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

const getPlaylistTrackCanonicalArtists = (track: TrackRow) => {
  const canonical =
    resolveCanonicalArtistName(track.artist_summary || track.artist || "") ||
    t("nowPlayingUnknown");
  return [canonical];
};

const getPlaylistTandaCanonicalArtists = (tanda: TandaDraft) =>
  tanda.trackSlots.reduce<string[]>((artists, trackId) => {
    if (!trackId) {
      return artists;
    }
    const track = trackCache.get(trackId);
    if (!track) {
      return artists;
    }
    const canonical =
      resolveCanonicalArtistName(track.artist_summary || track.artist || "") ||
      t("nowPlayingUnknown");
    if (!artists.includes(canonical)) {
      artists.push(canonical);
    }
    return artists;
  }, []);

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
  runSearchQuery(buildSearchQueryForTanda(tanda), true, "search-tandas");
};

const resolveTandaForSearch = (tandaId: string) =>
  resolveSearchResultTanda({
    cached: tandaCache.get(tandaId) ?? null,
    clipboard: clipboardTandas.find((item) => item.id === tandaId) ?? null,
    draft: tandaDrafts.find((item) => item.id === tandaId) ?? null,
  });

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
  const canMoveAcrossCollections = context === "clipboard" && Boolean(activeCollection);
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
        "actionSearch",
        "actionSearchShort",
        "search-tanda",
      ),
    );
  }
  if (context === "search") {
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
    if (canMoveAcrossCollections) {
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
      queueTrackTandaUsage(line.trackId);
    }
    if (line.slotIndex !== undefined) {
      lineEl.dataset.slotIndex = line.slotIndex.toString();
    }
    if (line.trackId && line.trackId === options?.activeTrackId) {
      lineEl.classList.add("active");
    }
    if (line.trackId) {
      lineEl.addEventListener("click", (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button")) {
          return;
        }
        event.stopPropagation();
        void handleTandaDetailTrackClick(
          context,
          line.trackId!,
          options?.playlistIndex,
        );
      });
    }
    lineEl.textContent = line.text;
    if (line.trackId) {
      const actionWrap = document.createElement("div");
      actionWrap.className = "tanda-detail-actions-right";
      const menuButton = buildDetailMenuButton();
      menuButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (lineEl.classList.contains("detail-menu-open")) {
          lineEl.classList.remove("detail-menu-open");
        } else {
          closeDetailMenus();
          lineEl.classList.add("detail-menu-open");
        }
      });
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
      if ((trackTandaUsageCache.get(line.trackId)?.tandaIds.length ?? 0) > 0) {
        const findTandasButton = buildActionButton(
          "actionFindTandas",
          "actionFindTandasShort",
          "find-track-tandas",
        );
        findTandasButton.classList.add("detail-search");
        menuWrap.appendChild(findTandasButton);
      }
      if (context === "search") {
        const clipButton = buildActionButton(
          "actionAddClipboard",
          "actionAddClipboardShort",
          "add-clip-track-from-tanda",
        );
        clipButton.classList.add("detail-send");
        clipButton.addEventListener("click", (event) => {
          event.stopPropagation();
          const track = trackCache.get(line.trackId!);
          if (track) {
            addTrackToClipboard(track);
          }
          closeRowMenus();
          closeDetailMenus();
        });
        menuWrap.appendChild(clipButton);
      }
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
      resolveSearchResultTanda({
        cached: tandaCache.get(tanda.id) ?? null,
        clipboard: clipboardTandas.find((item) => item.id === tanda.id) ?? null,
        draft: tandaDrafts.find((item) => item.id === tanda.id) ?? null,
      }) ??
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
  const version = ++tandaSearchVersion;
  const rows = await window.tanda.searchTandas({
    rating: { ...ratingFilter },
    query: searchInput?.value?.trim() ?? "",
    styles: getExpandedStyleFilter(),
    size: getTandaSearchSizeFilter(),
  });
  if (version !== tandaSearchVersion) return;
  tandaSearchResults = rows;
  const ids = rows.map((row) => row.id);
  if (ids.length > 0 && window.tanda.getTandasByIds) {
    const details = await window.tanda.getTandasByIds(ids);
    if (version !== tandaSearchVersion) return;
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

const collectionStyleGroupKey = (style: string | null | undefined) =>
  normalizeAvailabilityStyleGroup(normalizeStyleName(style ?? ""));

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
              .map(collectionStyleGroupKey)
              .filter(Boolean);
            return normalized[0] ?? "";
          })()
        : "";
    resolvePlaylistTracks(item).forEach((track) => {
      const artist = collectionArtistGroupKey(track);
      const style = collectionStyleGroupKey(track.genre) || tandaStyleFallback;
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
    getStyleKey: (track) => collectionStyleGroupKey(track.genre),
    getTitleKey: normalizeTrackTitleForAutofill,
  });
  const trackIds = tracks
    .filter((track) => {
      const artist = collectionArtistGroupKey(track);
      const style = collectionStyleGroupKey(track.genre);
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
            .map((track) => collectionStyleGroupKey(track.genre))
            .filter(Boolean),
        ),
      );
      const styleFromTracks = styles.length === 1 ? styles[0] ?? "" : "";
      const styleFromTanda = tanda.styles
        .map(collectionStyleGroupKey)
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
  const version = ++clipboardRenderVersion;
  const currentRatingFilter = { ...ratingFilter };
  let ratings: RatingSnapshot = { tracks: [], tandas: [] };
  if (currentRatingFilter.mode !== "any") {
    try {
      if (!window.tanda) throw new Error("Rating API unavailable");
      ratings = await window.tanda.getRatingSnapshot();
    } catch {
      if (version === clipboardRenderVersion) setStatus(t("ratingFilterFailed"));
      return;
    }
  }
  if (version !== clipboardRenderVersion) return;
  const trackRatings = new Map(ratings.tracks.map((row) => [row.id, row.rating]));
  const tandaRatings = new Map(ratings.tandas.map((row) => [row.id, row.rating]));
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
  if (version !== clipboardRenderVersion) return;
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
  const showDuplicates =
    !(
      activeClipboardCollectionId === CLIPBOARD_AVAILABLE_ID &&
      includedClipboardCollectionIds.length === 0
    );
  const duplicateIndex = showDuplicates ? buildPlaylistDuplicateIndexFromState() : undefined;
  clipTracksEl.innerHTML = "";
  const selectedId = selectedClipboardTrackId;
  const filteredTracks =
    forcedStyles.length > 0
      ? clipboardTracks.filter((track) =>
          styleMatchesFilter(track.genre ?? "", forcedStyles),
        )
      : clipboardTracks;
  const ratedTracks = filteredTracks.filter((track) => matchesRating(trackRatings.get(track.id), currentRatingFilter));
  const matchedTracks = filterText
    ? ratedTracks.filter((track) =>
        getClipboardTrackFilterText(track).includes(filterText),
      )
    : ratedTracks;
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
      if (!matchesRating(tandaRatings.get(tanda.id) ?? tanda.rating, currentRatingFilter)) return false;
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
    const snapshot: PlaylistTandaSnapshot | undefined = snapshotSource?.playlistUnsaved
      ? {
          id: snapshotSource.id,
          masterTandaId: snapshotSource.masterTandaId ?? null,
          unsaved: true,
          autoGenerated: snapshotSource.autoGenerated === true,
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
  return serialized;
};

const serializePlaylistState = () => {
  const validCortinaIndices = new Set(getCortinaRowIndices(playlistItems));
  const cortinaAssignments: StoredCortinaAssignment[] = [...validCortinaIndices]
    .map((index) => {
      const track = getCortinaRowTrack(index);
      return track?.id ? { index, trackId: track.id } : null;
    })
    .filter((entry): entry is StoredCortinaAssignment => Boolean(entry))
    .sort((a, b) => a.index - b.index);
  return serializeStoredPlaylistState({
    version: 2,
    items: serializePlaylistItems(playlistItems),
    cortinaSet: getCortinaSet() || undefined,
    cortinaAssignments,
  });
};

const buildPortableTrackRefForExport = (track: TrackRow): PortableTrackRef => ({
  fullPath: track.full_path,
  relativePath: track.relative_path,
  title: track.title ?? "",
  artist: track.artist ?? "",
});

const buildPlaylistExportManifest = (): PlaylistExportManifest => {
  const createdAt = new Date().toISOString();
  const validCortinaIndices = new Set(getCortinaRowIndices(playlistItems));
  return {
    format: "tanda-forge-playlist",
    version: PLAYLIST_EXPORT_VERSION,
    createdAt,
    appVersion: "renderer",
    cortinaSet: getCortinaSet() || undefined,
    cortinaAssignments: [...validCortinaIndices]
      .map((index) => {
        const track = getCortinaRowTrack(index);
        return track ? { index, track: buildPortableTrackRefForExport(track) } : null;
      })
      .filter((entry): entry is { index: number; track: PortableTrackRef } => Boolean(entry))
      .sort((a, b) => a.index - b.index),
    items: playlistItems.map((item) => {
      if (!item) {
        return null;
      }
      if (item.kind === "track") {
        return { kind: "track", track: buildPortableTrackRefForExport(item.track) };
      }
      const tanda = resolveTandaDraft(item.tandaId);
      if (!tanda) {
        return null;
      }
      const tracks = tanda.trackSlots
        .map((trackId) => (trackId ? trackCache.get(trackId) ?? null : null))
        .filter((track): track is TrackRow => Boolean(track));
      return {
        kind: "tanda",
        savedTandaId: tanda.playlistUnsaved
          ? tanda.masterTandaId ?? undefined
          : tanda.masterTandaId ?? tanda.id,
        name: tanda.name,
        styles: [...tanda.styles],
        rating: tanda.rating,
        instrumental: deriveInstrumental(tracks),
        mismatch: item.mismatch,
        totalDurationMs: tanda.totalDurationMs,
        trackRefs: tanda.trackSlots.map((trackId) => {
          if (!trackId) {
            return null;
          }
          const track = trackCache.get(trackId);
          return track ? buildPortableTrackRefForExport(track) : null;
        }),
      };
    }),
  };
};

const savePlaylistToStorage = () => {
  const serialized = serializePlaylistState();
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
  const storedState = parseStoredPlaylistState(raw);
  if (!storedState || storedState.items.length === 0) {
    return;
  }
  await applyStoredPlaylistState(storedState);
};

const applyStoredPlaylistState = async (storedState: StoredPlaylistState) => {
  if (!window.tanda) {
    return { resolvedCount: 0, missingCount: 0 };
  }
  const trackIds = collectStoredPlaylistTrackIds(storedState);
  const tandaIds = storedState.items
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
  const hydratedItems = storedState.items.map((item): PlaylistItem | null => {
    if (!item) {
      return null;
    }
    if (item.kind === "track") {
      const track = trackMap.get(item.id);
      return track ? { kind: "track", track } : null;
    }
    if (item.snapshot) {
      const snapshot = item.snapshot;
      const savedTanda = tandaMap.get(item.id);
      const legacySnapshotMatchesMaster =
        snapshot.unsaved !== true &&
        savedTanda !== undefined &&
        snapshot.name === savedTanda.name &&
        snapshot.rating === savedTanda.rating &&
        JSON.stringify(snapshot.styles) === JSON.stringify(savedTanda.styles) &&
        JSON.stringify(snapshot.trackSlots) === JSON.stringify(savedTanda.track_slots);
      if (legacySnapshotMatchesMaster) {
        return { kind: "tanda", tandaId: item.id, mismatch: item.mismatch };
      }
      const variantId = snapshot.unsaved === true ? item.id : crypto.randomUUID();
      const hydrated: TandaDraft = {
        id: variantId,
        name: snapshot.name,
        styles: [...snapshot.styles],
        rating: snapshot.rating,
        trackSlots: [...snapshot.trackSlots],
        totalDurationMs: snapshot.totalDurationMs,
        origin: "playlist",
        masterTandaId:
          snapshot.unsaved === true
            ? snapshot.masterTandaId ?? null
            : savedTanda
              ? item.id
              : null,
        playlistUnsaved: true,
        autoGenerated: snapshot.autoGenerated === true,
      };
      ensureTandaDraft(hydrated, "playlist");
      return { kind: "tanda", tandaId: hydrated.id, mismatch: item.mismatch };
    }
    const tanda = tandaMap.get(item.id);
    if (tanda) {
      return { kind: "tanda", tandaId: item.id, mismatch: item.mismatch };
    }
    return null;
  });
  playlistItems = hydratedItems;
  cortinaOverrideByIndex.clear();
  resetCortinaPlans();
  if (storedState.cortinaSet === getCortinaSet()) {
    storedState.cortinaAssignments?.forEach((entry) => {
      const track = trackMap.get(entry.trackId);
      if (track) {
        cortinaPlannedByIndex.set(entry.index, track);
      }
    });
  }
  maybeRepairLeadingPlaylistSlot();
  playlistSaveSnapshot = serializePlaylistState();
  clearPlaylistTarget();
  return {
    resolvedCount: hydratedItems.filter((item) => Boolean(item)).length,
    missingCount:
      storedState.items.filter((item) => Boolean(item)).length -
      hydratedItems.filter((item) => Boolean(item)).length,
  };
};

const resetPlaylistRuntimeStateForImport = () => {
  playlistPlayback.status = "idle";
  playlistPlayback.resume = null;
  playlistPlayback.currentIndex = 0;
  playlistPlayback.currentTrackIndex = 0;
  playlistPlayback.playedThroughIndex = -1;
  playlistPlayback.activeTrackId = null;
  playlistPlayback.activeTandaId = null;
  playlistPlayback.liveBaseStartMs = null;
  cortinaDisplayPhase = "none";
  isMarkedLastFinalCortinaActive = false;
  isPerformanceStopFinalCortinaActive = false;
  isPausedForPerformanceStop = false;
  lastPausedPerformanceStopCortinaLabel = null;
  holdPerformanceStopDisplayBlankWhenIdle = false;
  clearPlaylistTarget();
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
  const hasFilter = filterText.length > 0 || playlistFilterTandaIds !== null;
  const hasDuplicateFocus = Boolean(playlistDuplicateFocusTrackIds?.size);
  const hasFilteredLayout = hasFilter || hasDuplicateFocus;
  const hideLeadingPlaceholder = !hasFilteredLayout && playlistItems[0] === null;
  let visibleItems = 0;
  if (playlistAutofillInProgress && !hasFilteredLayout) {
    const loadingRow = document.createElement("div");
    loadingRow.className = "list-row playlist-autofill-row";
    loadingRow.textContent = t("statusPlaylistAutofillRunning");
    fragment.appendChild(loadingRow);
  }
  playlistItems.forEach((item, index) => {
    if (hideLeadingPlaceholder && index === 0 && item === null) {
      return;
    }
    if (hasFilteredLayout) {
      if (!item) {
        return;
      }
      if (hasDuplicateFocus) {
        const trackIds = item.kind === "track"
          ? [item.track.id]
          : (resolveTandaDraft(item.tandaId)?.trackSlots.filter(Boolean) as string[] ?? []);
        const matches = trackIds.some((trackId) =>
          [...(similarityEquivalentTrackIds.get(trackId) ?? new Set([trackId]))]
            .some((equivalent) => playlistDuplicateFocusTrackIds!.has(equivalent)));
        if (!matches) return;
      } else if (playlistFilterTandaIds) {
        if (item.kind !== "tanda" || !playlistFilterTandaIds.has(item.tandaId)) return;
      } else if (item.kind === "track") {
        if (
          !matchesPlaylistFilter({
            filterText: playlistFilterText,
            orchestraFilter: playlistFilterOrchestra,
            fallbackText: getPlaylistTrackFilterText(item.track),
            canonicalArtists: getPlaylistTrackCanonicalArtists(item.track),
          })
        ) {
          return;
        }
      } else {
        const tandaForFilter =
          resolveTandaDraft(item.tandaId) ?? createPlaceholderTanda(item.tandaId);
        if (
          !matchesPlaylistFilter({
            filterText: playlistFilterText,
            orchestraFilter: playlistFilterOrchestra,
            fallbackText: getPlaylistTandaFilterText(tandaForFilter),
            canonicalArtists: getPlaylistTandaCanonicalArtists(tandaForFilter),
          })
        ) {
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
      if (isCortinaEnabled() && !hasFilteredLayout) {
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
      if (hasFilteredLayout && startLabel) {
        const scheduleDivider = document.createElement("div");
        scheduleDivider.className = "playlist-filter-schedule-divider";
        scheduleDivider.setAttribute("aria-label", t("playlistFilterScheduledFor", {
          time: startLabel,
        }));
        const scheduleLabel = document.createElement("span");
        scheduleLabel.textContent = t("playlistFilterScheduledFor", {
          time: startLabel,
        });
        scheduleDivider.appendChild(scheduleLabel);
        fragment.appendChild(scheduleDivider);
      }
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
      if (tanda.playlistUnsaved) {
        row.classList.add("playlist-unsaved");
        const unsavedIndicator = document.createElement("span");
        unsavedIndicator.className = "playlist-unsaved-indicator";
        unsavedIndicator.textContent = "✎";
        const unsavedLabel = tanda.masterTandaId
          ? t("playlistUnsavedChangesTooltip")
          : t("playlistOnlyTandaTooltip");
        unsavedIndicator.title = unsavedLabel;
        unsavedIndicator.setAttribute("aria-label", unsavedLabel);
        row.appendChild(unsavedIndicator);
      }
      if (tanda.autoGenerated) {
        row.classList.add("playlist-auto-generated");
        const autoGeneratedIndicator = document.createElement("span");
        autoGeneratedIndicator.className = "playlist-auto-generated-indicator";
        autoGeneratedIndicator.textContent = t("playlistAutoGeneratedIndicator");
        const autoGeneratedLabel = t("playlistAutoGeneratedTooltip");
        autoGeneratedIndicator.title = autoGeneratedLabel;
        autoGeneratedIndicator.setAttribute("aria-label", autoGeneratedLabel);
        row.appendChild(autoGeneratedIndicator);
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
      if (hasFilteredLayout) {
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
      const styleCode = rule?.code ? rule.code.toUpperCase() : "";
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
  if (!hasFilteredLayout && isCortinaEnabled() && playlistItems.some((item) => item?.kind === "tanda")) {
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
  if (hasFilteredLayout && visibleItems === 0) {
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
    (centerPlaylistTargetOnNextRender || (!hasFilteredLayout && lastRenderedPlaylistHasFilter));
  centerPlaylistTargetOnNextRender = false;
  lastRenderedPlaylistHasFilter = hasFilteredLayout;
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
    playlistStartBtn.disabled = !shouldEnablePlaylistStart(
      playlistPlayback.status,
      isMainPlaybackActive(),
      hasItems,
      Boolean(playlistPlayback.resume),
    );
  }
  if (playlistStopBtn) {
    playlistStopBtn.disabled = !shouldEnablePlaylistStop(
      playlistPlayback.status,
      isMainPlaybackActive(),
    );
  }
  if (playlistClearBtn) {
    playlistClearBtn.disabled = appMode === "live";
  }
  updateE2eRuntimeSnapshot();
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

const resolvePlaybackEndSeconds = (params: {
  durationMs: number;
  startAtSeconds: number;
  endTrimMs: number;
  maxDurationSeconds?: number | null;
}) => {
  const durationSeconds = Math.max(0, params.durationMs) / 1000;
  const startAtSeconds = Math.max(0, params.startAtSeconds);
  const endTrimSeconds = Math.max(0, params.endTrimMs) / 1000;
  const trimmedEndSeconds = computeTrimmedEnd(
    durationSeconds,
    startAtSeconds,
    endTrimSeconds,
  );
  const maxDurationSeconds =
    Number.isFinite(params.maxDurationSeconds) && (params.maxDurationSeconds ?? 0) > 0
      ? Math.max(0, params.maxDurationSeconds ?? 0)
      : null;
  if (trimmedEndSeconds === null) {
    return maxDurationSeconds;
  }
  if (maxDurationSeconds === null) {
    return trimmedEndSeconds;
  }
  return Math.min(trimmedEndSeconds, maxDurationSeconds);
};

const waitForPlaybackThreshold = (
  audio: HTMLAudioElement,
  runId: number,
  targetSeconds: number,
) =>
  new Promise<boolean>((resolve) => {
    const tick = () => {
      if (!isPlaylistRunActive(runId)) {
        resolve(false);
        return;
      }
      if (audio.paused || audio.ended || audio.currentTime >= targetSeconds) {
        resolve(true);
        return;
      }
      window.setTimeout(tick, 40);
    };
    tick();
  });

const waitBeforeCortina = (runId: number) =>
  waitForGap(getGapBeforeCortina() * 1000, runId);

const waitBeforeTanda = (runId: number) =>
  waitForGap(getGapBeforeTanda() * 1000, runId);

const waitForAudioEnd = (audio: HTMLAudioElement, runId: number) =>
  new Promise<boolean>((resolve) => {
    if (audio.paused || audio.ended) {
      resolve(true);
      return;
    }
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
  if (cortinaPlayBtn) {
    cortinaPlayBtn.disabled = !visible || cortinaAllowFull;
    cortinaPlayBtn.setAttribute("aria-disabled", cortinaPlayBtn.disabled ? "true" : "false");
  }
  if (cortinaStopBtn) {
    cortinaStopBtn.disabled = !visible;
    cortinaStopBtn.setAttribute("aria-disabled", cortinaStopBtn.disabled ? "true" : "false");
  }
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

const requestImmediateCortinaStop = () => {
  if (cortinaStopPromise) {
    return cortinaStopPromise;
  }
  const activeAudio = playback.main.active;
  if (!activeAudio || activeAudio.paused || activeAudio.ended) {
    cortinaStopPromise = Promise.resolve();
    return cortinaStopPromise;
  }
  const activeCompanion = playback.main.compressedActive;
  const fadeMs = Math.max(0, getStopFadeSeconds() * 1000);
  cortinaStopPromise = (async () => {
    if (fadeMs > 0) {
      await Promise.all([
        fadeOutAudio(activeAudio, fadeMs),
        activeCompanion && !activeCompanion.paused
          ? fadeOutAudio(activeCompanion, fadeMs)
          : Promise.resolve(),
      ]);
    }
    activeAudio.pause();
  })().finally(() => {
    cortinaStopPromise = null;
  });
  return cortinaStopPromise;
};

const playCortina = async (
  runId: number,
  targetIndex: number,
  options?: {
    transitionFadeMs?: number;
    allowOverlapIntoNextTanda?: boolean;
  },
): Promise<{
  ok: boolean;
  overlappedIntoNext: boolean;
  overlapFadeMs: number | null;
  track: TrackRow | null;
}> => {
  if (!isCortinaEnabled()) {
    return { ok: true, overlappedIntoNext: false, overlapFadeMs: null, track: null };
  }
  const setName = getCortinaSet();
  if (!setName) {
    return { ok: true, overlappedIntoNext: false, overlapFadeMs: null, track: null };
  }
  const track = await pickNextCortina(targetIndex);
  if (!track) {
    cortinaDisplayPhase = "none";
    return { ok: true, overlappedIntoNext: false, overlapFadeMs: null, track: null };
  }
  cortinaDisplayPhase = "playing";
  cortinaPlaying = true;
  cortinaAllowFull = false;
  cortinaStopRequested = false;
  cortinaStopPromise = null;
  cortinaAutoStopRevision += 1;
  cortinaActiveIndex = targetIndex;
  const configuredDurationMs = getCortinaDuration() * 1000;
  const effectiveDurationMs =
    Number.isFinite(configuredDurationMs) && configuredDurationMs > 0
      ? configuredDurationMs
      : 20_000;
  const autoStopFadeMs = Math.max(0, getStopFadeSeconds() * 1000);
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
      transitionFadeMs: options?.transitionFadeMs,
    },
  );
  if (!started) {
    cortinaDisplayPhase = "none";
    cortinaPlaying = false;
    cortinaActiveIndex = null;
    setCortinaControlsVisible(false);
    renderPlaylist();
    return { ok: false, overlappedIntoNext: false, overlapFadeMs: null, track };
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
    return { ok: false, overlappedIntoNext: false, overlapFadeMs: null, track };
  }
  if (options?.allowOverlapIntoNextTanda) {
    const gapBeforeTandaMs = getGapBeforeTanda() * 1000;
    const startAtSeconds = Math.max(0, track.start_offset_ms ?? 0) / 1000;
    const playbackEndSeconds = resolvePlaybackEndSeconds({
      durationMs: track.duration_ms,
      startAtSeconds,
      endTrimMs: track.end_trim_ms,
      maxDurationSeconds: effectiveDurationMs / 1000,
    });
    const transitionTimeSeconds = resolveScheduledTransitionTimeSeconds(
      playbackEndSeconds,
      startAtSeconds,
      gapBeforeTandaMs,
    );
    if (transitionTimeSeconds !== null) {
      const thresholdReached = await waitForPlaybackThreshold(
        activeAudio,
        runId,
        transitionTimeSeconds,
      );
      if (!thresholdReached) {
        return { ok: false, overlappedIntoNext: false, overlapFadeMs: null, track };
      }
      if (cortinaAllowFull || cortinaStopRequested) {
        // A DJ override cancels the scheduled handoff into the next tanda.
      } else if (!activeAudio.paused && !activeAudio.ended) {
        cortinaDisplayPhase = "none";
        holdCortinaDisplayWhenIdle = false;
        cortinaPlaying = false;
        cortinaActiveIndex = null;
        setCortinaControlsVisible(false);
        renderPlaylist();
        return {
          ok: true,
          overlappedIntoNext: true,
          overlapFadeMs: resolveOverlapFadeMs(gapBeforeTandaMs),
          track,
        };
      }
    }
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
      return { ok: true, overlappedIntoNext: false, overlapFadeMs: null, track };
    }
    if (cortinaStopRequested) {
      if (cortinaStopPromise) {
        await cortinaStopPromise;
      } else {
        await requestImmediateCortinaStop();
      }
    } else {
      const settled = await waitForGap(Math.max(300, autoStopFadeMs + 250), runId);
      if (!settled) {
        return { ok: false, overlappedIntoNext: false, overlapFadeMs: null, track };
      }
      if (cortinaStopRequested) {
        if (cortinaStopPromise) {
          await cortinaStopPromise;
        } else {
          await requestImmediateCortinaStop();
        }
      } else if (cortinaAllowFull) {
        await waitForAudioEnd(activeAudio, runId);
      } else if (!activeAudio.paused && !activeAudio.ended) {
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
  return { ok: true, overlappedIntoNext: false, overlapFadeMs: null, track };
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
    syncMarkedLastTandaRemainingCount();
  } else if (resumeState) {
    playlistPlayback.currentIndex = resumeState.itemIndex;
    playlistPlayback.currentTrackIndex = resumeState.trackIndex;
    if (!isCurrentTandaMarkedLast()) {
      markedLastTandaRemainingCount = null;
    } else if (markedLastTandaRemainingCount === null) {
      syncMarkedLastTandaRemainingCount();
    }
  }
  playlistPlayback.status = "playing";
  isMarkedLastFinalCortinaActive = false;
  isPerformanceStopFinalCortinaActive = false;
  isPausedForPerformanceStop = false;
  lastPausedPerformanceStopCortinaLabel = null;
  holdPerformanceStopDisplayBlankWhenIdle = false;
  playlistPlayback.activeTrackId = null;
  playlistPlayback.activeTandaId = null;
  playlistPlayback.liveBaseStartMs = computeLiveBaseStartMs(
    buildPlaylistTimeline(),
    resumeState,
  );
  let runCompleted = false;
  const finalizeRunAsIdle = () => {
    playlistPlayback.status = "idle";
    cortinaDisplayPhase = "none";
    playlistPlayback.activeTrackId = null;
    playlistPlayback.activeTandaId = null;
    playlistPlayback.resume = null;
    playlistPlayback.liveBaseStartMs = null;
    isPerformanceStopFinalCortinaActive = false;
    isPausedForPerformanceStop = false;
    lastPausedPerformanceStopCortinaLabel = null;
    holdPerformanceStopDisplayBlankWhenIdle = false;
    renderPlaylist();
    runCompleted = true;
  };
  renderPlaylist();
  const skipInitialGap = options?.skipInitialCortinaGap ?? false;
  let skipInitialGapPending = skipInitialGap;
  const startFromIdle = options?.startFromIdle ?? false;
  const suppressLeadInCortinaForSelectedStart =
    options?.suppressLeadInCortinaForSelectedStart ?? false;
  const selectedStartIndex = resumeState?.itemIndex ?? null;
  let continuedFromEndCortina = false;
  let leadInCortinaPlayed = false;
  let continuedFromGapOverlap = false;
  let pendingTransitionFadeMs: number | null = null;
  try {
    const hasPlayableItems = playlistItems.some((item) => {
      if (!item) {
        return false;
      }
      return resolvePlaylistTracks(item).length > 0;
    });
    if (!resume && hasPlayableItems && isCortinaEnabled()) {
      isMarkedLastFinalCortinaActive = false;
      cortinaDisplayPhase = "about";
      const cortinaResult = await playCortina(runId, playlistPlayback.currentIndex, {
        allowOverlapIntoNextTanda: true,
      });
      if (!cortinaResult.ok) {
        return;
      }
      if (cortinaResult.overlappedIntoNext) {
        continuedFromGapOverlap = true;
        pendingTransitionFadeMs = cortinaResult.overlapFadeMs;
      } else {
        cortinaDisplayPhase = "after";
        const postOk = await waitBeforeTanda(runId);
        if (!postOk) {
          return;
        }
        cortinaDisplayPhase = "none";
      }
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
          isMarkedLastFinalCortinaActive = false;
          cortinaDisplayPhase = "about";
          const gapOk = await waitBeforeCortina(runId);
          if (!gapOk) {
            return;
          }
        }
        const cortinaResult = await playCortina(runId, playlistPlayback.currentIndex, {
          allowOverlapIntoNextTanda: true,
        });
        if (!cortinaResult.ok) {
          return;
        }
        if (cortinaResult.overlappedIntoNext) {
          continuedFromGapOverlap = true;
          pendingTransitionFadeMs = cortinaResult.overlapFadeMs;
        } else {
          cortinaDisplayPhase = "after";
          const postOk = await waitBeforeTanda(runId);
          if (!postOk) {
            return;
          }
          cortinaDisplayPhase = "none";
          holdCortinaDisplayWhenIdle = false;
        }
        leadInCortinaPlayed = true;
      }
    }

    let playedAny = false;
    while (isPlaylistRunActive(runId)) {
    if (playlistPlayback.currentIndex >= playlistItems.length) {
      if (playedAny && isCortinaEnabled()) {
        isMarkedLastFinalCortinaActive = false;
        cortinaDisplayPhase = "about";
        const gapOk = await waitBeforeCortina(runId);
        if (!gapOk) {
          return;
        }
        const cortinaResult = await playCortina(runId, playlistPlayback.currentIndex, {
          allowOverlapIntoNextTanda: true,
        });
        if (!cortinaResult.ok) {
          return;
        }
        const hasPlayableByIndex = playlistItems.map((entry) =>
          entry ? resolvePlaylistTracks(entry).length > 0 : false,
        );
        if (
          shouldContinueAfterEndCortina(
            playlistPlayback.currentIndex,
            playlistItems.length,
            hasPlayableByIndex,
          )
        ) {
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
      finalizeRunAsIdle();
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
      const cortinaResult = await playCortina(runId, playlistPlayback.currentIndex, {
        transitionFadeMs: pendingTransitionFadeMs ?? undefined,
        allowOverlapIntoNextTanda: true,
      });
      pendingTransitionFadeMs = null;
      if (!cortinaResult.ok) {
        return;
      }
      if (cortinaResult.overlappedIntoNext) {
        continuedFromGapOverlap = true;
        pendingTransitionFadeMs = cortinaResult.overlapFadeMs;
      } else {
        cortinaDisplayPhase = "after";
        const postOk = await waitBeforeTanda(runId);
        if (!postOk) {
          return;
        }
        cortinaDisplayPhase = "none";
        holdCortinaDisplayWhenIdle = false;
      }
    }
    if (continuedFromEndCortina) {
      cortinaDisplayPhase = "after";
      const postOk = await waitBeforeTanda(runId);
      if (!postOk) {
        return;
      }
      cortinaDisplayPhase = "none";
      holdCortinaDisplayWhenIdle = false;
    }
    continuedFromEndCortina = false;
    leadInCortinaPlayed = false;
    if (
      playlistPlayback.currentTrackIndex === 0 &&
      playlistPlayback.currentIndex > 0 &&
      !isResumeWithOffset
    ) {
      if (!isCortinaEnabled() && !skipInitialGap && !continuedFromGapOverlap) {
        const ok = await waitBeforeTanda(runId);
        if (!ok) {
          return;
        }
      }
    }
    continuedFromGapOverlap = false;
    let tailTransitionStartedByOverlap = false;
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
      isMarkedLastFinalCortinaActive = false;
      const started = await playOnChannel(
        "main",
        track.full_path,
        track.id,
        track,
        track.gain_db,
        {
          allowToggle: false,
          startAtSeconds: resumeSeconds,
          fromPlaylist: true,
          transitionFadeMs: pendingTransitionFadeMs ?? undefined,
        },
      );
      pendingTransitionFadeMs = null;
      if (!started) {
        finalizeRunAsIdle();
        isMarkedLastFinalCortinaActive = false;
        return;
      }
      const activeAudio = playback.main.active;
      if (!activeAudio) {
        finalizeRunAsIdle();
        isMarkedLastFinalCortinaActive = false;
        return;
      }
      const isLastTrackInItem = index === tracks.length - 1;
      const gapAfterTrackMs = !isLastTrackInItem
        ? getGapBetweenTracks() * 1000
          : isCortinaEnabled()
            ? getGapBeforeCortina() * 1000
            : playlistPlayback.currentIndex < playlistItems.length - 1 ||
              shouldStopAfterMarkedLastTanda(item.kind, getMarkedLastTandaRemainingCount())
            ? getGapBeforeTanda() * 1000
            : 0;
      const startAtSeconds =
        Number.isFinite(resumeSeconds) && (resumeSeconds ?? 0) > 0
          ? resumeSeconds ?? 0
          : Math.max(0, track.start_offset_ms ?? 0) / 1000;
      if (shouldUseOverlapForGapMs(gapAfterTrackMs)) {
        const playbackEndSeconds = resolvePlaybackEndSeconds({
          durationMs: track.duration_ms,
          startAtSeconds,
          endTrimMs: track.end_trim_ms,
        });
        const transitionTimeSeconds = resolveScheduledTransitionTimeSeconds(
          playbackEndSeconds,
          startAtSeconds,
          gapAfterTrackMs,
        );
        if (transitionTimeSeconds !== null) {
          const thresholdReached = await waitForPlaybackThreshold(
            activeAudio,
            runId,
            transitionTimeSeconds,
          );
          if (!thresholdReached) {
            return;
          }
          if (!activeAudio.paused && !activeAudio.ended) {
            if (appMode === "live") {
              incrementTrackPlayCount(track.id);
            }
            pendingTransitionFadeMs = resolveOverlapFadeMs(gapAfterTrackMs);
            if (!isLastTrackInItem) {
              continue;
            }
            continuedFromGapOverlap = true;
            tailTransitionStartedByOverlap = true;
            break;
          }
        }
      }
      const ended = await waitForAudioEnd(activeAudio, runId);
      if (!ended) {
        return;
      }
      if (appMode === "live") {
        incrementTrackPlayCount(track.id);
      }
      if (index < tracks.length - 1) {
        const ok = await waitForGap(Math.max(0, getGapBetweenTracks() * 1000), runId);
        if (!ok) {
          return;
        }
      }
    }
    playedAny = true;
    if (appMode === "live" && item.kind === "tanda") {
      incrementTandaPlayCount(item.tandaId);
    }
    if (appMode === "live") {
      savePlayCounts();
    }
    const stopAfterThisTanda = shouldStopAfterMarkedLastTanda(
      item.kind,
      getMarkedLastTandaRemainingCount(),
    );
    const pauseAfterThisTandaForPerformance = shouldPauseAfterMarkedPerformanceStop(
      item.kind,
      isCurrentTandaMarkedPerformanceStop(),
    );
    if (item.kind === "tanda" && isCurrentTandaMarkedLast()) {
      markedLastTandaRemainingCount = decrementLastTandaRemainingCount(
        getMarkedLastTandaRemainingCount(),
      );
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
      const performanceResume = pauseAfterThisTandaForPerformance
        ? resolveFirstPlayablePlaylistPosition(playlistPlayback.currentIndex)
        : null;
    if (stopAfterThisTanda) {
      if (isCortinaEnabled()) {
        isMarkedLastFinalCortinaActive = true;
        cortinaDisplayPhase = "about";
        if (!tailTransitionStartedByOverlap) {
          const gapOk = await waitBeforeCortina(runId);
          if (!gapOk) {
            return;
          }
        }
        const cortinaResult = await playCortina(runId, playlistPlayback.currentIndex, {
          transitionFadeMs: pendingTransitionFadeMs ?? undefined,
        });
        pendingTransitionFadeMs = null;
        if (!cortinaResult.ok) {
          return;
        }
      }
      finalizeRunAsIdle();
      return;
    }
    if (pauseAfterThisTandaForPerformance) {
      let finalCortinaTrack: TrackRow | null = null;
      if (isCortinaEnabled()) {
        isPerformanceStopFinalCortinaActive = true;
        cortinaDisplayPhase = "about";
        if (!tailTransitionStartedByOverlap) {
          const gapOk = await waitBeforeCortina(runId);
          if (!gapOk) {
            return;
          }
        }
        const cortinaResult = await playCortina(runId, playlistPlayback.currentIndex, {
          transitionFadeMs: pendingTransitionFadeMs ?? undefined,
        });
        pendingTransitionFadeMs = null;
        if (!cortinaResult.ok) {
          return;
        }
        finalCortinaTrack = cortinaResult.track;
      }
      playlistPlayback.status = performanceResume ? "paused" : "idle";
      playlistPlayback.activeTrackId = null;
      playlistPlayback.activeTandaId = null;
      playlistPlayback.liveBaseStartMs = null;
      cortinaDisplayPhase = "none";
      if (performanceResume) {
        playlistPlayback.currentIndex = performanceResume.itemIndex;
        playlistPlayback.currentTrackIndex = performanceResume.trackIndex;
        playlistPlayback.resume = {
          itemIndex: performanceResume.itemIndex,
          trackIndex: performanceResume.trackIndex,
          trackId: performanceResume.trackId,
          resumeTime: 0,
        };
        if (finalCortinaTrack) {
          cortinaOverrideByIndex.set(performanceResume.itemIndex, finalCortinaTrack);
        }
        isPausedForPerformanceStop = true;
        lastPausedPerformanceStopCortinaLabel = finalCortinaTrack
          ? resolveNowPlayingTrackLabel(finalCortinaTrack)
          : null;
      } else {
        playlistPlayback.resume = null;
        isPausedForPerformanceStop = false;
        lastPausedPerformanceStopCortinaLabel = null;
      }
      isPerformanceStopFinalCortinaActive = false;
      holdPerformanceStopDisplayBlankWhenIdle = true;
      renderPlaylist();
      runCompleted = true;
      return;
    }
    }
  } finally {
    if (!runCompleted && isPlaylistRunActive(runId)) {
      finalizeRunAsIdle();
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

const stopPlaybackFromPlaylistControls = async () => {
  const fadeMs = getStopFadeSeconds() * 1000;
  const preservePausedPerformanceResume = shouldPreservePausedPerformanceResumeOnStop(
    playlistPlayback.status,
    Boolean(playlistPlayback.resume),
    isPausedForPerformanceStop,
    isMainPlaybackActive(),
  );
  if (preservePausedPerformanceResume) {
    playlistPlayback.status = "paused";
    playlistPlayback.activeTrackId = null;
    playlistPlayback.activeTandaId = null;
    playlistPlayback.liveBaseStartMs = null;
  } else {
    playlistPlayback.status = "idle";
    playlistPlayback.resume = null;
    playlistPlayback.currentIndex = 0;
    playlistPlayback.currentTrackIndex = 0;
    playlistPlayback.playedThroughIndex = -1;
    playlistPlayback.activeTrackId = null;
    playlistPlayback.activeTandaId = null;
    playlistPlayback.liveBaseStartMs = null;
    isPausedForPerformanceStop = false;
    lastPausedPerformanceStopCortinaLabel = null;
    markedLastTandaRemainingCount = null;
  }
  cortinaDisplayPhase = "none";
  cortinaPlaying = false;
  cortinaStopRequested = false;
  cortinaActiveIndex = null;
  isMarkedLastFinalCortinaActive = false;
  isPerformanceStopFinalCortinaActive = false;
  holdCortinaDisplayWhenIdle = preservePausedPerformanceResume;
  holdPerformanceStopDisplayBlankWhenIdle = preservePausedPerformanceResume;
  setCortinaControlsVisible(false);
  await Promise.all([
    stopChannelPlayback("main", fadeMs),
    stopChannelPlayback("headphone", fadeMs),
  ]);
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
  resolveCanonicalArtistName(track.artist_summary || track.artist || "")
    .trim()
    .toLowerCase();

const singerKey = (track: TrackRow) => (track.singer ?? "").trim().toLowerCase();

const collectUsedTrackTitles = () => {
  const used = new Set<string>();
  const addTrack = (track: TrackRow) => {
    used.add(normalizeTrackTitleForAutofill(track));
    const equivalents = similarityEquivalentTrackIds.get(track.id) ?? new Set([track.id]);
    equivalents.forEach((trackId) => used.add(`@similarity:${trackId}`));
  };
  playlistItems.forEach((item) => {
    if (!item) {
      return;
    }
    if (item.kind === "track") {
      addTrack(item.track);
      return;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      return;
    }
    getTandaTracks(tanda).forEach(addTrack);
  });
  return used;
};

const isAutofillTrackUsed = (track: TrackRow, used: Set<string>) =>
  used.has(normalizeTrackTitleForAutofill(track))
  || [...(similarityEquivalentTrackIds.get(track.id) ?? new Set([track.id]))]
    .some((trackId) => used.has(`@similarity:${trackId}`));

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
  return Array.from(combined.values()).filter((tanda) =>
    !tanda.trackSlots.some((trackId) =>
      Boolean(trackId && similarityHiddenTrackIds.has(trackId))));
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
        tracks.some((track) => isAutofillTrackUsed(track, usedTrackTitles))
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
  const usable = filterByArtistRepeatGap({
    items: asScored,
    repeatGapMs,
    isGapSatisfied: (entry) => respectsGap(entry.tanda),
  });
  if (usable.length === 0) {
    return null;
  }
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
    if (isAutofillTrackUsed(track, usedTrackTitles)) {
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
          const seedTraits = {
            artist: seedArtist,
            singer: seedSinger,
            instrumental: seedInstrumental,
            year: seedYear,
            bpm: seedBpm,
          };
          const score = (track: TrackRow) => scoreTandaTrackCohesion(
            seedTraits,
            {
              artist: artistKey(track),
              singer: singerKey(track),
              instrumental: track.instrumental,
              year: yearValue(track),
              bpm: track.bpm,
            },
            artistCounts.get(artistKey(track)) ?? 0,
          );
          const difference = score(left) - score(right);
          return difference !== 0 ? difference : left.id.localeCompare(right.id);
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
        repeatGapMs > 0 &&
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
        playlistUnsaved: true,
        autoGenerated: true,
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
    const equivalents = similarityEquivalentTrackIds.get(track.id) ?? new Set([track.id]);
    equivalents.forEach((trackId) => usedTrackTitles.add(`@similarity:${trackId}`));
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
  isMarkedLastFinalCortinaActive = false;
  isPerformanceStopFinalCortinaActive = false;
  isPausedForPerformanceStop = false;
  lastPausedPerformanceStopCortinaLabel = null;
  holdPerformanceStopDisplayBlankWhenIdle = false;
  markedLastTandaRemainingCount = null;
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

const clearAndAutofillPlaylist = async (options?: { generateOnly?: boolean }) => {
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
    const candidateTandas = options?.generateOnly
      ? []
      : await collectSavedAutofillTandas();
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
  syncMarkedLastTandaRemainingCount();
  const skipInitialCortinaGap = wasIdle;
  void runPlaylistPlayback(true, {
    skipInitialCortinaGap,
    startFromIdle: wasIdle,
    suppressLeadInCortinaForSelectedStart: appMode !== "live",
  });
};

const resolvePlaylistPositionForTrackId = (
  trackId: string,
): { itemIndex: number; trackIndex: number } | null => {
  if (!trackId) {
    return null;
  }
  for (let itemIndex = 0; itemIndex < playlistItems.length; itemIndex += 1) {
    const item = playlistItems[itemIndex];
    if (!item) {
      continue;
    }
    if (item.kind === "track") {
      if (item.track.id === trackId) {
        return { itemIndex, trackIndex: 0 };
      }
      continue;
    }
    const tanda = resolveTandaDraft(item.tandaId);
    if (!tanda) {
      continue;
    }
    const trackIndex = tanda.trackSlots.indexOf(trackId);
    if (trackIndex >= 0) {
      return { itemIndex, trackIndex };
    }
  }
  return null;
};

const attachActivePlaylistTrackToRun = () => {
  if (playlistPlayback.status !== "idle") {
    return false;
  }
  const active = playback.main.active;
  const activeTrackId = playback.main.currentTrackId;
  if (!active || active.paused || !activeTrackId) {
    return false;
  }
  const position = resolvePlaylistPositionForTrackId(activeTrackId);
  if (!position) {
    return false;
  }
  playlistPlayback.status = "paused";
  playlistPlayback.currentIndex = position.itemIndex;
  playlistPlayback.currentTrackIndex = position.trackIndex;
  playlistPlayback.playedThroughIndex = Math.max(-1, position.itemIndex - 1);
  playlistPlayback.resume = {
    itemIndex: position.itemIndex,
    trackIndex: position.trackIndex,
    trackId: activeTrackId,
    resumeTime: active.currentTime ?? 0,
  };
  syncMarkedLastTandaRemainingCount();
  void runPlaylistPlayback(true, {
    skipInitialCortinaGap: false,
    startFromIdle: false,
    suppressLeadInCortinaForSelectedStart: true,
  });
  return true;
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
      getBaseStyles().forEach((baseStyle) => {
        const button = document.createElement("button");
        const selectedVariantStyle = tanda.styles.reduce<string | null>((found, selectedStyle) => {
          if (found) {
            return found;
          }
          const parts = splitStyleLabel(selectedStyle);
          return parts.base === baseStyle && parts.variant ? selectedStyle : null;
        }, null);
        button.textContent = selectedVariantStyle
          ? formatStylePillLabel(selectedVariantStyle, styleFamilies)
          : baseStyle;
        button.title = selectedVariantStyle ?? baseStyle;
        button.classList.toggle(
          "active",
          tanda.styles.some((selected) => splitStyleLabel(selected).base === baseStyle),
        );
        button.disabled = locked;
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
          tanda.styles = toggleTandaBaseStyle(tanda.styles, baseStyle);
          selectedStyles = toBaseStyleFilters(tanda.styles);
          setActiveTanda(tanda.id);
        });
        button.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          const family = styleFamilies.find((item) => item.base === baseStyle);
          if (!family || family.variants.length === 0) {
            return;
          }
          clearLongPress();
          openTandaStyleVariantMenu(
            event.clientX,
            event.clientY,
            baseStyle,
            family,
            (styleValue) => {
              tanda.styles = selectTandaVariantStyle(tanda.styles, baseStyle, styleValue);
              selectedStyles = toBaseStyleFilters(tanda.styles);
              setActiveTanda(tanda.id);
            },
          );
        });
        button.addEventListener("mousedown", (event) => {
          if (event.button !== 0) {
            return;
          }
          const family = styleFamilies.find((item) => item.base === baseStyle);
          if (!family || family.variants.length === 0) {
            return;
          }
          clearLongPress();
          longPressTimer = window.setTimeout(() => {
            longPressTimer = null;
            const rect = button.getBoundingClientRect();
            button.dataset.longPressHandled = "1";
            openTandaStyleVariantMenu(
              rect.left + Math.min(rect.width - 8, 24),
              rect.bottom + 4,
              baseStyle,
              family,
              (styleValue) => {
                tanda.styles = selectTandaVariantStyle(tanda.styles, baseStyle, styleValue);
                selectedStyles = toBaseStyleFilters(tanda.styles);
                setActiveTanda(tanda.id);
              },
            );
          }, STYLE_VARIANT_LONG_PRESS_MS);
        });
        button.addEventListener("mouseup", clearLongPress);
        button.addEventListener("mouseleave", clearLongPress);
        button.addEventListener("touchstart", () => {
          const family = styleFamilies.find((item) => item.base === baseStyle);
          if (!family || family.variants.length === 0) {
            return;
          }
          clearLongPress();
          longPressTimer = window.setTimeout(() => {
            longPressTimer = null;
            const rect = button.getBoundingClientRect();
            button.dataset.longPressHandled = "1";
            openTandaStyleVariantMenu(
              rect.left + Math.min(rect.width - 8, 24),
              rect.bottom + 4,
              baseStyle,
              family,
              (styleValue) => {
                tanda.styles = selectTandaVariantStyle(tanda.styles, baseStyle, styleValue);
                selectedStyles = toBaseStyleFilters(tanda.styles);
                setActiveTanda(tanda.id);
              },
            );
          }, STYLE_VARIANT_LONG_PRESS_MS);
        });
        button.addEventListener("touchend", clearLongPress);
        button.addEventListener("touchcancel", clearLongPress);
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
          artist: summarizeTrackArtist(track),
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
    [...READ_ONLY_CLIPBOARD_COLLECTION_IDS],
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
  if (original.playlistUnsaved) {
    return original;
  }
  const draft = cloneTandaWithNewId(original, "playlist");
  draft.masterTandaId = original.masterTandaId ?? original.id;
  draft.playlistUnsaved = true;
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
    if (rule?.code) {
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
    const sourceTanda = resolveTandaDraft(existing.tandaId);
    if (!sourceTanda) {
      return;
    }
    const emptyIndex = sourceTanda.trackSlots.findIndex((slot) => !slot);
    if (emptyIndex < 0) {
      setStatus(t("statusPlaylistNoEmptySlot"));
      return;
    }
    const previewTrackSlots = [...sourceTanda.trackSlots];
    previewTrackSlots[emptyIndex] = track.id;
    const previewTracks = previewTrackSlots.map((id) =>
      id ? trackCache.get(id) ?? null : null,
    );
    const derivedStyles = collectStylesFromTracks(previewTracks, availableStyles);
    const normalizedExisting = sourceTanda.styles
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
      ...sourceTanda,
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
    const tanda = ensurePlaylistEditableTanda(existing.tandaId, insertIndex);
    if (!tanda) {
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
      tandaId: tanda.id,
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
  const styleMap = getPlaylistStyleMap();
  const trackStyle = canonicalizeStyleForMatching(track.genre ?? "");
  if (!trackStyle) {
    return true;
  }
  const alternatives = rule.alternatives.length > 0 ? rule.alternatives : [{ count: rule.count, code: rule.code }];
  return !alternatives.some((alternative) => {
    const mapped = styleMap[alternative.code] ?? [];
    if (mapped.length === 0) {
      return true;
    }
    const mappedCanonical = mapped.map((style) =>
      canonicalizeStyleForMatching(style),
    );
    return mappedCanonical.includes(trackStyle);
  });
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
    masterTandaId: null,
    playlistUnsaved: true,
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

const getDisplayLagSeconds = () => {
  const value = Number.parseFloat(localStorage.getItem(DISPLAY_AV_LAG_KEY) ?? "0");
  return Number.isFinite(value) ? Math.min(4, Math.max(0, value)) : 0;
};

const displayLagScheduler = createDisplayLagScheduler<DisplayUpdatePayload>(
  (payload) => void window.tanda?.updateDisplay(payload),
  getDisplayLagSeconds(),
);

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
  masterTandaId: tanda.masterTandaId,
  playlistUnsaved: tanda.playlistUnsaved,
  autoGenerated: tanda.autoGenerated,
  legacySourcePath: tanda.legacySourcePath,
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
    legacySourcePath: tanda.legacy_source_path,
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

const getConfirmedSimilarCandidates = async (track: TrackRow) => {
  const equivalentIds = similarityEquivalentTrackIds.get(track.id);
  if (!equivalentIds || equivalentIds.size < 2 || !window.tanda) return [];
  const allTracks = await window.tanda.listTracks();
  return allTracks
    .filter((candidate) =>
      equivalentIds.has(candidate.id) && !similarityHiddenTrackIds.has(candidate.id))
    .sort((left, right) => left.id.localeCompare(right.id));
};

const appendSimilarityVersionNumber = (row: HTMLTableRowElement, index: number) => {
  const number = document.createElement("td");
  number.className = "audio-similarity-version-number";
  number.textContent = `#${index + 1}`;
  row.appendChild(number);
};

const previewSearchTrackOnHeadphones = async (track: TrackRow) => {
  const candidates = await getConfirmedSimilarCandidates(track);
  if (similarityRelationshipByTrackId.get(track.id) !== "same-recording"
    || candidates.length < 2) {
    await playOnChannel("headphone", track.full_path, track.id, track, track.gain_db);
    updateHeadphoneButtonIndicators();
    return;
  }
  const body = openAudioSimilarityOverlay(t("audioSimilarityConfirmedGroup", {
    type: t("audioSimilaritySameRecording"),
    count: candidates.length,
  }));
  const table = document.createElement("table");
  table.className = "audio-similarity-version-table";
  candidates.forEach((candidate, index) => {
    const row = document.createElement("tr");
    appendSimilarityVersionNumber(row, index);
    const previewCell = document.createElement("td");
    previewCell.className = "audio-similarity-version-preview";
    const headphone = buildHeadphoneButton(candidate.id);
    headphone.disabled = !headphoneAvailable;
    headphone.addEventListener("click", async () => {
      await playOnChannel(
        "headphone", candidate.full_path, candidate.id, candidate, candidate.gain_db,
      );
      updateHeadphoneButtonIndicators();
    });
    previewCell.appendChild(headphone);
    const identity = document.createElement("td");
    identity.textContent = [candidate.artist, candidate.title, candidate.album, candidate.full_path]
      .filter(Boolean).join(" · ");
    row.append(previewCell, identity);
    table.appendChild(row);
  });
  body.appendChild(table);
};

const chooseConfirmedSimilarTrack = async (track: TrackRow): Promise<TrackRow | null> => {
  const candidates = await getConfirmedSimilarCandidates(track);
  if (candidates.length < 2) return track;
  if (similarityRelationshipByTrackId.get(track.id) === "identical") {
    const preferredId = similarityPreferredTrackIds.get(track.id);
    return candidates.find((candidate) => candidate.id === preferredId) ?? track;
  }
  return await new Promise<TrackRow | null>((resolve) => {
    const body = openAudioSimilarityOverlay(t("audioSimilarityConfirmedGroup", {
      type: t(similarityRelationshipByTrackId.get(track.id) === "same-orchestra"
        ? "audioSimilaritySameOrchestra"
        : similarityRelationshipByTrackId.get(track.id) === "same-composition"
          ? "audioSimilaritySameComposition"
          : "audioSimilaritySameRecording"),
      count: candidates.length,
    }));
    const overlay = body.closest<HTMLElement>(".audio-similarity-lazy-modal");
    let settled = false;
    let selectedTrackId = candidates.some((candidate) => candidate.id === track.id)
      ? track.id : null;
    const finish = (selected: TrackRow | null) => {
      if (settled) return;
      settled = true;
      overlay?.remove();
      resolve(selected);
    };
    overlay?.querySelector("header button")?.addEventListener("click", () => finish(null), { once: true });
    overlay?.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    }, { once: true });
    const table = document.createElement("table");
    table.className = "audio-similarity-version-table";
    candidates.forEach((candidate, index) => {
      const row = document.createElement("tr");
      if (candidate.id === track.id) row.classList.add("current");
      appendSimilarityVersionNumber(row, index);
      const selectionCell = document.createElement("td");
      selectionCell.className = "audio-similarity-version-selection";
      const selection = document.createElement("input");
      selection.type = "radio";
      selection.name = `similarity-version-${track.id}`;
      selection.value = candidate.id;
      selection.checked = selectedTrackId === candidate.id;
      selection.setAttribute("aria-label", t("audioSimilarityUseVersion", {
        track: candidate.title,
      }));
      selection.addEventListener("change", () => {
        if (selection.checked) selectedTrackId = candidate.id;
        apply.disabled = !selectedTrackId;
      });
      selectionCell.appendChild(selection);
      const previewCell = document.createElement("td");
      previewCell.className = "audio-similarity-version-preview";
      const headphone = buildHeadphoneButton(candidate.id);
      headphone.disabled = !headphoneAvailable;
      headphone.addEventListener("click", async () => {
        if (!headphoneAvailable) return;
        await stopMainForSimilarityAudition();
        await playOnChannel(
          "headphone", candidate.full_path, candidate.id, candidate, candidate.gain_db,
        );
        updateHeadphoneButtonIndicators();
      });
      previewCell.appendChild(headphone);
      const identity = document.createElement("td");
      identity.textContent = [candidate.artist, candidate.title, candidate.album, candidate.full_path]
        .filter(Boolean).join(" · ");
      row.append(selectionCell, previewCell, identity);
      table.appendChild(row);
    });
    body.appendChild(table);
    const actions = document.createElement("div");
    actions.className = "audio-similarity-actions audio-similarity-picker-footer";
    const cancel = document.createElement("button");
    cancel.textContent = t("cancel");
    cancel.addEventListener("click", () => finish(null));
    const apply = document.createElement("button");
    apply.textContent = t("audioSimilarityApply");
    apply.disabled = !selectedTrackId;
    apply.addEventListener("click", () => {
      finish(candidates.find((candidate) => candidate.id === selectedTrackId) ?? null);
    });
    actions.append(cancel, apply);
    body.appendChild(actions);
  });
};

const addTrackToActiveTanda = async (requestedTrack: TrackRow) => {
  let track: TrackRow | null;
  try {
    track = await chooseConfirmedSimilarTrack(requestedTrack);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
    return false;
  }
  if (!track) return true;
  let activeTanda = getActiveTanda();
  if (!activeTanda) {
    activeTanda = createEmptyTanda();
    ensureTandaDraft(activeTanda, "designer");
    selectedTandaId = activeTanda.id;
    tandaEditorReturnTab = null;
    tandaEditorHostTab = "tanda-designer-tab";
  }
  const added = addTrackToTanda(activeTanda.id, track);
  if (added) {
    activateRightTab(
      tandaEditorHostTab === "playlist-tab" ? "playlist-tab" : "tanda-designer-tab",
    );
  }
  return added;
};

const addTandaToClipboard = (tandaId: string) => {
  const target = resolveCollectionForClipboardWrite(
    activeClipboardCollectionId,
    getGeneralCollection()?.id ?? null,
    CLIPBOARD_NEW_ID,
    [...READ_ONLY_CLIPBOARD_COLLECTION_IDS],
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

const formatAlertErrorMessage = (message: unknown) => {
  const normalized =
    typeof message === "string" ? message : message === null || message === undefined ? "" : String(message);
  const compact = normalized.replace(/\s+/g, " ").trim();
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
    [...READ_ONLY_CLIPBOARD_COLLECTION_IDS],
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
    [...READ_ONLY_CLIPBOARD_COLLECTION_IDS],
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
  const bases = sortBaseStyles(styleFamilies.map((family) => family.base).filter(Boolean));
  if (bases.length > 0) {
    return bases;
  }
  return sortBaseStyles(
    availableStyles.map((style) => splitStyleLabel(style).base).filter(Boolean),
  );
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
      pulseStyleFamilyEditFields([
        styleFamilyCodeInput,
        styleFamilyBaseInput,
        styleFamilyVariantsInput,
      ]);
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

const saveLegacyStyleMappings = () => {
  localStorage.setItem(
    LEGACY_STYLE_MAPPINGS_KEY,
    JSON.stringify(legacyStyleMappings),
  );
};

const rememberLegacyStyleMapping = (legacyStyle: string, canonicalStyle: string) => {
  if (!legacyImportRootPath) {
    return;
  }
  legacyStyleMappings = setLegacyStyleMapping(
    legacyStyleMappings,
    legacyImportRootPath,
    legacyStyle,
    canonicalStyle,
  );
  saveLegacyStyleMappings();
};

const resolveStoredLegacyStyleMapping = (legacyStyle: string) => {
  if (!legacyImportRootPath) {
    return "";
  }
  return getLegacyStyleMapping(
    legacyStyleMappings,
    legacyImportRootPath,
    legacyStyle,
  );
};

const refreshLegacyStyleRows = async () => {
  if (!window.tanda || !legacyImportRootPath) {
    return;
  }
  const result = await window.tanda.listLegacyStyles(legacyImportRootPath);
  if (!result.ok) {
    return;
  }
  legacyStyleRows = result.styles.map((entry) => {
    const mappedTo = entry.mappedTo || resolveStoredLegacyStyleMapping(entry.value);
    if (mappedTo) {
      rememberLegacyStyleMapping(entry.value, mappedTo);
    }
    return {
      ...entry,
      mappedTo,
    };
  });
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

const applyStoredLegacyStyleMappingsForImport = async () => {
  if (!window.tanda || !legacyImportRootPath || legacyStyleRows.length === 0) {
    return;
  }
  let changed = false;
  for (const row of legacyStyleRows) {
    if (row.mappedTo) {
      continue;
    }
    const target = resolveStoredLegacyStyleMapping(row.value);
    if (!target) {
      continue;
    }
    await mapLegacyStyleToCanonical(row.value, target);
    rememberLegacyStyleMapping(row.value, target);
    changed = true;
  }
  if (changed) {
    await loadStyles();
    await refreshLegacyStyleRows();
  }
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
        rememberLegacyStyleMapping(entry.value, selected);
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
      rememberLegacyStyleMapping(entry.value, base);
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

const getSettingsDiagnosticsController = () => {
  if (settingsDiagnosticsController) {
    return settingsDiagnosticsController;
  }
  if (
    !window.tanda?.getDiagnosticsPaths ||
    !window.tanda?.pickFfmpegToolsDir ||
    !window.tanda?.getFfmpegToolsDir ||
    !window.tanda?.setFfmpegToolsDir ||
    !window.tanda?.getDiagnosticsLogs ||
    !window.tanda?.clearDiagnosticsLogs ||
    !window.tanda?.getDiagnosticsDataReadiness
  ) {
    return null;
  }
  settingsDiagnosticsController = createSettingsDiagnosticsController({
    translate: t,
    pickFfmpegToolsDir: window.tanda.pickFfmpegToolsDir,
    getFfmpegToolsDir: window.tanda.getFfmpegToolsDir,
    setFfmpegToolsDir: window.tanda.setFfmpegToolsDir,
    getDiagnosticsPaths: window.tanda.getDiagnosticsPaths,
    getDiagnosticsLogs: window.tanda.getDiagnosticsLogs,
    clearDiagnosticsLogs: window.tanda.clearDiagnosticsLogs,
    getDiagnosticsDataReadiness: window.tanda.getDiagnosticsDataReadiness,
    enumerateDevices: () => navigator.mediaDevices.enumerateDevices(),
    requestAudioAccess: async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    },
    createAudioProbe: () => new Audio(),
  });
  return settingsDiagnosticsController;
};

const renderDiagnosticsPaths = async () => {
  if (!diagnosticsPathsEl) {
    return;
  }
  const controller = getSettingsDiagnosticsController();
  if (!controller) {
    return;
  }
  await controller.renderDiagnosticsPaths(diagnosticsPathsEl);
};

const renderFfmpegToolsDir = async () => {
  if (!diagnosticsFfmpegToolsResult) {
    return;
  }
  const controller = getSettingsDiagnosticsController();
  if (!controller) {
    return;
  }
  await controller.renderFfmpegToolsDir(diagnosticsFfmpegToolsResult);
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
  const controller = getSettingsDiagnosticsController();
  if (!controller) {
    return;
  }
  await controller.runAudioOutputProbe(diagnosticsOutputProbeResult);
};

let diagnosticsReviewAudio: HTMLAudioElement | null = null;
let diagnosticsReviewStopAtSeconds: number | null = null;
let diagnosticsReviewPlayhead: HTMLElement | null = null;
let diagnosticsReviewState: HTMLElement | null = null;

const stopDiagnosticsReviewAudio = () => {
  diagnosticsReviewAudio?.pause();
  if (diagnosticsReviewAudio) diagnosticsReviewAudio.src = "";
  diagnosticsReviewAudio = null;
  diagnosticsReviewStopAtSeconds = null;
  if (diagnosticsReviewState) {
    diagnosticsReviewState.textContent = t("diagnosticsTrackReviewStopped");
    diagnosticsReviewState.dataset.state = "stopped";
  }
};

const stopMainForDiagnosticsAudition = async () => {
  if (!playback.main.active || playback.main.active.paused) return;
  await stopChannelPlayback("main", getStopFadeSeconds() * 1000);
};

const renderDiagnosticsTrackReview = async (target: HTMLElement) => {
  if (!window.tanda) return;
  stopDiagnosticsReviewAudio();
  const summary = await window.tanda.getDiagnosticsDataReadiness();
  const deduplicatedTracks = new Map(
    [...summary.shortDurationTracks, ...summary.aggressivelyTrimmedTracks]
      .map((track) => [track.id, track] as const),
  );
  const tracks = new Map(
    [...deduplicatedTracks.values()]
      .sort((left, right) => Number(left.acknowledged) - Number(right.acknowledged))
      .map((track) => [track.id, track] as const),
  );
  target.innerHTML = "";
  if (tracks.size === 0) {
    target.textContent = t("diagnosticsTrackLengthNone");
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  [t("trackEditorTitle"), t("diagnosticsTrackReviewIssue"), t("audioSimilarityMetaDuration"), t("diagnosticsTrackReviewStatus")]
    .forEach((label) => {
      const cell = document.createElement("th");
      cell.textContent = label;
      headerRow.appendChild(cell);
    });
  head.appendChild(headerRow);
  table.appendChild(head);
  const body = document.createElement("tbody");
  const panel = document.createElement("div");
  panel.className = "diagnostics-track-review-panel";
  table.appendChild(body);
  const tableScroller = document.createElement("div");
  tableScroller.className = "diagnostics-track-review-table-scroller";
  tableScroller.appendChild(table);
  target.append(panel, tableScroller);

  const selectTrack = async (track: typeof summary.shortDurationTracks[number], row: HTMLTableRowElement) => {
    body.querySelectorAll("tr").forEach((candidate) => candidate.setAttribute("aria-selected", "false"));
    row.setAttribute("aria-selected", "true");
    stopDiagnosticsReviewAudio();
    panel.innerHTML = "";
    const heading = document.createElement("h4");
    const formatDuration = (durationMs: number) => {
      const seconds = Math.max(0, Math.round(durationMs / 1000));
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    };
    const issueLabel = track.issueKinds
      .map((kind) => t(kind === "short" ? "diagnosticsTrackReviewShort" : "diagnosticsTrackReviewTrim"))
      .join(", ");
    heading.textContent = `${track.title} — ${t("diagnosticsTrackReviewTitleDetails", {
      effective: formatDuration(track.effectiveDurationMs),
      original: formatDuration(track.durationMs),
      issue: issueLabel,
    })}`;
    const sourcePath = document.createElement("div");
    sourcePath.className = "diagnostics-track-review-path";
    sourcePath.textContent = track.relativePath;
    const playbackState = document.createElement("span");
    playbackState.className = "diagnostics-track-review-state";
    playbackState.dataset.state = "stopped";
    playbackState.textContent = t("diagnosticsTrackReviewStopped");
    diagnosticsReviewState = playbackState;
    const reviewNotice = document.createElement("div");
    reviewNotice.className = "diagnostics-track-review-notice hidden";
    if (track.acknowledged) {
      reviewNotice.textContent = t("diagnosticsTrackReviewAcknowledged");
      reviewNotice.classList.remove("hidden");
    }
    const waveform = document.createElement("div");
    waveform.className = "diagnostics-trim-waveform";
    const leftShade = document.createElement("div");
    const rightShade = document.createElement("div");
    const playhead = document.createElement("div");
    leftShade.className = rightShade.className = "diagnostics-trim-shade";
    playhead.className = "diagnostics-trim-playhead";
    leftShade.style.left = "0";
    rightShade.style.right = "0";
    playhead.style.left = "0%";
    waveform.append(leftShade, rightShade, playhead);
    diagnosticsReviewPlayhead = playhead;
    const start = document.createElement("input");
    const end = document.createElement("input");
    for (const input of [start, end]) {
      input.type = "range";
      input.min = "0";
      input.max = String(track.durationMs);
      input.step = "10";
      input.className = "diagnostics-trim-handle";
    }
    start.value = String(track.startOffsetMs);
    end.value = String(track.durationMs - track.endTrimMs);
    const startLabel = document.createElement("label");
    const endLabel = document.createElement("label");
    const redraw = () => {
      let startMs = Math.max(0, Number(start.value));
      let endMs = Math.min(track.durationMs, Number(end.value));
      if (startMs >= endMs) {
        if (document.activeElement === start) startMs = Math.max(0, endMs - 10);
        else endMs = Math.min(track.durationMs, startMs + 10);
        start.value = String(startMs);
        end.value = String(endMs);
      }
      leftShade.style.width = `${(startMs / track.durationMs) * 100}%`;
      rightShade.style.width = `${((track.durationMs - endMs) / track.durationMs) * 100}%`;
      startLabel.firstChild!.textContent = `${t("diagnosticsTrackReviewStartTrim")}: ${(startMs / 1000).toFixed(2)}s `;
      endLabel.firstChild!.textContent = `${t("diagnosticsTrackReviewEndTrim")}: ${((track.durationMs - endMs) / 1000).toFixed(2)}s `;
    };
    startLabel.append(document.createTextNode(""), start);
    endLabel.append(document.createTextNode(""), end);
    start.addEventListener("input", redraw);
    end.addEventListener("input", redraw);
    redraw();
    void window.tanda?.getWaveform(track.id).then((url) => {
      if (url && waveform.isConnected) waveform.style.backgroundImage = `url("${url}")`;
    });

    const actions = document.createElement("div");
    actions.className = "diagnostics-track-review-actions";
    const addButton = (label: string, action: () => void | Promise<void>) => {
      const button = document.createElement("button");
      button.textContent = label;
      button.addEventListener("click", () => void action());
      actions.appendChild(button);
      return button;
    };
    const play = async (fromMs: number, stopAtMs: number | null) => {
      if (
        diagnosticsReviewAudio
        && !diagnosticsReviewAudio.paused
        && diagnosticsReviewAudio.dataset.trackId === track.id
      ) {
        diagnosticsReviewStopAtSeconds = stopAtMs === null ? null : stopAtMs / 1000;
        diagnosticsReviewAudio.currentTime = Math.max(0, fromMs / 1000);
        return;
      }
      stopDiagnosticsReviewAudio();
      await stopMainForDiagnosticsAudition();
      const audio = new Audio(localAudioUrl(track.fullPath));
      audio.dataset.trackId = track.id;
      diagnosticsReviewAudio = audio;
      diagnosticsReviewStopAtSeconds = stopAtMs === null ? null : stopAtMs / 1000;
      audio.addEventListener("loadedmetadata", () => {
        audio.currentTime = Math.max(0, fromMs / 1000);
        void audio.play().catch(stopDiagnosticsReviewAudio);
      }, { once: true });
      audio.addEventListener("playing", () => {
        if (diagnosticsReviewState === playbackState) {
          playbackState.textContent = t("diagnosticsTrackReviewPlaying");
          playbackState.dataset.state = "playing";
        }
      });
      audio.addEventListener("pause", () => {
        if (diagnosticsReviewState === playbackState) {
          playbackState.textContent = t("diagnosticsTrackReviewStopped");
          playbackState.dataset.state = "stopped";
        }
      });
      audio.addEventListener("error", stopDiagnosticsReviewAudio, { once: true });
      audio.addEventListener("timeupdate", () => {
        if (diagnosticsReviewPlayhead === playhead) {
          diagnosticsReviewPlayhead.style.left = `${Math.max(0, Math.min(100,
            (audio.currentTime * 1000 / track.durationMs) * 100))}%`;
        }
        if (diagnosticsReviewStopAtSeconds !== null && audio.currentTime >= diagnosticsReviewStopAtSeconds) {
          stopDiagnosticsReviewAudio();
        }
      });
      audio.addEventListener("ended", stopDiagnosticsReviewAudio, { once: true });
    };
    waveform.addEventListener("click", (event) => {
      const bounds = waveform.getBoundingClientRect();
      if (bounds.width > 0) void play(((event.clientX - bounds.left) / bounds.width) * track.durationMs, null);
    });
    addButton(t("diagnosticsTrackReviewOriginal"), () => play(0, null));
    addButton(t("diagnosticsTrackReviewTrimmed"), () => play(Number(start.value), Number(end.value)));
    addButton(t("diagnosticsTrackReviewStart"), () => play(Number(start.value), null));
    addButton(t("diagnosticsTrackReviewEnding"), () => play(Math.max(Number(start.value), Number(end.value) - 10_000), null));
    addButton(t("diagnosticsTrackReviewStop"), stopDiagnosticsReviewAudio);
    addButton(t("diagnosticsTrackReviewSave"), async () => {
      const result = await window.tanda!.saveDiagnosticsTrackTrim({
        id: track.id,
        startOffsetMs: Number(start.value),
        endTrimMs: track.durationMs - Number(end.value),
      });
      if (result.ok) {
        setStatus(t("diagnosticsTrackReviewSaved"));
        await renderDiagnosticsDataReadiness();
      }
    });
    addButton(t("diagnosticsTrackReviewReset"), async () => {
      await window.tanda!.resetDiagnosticsTrackTrim(track.id);
      await renderDiagnosticsDataReadiness();
    });
    const okButton = addButton(t("diagnosticsTrackReviewOk"), async () => {
      const result = await window.tanda!.acknowledgeDiagnosticsTrack({
        id: track.id,
        issueSignature: track.issueSignature,
      });
      if (!result.ok) return;
      const message = t("diagnosticsTrackReviewAcknowledged");
      reviewNotice.textContent = message;
      reviewNotice.classList.remove("hidden");
      okButton.disabled = true;
      track.acknowledged = true;
      const statusCell = row.querySelector<HTMLElement>("[data-review-status]");
      if (statusCell) statusCell.textContent = t("diagnosticsTrackReviewApproved");
      row.dataset.reviewStatus = "acknowledged";
      setStatus(message);
    });
    okButton.disabled = track.acknowledged;
    addButton(t("trackEditorDelete"), async () => {
      const removeFile = await showDeleteTrackModal();
      if (removeFile === null) return;
      const result = await window.tanda!.deleteTrack({ id: track.id, removeFile });
      if (result.ok) await renderDiagnosticsDataReadiness();
    });
    panel.append(heading, sourcePath, reviewNotice, playbackState, waveform, startLabel, endLabel, actions);
  };

  tracks.forEach((track) => {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    const issue = track.issueKinds.map((kind) => t(kind === "short" ? "diagnosticsTrackReviewShort" : "diagnosticsTrackReviewTrim")).join(", ");
    [
      track.title,
      issue,
      `${Math.round(track.durationMs / 1000)}s / ${Math.round(track.effectiveDurationMs / 1000)}s`,
      t(track.acknowledged ? "diagnosticsTrackReviewApproved" : "diagnosticsTrackReviewPending"),
    ].forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 3) cell.dataset.reviewStatus = "true";
        row.appendChild(cell);
      });
    row.dataset.reviewStatus = track.acknowledged ? "acknowledged" : "pending";
    row.addEventListener("click", () => void selectTrack(track, row));
    row.addEventListener("keydown", (event) => { if (event.key === "Enter") void selectTrack(track, row); });
    body.appendChild(row);
  });
  const firstRow = body.querySelector("tr");
  const firstTrack = tracks.values().next().value;
  if (firstRow && firstTrack) await selectTrack(firstTrack, firstRow);
};

const renderDiagnosticsDataReadiness = async () => {
  if (!diagnosticsDataReadinessEl) {
    return;
  }
  const controller = getSettingsDiagnosticsController();
  if (!controller) {
    return;
  }
  await controller.renderDiagnosticsDataReadiness(diagnosticsDataReadinessEl);
  if (diagnosticsTrackLengthIssuesEl) {
    await renderDiagnosticsTrackReview(diagnosticsTrackLengthIssuesEl);
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
  const result = await controller.verifyLegacyReadiness(legacyReadinessResult);
  if (result) {
    libraryWorkflowReadiness = result.status ?? "idle";
    renderLibraryWorkflow();
    setStatus(result.message);
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
  t("defaultStyleOther"),
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
    rating: { ...ratingFilter },
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
  if (!open) {
    closeAvLagCalibration();
  }
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
  const wasOpen = settingsPanel.classList.contains("open");
  if (open && !wasOpen) {
    libraryWorkflowExpandedStep = null;
    libraryWorkflowExpandedStepTouched = false;
    libraryWorkflowInitialExpansionApplied = false;
  }
  settingsPanel.classList.toggle("open", open);
  settingsPanel.setAttribute("aria-hidden", open ? "false" : "true");
  if (open) {
    renderLibraryWorkflow();
  }
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

const mountLibraryWorkflowPanels = () => {
  if (libraryWorkflowPanelsMounted) {
    return;
  }
  libraryWorkflowPanels.get("roots")?.appendChild(libraryRootsSection ?? document.createElement("div"));
  const legacyStylesPanel = libraryWorkflowPanels.get("legacy-styles");
  if (legacyStylesPanel) {
    if (styleFamiliesSection) {
      legacyStylesPanel.appendChild(styleFamiliesSection);
    }
    if (legacyStyleReviewSection) {
      legacyStylesPanel.appendChild(legacyStyleReviewSection);
    }
  }
  libraryWorkflowPanels
    .get("legacy-import")
    ?.appendChild(libraryLegacyImportSection ?? document.createElement("div"));
  const analysisPanel = libraryWorkflowPanels.get("analysis");
  if (analysisPanel) {
    if (libraryStartupFlowSection) {
      analysisPanel.appendChild(libraryStartupFlowSection);
    }
    if (libraryScanSection) {
      analysisPanel.appendChild(libraryScanSection);
    }
  }
  libraryWorkflowPanels
    .get("verify")
    ?.appendChild(libraryVerifySection ?? document.createElement("div"));
  libraryWorkflowPanelsMounted = true;
};

const loadLegacyStylesForDisplay = async () => {
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
};

const renderLibraryWorkflow = () => {
  if (!libraryWorkflowGuidance || !libraryWorkflowDetail || libraryWorkflowSteps.length === 0) {
    return;
  }
  mountLibraryWorkflowPanels();
  const state = {
    hasMusicRoot: libraryWorkflowRoots.some((root) => root.kind === "music"),
    hasCortinaRoot: libraryWorkflowRoots.some((root) => root.kind === "cortina"),
    legacyDetected: Boolean(legacyImportRootPath),
    legacyStylesReviewed: libraryWorkflowLegacyStylesReviewed,
    legacyImported: libraryWorkflowLegacyImported,
    analysisCompleted: libraryWorkflowAnalysisCompleted,
    readiness: libraryWorkflowReadiness,
  };
  libraryWorkflowExpandedStep = resolveLibraryWorkflowExpandedStep(
    state,
    libraryWorkflowExpandedStep,
    libraryWorkflowInitialExpansionApplied,
  );
  libraryWorkflowInitialExpansionApplied = true;
  const workflow = deriveLibraryWorkflow(state);
  libraryWorkflowSteps.forEach((stepEl) => {
    const status = workflow.steps.find((step) => step.key === stepEl.dataset.step)?.status ?? "pending";
    stepEl.classList.toggle("completed", status === "complete");
    stepEl.classList.toggle("current", status === "current");
    stepEl.classList.toggle("attention", status === "attention");
    stepEl.classList.toggle("optional", status === "optional");
    stepEl.classList.toggle("expanded", stepEl.dataset.step === libraryWorkflowExpandedStep);
  });
  libraryWorkflowStepToggles.forEach((toggle) => {
    const stepKey = (toggle.dataset.stepToggle ?? "") as LibraryWorkflowStepKey;
    const expanded = stepKey === libraryWorkflowExpandedStep;
    const label = t(expanded ? "libraryWorkflowCollapseStep" : "libraryWorkflowExpandStep");
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
    const labelEl = toggle.querySelector<HTMLElement>(".library-workflow-step-toggle-label");
    if (labelEl) {
      labelEl.textContent = label;
    }
  });
  libraryWorkflowGuidance.textContent = t(
    getLibraryWorkflowGuidanceKey(state, libraryWorkflowExpandedStep),
  );
  libraryWorkflowEmptyDetail?.classList.toggle(
    "hidden",
    libraryWorkflowExpandedStep !== null,
  );
  libraryWorkflowPanels.forEach((panel, key) => {
    panel?.classList.toggle("hidden", key !== libraryWorkflowExpandedStep);
  });
  legacyStyleReviewSection?.classList.toggle("hidden", !legacyImportRootPath);
  libraryLegacyImportSection?.classList.toggle("hidden", !legacyImportRootPath);
  if (legacyStyleReviewDoneButton) {
    legacyStyleReviewDoneButton.disabled = !legacyImportRootPath;
  }
  if (
    libraryWorkflowExpandedStep === "legacy-styles" &&
    legacyImportRootPath &&
    legacyStyleRows.length === 0 &&
    !legacyStylesResult?.textContent?.trim()
  ) {
    void loadLegacyStylesForDisplay();
  }
};

const scrollLibraryWorkflowToTop = () => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      scrollSettingsContentTo(settingsContent, libraryWorkflowShell);
    });
  });
};

const renderRoots = async () => {
  if (!window.tanda || !rootList || !rootBanner || !rootBannerText) {
    return;
  }
  const roots = await window.tanda.listRoots();
  libraryWorkflowRoots = roots;
  if (!roots.some((root) => root.kind === "music") || !roots.some((root) => root.kind === "cortina")) {
    libraryWorkflowLegacyStylesReviewed = false;
    libraryWorkflowLegacyImported = false;
    libraryWorkflowAnalysisCompleted = false;
    libraryWorkflowReadiness = "idle";
  }
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
    const removeBtn = document.createElement("button");
    removeBtn.textContent = t("removeRootButton");
    removeBtn.addEventListener("click", async () => {
      const preview = await window.tanda?.getRootRemovalPreview(root.id);
      if (!preview) {
        return;
      }
      const confirmed = await showConfirmModal(
        t("confirmRemoveRoot", {
          kind:
            preview.kind === "music"
              ? t("rootMusic")
              : preview.kind === "cortina"
                ? t("rootCortina")
                : t("rootBackground"),
          path: preview.path,
          tracks: preview.trackCount,
          tandas: preview.tandaCount,
          playlists: preview.playlistCount,
        }),
        t("removeRootButton"),
      );
      if (!confirmed) {
        return;
      }
      const result = await window.tanda?.removeRoot(root.id);
      if (!result?.removed) {
        return;
      }
      trackCache.clear();
      tandaCache.clear();
      await renderRoots();
      await loadStyles();
      await loadTandaDrafts();
      await loadCortinaSets();
      await refreshNewCollectionTracks();
      await refreshSearch();
      await renderDiagnosticsDataReadiness();
      renderClipboard();
      renderPlaylist();
      renderAllLists();
      setStatus(
        t("statusRootRemoved", {
          path: result.path,
          tracks: result.trackCount,
          tandas: result.tandaCount,
        }),
      );
    });
    row.append(label, kind, status, path, removeBtn);
    rootList.appendChild(row);
  });
  renderLibraryWorkflow();
};

const renderDeletedTracks = async () => {
  if (!window.tanda || !undeleteTracksList || !undeleteTracksButton) return;
  const rows = await window.tanda.listDeletedTracks();
  undeleteTracksList.innerHTML = "";
  undeleteTracksButton.disabled = true;
  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "settings-note";
    empty.textContent = t("undeleteTracksEmpty");
    undeleteTracksList.appendChild(empty);
    return;
  }
  rows.forEach((track) => {
    const label = document.createElement("label");
    label.className = "undelete-track-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = track.id;
    checkbox.addEventListener("change", () => {
      undeleteTracksButton.disabled =
        !undeleteTracksList.querySelector<HTMLInputElement>('input[type="checkbox"]:checked');
    });
    const text = document.createElement("span");
    text.textContent = t("undeleteTrackLabel", {
      title: track.title || t("unknownTitle"),
      artist: track.artist || t("unknownArtist"),
    });
    label.append(checkbox, text);
    undeleteTracksList.appendChild(label);
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
  const previousRootPath = legacyImportRootPath;
  const result = await window.tanda.detectLegacy(candidatePath ?? null);
  if (result.available) {
    if (previousRootPath && previousRootPath !== result.rootPath) {
      libraryWorkflowLegacyStylesReviewed = false;
      libraryWorkflowLegacyImported = false;
      libraryWorkflowAnalysisCompleted = false;
      libraryWorkflowReadiness = "idle";
      if (legacyImportResult) {
        legacyImportResult.textContent = "";
      }
    }
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
    libraryWorkflowLegacyStylesReviewed = false;
    libraryWorkflowLegacyImported = false;
    legacyImportDescription.textContent = "";
    if (legacyImportResult) {
      legacyImportResult.textContent = "";
    }
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
  renderLibraryWorkflow();
};

let similarityReport: AudioSimilarityReport | null = null;
let similarityGenerationPending = false;
let similarityGenerationCompleted = false;
let similarityEquivalentTrackIds = new Map<string, ReadonlySet<string>>();
let similarityRelationshipByTrackId = new Map<string, AudioSimilarityRelationshipType>();
let similarityPreferredTrackIds = new Map<string, string>();
let similarityHiddenTrackIds = new Set<string>();
let similarityPreview: HTMLAudioElement | null = null;
let similarityPreviewButton: HTMLButtonElement | null = null;
let similarityPreviewBounds: { startMs: number; effectiveMs: number } | null = null;
let similarityPreviewRequestVersion = 0;
let similarityActiveGroupId: string | null = null;
let similaritySharedPosition = 0;
let similarityPollTimer: number | null = null;
let similarityMetadataUndoStacks = new Map<string, AudioSimilarityMetadataChange[][]>();

const createSimilarityWaveform = (
  groupId: string,
  member: AudioSimilarityMember,
  position: HTMLElement,
) => {
  const canvas = document.createElement("canvas");
  canvas.className = "audio-similarity-waveform";
  canvas.width = 600;
  canvas.height = 64;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "slider");
  canvas.setAttribute("aria-label", t("audioSimilarityWaveformSeek", { track: member.title }));
  canvas.setAttribute("aria-valuemin", "0");
  canvas.setAttribute("aria-valuemax", "100");
  const image = new Image();
  let available = false;
  const draw = () => {
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111827";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (available) context.drawImage(image, 0, 0, canvas.width, canvas.height);
    else {
      context.fillStyle = "#9ca3af";
      context.font = "14px sans-serif";
      context.fillText(t("waveformLoading"), 10, 38);
    }
    const ratio = similarityActiveGroupId === groupId ? similaritySharedPosition : 0;
    const x = Math.round(ratio * canvas.width);
    context.fillStyle = "rgba(56, 189, 248, 0.2)";
    context.fillRect(0, 0, x, canvas.height);
    context.strokeStyle = "#38bdf8";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
    canvas.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  };
  const setRatio = (ratio: number) => {
    similarityActiveGroupId = groupId;
    similaritySharedPosition = Math.max(0, Math.min(1, ratio));
    position.textContent = t("audioSimilaritySharedPosition", {
      percent: Math.round(similaritySharedPosition * 100),
    });
    if (similarityPreview && similarityPreviewBounds) {
      similarityPreview.currentTime = (
        similarityPreviewBounds.startMs
        + similarityPreviewBounds.effectiveMs * similaritySharedPosition
      ) / 1000;
    }
    canvas.closest(".audio-similarity-group")
      ?.querySelectorAll<HTMLCanvasElement>(".audio-similarity-waveform")
      .forEach((candidate) => candidate.dispatchEvent(new Event("similarity-position-change")));
  };
  canvas.addEventListener("click", (event) => {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width > 0) setRatio((event.clientX - bounds.left) / bounds.width);
  });
  canvas.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = similarityActiveGroupId === groupId ? similaritySharedPosition : 0;
    setRatio(current + (event.key === "ArrowRight" ? 0.05 : -0.05));
  });
  canvas.addEventListener("similarity-position-change", draw);
  draw();
  void window.tanda?.getWaveform(member.trackId).then((dataUrl) => {
    if (!dataUrl || !canvas.isConnected) {
      const context = canvas.getContext("2d");
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#9ca3af";
        context.font = "14px sans-serif";
        context.fillText(t("waveformUnavailable"), 10, 38);
      }
      return;
    }
    image.addEventListener("load", () => { available = true; draw(); }, { once: true });
    image.src = dataUrl;
  }).catch(() => {
    // A missing waveform leaves the labelled canvas unavailable without blocking the report.
  });
  return canvas;
};
const AUDIO_SIMILARITY_COLLAPSED_KEY = "audio-similarity-collapsed-groups";
let similarityGroupSelections = new Map<string, Set<string>>();
let similarityGroupMasterSelections = new Map<string, string>();
let similarityCollapsedGroupIds = new Set<string>();
try {
  const stored = JSON.parse(localStorage.getItem(AUDIO_SIMILARITY_COLLAPSED_KEY) ?? "[]");
  if (Array.isArray(stored)) {
    similarityCollapsedGroupIds = new Set(stored.filter((id): id is string => typeof id === "string"));
  }
} catch {
  similarityCollapsedGroupIds = new Set();
}

const saveSimilarityCollapsedGroups = () => {
  localStorage.setItem(
    AUDIO_SIMILARITY_COLLAPSED_KEY,
    JSON.stringify([...similarityCollapsedGroupIds]),
  );
};

const localAudioUrl = (filePath: string) => {
  const normalized = filePath.replace(/\\/g, "/");
  const prefix = normalized.startsWith("/") ? "file://" : "file:///";
  return encodeURI(`${prefix}${normalized}`).replace(/#/g, "%23");
};

const stopSimilarityPreview = () => {
  similarityPreviewRequestVersion += 1;
  if (similarityPreview) {
    similarityPreview.pause();
    void releaseAudioDspRuntime(similarityPreview);
  }
  similarityPreview = null;
  similarityPreviewBounds = null;
  if (similarityPreviewButton) {
    similarityPreviewButton.textContent = t("audioSimilarityPlay");
    similarityPreviewButton.setAttribute("aria-pressed", "false");
  }
  similarityPreviewButton = null;
};

const stopMainForSimilarityAudition = async () => {
  if (!playback.main.active || playback.main.active.paused) return;
  await stopChannelPlayback("main", getStopFadeSeconds() * 1000);
};

const refreshOpenSimilarityMetadataOverlay = () => {
  const overlay = document.querySelector<HTMLElement>(
    ".audio-similarity-lazy-modal[data-similarity-metadata-group-id]",
  );
  const groupId = overlay?.dataset.similarityMetadataGroupId;
  if (!overlay || !groupId) return;
  overlay.remove();
  audioSimilarityGroups
    ?.querySelector<HTMLElement>(
      `[data-similarity-group-id="${CSS.escape(groupId)}"] [data-action="show-similarity-metadata"]`,
    )
    ?.click();
};

const translateAudioSimilarityRelationship = (
  relationshipType: AudioSimilarityRelationshipType,
) => t(
  relationshipType === "identical"
    ? "audioSimilarityIdentical"
    : relationshipType === "same-recording"
      ? "audioSimilaritySameRecording"
      : relationshipType === "same-orchestra"
        ? "audioSimilaritySameOrchestra"
        : "audioSimilaritySameComposition",
);

const openAudioSimilarityOverlay = (titleText: string) => {
  const overlay = document.createElement("div");
  overlay.className = "audio-similarity-lazy-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const dialog = document.createElement("section");
  dialog.className = "audio-similarity-lazy-dialog";
  const header = document.createElement("header");
  const title = document.createElement("h3");
  title.textContent = titleText;
  const close = document.createElement("button");
  close.textContent = t("close");
  const dismiss = () => {
    stopSimilarityPreview();
    overlay.dispatchEvent(new Event("similarity-overlay-dismiss"));
    overlay.remove();
  };
  close.addEventListener("click", dismiss);
  header.append(title, close);
  const body = document.createElement("div");
  dialog.append(header, body);
  overlay.appendChild(dialog);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) dismiss();
  });
  document.body.appendChild(overlay);
  close.focus();
  return body;
};

const chooseAudioSimilarityMaster = (
  members: AudioSimilarityMember[],
  selectedIds: ReadonlySet<string>,
  currentTrackId: string | null,
) => new Promise<string | null>((resolve) => {
  const body = openAudioSimilarityOverlay(t("audioSimilarityChooseMasterTitle"));
  const overlay = body.closest<HTMLElement>(".audio-similarity-lazy-modal");
  let settled = false;
  let chosenTrackId = currentTrackId && selectedIds.has(currentTrackId)
    ? currentTrackId : null;
  const finish = (trackId: string | null) => {
    if (settled) return;
    settled = true;
    overlay?.remove();
    resolve(trackId);
  };
  const help = document.createElement("p");
  help.textContent = t("audioSimilarityChooseMasterHelp");
  body.appendChild(help);
  const choices = document.createElement("div");
  choices.className = "audio-similarity-master-dialog-choices";
  for (const member of members.filter((candidate) => selectedIds.has(candidate.trackId))) {
    const label = document.createElement("label");
    label.className = "audio-similarity-compact-track";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "audio-similarity-master-dialog";
    input.value = member.trackId;
    input.checked = chosenTrackId === member.trackId;
    const identity = document.createElement("span");
    identity.textContent = [member.title, member.artist, member.album, member.fullPath]
      .filter(Boolean).join(" · ");
    input.addEventListener("change", () => {
      if (input.checked) chosenTrackId = member.trackId;
      apply.disabled = !chosenTrackId;
    });
    label.append(input, identity);
    choices.appendChild(label);
  }
  const actions = document.createElement("div");
  actions.className = "audio-similarity-actions";
  const cancel = document.createElement("button");
  cancel.textContent = t("cancel");
  cancel.addEventListener("click", () => finish(null));
  const apply = document.createElement("button");
  apply.textContent = t("audioSimilarityApply");
  apply.disabled = !chosenTrackId;
  apply.addEventListener("click", () => finish(chosenTrackId));
  actions.append(cancel, apply);
  body.append(choices, actions);
  overlay?.querySelector("header button")?.addEventListener("click", () => finish(null), { once: true });
  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) finish(null);
  });
});

const renderAudioSimilarityReport = () => {
  if (!audioSimilarityGroups || !audioSimilaritySummary || !similarityReport) return;
  const report = similarityReport;
  const query = audioSimilaritySearch?.value.trim().toLocaleLowerCase() ?? "";
  const running = similarityGenerationPending
    || report.status.state === "running"
    || report.status.state === "cancelling";
  if (audioSimilarityStatus) {
    audioSimilarityStatus.textContent = running
      ? report.status.totalTracks > 0
        && report.status.processedTracks >= report.status.totalTracks
        ? report.status.comparisonPairsTotal > 0
          ? t("audioSimilarityComparingProgress", {
              total: report.status.totalTracks,
              percent: Math.min(100, Math.floor(
                report.status.comparisonPairsProcessed
                  / report.status.comparisonPairsTotal * 100,
              )),
            })
          : t("audioSimilarityComparing", { total: report.status.totalTracks })
        : t("audioSimilarityRunning", {
            processed: report.status.processedTracks,
            total: report.status.totalTracks,
          })
      : report.status.state === "failed"
        ? t("audioSimilarityFailed", { message: report.status.error ?? "" })
        : similarityGenerationCompleted
          ? t("audioSimilarityGenerationComplete")
          : "";
  }
  if (generateAudioSimilarityBtn) {
    generateAudioSimilarityBtn.disabled = running;
    generateAudioSimilarityBtn.textContent = t(
      report.hasCompletedReport ? "audioSimilarityRegenerate" : "audioSimilarityGenerate",
    );
  }
  if (cancelAudioSimilarityBtn) cancelAudioSimilarityBtn.disabled = !running;
  audioSimilaritySummary.textContent = report.hasCompletedReport
    ? t("audioSimilarityComplete", {
        groups: report.candidateGroups.length,
        matches: report.status.matchingPairs,
        failed: report.status.failedTracks,
      })
    : t("audioSimilarityEmpty");
  if (report.status.staleTracks > 0) {
    audioSimilaritySummary.textContent += ` · ${t("audioSimilarityStale", {
      count: report.status.staleTracks,
    })}`;
  }
  audioSimilaritySummary.textContent += ` · ${t("audioSimilarityIntegrity", {
    version: report.integrity.algorithmVersion,
    ready: report.integrity.readyTracks,
    total: report.integrity.activeTracks,
    orphaned: report.integrity.orphanedFeatures + report.integrity.orphanedConfirmedMembers,
  })}`;
  audioSimilarityGroups.innerHTML = "";
  let hiddenTracksCard: HTMLElement | null = null;
  const reviewSection = document.createElement("details");
  reviewSection.className = "audio-similarity-review-section";
  reviewSection.open = true;
  const reviewHeading = document.createElement("summary");
  const reviewContent = document.createElement("div");
  reviewContent.className = "audio-similarity-review-content";
  reviewSection.append(reviewHeading, reviewContent);
  let reviewCount = 0;
  const reviewedSection = document.createElement("details");
  reviewedSection.className = "audio-similarity-reviewed-section";
  const reviewedSummary = document.createElement("summary");
  const reviewedContent = document.createElement("div");
  reviewedContent.className = "audio-similarity-reviewed-content";
  reviewedSection.append(reviewedSummary, reviewedContent);
  let reviewedCount = 0;
  const reviewedCards: Array<{ card: HTMLElement; processedAt: string }> = [];
  for (const confirmedGroup of report.confirmedGroups) {
    const representedByCandidate = report.candidateGroups.some((candidate) => {
      const candidateIds = new Set(candidate.members.map((member) => member.trackId));
      return confirmedGroup.trackIds.filter((trackId) => candidateIds.has(trackId)).length >= 2;
    });
    if (representedByCandidate) continue;
    const confirmedCard = document.createElement("article");
    confirmedCard.className = "audio-similarity-card";
    const label = document.createElement("strong");
    label.textContent = t("audioSimilarityConfirmedGroup", {
      type: translateAudioSimilarityRelationship(confirmedGroup.relationshipType),
      count: confirmedGroup.trackIds.length,
    });
    const ids = document.createElement("small");
    ids.textContent = confirmedGroup.trackIds.join(" · ");
    const withdraw = document.createElement("button");
    withdraw.textContent = t("audioSimilarityWithdraw");
    withdraw.addEventListener("click", async () => {
      if (!(await showConfirmModal(
        t("audioSimilarityWithdrawConfirm"), t("audioSimilarityWithdraw"),
      ))) return;
      await window.tanda?.withdrawConfirmedAudioSimilarityGroup(confirmedGroup.id);
      await loadAudioSimilarityReport();
      renderAllLists();
    });
    confirmedCard.append(label, ids, withdraw);
    reviewedCards.push({ card: confirmedCard, processedAt: confirmedGroup.updatedAt });
    reviewedCount += 1;
  }
  for (const failure of report.failures) {
    const failureRow = document.createElement("div");
    failureRow.className = "audio-similarity-card";
    failureRow.textContent = t("audioSimilarityFailureItem", {
      track: failure.title, message: failure.message,
    });
    audioSimilarityGroups.appendChild(failureRow);
  }
  if (report.hiddenTracks.length > 0) {
    const hiddenCard = document.createElement("article");
    hiddenCard.className = "audio-similarity-card audio-similarity-hidden-tracks";
    const hiddenHeading = document.createElement("h3");
    hiddenHeading.textContent = t("audioSimilarityHiddenTracks");
    hiddenCard.appendChild(hiddenHeading);
    for (const hiddenTrack of report.hiddenTracks) {
      const row = document.createElement("div");
      row.className = "audio-similarity-actions";
      const label = document.createElement("span");
      label.textContent = t("audioSimilarityHiddenTrack", {
        title: hiddenTrack.title, artist: hiddenTrack.artist, path: hiddenTrack.fullPath,
      });
      const restore = document.createElement("button");
      restore.textContent = t("audioSimilarityRestore");
      restore.addEventListener("click", async () => {
        await window.tanda?.setTrackHidden(hiddenTrack.trackId, false);
        await loadAudioSimilarityReport();
      });
      row.append(label, restore);
      hiddenCard.appendChild(row);
    }
    hiddenTracksCard = hiddenCard;
  }
  const visibleGroups = report.candidateGroups.filter((group) =>
    !query || group.members.some((member) =>
      `${member.title} ${member.artist} ${member.album} ${member.fullPath}`
        .toLocaleLowerCase().includes(query)),
  );
  for (const [groupIndex, group] of visibleGroups.entries()) {
    const memberIds = new Set(group.members.map((member) => member.trackId));
    const matchingConfirmedGroups = report.confirmedGroups
      .map((confirmed) => ({
        confirmed,
        matchedIds: confirmed.trackIds.filter((trackId) => memberIds.has(trackId)),
      }))
      .filter((entry) => entry.matchedIds.length >= 2)
      .sort((left, right) => right.matchedIds.length - left.matchedIds.length);
    const confirmedGroup = matchingConfirmedGroups[0] ?? null;
    let selectedIds = similarityGroupSelections.get(group.id);
    if (!selectedIds) {
      selectedIds = new Set(
        confirmedGroup?.matchedIds ?? group.members.map((member) => member.trackId),
      );
      similarityGroupSelections.set(group.id, selectedIds);
    }
    const rememberedMasterTrackId = similarityGroupMasterSelections.get(group.id) ?? null;
    let masterTrackId = confirmedGroup?.confirmed.relationshipType === "identical"
      ? confirmedGroup.confirmed.preferredTrackId
      : rememberedMasterTrackId
          && memberIds.has(rememberedMasterTrackId)
          && selectedIds.has(rememberedMasterTrackId)
        ? rememberedMasterTrackId
        : null;
    if (masterTrackId) similarityGroupMasterSelections.set(group.id, masterTrackId);
    else similarityGroupMasterSelections.delete(group.id);
    const card = document.createElement("article");
    card.className = `audio-similarity-card audio-similarity-group group-color-${groupIndex % 6}`;
    card.dataset.similarityGroupId = group.id;
    const header = document.createElement("header");
    header.className = "audio-similarity-group-header";
    const collapse = document.createElement("button");
    collapse.className = "audio-similarity-collapse";
    const collapsed = similarityCollapsedGroupIds.has(group.id);
    collapse.textContent = collapsed ? "▸" : "▾";
    collapse.title = t(collapsed ? "audioSimilarityExpandGroup" : "audioSimilarityCollapseGroup");
    collapse.setAttribute("aria-label", collapse.title);
    collapse.setAttribute("aria-expanded", collapsed ? "false" : "true");
    const heading = document.createElement("h3");
    const updateHeading = () => {
      const count = selectedIds!.size;
      heading.textContent = confirmedGroup
        ? t("audioSimilarityMatchedCount", { matched: count, total: group.members.length })
        : count === group.members.length
          ? t("audioSimilarityTracks", { count: group.members.length })
          : t("audioSimilaritySelectedCount", { selected: count, total: group.members.length });
    };
    updateHeading();
    const distinctTitles = [...new Map(group.members.map((member) => {
      const title = member.title.trim() || member.fullPath.split(/[\\/]/).pop() || member.trackId;
      return [title.toLocaleLowerCase(), title] as const;
    })).values()];
    const titleSummary = document.createElement("span");
    titleSummary.className = "audio-similarity-title-summary";
    titleSummary.textContent = `${t("audioSimilarityMetaTitle")}: ${distinctTitles.join(" / ")}`;
    const confirmedTag = document.createElement("span");
    confirmedTag.className = "audio-similarity-confirmed-tag";
    confirmedTag.textContent = t("audioSimilarityConfirmedMatch");
    confirmedTag.classList.toggle("hidden", !confirmedGroup);
    const confidence = document.createElement("strong");
    const exactFile = group.members.some((member, index) =>
      group.members.slice(index + 1).some((other) => other.fileHash === member.fileHash));
    confidence.textContent = `${exactFile
      ? t("audioSimilarityExactFiles")
      : t("audioSimilarityCandidateEvidence")} · ${group.confidence.toFixed(6)}`;
    header.append(collapse, heading, titleSummary, confirmedTag, confidence);
    card.appendChild(header);
    if (matchingConfirmedGroups.length > 0) {
      const relationships = document.createElement("div");
      relationships.className = "audio-similarity-confirmed-relationships";
      for (const match of matchingConfirmedGroups) {
        const relationship = document.createElement("span");
        relationship.textContent = `${translateAudioSimilarityRelationship(
          match.confirmed.relationshipType,
        )}: ${match.matchedIds.length}`;
        relationships.appendChild(relationship);
      }
      card.appendChild(relationships);
    }
    const position = document.createElement("div");
    position.dataset.similarityPosition = group.id;
    position.textContent = t("audioSimilaritySharedPosition", {
      percent: similarityActiveGroupId === group.id ? Math.round(similaritySharedPosition * 100) : 0,
    });
    card.appendChild(position);
    const members = document.createElement("div");
    members.className = "audio-similarity-members";
    for (const member of group.members) {
      const row = document.createElement("div");
      row.className = "audio-similarity-member";
      const selected = document.createElement("input");
      selected.type = "checkbox";
      selected.checked = selectedIds.has(member.trackId);
      selected.value = member.trackId;
      selected.setAttribute("aria-label", t("audioSimilarityIncludeMatch", {
        title: member.title, artist: member.artist,
      }));
      selected.addEventListener("change", () => {
        if (selected.checked) selectedIds!.add(member.trackId);
        else {
          selectedIds!.delete(member.trackId);
          if (masterTrackId === member.trackId) {
            masterTrackId = null;
            similarityGroupMasterSelections.delete(group.id);
          }
        }
        updateHeading();
        card.querySelectorAll<HTMLButtonElement>("[data-similarity-confirm]")
          .forEach((button) => { button.disabled = selectedIds!.size < 2; });
        card.querySelector<HTMLButtonElement>("[data-similarity-reject]")?.dispatchEvent(
          new Event("similarity-selection-change"),
        );
      });
      const election = document.createElement("label");
      election.className = "audio-similarity-election";
      const electionText = document.createElement("span");
      electionText.textContent = t("audioSimilarityInclude");
      election.append(selected, electionText);
      const master = document.createElement("label");
      master.className = "audio-similarity-master";
      const masterChoice = document.createElement("input");
      masterChoice.type = "radio";
      masterChoice.name = `similarity-master-${group.id}`;
      masterChoice.dataset.masterTrackId = member.trackId;
      masterChoice.checked = masterTrackId === member.trackId;
      masterChoice.setAttribute("aria-label", t("audioSimilarityElectMaster", {
        title: member.title, artist: member.artist,
      }));
      masterChoice.addEventListener("change", () => {
        if (!masterChoice.checked) return;
        masterTrackId = member.trackId;
        similarityGroupMasterSelections.set(group.id, member.trackId);
        if (!selected.checked) {
          selected.checked = true;
          selected.dispatchEvent(new Event("change"));
        }
      });
      const masterText = document.createElement("span");
      masterText.textContent = t("audioSimilarityMaster");
      master.append(masterChoice, masterText);
      const text = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = member.title || member.fullPath.split(/[\\/]/).pop() || member.trackId;
      const detail = document.createElement("small");
      detail.textContent = [member.artist, member.album, member.fullPath].filter(Boolean).join(" · ");
      const waveform = createSimilarityWaveform(group.id, member, position);
      const effectiveDuration = document.createElement("small");
      effectiveDuration.className = "audio-similarity-effective-duration";
      effectiveDuration.textContent = `${t("colDuration")}: ${formatTime(
        Math.max(0, member.durationMs - member.startOffsetMs - member.endTrimMs) / 1000,
      )}`;
      text.append(title, detail, waveform, effectiveDuration);
      const format = document.createElement("span");
      format.className = "audio-similarity-format";
      format.textContent = member.fullPath.split(".").pop() || "audio";
      const play = document.createElement("button");
      play.textContent = t("audioSimilarityPlay");
      play.addEventListener("click", () => {
        void playSimilarityMember(group.id, member, position, play);
      });
      const hide = document.createElement("button");
      hide.textContent = t(member.hidden ? "audioSimilarityRestore" : "audioSimilarityHide");
      hide.addEventListener("click", async () => {
        await window.tanda?.setTrackHidden(member.trackId, !member.hidden);
        await loadAudioSimilarityReport();
      });
      const memberActions = document.createElement("div");
      memberActions.className = "audio-similarity-member-actions";
      memberActions.append(format, play, hide);
      const memberChoices = document.createElement("div");
      memberChoices.className = "audio-similarity-member-choices";
      memberChoices.append(election, master);
      row.append(memberChoices, text, memberActions);
      members.appendChild(row);
    }
    card.appendChild(members);
    const metadataButton = document.createElement("button");
    metadataButton.dataset.action = "show-similarity-metadata";
    metadataButton.textContent = t("audioSimilarityShowMetadata");
    metadataButton.addEventListener("click", () => {
    const tableWrap = openAudioSimilarityOverlay(t("audioSimilarityMetadataTitle"));
    const metadataOverlay = tableWrap.closest<HTMLElement>(".audio-similarity-lazy-modal");
    if (metadataOverlay) {
      metadataOverlay.dataset.similarityMetadataGroupId = group.id;
      metadataOverlay.addEventListener("similarity-overlay-dismiss", () => {
        similarityMetadataUndoStacks.delete(group.id);
      }, { once: true });
    }
    const undoStack = similarityMetadataUndoStacks.get(group.id) ?? [];
    similarityMetadataUndoStacks.set(group.id, undoStack);
    const metadataActions = document.createElement("div");
    metadataActions.className = "audio-similarity-actions";
    const undo = document.createElement("button");
    undo.textContent = t("audioSimilarityUndo");
    undo.disabled = undoStack.length === 0;
    undo.addEventListener("click", async () => {
      const changes = undoStack.pop();
      if (!changes) return;
      const result = await window.tanda?.undoAudioSimilarityMetadata(changes);
      if (result?.conflicts.length) {
        const conflicts = new Set(result.conflicts);
        undoStack.push(changes.filter((change) => conflicts.has(change.trackId)));
      }
      await loadAudioSimilarityReport();
      metadataOverlay?.remove();
      audioSimilarityGroups
        ?.querySelector<HTMLElement>(
          `[data-similarity-group-id="${CSS.escape(group.id)}"] [data-action="show-similarity-metadata"]`,
        )
        ?.click();
    });
    metadataActions.appendChild(undo);
    tableWrap.appendChild(metadataActions);
    tableWrap.style.overflowX = "auto";
    const table = document.createElement("table");
    const metadataFields: Array<{
      label: string;
      field: keyof AudioSimilarityMember;
      editable?: "title" | "artist" | "artist_summary" | "singer" | "year" | "genre" | "bpm" | "notes" | "instrumental";
    }> = [
      { label: t("audioSimilarityMetaTitle"), field: "title", editable: "title" },
      { label: t("audioSimilarityMetaArtist"), field: "artist", editable: "artist" },
      { label: t("audioSimilarityMetaArtistSummary"), field: "artistSummary", editable: "artist_summary" },
      { label: t("audioSimilarityMetaSinger"), field: "singer", editable: "singer" },
      { label: t("audioSimilarityMetaAlbum"), field: "album" },
      { label: t("audioSimilarityMetaYear"), field: "year", editable: "year" },
      { label: t("audioSimilarityMetaStyle"), field: "genre", editable: "genre" },
      { label: t("audioSimilarityMetaBpm"), field: "bpm", editable: "bpm" },
      { label: t("audioSimilarityMetaNotes"), field: "notes", editable: "notes" },
      { label: t("audioSimilarityMetaInstrumental"), field: "instrumental", editable: "instrumental" },
      { label: t("audioSimilarityMetaPath"), field: "fullPath" },
    ];
    const head = document.createElement("tr");
    const attributeHeading = document.createElement("th");
    attributeHeading.textContent = t("audioSimilarityAttribute");
    head.appendChild(attributeHeading);
    group.members.forEach((member) => {
      const th = document.createElement("th");
      const trackHeading = document.createElement("span");
      trackHeading.textContent = `${member.title} · ${member.artist}`;
      const editTrack = document.createElement("button");
      editTrack.className = "audio-similarity-edit-track";
      editTrack.textContent = t("audioSimilarityEditTrack");
      editTrack.setAttribute("aria-label", t("audioSimilarityEditNamedTrack", {
        title: member.title,
      }));
      editTrack.addEventListener("click", async () => {
        if (!trackCache.has(member.trackId)) {
          const track = (await window.tanda?.listTracks())
            ?.find((candidate) => candidate.id === member.trackId);
          if (track) updateTrackCaches(track);
        }
        await openTrackEditor(member.trackId);
      });
      th.title = `${member.album}\n${member.fullPath}`;
      th.append(trackHeading, editTrack);
      head.appendChild(th);
    });
    table.appendChild(head);
    for (const metadata of metadataFields) {
      const row = document.createElement("tr");
      const label = document.createElement("th");
      label.textContent = metadata.label;
      row.appendChild(label);
      const comparisonValues = group.members.map((member) => String(member[metadata.field] ?? ""));
      const differs = new Set(comparisonValues).size > 1;
      for (const member of group.members) {
        const cell = document.createElement("td");
        const value = member[metadata.field];
        cell.textContent = value === null || value === "" ? "—" : String(value);
        cell.classList.add(differs ? "metadata-different" : "metadata-equal");
        if (metadata.editable) {
          cell.tabIndex = 0;
          cell.role = "button";
          const replicate = async () => {
            const targets = group.members.filter((candidate) => candidate.trackId !== member.trackId);
            const result = await window.tanda?.replicateAudioSimilarityMetadata(
              member.trackId, targets.map((target) => target.trackId), metadata.editable!,
            );
            if (result?.changes.length) undoStack.push(result.changes);
            await loadAudioSimilarityReport();
            tableWrap.closest(".audio-similarity-lazy-modal")?.remove();
            audioSimilarityGroups
              ?.querySelector<HTMLElement>(
                `[data-similarity-group-id="${CSS.escape(group.id)}"] [data-action="show-similarity-metadata"]`,
              )
              ?.click();
          };
          cell.addEventListener("click", replicate);
          cell.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              void replicate();
            }
          });
        }
        row.appendChild(cell);
      }
      table.appendChild(row);
    }
    tableWrap.appendChild(table);
    });
    const detailActions = document.createElement("div");
    detailActions.className = "audio-similarity-detail-actions";
    detailActions.appendChild(metadataButton);
    const comparedMetadata: Array<{ label: string; field: keyof AudioSimilarityMember }> = [
      { label: t("audioSimilarityMetaArtist"), field: "artist" },
      { label: t("audioSimilarityMetaTitle"), field: "title" },
      { label: t("audioSimilarityMetaSinger"), field: "singer" },
      { label: t("audioSimilarityMetaBpm"), field: "bpm" },
      { label: t("audioSimilarityMetaNotes"), field: "notes" },
      { label: t("audioSimilarityMetaYear"), field: "year" },
    ];
    const differingMetadata = comparedMetadata.filter(({ field }) => new Set(group.members.map((member) =>
      String(member[field] ?? "").trim().toLocaleLowerCase(),
    )).size > 1);
    const metadataDifferenceLabel = document.createElement("span");
    metadataDifferenceLabel.className = "audio-similarity-metadata-differences";
    metadataDifferenceLabel.textContent = differingMetadata.length
      ? t("audioSimilarityMetadataDiffers", {
          fields: differingMetadata.map(({ label }) => label).join(", "),
        })
      : t("audioSimilarityMetadataMatches");
    detailActions.appendChild(metadataDifferenceLabel);
    const groupedUsages = new Map<string, {
      tandaName: string;
      playlistNames: string[];
      contextTracks: AudioSimilarityAuditionTrack[];
      matches: Array<{ member: AudioSimilarityMember; position: number }>;
    }>();
    for (const member of group.members) {
      for (const usage of member.usages) {
        const existing = groupedUsages.get(usage.tandaId) ?? {
          tandaName: usage.tandaName,
          playlistNames: usage.playlistNames,
          contextTracks: usage.contextTracks,
          matches: [],
        };
        existing.matches.push({ member, position: usage.position });
        groupedUsages.set(usage.tandaId, existing);
      }
    }
    const usageCount = groupedUsages.size;
    const tandasButton = document.createElement("button");
    tandasButton.dataset.action = "show-similarity-tandas";
    tandasButton.textContent = t("audioSimilarityShowTandas", { count: usageCount });
    tandasButton.disabled = usageCount === 0;
    tandasButton.addEventListener("click", () => {
    const usageBody = openAudioSimilarityOverlay(t("audioSimilarityTandasTitle", { count: usageCount }));
    for (const [tandaId, usage] of groupedUsages) {
        const usageRow = document.createElement("div");
        usageRow.className = "audio-similarity-card";
        const usageText = document.createElement("span");
        usageText.textContent = t("audioSimilarityTandaUsage", {
          tanda: usage.tandaName, count: usage.matches.length,
          playlists: usage.playlistNames.length ? ` · ${usage.playlistNames.join(", ")}` : "",
        });
        usageRow.appendChild(usageText);
        const matchedIds = new Set(usage.matches.map((match) => match.member.trackId));
        const comparison = document.createElement("div");
        comparison.className = "audio-similarity-tanda-comparison";
        for (const match of usage.matches) {
          const choices = document.createElement("fieldset");
          choices.className = "audio-similarity-replacement-choices";
          const legend = document.createElement("legend");
          legend.textContent = t("audioSimilarityReplacementPosition", {
            position: match.position + 1,
          });
          choices.appendChild(legend);
          for (const member of group.members) {
            const compact = document.createElement("label");
            compact.className = "audio-similarity-compact-track";
            const isCurrent = match.member.trackId === member.trackId;
            if (isCurrent) compact.classList.add("current");
            const selection = document.createElement("input");
            selection.type = "radio";
            selection.name = `similarity-replacement-${tandaId}-${match.position}`;
            selection.value = member.trackId;
            selection.checked = isCurrent;
            selection.disabled = member.hidden;
            selection.setAttribute("aria-label", t("audioSimilarityUseVersion", {
              track: member.title,
            }));
            const identity = document.createElement("span");
            identity.textContent = [member.artist, member.title, member.album]
              .filter(Boolean).join(" · ");
            const preview = document.createElement("button");
            preview.type = "button";
            preview.textContent = t("audioSimilarityPlay");
            preview.addEventListener("click", (event) => {
              event.preventDefault();
              void playSimilarityMember(`${group.id}:${tandaId}`, member, position, preview);
            });
            compact.append(selection, identity, preview);
            selection.addEventListener("change", async () => {
              if (!selection.checked || isCurrent || member.hidden) return;
              if (!(await showConfirmModal(t("audioSimilarityReplaceConfirm", {
                tanda: usage.tandaName, oldTrack: match.member.title, newTrack: member.title,
              }), t("audioSimilarityApply")))) {
                choices.querySelector<HTMLInputElement>(`input[value="${CSS.escape(match.member.trackId)}"]`)!.checked = true;
                return;
              }
              try {
                await window.tanda?.replaceAudioSimilarityTandaTrack(
                  tandaId, match.position, member.trackId,
                );
                tandaCache.clear();
                await loadTandaDrafts();
                await loadAudioSimilarityReport();
                renderAllLists();
                usageBody.closest(".audio-similarity-lazy-modal")?.remove();
                audioSimilarityGroups
                  ?.querySelector<HTMLElement>(
                    `[data-similarity-group-id="${CSS.escape(group.id)}"] [data-action="show-similarity-tandas"]`,
                  )
                  ?.click();
              } catch (error) {
                choices.querySelector<HTMLInputElement>(`input[value="${CSS.escape(match.member.trackId)}"]`)!.checked = true;
                setStatus(error instanceof Error ? error.message : String(error));
              }
            });
            choices.appendChild(compact);
          }
          comparison.appendChild(choices);
        }
        usageRow.appendChild(comparison);
        const contextActions = document.createElement("div");
        contextActions.className = "audio-similarity-tanda-tracks";
        for (const contextTrack of usage.contextTracks) {
          const context = document.createElement("div");
          context.className = "tanda-detail-line audio-similarity-tanda-track";
          if (matchedIds.has(contextTrack.trackId)) context.classList.add("audio-similarity-context-match");
          const identity = document.createElement("span");
          identity.textContent = [contextTrack.artist, contextTrack.title, contextTrack.album]
            .filter(Boolean).join(" · ");
          const preview = document.createElement("button");
          preview.textContent = t("audioSimilarityPlay");
          preview.title = t("audioSimilarityPreviewContextTrack", { track: contextTrack.title });
          preview.addEventListener("click", () => {
            void playSimilarityMember(
              `${group.id}:${tandaId}`,
              contextTrack,
              position,
              preview,
            );
          });
          context.append(identity, preview);
          contextActions.appendChild(context);
        }
        usageRow.appendChild(contextActions);
        usageBody.appendChild(usageRow);
    }
    });
    detailActions.appendChild(tandasButton);
    card.appendChild(detailActions);
    const actions = document.createElement("div");
    actions.className = "audio-similarity-actions";
    const reviewHelp = document.createElement("p");
    reviewHelp.textContent = t("audioSimilarityReviewHelp");
    card.appendChild(reviewHelp);
    const confirm = (relationshipType: AudioSimilarityRelationshipType) => async () => {
      const accepted = group.members
        .map((member) => member.trackId)
        .filter((trackId) => selectedIds!.has(trackId));
      if (accepted.length < 2) return;
      if (relationshipType === "identical" && (!masterTrackId || !accepted.includes(masterTrackId))) {
        masterTrackId = await chooseAudioSimilarityMaster(group.members, selectedIds!, masterTrackId);
        if (!masterTrackId) return;
        card.querySelector<HTMLInputElement>(
          `input[data-master-track-id="${CSS.escape(masterTrackId)}"]`,
        )?.click();
      }
      if (!(await showConfirmModal(
        t("audioSimilarityLinkSelectedConfirm", {
          count: accepted.length,
          type: relationshipType === "identical"
            ? t("audioSimilarityIdentical")
            : relationshipType === "same-recording"
              ? t("audioSimilaritySameRecording")
            : relationshipType === "same-orchestra"
              ? t("audioSimilaritySameOrchestra") : t("audioSimilaritySameComposition"),
        }),
        t("audioSimilarityApply"),
      ))) return;
      await window.tanda?.confirmAudioSimilarityGroup(
        group.members.map((member) => member.trackId), accepted, relationshipType,
        relationshipType === "identical" ? masterTrackId : null,
      );
      if (relationshipType !== "identical") {
        similarityGroupMasterSelections.delete(group.id);
      }
      await loadAudioSimilarityReport();
      renderAllLists();
    };
    const recording = document.createElement("button");
    recording.dataset.similarityConfirm = "recording";
    recording.textContent = t("audioSimilarityConfirmRecording");
    recording.disabled = selectedIds.size < 2;
    recording.addEventListener("click", confirm("same-recording"));
    const identical = document.createElement("button");
    identical.dataset.similarityConfirm = "identical";
    identical.textContent = t("audioSimilarityConfirmIdentical");
    identical.disabled = selectedIds.size < 2;
    identical.addEventListener("click", confirm("identical"));
    const orchestra = document.createElement("button");
    orchestra.dataset.similarityConfirm = "orchestra";
    orchestra.textContent = t("audioSimilarityConfirmOrchestra");
    orchestra.disabled = selectedIds.size < 2;
    orchestra.addEventListener("click", confirm("same-orchestra"));
    const composition = document.createElement("button");
    composition.dataset.similarityConfirm = "composition";
    composition.textContent = t("audioSimilarityConfirmComposition");
    composition.disabled = selectedIds.size < 2;
    composition.addEventListener("click", confirm("same-composition"));
    actions.append(identical, recording, orchestra, composition);
    if (confirmedGroup) {
      const withdraw = document.createElement("button");
      withdraw.textContent = t("audioSimilarityWithdraw");
      withdraw.addEventListener("click", async () => {
        if (!(await showConfirmModal(
          t("audioSimilarityWithdrawConfirm"), t("audioSimilarityApply"),
        ))) return;
        await window.tanda?.withdrawConfirmedAudioSimilarityGroup(
          confirmedGroup.confirmed.id,
        );
        similarityGroupSelections.delete(group.id);
        similarityGroupMasterSelections.delete(group.id);
        await loadAudioSimilarityReport();
        renderAllLists();
      });
      actions.appendChild(withdraw);
    }
    const reject = document.createElement("button");
    reject.dataset.similarityReject = "selected";
    const updateReject = () => {
      const selected = [...selectedIds!];
      const edge = selected.length === 2
        ? group.edges.find((candidate) => selected.includes(candidate.leftTrackId)
          && selected.includes(candidate.rightTrackId)) : undefined;
      const left = edge && group.members.find((member) => member.trackId === edge.leftTrackId);
      const right = edge && group.members.find((member) => member.trackId === edge.rightTrackId);
      reject.disabled = !edge;
      reject.textContent = edge?.decision === "rejected"
        ? t("audioSimilarityRestorePair", { left: left?.title ?? "", right: right?.title ?? "" })
        : t("audioSimilarityRejectNamedPair");
    };
    reject.addEventListener("click", async () => {
      const selected = [...selectedIds!];
      const edge = group.edges.find((candidate) => selected.includes(candidate.leftTrackId)
        && selected.includes(candidate.rightTrackId));
      if (!edge) return;
      const left = group.members.find((member) => member.trackId === edge.leftTrackId);
      const right = group.members.find((member) => member.trackId === edge.rightTrackId);
      if (edge.decision === "rejected") {
        await window.tanda?.reconsiderAudioSimilarityPair(edge.leftTrackId, edge.rightTrackId);
      } else {
        if (!(await showConfirmModal(t("audioSimilarityRejectConfirm", {
          left: left?.title ?? "", right: right?.title ?? "",
        }), t("audioSimilarityApply")))) return;
        await window.tanda?.rejectAudioSimilarityPair(edge.leftTrackId, edge.rightTrackId);
      }
      await loadAudioSimilarityReport();
      renderAllLists();
    });
    reject.addEventListener("similarity-selection-change", updateReject);
    actions.appendChild(reject);
    updateReject();
    card.appendChild(actions);
    const body = document.createElement("div");
    body.className = "audio-similarity-group-body";
    Array.from(card.children).slice(1).forEach((child) => body.appendChild(child));
    body.hidden = collapsed;
    card.appendChild(body);
    collapse.addEventListener("click", () => {
      const nextCollapsed = !body.hidden;
      body.hidden = nextCollapsed;
      collapse.textContent = nextCollapsed ? "▸" : "▾";
      collapse.title = t(nextCollapsed
        ? "audioSimilarityExpandGroup" : "audioSimilarityCollapseGroup");
      collapse.setAttribute("aria-label", collapse.title);
      collapse.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
      if (nextCollapsed) similarityCollapsedGroupIds.add(group.id);
      else similarityCollapsedGroupIds.delete(group.id);
      saveSimilarityCollapsedGroups();
    });
    const dealtWith = confirmedGroup?.matchedIds.length === group.members.length
      || (group.edges.length > 0 && group.edges.every((edge) => edge.decision !== "pending"));
    if (dealtWith) {
      const decisionTimes = [
        ...matchingConfirmedGroups.map((entry) => entry.confirmed.updatedAt),
        ...group.edges
          .filter((edge) => edge.decision !== "pending")
          .map((edge) => edge.updatedAt),
      ].filter((value): value is string => Boolean(value));
      reviewedCards.push({
        card,
        processedAt: decisionTimes.sort((left, right) => right.localeCompare(left))[0] ?? "",
      });
      reviewedCount += 1;
    } else {
      reviewContent.appendChild(card);
      reviewCount += 1;
    }
  }
  reviewHeading.textContent = t("audioSimilarityToReview", { count: reviewCount });
  audioSimilarityGroups.appendChild(reviewSection);
  if (reviewedCount > 0) {
    reviewedCards
      .sort((left, right) => right.processedAt.localeCompare(left.processedAt))
      .forEach(({ card }) => reviewedContent.appendChild(card));
    reviewedSummary.textContent = t("audioSimilarityReviewed", { count: reviewedCount });
    audioSimilarityGroups.appendChild(reviewedSection);
  }
  if (hiddenTracksCard) audioSimilarityGroups.appendChild(hiddenTracksCard);
};

const playSimilarityMember = async (
  groupId: string,
  member: AudioSimilarityMember | AudioSimilarityAuditionTrack,
  position: HTMLElement,
  button: HTMLButtonElement,
) => {
  if (similarityPreview && !similarityPreview.paused && similarityActiveGroupId === groupId
      && similarityPreview.dataset.trackId === member.trackId) {
    stopSimilarityPreview();
    button.textContent = t("audioSimilarityPlay");
    return;
  }
  stopSimilarityPreview();
  const requestVersion = similarityPreviewRequestVersion;
  await stopMainForSimilarityAudition();
  if (requestVersion !== similarityPreviewRequestVersion) return;
  if (similarityActiveGroupId !== groupId) similaritySharedPosition = 0;
  similarityActiveGroupId = groupId;
  const audio = new Audio();
  audio.dataset.trackId = member.trackId;
  const requestedOutputDeviceId = resolveOutputDeviceIdForChannel("headphone");
  if (shouldUseAudioDspForOutput("headphone", requestedOutputDeviceId)) {
    ensureAudioDspRuntime(audio);
  }
  const normalization = resolvePlaybackNormalization(member.gainDb, member.loudnessDb);
  setAudioLevel(audio, gainForTrack(normalization.gainDb));
  const outputRouting = await applyOutputDevice(audio, requestedOutputDeviceId);
  if (requestVersion !== similarityPreviewRequestVersion) {
    await releaseAudioDspRuntime(audio);
    return;
  }
  if (requestedOutputDeviceId && !outputRouting.appliedDeviceId) {
    await releaseAudioDspRuntime(audio);
    return;
  }
  audio.src = localAudioUrl(member.fullPath);
  similarityPreview = audio;
  similarityPreviewButton = button;
  similarityPreviewBounds = {
    startMs: member.startOffsetMs,
    effectiveMs: Math.max(0, member.durationMs - member.startOffsetMs - member.endTrimMs),
  };
  audio.addEventListener("loadedmetadata", () => {
    const effectiveMs = Math.max(0, member.durationMs - member.startOffsetMs - member.endTrimMs);
    audio.currentTime = (member.startOffsetMs + effectiveMs * similaritySharedPosition) / 1000;
    void audio.play().catch(() => stopSimilarityPreview());
  }, { once: true });
  audio.addEventListener("seeked", () => {
    const effectiveMs = Math.max(1, member.durationMs - member.startOffsetMs - member.endTrimMs);
    similaritySharedPosition = Math.max(0, Math.min(1,
      (audio.currentTime * 1000 - member.startOffsetMs) / effectiveMs));
    position.textContent = t("audioSimilaritySharedPosition", {
      percent: Math.round(similaritySharedPosition * 100),
    });
    position.closest(".audio-similarity-group")
      ?.querySelectorAll<HTMLCanvasElement>(".audio-similarity-waveform")
      .forEach((candidate) => candidate.dispatchEvent(new Event("similarity-position-change")));
  });
  audio.addEventListener("timeupdate", () => {
    const endMs = Math.max(member.startOffsetMs, member.durationMs - member.endTrimMs);
    if (audio.currentTime * 1000 >= endMs) stopSimilarityPreview();
  });
  audio.addEventListener("ended", stopSimilarityPreview, { once: true });
  audio.addEventListener("error", stopSimilarityPreview, { once: true });
  button.textContent = t("audioSimilarityStop");
  button.setAttribute("aria-pressed", "true");
};

const loadAudioSimilarityReport = async () => {
  if (!window.tanda) return;
  similarityReport = await window.tanda.getAudioSimilarityReport();
  similarityHiddenTrackIds = new Set(similarityReport.hiddenTrackIds);
  similarityEquivalentTrackIds = new Map();
  similarityRelationshipByTrackId = new Map();
  similarityPreferredTrackIds = new Map();
  const relationshipBreadth: Record<AudioSimilarityRelationshipType, number> = {
    identical: 0, "same-recording": 1, "same-orchestra": 2, "same-composition": 3,
  };
  for (const group of [...similarityReport.confirmedGroups].sort((left, right) =>
    left.trackIds.length - right.trackIds.length
      || relationshipBreadth[left.relationshipType] - relationshipBreadth[right.relationshipType])) {
    const members = new Set(group.trackIds);
    for (const trackId of members) {
      similarityEquivalentTrackIds.set(trackId, members);
      similarityRelationshipByTrackId.set(trackId, group.relationshipType);
      if (group.preferredTrackId) similarityPreferredTrackIds.set(trackId, group.preferredTrackId);
    }
  }
  invalidateTrackTandaUsage();
  renderAudioSimilarityReport();
  const running = similarityGenerationPending
    || similarityReport.status.state === "running"
    || similarityReport.status.state === "cancelling";
  if (similarityPollTimer !== null) window.clearTimeout(similarityPollTimer);
  similarityPollTimer = running
    ? window.setTimeout(() => { void loadAudioSimilarityReport(); }, 750)
    : null;
};

const initAudioSimilarityInteractions = () => {
  openAudioSimilarityBtn?.addEventListener("click", async () => {
    audioSimilarityPage?.classList.add("open");
    audioSimilarityPage?.setAttribute("aria-hidden", "false");
    similarityActiveGroupId = null;
    similaritySharedPosition = 0;
    similarityGroupSelections = new Map();
    similarityGroupMasterSelections = new Map();
    await loadAudioSimilarityReport();
  });
  closeAudioSimilarityBtn?.addEventListener("click", () => {
    stopSimilarityPreview();
    similarityMetadataUndoStacks.clear();
    audioSimilarityPage?.classList.remove("open");
    audioSimilarityPage?.setAttribute("aria-hidden", "true");
    if (similarityPollTimer !== null) window.clearTimeout(similarityPollTimer);
    similarityPollTimer = null;
  });
  audioSimilaritySearch?.addEventListener("input", renderAudioSimilarityReport);
  generateAudioSimilarityBtn?.addEventListener("click", async () => {
    const regenerating = Boolean(similarityReport?.hasCompletedReport);
    if (regenerating && !(await showConfirmModal(
      t("audioSimilarityRegenerateConfirm"), t("audioSimilarityTitle"),
    ))) return;
    similarityGenerationCompleted = false;
    similarityGenerationPending = true;
    renderAudioSimilarityReport();
    const generation = window.tanda!.generateAudioSimilarityReport({ fullRebuild: false });
    await loadAudioSimilarityReport();
    try {
      const result = await generation;
      similarityGenerationCompleted = result.state === "completed";
    } catch (error) {
      if (audioSimilarityStatus) {
        audioSimilarityStatus.textContent = t("audioSimilarityFailed", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      similarityGenerationPending = false;
      await loadAudioSimilarityReport();
    }
  });
  cancelAudioSimilarityBtn?.addEventListener("click", async () => {
    similarityGenerationCompleted = false;
    await window.tanda!.cancelAudioSimilarityAnalysis();
    await loadAudioSimilarityReport();
  });
  document.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement | null;
    const trigger = target?.closest<HTMLElement>(".duplicate-jump")
      ?? target?.closest<HTMLElement>("button")?.querySelector<HTMLElement>(".duplicate-jump");
    if (trigger) startPlaylistDuplicateFocus(trigger);
  });
  document.addEventListener("pointerup", cancelPlaylistDuplicateFocusTimer);
  document.addEventListener("pointercancel", () => {
    cancelPlaylistDuplicateFocusTimer();
    suppressDuplicateJumpClick = false;
  });
  window.addEventListener("blur", cancelPlaylistDuplicateFocusTimer);
  playlistDuplicateFocusClear?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearPlaylistDuplicateFocus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    const target = event.target as HTMLElement | null;
    const trigger = target?.closest<HTMLElement>(".duplicate-jump")
      ?? target?.closest<HTMLElement>("button")?.querySelector<HTMLElement>(".duplicate-jump");
    if (trigger && !event.repeat) startPlaylistDuplicateFocus(trigger, true);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !playlistDuplicateFocusStatus?.classList.contains("hidden")) {
      clearPlaylistDuplicateFocus();
    }
  });
};

const init = async () => {
  if (!window.tanda) {
    setStatus(t("statusNoApi"));
    return;
  }
  initAudioSimilarityInteractions();

  try {
    const version = await window.tanda.getAppVersion();
    if (version.trim()) {
      appVersion = version.trim();
    }
  } catch {
    appVersion = "—";
  }

  const settingsLibraryController = createSettingsLibraryController({
    translate: t,
    basenameForDisplay: (filePath) => basenameForDisplay(filePath ?? ""),
    api: {
      scanKind: (kind) => window.tanda!.scanKind(kind),
      runStartupFlow: (params) => window.tanda!.runStartupFlow(params),
      precomputeCompressedTracks: (params) => window.tanda!.precomputeCompressedTracks(params),
      refreshStoredMetadata: () => window.tanda!.refreshStoredMetadata(),
      verifyCachedFiles: () => window.tanda!.verifyCachedFiles(),
      clearCachedFiles: () => window.tanda!.clearCachedFiles(),
      exportSystemData: () => window.tanda!.exportSystemData(),
      importSystemData: () => window.tanda!.importSystemData(),
    },
    elements: {
      errorList,
      progressEl,
      progressLabel,
      progressElSettings,
      progressLabelSettings,
      precomputeProgressElSettings,
      precomputeProgressLabelSettings,
      precomputeCompressedResult,
      precomputeCompressedBtn,
      precomputeCompressedShortcutBtn,
      refreshStoredMetadataResult,
      refreshStoredMetadataBtn,
      startupFlowBtn,
      startupFlowResult,
      startupFlowPhaseItems,
      startupFlowPhaseDetail,
      startupFlowProgressLabel,
      startupFlowEta,
      startupFlowProgressEl,
      scanMusicBtn,
      scanCortinasBtn,
      exportSystemBtn,
      importSystemBtn,
      systemTransferResult,
      systemTransferProgress,
      cacheVerifyResult,
    },
    setStatus,
    clearAlert,
    getCompressionConfig: getAudioDynamicsConfig,
    scheduleCompressionPrefetch,
    onScanCompleted: async (kind) => {
      if (kind === "music" || kind === "cortina") {
        libraryWorkflowAnalysisCompleted = true;
        libraryWorkflowReadiness = "idle";
        renderLibraryWorkflow();
      }
      await loadStyles();
      await loadCortinaSets();
      if (kind === "music") {
        await refreshNewCollectionTracks();
      }
      await refreshSearch();
      await renderDiagnosticsDataReadiness();
      renderAllLists();
    },
    onStoredMetadataRefreshed: async () => {
      const cachedTrackIds = Array.from(trackCache.keys());
      if (cachedTrackIds.length > 0) {
        const refreshedTracks = await window.tanda!.getTracksByIds(cachedTrackIds);
        refreshedTracks.forEach((track) => trackCache.set(track.id, track));
      }
      await refreshNewCollectionTracks();
      await refreshSearch();
      renderAllLists();
      updateNowPlayingDisplay();
    },
    onCachedFilesCleared: async () => {
      await renderDiagnosticsPaths();
      await renderDiagnosticsDataReadiness();
      updateNowPlayingDisplay();
    },
    onStartupFlowCompleted: async () => {
      libraryWorkflowAnalysisCompleted = true;
      libraryWorkflowReadiness = "idle";
      renderLibraryWorkflow();
      await loadTandaDrafts();
      await loadStyles();
      await loadCortinaSets();
      await refreshNewCollectionTracks();
      await refreshSearch();
      await updateLegacyImport();
      await renderDiagnosticsDataReadiness();
      renderAllLists();
      updateNowPlayingDisplay();
    },
    onSystemImported: async () => {
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
      isMarkedLastFinalCortinaActive = false;
      isPerformanceStopFinalCortinaActive = false;
      isPausedForPerformanceStop = false;
      lastPausedPerformanceStopCortinaLabel = null;
      holdPerformanceStopDisplayBlankWhenIdle = false;
      playlistPlayback.activeTrackId = null;
      playlistPlayback.activeTandaId = null;
      playlistPlayback.liveBaseStartMs = null;
      clearPlaylistTarget();
      resetCortinaPlans();
      localStorage.removeItem(PLAYLIST_STORAGE_KEY);
      await renderRoots();
      await renderDataLocation();
      await loadStyles();
      await loadTandaDrafts();
      await loadCortinaSets();
      await updateLegacyImport();
      await renderDiagnosticsPaths();
      await renderFfmpegToolsDir();
      await renderDiagnosticsDataReadiness();
      await refreshSearch();
      renderClipboard();
      renderPlaylist();
      renderAllLists();
      updateNowPlayingDisplay();
    },
  });
  systemBackupStatus = await window.tanda.getSystemBackupStatus();
  settingsLibraryController.handleSystemBackupStatus(systemBackupStatus);
  window.tanda.onSystemBackupStatus((status) => {
    systemBackupStatus = status;
    settingsLibraryController.handleSystemBackupStatus(status);
  });
  const settingsPlaylistController = createSettingsPlaylistController({
    storage: localStorage,
    elements: {
      playlistLastTandaToggle,
      playlistLastTandaCountInput,
      playlistPerformanceStopToggle,
      playlistCortinaSetSelect,
      playlistCortinaDurationInput,
      displayBackgroundIntervalInput,
      displayLagInput,
      displayLagValue,
      displayUseImagesInput,
      displayImageDimInput,
      displayBaseFontSizeInput,
      displayCortinaFontSizeInput,
      displayEdgePaddingInput,
      playlistStartTimeInput,
      playlistEndTimeInput,
      playlistArtistRepeatGapInput,
    },
    keys: {
      playlistLastTanda: PLAYLIST_LAST_TANDA_KEY,
      playlistLastTandaCount: PLAYLIST_LAST_TANDA_COUNT_KEY,
      playlistPerformanceStop: PLAYLIST_PERFORMANCE_STOP_KEY,
      cortinaSet: CORTINA_SET_KEY,
      cortinaDuration: CORTINA_DURATION_KEY,
      displayBackgroundInterval: DISPLAY_BACKGROUND_INTERVAL_KEY,
      displayLag: DISPLAY_AV_LAG_KEY,
      displayUseImages: DISPLAY_USE_IMAGES_KEY,
      displayImageDim: DISPLAY_IMAGE_DIM_KEY,
      displayFontScale: DISPLAY_FONT_SCALE_KEY,
      displayCortinaFontScale: DISPLAY_CORTINA_FONT_SCALE_KEY,
      displayEdgePadding: DISPLAY_EDGE_PADDING_KEY,
      playlistStartTime: "tanda-playlist-start-time",
      playlistEndTime: PLAYLIST_END_TIME_KEY,
      playlistArtistRepeatGapMinutes: PLAYLIST_ARTIST_REPEAT_GAP_MIN_KEY,
    },
    readers: {
      getPlaylistLastTandaCount,
      getCortinaSet,
      getCortinaDuration,
      getDisplayBackgroundIntervalSec,
      getDisplayLagSeconds,
      getDisplayUseBackgroundImages,
      getDisplayImageDimOpacity,
      getDisplayFontScale,
      getDisplayCortinaFontScale,
      getDisplayEdgePaddingVmin,
      getPlaylistStartTimeInput,
      getPlaylistEndTimeInput,
      getPlaylistArtistRepeatGapMinutes,
    },
    actions: {
      resetPlaylistLastTandaState: () =>
        resetPlaylistLastTandaState(localStorage, PLAYLIST_LAST_TANDA_KEY),
      resetPlaylistPerformanceStopState: () =>
        resetPlaylistToggleState(localStorage, PLAYLIST_PERFORMANCE_STOP_KEY),
      onPlaylistLastTandaChanged: () => {
        syncMarkedLastTandaRemainingCount();
        renderPlaylist();
      },
      updateExternalDisplay,
      onDisplayLagChanged: (seconds) => {
        displayLagScheduler.setDelaySeconds(seconds);
        lastDisplayPayloadSignature = "";
        clearCalibrationFlashTimers();
        if (displayLagModalInput) {
          displayLagModalInput.value = seconds.toFixed(3);
        }
        if (displayLagModalValue) {
          displayLagModalValue.value = seconds.toFixed(3);
          displayLagModalValue.textContent = seconds.toFixed(3);
        }
      },
      onCortinaSetChanged: async (next) => {
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
      },
      onCortinaDurationChanged: () => {},
      onPlaylistStartTimeChanged: () => {
        renderPlaylist();
      },
    },
  });
  const settingsSearchAudioController = createSettingsSearchAudioController({
    storage: localStorage,
    elements: {
      tandaSizeInput,
      clipboardNewLimitInput,
      searchMinScoreInput,
      searchTandaSizeInput,
      searchBpmRangeInput,
      trimPaddingInput,
      gapBetweenTracksInput,
      gapBeforeTandaInput,
      gapBeforeCortinaInput,
      stopFadeInput,
      cortinaLevelPercentInput,
      audioDynamicsEnabledInput,
      audioDynamicsLiftThresholdInput,
      audioDynamicsMaxLiftInput,
      audioDynamicsRatioInput,
      audioDynamicsAttackInput,
      audioDynamicsReleaseInput,
      audioDynamicsGateThresholdInput,
      audioDynamicsLimiterCeilingInput,
      audioDynamicsLimiterReleaseInput,
      audioDynamicsRampInput,
    },
    keys: {
      tandaDefaultSize: "tanda-default-size",
      clipboardNewLimit: CLIPBOARD_NEW_LIMIT_KEY,
      searchMinScore: SEARCH_MIN_SCORE_KEY,
      tandaSearchSize: TANDA_SEARCH_SIZE_KEY,
      searchBpmRange: SEARCH_BPM_RANGE_KEY,
      trimPadding: TRIM_PADDING_KEY,
      gapBetweenTracks: "tanda-gap-between-tracks",
      gapBeforeTanda: "tanda-gap-before-tanda",
      gapBeforeCortina: "tanda-gap-before-cortina",
      stopFade: "tanda-stop-fade",
      cortinaLevelPercent: CORTINA_LEVEL_PERCENT_KEY,
      dynamicsEnabled: AUDIO_DYNAMICS_ENABLED_KEY,
      dynamicsLiftThreshold: AUDIO_DYNAMICS_LIFT_THRESHOLD_KEY,
      dynamicsMaxLift: AUDIO_DYNAMICS_MAX_LIFT_KEY,
      dynamicsRatio: AUDIO_DYNAMICS_RATIO_KEY,
      dynamicsAttack: AUDIO_DYNAMICS_ATTACK_KEY,
      dynamicsRelease: AUDIO_DYNAMICS_RELEASE_KEY,
      dynamicsGateThreshold: AUDIO_DYNAMICS_GATE_THRESHOLD_KEY,
      dynamicsLimiterCeiling: AUDIO_DYNAMICS_LIMITER_CEILING_KEY,
      dynamicsLimiterRelease: AUDIO_DYNAMICS_LIMITER_RELEASE_KEY,
      dynamicsRamp: AUDIO_DYNAMICS_RAMP_KEY,
    },
    readers: {
      getDefaultTandaSize,
      getNewCollectionLimit,
      getSearchMinScore,
      getSearchBpmRange,
      getTrimPaddingSeconds,
      getGapBetweenTracks,
      getGapBeforeTanda,
      getGapBeforeCortina,
      getStopFadeSeconds,
      getCortinaLevelPercent,
      getAudioDynamicsConfig,
    },
    actions: {
      refreshSearch: () => {
        void refreshSearch();
      },
      renderClipboard: () => renderClipboard(),
      refreshNewCollectionTracks: () => refreshNewCollectionTracks(),
      renderTandaSearchResults,
      renderPlaylist,
      updateNowPlayingDisplay,
      setMainCompressionDepthPercent,
      scheduleCompressionPrefetch,
      syncDynamicsRuntimeForActivePlayback,
      normalizeTandaSearchSizeInput,
    },
  });
  const settingsGeneralController = createSettingsGeneralController({
    storage: localStorage,
    elements: {
      languageSelect,
      modeSelect,
      mainOutputSelect,
      headphoneOutputSelect,
    },
    keys: {
      language: "tanda-language",
      mode: "tanda-mode",
      headphoneOutput: "tanda-headphone-output",
      headphoneOutputLabel: "tanda-headphone-output-label",
      headphoneOutputGroup: "tanda-headphone-output-group",
    },
    readers: {
      getLanguage,
      getAppMode: () => appMode,
      getMainOutputValue: () => mainOutputSelect?.value ?? null,
    },
    actions: {
      applyLanguageChange: async (language) => {
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
        setStatus(t("statusLanguageSet", { language }));
      },
      applyModeChange: (nextMode, previousMode) => {
        const next = resolveOutputModeValue(nextMode);
        setAppModeState(next);
        document.body.classList.toggle("mode-live", appMode === "live");
        if (previousMode !== "live" && appMode === "live") {
          attachActivePlaylistTrackToRun();
        }
        if (appMode === "edit") {
          setTrackEditorOpen(false);
          trackEditorState.track = null;
          setCortinaModalVisible(false);
        }
        updateTrackEditorPresentation();
        renderPlaylist();
        renderTandaDesigner();
        updatePlaylistControls();
      },
      verifyOutputSelection,
      ensureAudioOutputs,
      renderAllLists,
    },
  });
  const settingsCatalogController = createSettingsCatalogController({
    elements: {
      orchestraAddBtn,
      orchestraResetBtn,
      orchestraSaveBtn,
      orchestraFilterInput,
      styleFamilyAddBtn,
      styleFamilyCodeInput,
      styleFamilyBaseInput,
      styleFamilyVariantsInput,
    },
    actions: {
      addOrchestraEntry: () => {
        orchestraRegistry.push(
          normalizeRegistryEntry({
            canonical: "",
            aliases: [],
            related: [],
          }),
        );
        renderOrchestraRegistry();
      },
      resetOrchestraRegistry: async () => {
        const confirmed = await showConfirmModal(t("confirmOrchestraRegistryReset"));
        if (!confirmed) {
          return;
        }
        orchestraRegistry = convertSeedToRegistry(ORCHESTRA_SEED_DATA);
        saveOrchestraRegistry();
        renderOrchestraRegistry();
        setStatus(t("statusOrchestraRegistryReset"));
      },
      saveOrchestraRegistry: () => {
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
      },
      setOrchestraFilter: (value) => {
        orchestraFilterText = value;
        renderOrchestraRegistry();
      },
      addStyleFamily: async () => {
        const code = styleFamilyCodeInput?.value?.trim().toUpperCase() ?? "";
        const base = styleFamilyBaseInput?.value?.trim() ?? "";
        const variants = (styleFamilyVariantsInput?.value ?? "")
          .split(/[;,/]+/)
          .map((value) => value.trim())
          .filter(Boolean);
        if (!code || !base) {
          return false;
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
        return true;
      },
    },
  });
  const libraryListInteractionsController = createLibraryListInteractionsController({
    elements: {
      clipTandasEl,
      searchTracksEl,
      searchTandasEl,
      clipTracksEl,
    },
    readers: {
      getClipboardTandas: () => clipboardTandas,
      getClipboardTracks: () => clipboardTracks,
      getActiveCollectionId: () => getActiveCollection()?.id ?? null,
      getAppMode: () => appMode,
      isHeadphoneAvailable: () => headphoneAvailable,
      isTrackEditorOpen,
      getTrackDataFromRow,
      getTrackById: resolveTrackById,
      getTrackFromCache: (id) => trackCache.get(id) ?? null,
      resolveTandaForSearch,
      getClipboardMoveTargets,
    },
    actions: {
      handleDuplicateJump,
      toggleTandaRow,
      closeDetailMenus,
      closeRowMenus,
      toggleRowMenu,
      openTrackEditor,
      runSearchForTrack,
      runFindTandasForTrack,
      runSearchForTanda,
      playOnChannel,
      previewSearchTrackOnHeadphones,
      playTrackForMode,
      updateHeadphoneButtonIndicators,
      addTrackToClipboard,
      addTandaToClipboard,
      openTandaInDesigner,
      addTrackToActiveTanda,
      appendTrackToPlaylist,
      addTandaToPlaylist,
      moveTrackBetweenClipboardCollections,
      moveTandaBetweenClipboardCollections,
      openTrackMoveTargetMenu,
      openTandaMoveTargetMenu,
      removeClipboardTrack,
      removeClipboardTanda,
      activateClipboardTab: (tabId) => activatePanelTab(clipPanel, tabId),
      setSelectedClipboardTrackId: (trackId) => {
        selectedClipboardTrackId = trackId;
      },
      setSelectedClipboardTandaId: (tandaId) => {
        selectedClipboardTandaId = tandaId;
      },
      renderClipboard,
      setStatusNoTandaSelected: () => {
        setStatus(t("statusNoTandaSelected"));
      },
    },
  });
  const panelInteractionsController = createPanelInteractionsController({
    elements: {
      tandaListEl,
      playlistTandaEditorEl,
      panelTabButtons,
      documentBody: document,
    },
    readers: {
      getTrackFromCache: (trackId) => trackCache.get(trackId) ?? null,
    },
    actions: {
      handleTandaAction,
      playTrackForMode,
      handleDropToTanda,
      closeRowMenus,
      closeDetailMenus,
      closeStyleVariantMenu,
      closeCollectionTargetMenu,
      setActiveSearchTab: (tabId) => {
        setActiveSearchTabState(tabId as SearchTab);
      },
      updateSearchTabVisibility,
      setActiveRightTab: (tabId) => {
        setActiveRightTabState(tabId as RightPanelTab);
      },
      renderTandaDesigner,
    },
  });
  const playlistInteractionsController = createPlaylistInteractionsController({
    elements: {
      playlistPanel: playlistPanel as HTMLElement | null,
      playlistListEl,
      addTandaBtn,
    },
    readers: {
      getHeadphoneAvailable: () => headphoneAvailable,
      getTrackDataFromRow,
      getTrackFromCache: (trackId) => trackCache.get(trackId) ?? null,
      getTrackById: resolveTrackById,
      resolveTandaForSearch,
      resolvePlaylistRowIndex,
      resolveSearchStylesForPlaylistIndex,
      isCortinaIndexEditable,
      isPlaylistIndexLocked,
      isPlaylistTandaSlotLocked,
      getPlaylistTargetIndex,
      getPlaylistTrackTargetIndex,
      getPlaylistItems: () => playlistItems,
      getPlaylistOpenTandaIndex: () => playlistOpenTandaIndex,
      getRuleForSlot,
      getPlaylistStyleMap,
      getSelectedTandaId: () => selectedTandaId,
      getSelectedClipboardTandaId: () => selectedClipboardTandaId,
      getSelectedClipboardTrackId: () => selectedClipboardTrackId,
      getClipboardTandas: () => clipboardTandas,
      getClipboardTracks: () => clipboardTracks,
      getActiveCollection,
      getAppMode: () => appMode,
      isMainPlaying: () => !!playback.main.active && !playback.main.active.paused,
      shouldStartPlaylistFromClick: (mode, isMainPlaying) =>
        shouldStartPlaylistFromClick(
          mode as "prep" | "live" | "edit",
          isMainPlaying,
        ),
      resolveTandaDraft,
    },
    actions: {
      handleDropToPlaylist,
      createEmptyTanda,
      appendTandaDraft: (draft) => {
        tandaDrafts = [...tandaDrafts, draft];
      },
      setActiveTanda,
      openCortinaModal,
      toggleTandaRow,
      closeDetailMenus,
      closeRowMenus,
      openTrackEditor,
      playOnChannel,
      runSearchForTanda,
      runSearchForTrack,
      toggleRowMenu,
      clearPlaylistTarget,
      retainPlaylistTargetAtIndex,
      retainPlaylistTrackTargetAtIndex,
      applyPlaylistTargetStyles,
      setPlaylistTargetIndex: (index) => {
        playlistTargetIndex = index;
      },
      setCenterPlaylistTargetOnNextRender: (value) => {
        centerPlaylistTargetOnNextRender = value;
      },
      renderPlaylist,
      setStatusPlaylistLocked: () => {
        setStatus(t("statusPlaylistLocked"));
      },
      setStatusPlaylistSwapInvalid: () => {
        setStatus(t("statusPlaylistSwapInvalid"));
      },
      setStatusClipboardReadonlyRemove: () => {
        setStatus(t("statusClipboardReadonlyRemove"));
      },
      setStatusCortinaLocked: () => {
        setStatus(t("statusCortinaLocked"));
      },
      markPlaylistPulse,
      validateTandaForSlot,
      confirmPlaylistCountOverride: (ruleLabel, expected, count, onConfirm) => {
        showAlertAction(
          t("confirmPlaylistSequenceOverride", {
            rule: ruleLabel,
            expected,
            count,
          }),
          t("allowOverride"),
          onConfirm,
        );
      },
      confirmPlaylistStyleOverride: (ruleLabel, tandaLabel, onConfirm) => {
        showAlertAction(
          t("confirmPlaylistSequenceStyleOverride", {
            rule: ruleLabel,
            tanda: tandaLabel,
          }),
          t("allowOverride"),
          onConfirm,
        );
      },
      setPlaylistItem: (index, item) => {
        playlistItems[index] = item;
      },
      setPlaylistOpenTandaIndex: (index) => {
        playlistOpenTandaIndex = index;
      },
      ensurePlaylistEditableTanda,
      createPlaceholderTanda,
      openTandaInDesigner,
      addTandaToActiveCollection,
      addTrackToActiveCollection,
      normalizePlaylist,
      renderClipboard,
      setSelectedStylesFromRule: (styles) => {
        selectedStyles = toBaseStyleFilters(styles);
        loadStyles();
        updateSearchTabVisibility();
        refreshSearch();
        activatePanelTab(getSearchPanel(), "search-tracks");
        setActiveSearchTabState("search-tracks");
      },
      createPlaylistTandaForSlot,
      ensureTandaDraft,
      startPlaylistFrom,
      setSelectedClipboardTandaId: (tandaId) => {
        selectedClipboardTandaId = tandaId;
      },
      setSelectedClipboardTrackId: (trackId) => {
        selectedClipboardTrackId = trackId;
      },
      saveClipboardCollections,
      placeTandaInPlaylistSlot,
      playTrackForMode,
      refreshPlaylistTandaStyles: (tanda) => {
        const tracks = tanda.trackSlots.map((id: string | null) =>
          id ? trackCache.get(id) ?? null : null,
        );
        const derivedStyles = collectStylesFromTracks(tracks, availableStyles);
        const normalizedExisting = tanda.styles
          .map((style: string) => normalizeStyleName(style))
          .map((normalized: string) =>
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
      },
      setTrackInCache: (track) => {
        trackCache.set(track.id, track);
      },
      updateHeadphoneButtonIndicators,
      getSequenceLabel,
      getTandaSequenceLabel,
    },
  });
  const appRuntimeController = createAppRuntimeController({
    elements: {
      searchInput,
      searchButton,
      searchSortButtons,
      searchListBody,
      clipPanel: clipPanel as HTMLElement | null,
      playlistListEl,
      documentBody: document,
      windowObject: window,
      mediaDevices: navigator.mediaDevices,
    },
    readers: {
      getSearchState: () => searchState,
      shouldBlockBeforeUnload: () => {
        if (allowAppClose) {
          return false;
        }
        const isHeadphonePlaying =
          playback.headphone.active && !playback.headphone.active.paused;
        const isMainPlaying = playback.main.active && !playback.main.active.paused;
        return (
          !!isHeadphonePlaying ||
          !!isMainPlaying ||
          systemBackupStatus.state === "running"
        );
      },
    },
    actions: {
      scheduleSearch,
      refreshSearch,
      patchSearchState: (patch) => {
        patchSearchState(patch);
      },
      updateSortButtons,
      handleSearchScroll,
      handleDropToClipboard,
      ensureAudioOutputs,
      renderAllLists,
      markUserInteraction,
    },
  });
  const settingsShellController = createSettingsShellController({
    storage: localStorage,
    body: document.body,
    elements: {
      themeToggle,
      closeSettingsBtn,
      openSettingsBtn,
      fullscreenToggle,
      openDisplayBtn,
      openDiagnosticsSettings,
      openDiagnosticsPrecompute,
      tabButtons,
      tabPanels,
    },
    actions: {
      setSettingsOpen,
      activateSettingsTab: (tab) => activateSettingsTab(tabButtons, tabPanels, tab),
      toggleFullscreen: async () => {
        if (!window.tanda?.toggleFullscreen) {
          throw new Error(t("statusFullscreenUnavailable"));
        }
        await window.tanda.toggleFullscreen();
      },
      openDisplay: async () => {
        if (!window.tanda?.openDisplay) {
          throw new Error(t("statusNoApi"));
        }
        await window.tanda.openDisplay();
      },
      updateExternalDisplay,
      setStatus,
    },
    labels: {
      fullscreenUnavailable: t("statusFullscreenUnavailable"),
      fullscreenFailed: t("statusFullscreenFailed"),
      fullscreenFailedDetail: (message) =>
        t("statusFullscreenFailedDetail", { message }),
      noApi: t("statusNoApi"),
    },
  });
  openLibrarySetupMain?.addEventListener("click", async () => {
    await setSettingsOpen(true);
    activateSettingsTab(tabButtons, tabPanels, "library");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollSettingsContentTo(settingsContent, libraryRootsSection);
        pulseSettingsSection(libraryRootsSection);
      });
    });
  });
  const savedMode = (localStorage.getItem("tanda-mode") ?? "prep") as OutputMode;
  setAppModeState(resolveOutputModeValue(savedMode));
  document.body.classList.toggle("mode-live", appMode === "live");

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

  document.querySelector<HTMLSelectElement>("#rating-filter-mode")?.addEventListener("change", (event) => {
    setRatingFilter({ mode: (event.target as HTMLSelectElement).value as RatingFilter["mode"], stars: ratingFilter.stars });
  });
  document.querySelector("#rating-filter-clear")?.addEventListener("click", () => {
    setRatingFilter({ mode: "any", stars: 1 });
    const details = document.querySelector<HTMLDetailsElement>("#rating-filter");
    if (details) details.open = false;
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
      playlistFilterOrchestra = null;
      playlistFilterTandaIds = null;
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
      playlistFilterOrchestra = null;
      playlistFilterTandaIds = null;
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
    if (selection === "generate") {
      await clearAndAutofillPlaylist({ generateOnly: true });
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
    const backupRunning = systemBackupStatus.state === "running";
    if (isHeadphonePlaying || isMainPlaying || backupRunning) {
      const message =
        isHeadphonePlaying || isMainPlaying
          ? backupRunning
            ? t("confirmCloseWhilePlayingAndBackupRunning")
            : t("confirmCloseWhilePlaying")
          : t("confirmCloseWhileBackupRunning");
      void showConfirmModal(
        message,
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

  settingsGeneralController.initialize();
  settingsCatalogController.initialize();
  libraryListInteractionsController.initialize();
  panelInteractionsController.initialize();
  playlistInteractionsController.initialize();
  appRuntimeController.initialize();
  settingsShellController.initialize();

  settingsSearchAudioController.initialize();
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
      setMainCompressionDepthPercent(clamped);
    });
  }
  settingsPlaylistController.initialize();

  displayLagCalibrateBtn?.addEventListener("click", openAvLagCalibration);
  displayLagModalClose?.addEventListener("click", closeAvLagCalibration);
  displayLagModal?.addEventListener("click", (event) => {
    if (event.target === displayLagModal) {
      closeAvLagCalibration();
    }
  });
  displayLagToggle?.addEventListener("click", async () => {
    displayLagToggle.disabled = true;
    try {
      if (avLagCalibrationLoop.isRunning()) {
        stopAvLagCalibration();
      } else {
        await startAvLagCalibration();
      }
    } finally {
      displayLagToggle.disabled = false;
    }
  });
  displayLagModalInput?.addEventListener("input", () => {
    const value = Math.min(4, Math.max(0, Number.parseFloat(displayLagModalInput.value) || 0));
    const formatted = value.toFixed(3);
    localStorage.setItem(DISPLAY_AV_LAG_KEY, formatted);
    displayLagScheduler.setDelaySeconds(value);
    lastDisplayPayloadSignature = "";
    clearCalibrationFlashTimers();
    if (displayLagModalValue) {
      displayLagModalValue.value = formatted;
      displayLagModalValue.textContent = formatted;
    }
    if (displayLagInput) {
      displayLagInput.value = value.toString();
    }
    if (displayLagValue) {
      displayLagValue.value = formatted;
      displayLagValue.textContent = formatted;
    }
    updateExternalDisplay();
  });

  clearPlayCountsBtn?.addEventListener("click", async () => {
    const confirmed = await showConfirmModal(t("confirmClearPlayCounts"));
    if (!confirmed) {
      return;
    }
    clearPlayCounts();
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
    const applySequenceValidationState = () => {
      const validation = validateSequenceSyntax(playlistSequenceInput.value);
      if (!validation.ok) {
        const message = validation.message ?? t("playlistSequenceInvalidSyntax");
        playlistSequenceInput.dataset.invalid = "1";
        playlistSequenceInput.title = message;
        setStatus(t("statusPlaylistSequenceInvalid", { message }));
        return false;
      }
      const parsed = parseSequence(playlistSequenceInput.value);
      const codeValidation = validateSequenceCodes(
        parsed,
        Object.keys(getPlaylistStyleMap()),
      );
      if (!codeValidation.ok) {
        const message = t("playlistSequenceUnknownCodes", {
          codes: codeValidation.unknownCodes.join(", "),
        });
        playlistSequenceInput.dataset.invalid = "1";
        playlistSequenceInput.title = message;
        setStatus(t("statusPlaylistSequenceInvalid", { message }));
        return false;
      }
      delete playlistSequenceInput.dataset.invalid;
      playlistSequenceInput.title = "";
      return true;
    };
    playlistSequenceInput.addEventListener("input", () => {
      void applySequenceValidationState();
    });
    playlistSequenceInput.addEventListener("change", () => {
      if (!applySequenceValidationState()) {
        return;
      }
      localStorage.setItem("tanda-playlist-sequence", playlistSequenceInput.value);
      recomputePlaylistMismatches();
      renderPlaylist();
    });
    void applySequenceValidationState();
  }

  cortinaStopBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!cortinaPlaying) {
      return;
    }
    cortinaStopRequested = true;
    void requestImmediateCortinaStop();
    setCortinaControlsVisible(false);
    updateNowPlayingDisplay();
  });
  cortinaPlayBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!cortinaPlaying) {
      return;
    }
    cortinaStopRequested = false;
    cortinaAllowFull = true;
    cortinaAutoStopRevision += 1;
    applyDynamicLevelToChannel("main");
    setCortinaControlsVisible(true);
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
    if (field === "genre") {
      selectedStyles = resolveTrackSearchStyles({
        trackStyle: fieldValue,
        availableStyles,
      });
      loadStyles();
      runSearchQuery(searchInput.value, true, "search-tracks");
      return;
    }
    const nextQuery = appendQueryTokens(searchInput.value, fieldValue);
    runSearchQuery(nextQuery, true);
  });
  trackEditorResetBtn?.addEventListener("click", () => {
    resetTrackEditorFields();
  });
  trackEditorDeleteBtn?.addEventListener("click", async () => {
    const track = trackEditorState.track;
    if (!window.tanda || !track) return;
    const removeFile = await showDeleteTrackModal();
    if (removeFile === null) return;
    try {
      const result = await window.tanda.deleteTrack({ id: track.id, removeFile });
      if (!result.ok) {
        setStatus(t("statusTrackDeleteFailed"));
        return;
      }
      setTrackEditorOpen(false);
      clearTrackEditorState();
      setStatus(result.fileRemovalError
        ? t("statusTrackDeletedFileFailed", { message: result.fileRemovalError })
        : result.fileRemoved ? t("statusTrackDeletedWithFile") : t("statusTrackDeleted"));
      await refreshSearch();
      await renderDeletedTracks();
      renderAllLists();
    } catch {
      setStatus(t("statusTrackDeleteFailed"));
    }
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
      if (appMode === "edit") {
        trackEditorState.track = { ...updated };
        fillTrackEditorFields(updated);
      } else {
        setTrackEditorOpen(false);
        clearTrackEditorState();
      }
      await loadStyles();
      await refreshSearch();
      renderAllLists();
      if (audioSimilarityPage?.classList.contains("open")) {
        await loadAudioSimilarityReport();
        refreshOpenSimilarityMetadataOverlay();
      }
    } catch {
      setStatus(t("statusTrackUpdateFailed"));
    }
  });

  attachModalDrag(trackEditor);
  attachModalDrag(cortinaModal);

  window.tanda.onScanProgress((progress) => {
    settingsLibraryController.handleScanProgress(progress);
  });

  window.tanda.onStartupFlowProgress((progress) => {
    settingsLibraryController.handleStartupFlowProgress(progress);
  });

  window.tanda.onPrecomputeCompressedProgress((progress) => {
    settingsLibraryController.handlePrecomputeProgress(progress);
  });

  nowPlayingSection?.addEventListener("click", async (event) => {
    if (shouldIgnoreNowPlayingSectionClick(event.target)) {
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
    event.preventDefault();
    event.stopPropagation();
    seekToWaveformPosition(event, waveformContainer);
  });
  trackEditorWaveformContainer?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    seekToWaveformPosition(event, trackEditorWaveformContainer);
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
  diagnosticsFfmpegToolsPickBtn?.addEventListener("click", () => {
    if (!diagnosticsFfmpegToolsResult) {
      return;
    }
    const controller = getSettingsDiagnosticsController();
    if (!controller) {
      return;
    }
    void controller.chooseFfmpegToolsDir(diagnosticsFfmpegToolsResult, renderDiagnosticsPaths);
  });
  diagnosticsFfmpegToolsClearBtn?.addEventListener("click", () => {
    if (!diagnosticsFfmpegToolsResult) {
      return;
    }
    const controller = getSettingsDiagnosticsController();
    if (!controller) {
      return;
    }
    void controller.clearFfmpegToolsDir(diagnosticsFfmpegToolsResult, renderDiagnosticsPaths);
  });
  diagnosticsClearLogsBtn?.addEventListener("click", () => {
    void clearDiagnosticsLogs();
  });
  diagnosticsOutputProbeBtn?.addEventListener("click", () => {
    void runAudioOutputProbe();
  });

  playlistStartBtn?.addEventListener("click", () => {
    if (playlistPlayback.status === "paused" && playlistPlayback.resume) {
      resumePlaylistPlayback();
      return;
    }
    startPlaylistPlayback();
  });
  playlistStopBtn?.addEventListener("click", () => {
    void stopPlaybackFromPlaylistControls();
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
    isMarkedLastFinalCortinaActive = false;
    isPerformanceStopFinalCortinaActive = false;
    isPausedForPerformanceStop = false;
    lastPausedPerformanceStopCortinaLabel = null;
    holdPerformanceStopDisplayBlankWhenIdle = false;
    playlistPlayback.activeTrackId = null;
    playlistPlayback.activeTandaId = null;
    playlistPlayback.liveBaseStartMs = null;
    clearPlaylistTarget();
    resetCortinaPlans();
    localStorage.removeItem(PLAYLIST_STORAGE_KEY);
    await renderRoots();
    await renderDataLocation();
    await updateLegacyImport(result.path);
    await renderDiagnosticsPaths();
    await renderFfmpegToolsDir();
    await renderDiagnosticsDataReadiness();
    renderClipboard();
    renderPlaylist();
    refreshSearch();
  });

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
    await applyStoredLegacyStyleMappingsForImport();
    const result = await window.tanda.importLegacy(legacyImportRootPath);
    libraryWorkflowLegacyStylesReviewed = true;
    libraryWorkflowLegacyImported = result.tracksAdded + result.tracksUpdated + result.tandasImported > 0;
    libraryWorkflowAnalysisCompleted = false;
    libraryWorkflowReadiness = "idle";
    const importMessage = t("statusLegacyImportDone", {
      tandas: result.tandasImported,
      added: result.tracksAdded,
      updated: result.tracksUpdated,
      missing: result.missingTracks,
    });
    if (legacyImportResult) {
      legacyImportResult.textContent = importMessage;
    }
    renderLibraryWorkflow();
    setStatus(importMessage);
    if (result.missingFiles) {
      settingsLibraryController.updateScanIssues(result.missingFiles);
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
  libraryWorkflowStepToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const stepKey = (toggle.dataset.stepToggle ?? "") as LibraryWorkflowStepKey;
      libraryWorkflowExpandedStepTouched = true;
      libraryWorkflowExpandedStep =
        libraryWorkflowExpandedStep === stepKey ? null : stepKey;
      renderLibraryWorkflow();
    });
  });
  libraryWorkflowStepMarkers.forEach((marker) => {
    marker.addEventListener("click", () => {
      const stepKey = (marker.dataset.stepExpand ?? "") as LibraryWorkflowStepKey;
      if (!stepKey) {
        return;
      }
      libraryWorkflowExpandedStepTouched = true;
      libraryWorkflowExpandedStep = stepKey;
      renderLibraryWorkflow();
    });
  });
  libraryRootsDoneButton?.addEventListener("click", () => {
    libraryWorkflowExpandedStepTouched = true;
    libraryWorkflowExpandedStep = null;
    renderLibraryWorkflow();
  });
  legacyStyleReviewDoneButton?.addEventListener("click", () => {
    libraryWorkflowLegacyStylesReviewed = true;
    renderLibraryWorkflow();
    scrollLibraryWorkflowToTop();
  });
  legacyStylesButton?.addEventListener("click", async () => {
    await loadLegacyStylesForDisplay();
  });

  exportTandasBtn?.addEventListener("click", async () => {
    if (!window.tanda || !tandaExportResult) {
      return;
    }
    tandaExportResult.textContent = t("tandaExportRunning");
    const result = await window.tanda.exportTandasData();
    if (result.cancelled) {
      tandaExportResult.textContent = t("playlistTransferCancelled");
      return;
    }
    if (!result.ok) {
      tandaExportResult.textContent = t("tandaExportFailed", {
        message: result.error ?? t("statusUnknownError"),
      });
      return;
    }
    tandaExportResult.textContent = t("tandaExportDone", { path: result.path });
  });

  scanMusicBtn?.addEventListener("click", () => {
    void settingsLibraryController.runScan("music");
  });
  scanCortinasBtn?.addEventListener("click", () => {
    void settingsLibraryController.runScan("cortina");
  });
  refreshStoredMetadataBtn?.addEventListener("click", () => {
    void settingsLibraryController.runRefreshStoredMetadata();
  });
  startupFlowBtn?.addEventListener("click", async () => {
    await settingsLibraryController.runStartupFlow();
  });

  precomputeCompressedBtn?.addEventListener("click", async () => {
    await settingsLibraryController.runPrecomputeCompressedTracks();
  });

  precomputeCompressedShortcutBtn?.addEventListener("click", async () => {
    await setSettingsOpen(true);
    activateSettingsTab(tabButtons, tabPanels, "library");
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          scrollSettingsContentTo(settingsContent, derivedCachesSection, "auto");
          pulseSettingsSection(derivedCachesSection);
          resolve();
        });
      });
    });
    await settingsLibraryController.runPrecomputeCompressedTracks();
  });

  verifyCachedFilesBtn?.addEventListener("click", async () => {
    await settingsLibraryController.runVerifyCachedFiles();
  });

  clearCachedFilesBtn?.addEventListener("click", async () => {
    if (!window.tanda) {
      return;
    }
    await settingsLibraryController.runClearCachedFiles(async () =>
      showConfirmModal(t("confirmEraseCachedFiles"), t("eraseCachedFiles")),
    );
  });

  exportSystemBtn?.addEventListener("click", async () => {
    await settingsLibraryController.runExportSystemData();
  });

  importSystemBtn?.addEventListener("click", async () => {
    await settingsLibraryController.runImportSystemData(async () =>
      showConfirmModal(t("confirmSystemImport"), t("systemImport")),
    );
  });

  playlistSaveBtn?.addEventListener("click", async () => {
    if (!window.tanda || !playlistTransferResult) {
      return;
    }
    playlistTransferResult.textContent = t("playlistExportRunning");
    const result = await window.tanda.exportPlaylistData(buildPlaylistExportManifest());
    if (result.cancelled) {
      playlistTransferResult.textContent = t("playlistTransferCancelled");
      return;
    }
    if (!result.ok) {
      playlistTransferResult.textContent = t("playlistExportFailed", {
        message: result.error ?? t("statusUnknownError"),
      });
      return;
    }
    playlistTransferResult.textContent = t("playlistExportDone", { path: result.path });
  });

  playlistImportBtn?.addEventListener("click", async () => {
    if (!window.tanda || !playlistTransferResult) {
      return;
    }
    if (playlistPlayback.status !== "idle") {
      setStatus(t("statusPlaylistImportDuringPlayback"));
      return;
    }
    playlistTransferResult.textContent = t("playlistImportRunning");
    const result = await window.tanda.importPlaylistData();
    if (result.cancelled) {
      playlistTransferResult.textContent = t("playlistTransferCancelled");
      return;
    }
    if (!result.ok || !result.state) {
      playlistTransferResult.textContent = t("playlistImportFailed", {
        message: result.error ?? t("statusUnknownError"),
      });
      return;
    }
    resetPlaylistRuntimeStateForImport();
    const applied = await applyStoredPlaylistState(result.state);
    playlistSaveSnapshot = "";
    savePlaylistToStorage();
    renderPlaylist();
    renderAllLists();
    updateNowPlayingDisplay();
    const warnings = [...(result.warnings ?? [])];
    if (applied.missingCount > 0) {
      warnings.push(t("playlistImportMissingItems", { count: applied.missingCount }));
    }
    const formatLabel =
      result.format === "m3u" ? t("playlistImportFormatM3u") : t("playlistImportFormatJson");
    playlistTransferResult.textContent = t("playlistImportDone", {
      path: result.path,
      format: formatLabel,
      count: applied.resolvedCount,
      warnings: warnings.length,
    });
    if (warnings.length > 0) {
      playlistTransferResult.textContent += `\n${warnings.join("\n")}`;
    }
    setStatus(playlistTransferResult.textContent);
    activateRightTab("playlist-tab");
    await setSettingsOpen(false);
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
      await renderDeletedTracks();
      await loadStyles();
      await refreshSearch();
      renderAllLists();
    }
  });
  undeleteTracksButton?.addEventListener("click", async () => {
    if (!window.tanda || !undeleteTracksList) return;
    const ids = Array.from(
      undeleteTracksList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'),
    ).map((input) => input.value);
    if (ids.length === 0) return;
    const result = await window.tanda.restoreDeletedTracks(ids);
    if (undeleteTracksResult) {
      undeleteTracksResult.textContent = t("undeleteTracksRestored", { count: result.restored });
    }
    trackCache.clear();
    tandaCache.clear();
    await renderDeletedTracks();
    await loadTandaDrafts();
    await refreshNewCollectionTracks();
    await refreshSearch();
    renderAllLists();
  });

  applyTranslations();
  await loadAudioSimilarityReport();
  if (orchestraFilterInput) {
    orchestraFilterInput.value = orchestraFilterText;
  }
  renderOrchestraRegistry();
  ensureCortinaDurationDefault();
  await renderDiagnosticsPaths();
  await renderFfmpegToolsDir();
  await renderPlaybackDiagnosticsLog();
  await renderDiagnosticsDataReadiness();
  updateSearchTabVisibility();
  await ensureAudioOutputs();
  await renderRoots();
  await renderDeletedTracks();
  await renderDataLocation();
  await updateLegacyImport();
  await ensureDefaultStyles("init");
  await loadStyles();
  await loadCortinaSets();
  await refreshSearch();
  await loadPlaylistFromStorage();
  renderAllLists();
  window.setTimeout(() => {
    void maybeShowReleaseUpdatePopup();
  }, 300);
  window.setInterval(updateNowPlayingDisplay, 200);
  window.setInterval(maybeAutoCenterPlaylist, 5000);
};

init().catch((error) => {
  setStatus(error instanceof Error ? error.message : t("statusUnknownError"));
});
