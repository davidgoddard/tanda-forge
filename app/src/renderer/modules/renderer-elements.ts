// Static shell elements; call once after the renderer HTML has loaded.
export const queryRendererElements = () => {
  const statusEl = document.querySelector<HTMLParagraphElement>("#status");
  const addMusicBtn = document.querySelector<HTMLButtonElement>("#add-music");
  const copyMusicRootsBtn =
    document.querySelector<HTMLButtonElement>("#copy-music-roots");
  const relocateMusicRootsBtn =
    document.querySelector<HTMLButtonElement>("#relocate-music-roots");
  const rootRelocationProgress =
    document.querySelector<HTMLDivElement>("#root-relocation-progress");
  const rootRelocationProgressLabel =
    document.querySelector<HTMLDivElement>("#root-relocation-progress-label");
  const rootRelocationProgressBar =
    document.querySelector<HTMLProgressElement>("#root-relocation-progress-bar");
  const rootRelocationProgressPath =
    document.querySelector<HTMLDivElement>("#root-relocation-progress-path");
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
  const clipTracksEl = document.querySelector<HTMLDivElement>("#clip-tracks");
  const clipTandasEl = document.querySelector<HTMLDivElement>("#clip-tandas");
  const playlistListEl = document.querySelector<HTMLDivElement>("#playlist-list");
  const playlistDuplicateFocusStatus =
    document.querySelector<HTMLDivElement>("#playlist-duplicate-focus-status");
  const playlistDuplicateFocusClear =
    document.querySelector<HTMLButtonElement>("#playlist-duplicate-focus-clear");
  const tandaListEl = document.querySelector<HTMLDivElement>("#tanda-list");
  const addTandaBtn = document.querySelector<HTMLButtonElement>("#add-tanda");
  const generateTandaBtn = document.querySelector<HTMLButtonElement>("#generate-tanda");
  const playlistStartBtn =
    document.querySelector<HTMLButtonElement>("#playlist-start");
  const playlistStopBtn =
    document.querySelector<HTMLButtonElement>("#playlist-stop");
  const playlistClearBtn =
    document.querySelector<HTMLButtonElement>("#playlist-clear");
  const playlistFilterInput =
    document.querySelector<HTMLInputElement>("#playlist-filter");
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
  const playlistSaveCortinasInput =
    document.querySelector<HTMLInputElement>("#playlist-save-cortinas");
  const playlistImportBtn =
    document.querySelector<HTMLButtonElement>("#playlist-import-button");
  const playlistTransferResult =
    document.querySelector<HTMLDivElement>("#playlist-transfer-result");
  const cortinaFadeInput =
    document.querySelector<HTMLInputElement>("#cortina-fade-duration");
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
  const displayAutoFitTextInput =
    document.querySelector<HTMLInputElement>("#display-auto-fit-text");
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
  return {
    statusEl,
    addMusicBtn,
    copyMusicRootsBtn,
    relocateMusicRootsBtn,
    rootRelocationProgress,
    rootRelocationProgressLabel,
    rootRelocationProgressBar,
    rootRelocationProgressPath,
    addCortinaBtn,
    addBackgroundsBtn,
    scanMusicBtn,
    scanCortinasBtn,
    refreshStoredMetadataBtn,
    refreshStoredMetadataResult,
    startupFlowBtn,
    startupFlowResult,
    startupFlowPhaseDetail,
    startupFlowProgressLabel,
    startupFlowEta,
    startupFlowProgressEl,
    precomputeCompressedBtn,
    verifyCachedFilesBtn,
    clearCachedFilesBtn,
    cacheVerifyResult,
    precomputeCompressedResult,
    precomputeProgressElSettings,
    precomputeProgressLabelSettings,
    openDiagnosticsPrecompute,
    precomputeCompressedShortcutBtn,
    derivedCachesSection,
    errorList,
    diagnosticsPathsEl,
    diagnosticsFfmpegToolsPickBtn,
    diagnosticsFfmpegToolsClearBtn,
    diagnosticsFfmpegToolsResult,
    diagnosticsWaveformBtn,
    diagnosticsWaveformResult,
    diagnosticsDataReadinessEl,
    diagnosticsTrackLengthIssuesEl,
    diagnosticsPlaybackLogBtn,
    diagnosticsClearLogsBtn,
    diagnosticsPlaybackLogResult,
    diagnosticsOutputProbeBtn,
    diagnosticsOutputProbeResult,
    orchestraFilterInput,
    orchestraAddBtn,
    orchestraResetBtn,
    orchestraSaveBtn,
    orchestraListEl,
    progressEl,
    progressLabel,
    progressElSettings,
    progressLabelSettings,
    settingsPanel,
    audioSimilarityPage,
    openAudioSimilarityBtn,
    closeAudioSimilarityBtn,
    generateAudioSimilarityBtn,
    cancelAudioSimilarityBtn,
    audioSimilaritySearch,
    audioSimilarityStatus,
    audioSimilaritySummary,
    audioSimilarityGroups,
    settingsContent,
    closeSettingsBtn,
    dataLocationPathInput,
    dataLocationChooseBtn,
    legacyImportSection,
    playlistTandaEditorEl,
    legacyImportDescription,
    legacyImportButton,
    legacyImportResult,
    legacyReadinessButton,
    legacyReadinessResult,
    libraryWorkflowGuidance,
    libraryWorkflowDetail,
    libraryWorkflowEmptyDetail,
    libraryWorkflowShell,
    libraryRootsSection,
    libraryRootsDoneButton,
    styleFamiliesSection,
    legacyStyleReviewSection,
    libraryLegacyImportSection,
    libraryStartupFlowSection,
    libraryVerifySection,
    libraryScanSection,
    legacyStylesButton,
    legacyStylesResult,
    legacyStyleReviewDoneButton,
    legacyStyleTools,
    legacyStyleMappingEl,
    legacyStyleMappingBody,
    exportSystemBtn,
    importSystemBtn,
    systemTransferResult,
    systemTransferProgress,
    exportTandasBtn,
    tandaExportResult,
    clipboardClearBtn,
    clipboardFilterInput,
    rootList,
    rootBanner,
    rootBannerText,
    openSettingsBtn,
    resetDbBtn,
    undeleteTracksList,
    undeleteTracksButton,
    undeleteTracksResult,
    searchInput,
    styleOptions,
    searchTracksEl,
    searchTandasEl,
    searchTrackHeader,
    searchTandaHeader,
    searchListBody,
    searchJumpIndex,
    clipTracksEl,
    clipTandasEl,
    playlistListEl,
    playlistDuplicateFocusStatus,
    playlistDuplicateFocusClear,
    tandaListEl,
    addTandaBtn,
    generateTandaBtn,
    playlistStartBtn,
    playlistStopBtn,
    playlistClearBtn,
    playlistFilterInput,
    clipboardCollectionsTabs,
    clipboardCollectionsInclude,
    clipboardCollectionNameInput,
    clipboardCollectionAddBtn,
    clearPlayCountsBtn,
    searchDiversityBtn,
    searchDiversityModal,
    searchDiversityCloseBtn,
    searchDiversityOrchestraEl,
    searchDiversityYearEl,
    searchDiversityTempoEl,
    searchDiversityStyleEl,
    searchDiversitySummaryEl,
    searchDiversityOpportunitiesEl,
    searchDiversityStyleGapsEl,
    playlistStatsBtn,
    playlistStatsModal,
    playlistStatsCloseBtn,
    playlistStatsOrchestraEl,
    playlistStatsPurityEl,
    playlistStatsYearEl,
    playlistStatsTempoEl,
    clipboardNewLimitInput,
    themeToggle,
    closeAppBtn,
    fullscreenToggle,
    openDisplayBtn,
    languageSelect,
    styleFamilyCodeInput,
    styleFamilyBaseInput,
    styleFamilyVariantsInput,
    styleFamilyAddBtn,
    styleFamilyList,
    modeSelect,
    mainOutputSelect,
    headphoneOutputSelect,
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
    tandaSizeInput,
    searchTandaSizeInput,
    searchMinScoreInput,
    searchBpmRangeInput,
    trimPaddingInput,
    gapBetweenTracksInput,
    gapBeforeTandaInput,
    gapBeforeCortinaInput,
    playlistStartTimeInput,
    playlistEndTimeInput,
    playlistSaveBtn,
    playlistSaveCortinasInput,
    playlistImportBtn,
    playlistTransferResult,
    stopFadeInput,
    cortinaFadeInput,
    playlistSequenceInput,
    playlistArtistRepeatGapInput,
    playlistCortinaSetSelect,
    playlistCortinaDurationInput,
    displayBackgroundIntervalInput,
    displayLagInput,
    displayLagValue,
    displayLagCalibrateBtn,
    displayLagModal,
    displayLagModalClose,
    displayLagModalInput,
    displayLagModalValue,
    displayLagToggle,
    displayLagStatus,
    displayLagFlash,
    displayUseImagesInput,
    displayImageDimInput,
    displayBaseFontSizeInput,
    displayAutoFitTextInput,
    displayCortinaFontSizeInput,
    displayEdgePaddingInput,
    playlistLastTandaToggle,
    playlistLastTandaCountInput,
    playlistPerformanceStopToggle,
    searchButton,
    alertBanner,
    openLibrarySetupMain,
    openDiagnosticsSettings,
    nowPlayingTrack,
    nowPlayingTime,
    nowPlayingSource,
    nowPlayingSection,
    nowPlayingDynamicsControl,
    nowPlayingDynamicsMixInput,
    nowPlayingDynamicsMixValue,
    waveformContainer,
    waveformImage,
    waveformPlaceholder,
    waveformProgress,
    waveformPlayhead,
    trackEditorWaveformContainer,
    trackEditorWaveformImage,
    trackEditorWaveformPlaceholder,
    trackEditorWaveformProgress,
    trackEditorWaveformPlayhead,
    cortinaControls,
    cortinaStopBtn,
    cortinaPlayBtn,
    cortinaModal,
    cortinaModalClose,
    cortinaModalSet,
    cortinaSearchInput,
    cortinaResults,
    trackEditor,
    trackEditorTitleInput,
    trackEditorArtistInput,
    trackEditorSingerInput,
    trackEditorVocalInput,
    trackEditorAlbumInput,
    trackEditorYearInput,
    trackEditorGenreInput,
    trackEditorNotesInput,
    trackEditorBpmInput,
    trackEditorTapBtn,
    trackEditorDeleteBtn,
    trackEditorCloseBtn,
    trackEditorSaveBtn,
    trackEditorResetBtn,
    trackEditorPathHint,
    trackEditorCompressedPathHint,
  };
};
