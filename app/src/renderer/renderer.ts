import {
  deriveInstrumental,
  effectiveDurationMs,
  normalizeStyleName,
  summarizeArtistName,
  sumEffectiveDurationMs,
  summarizeTandaTracks,
} from "../shared/tanda-utils.js";
import {
  getSequenceRule,
  parseSequence,
  parseStyleMap,
  validateTandaForRule,
  type SequenceEntry,
  type StyleMap,
} from "../shared/playlist-sequence.js";

const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const addMusicBtn = document.querySelector<HTMLButtonElement>("#add-music");
const addCortinaBtn = document.querySelector<HTMLButtonElement>("#add-cortina");
const scanSettingsBtn =
  document.querySelector<HTMLButtonElement>("#scan-settings");
const errorList = document.querySelector<HTMLUListElement>("#error-list");
const progressEl = document.querySelector<HTMLProgressElement>("#scan-progress");
const progressLabel = document.querySelector<HTMLDivElement>("#progress-label");
const progressElSettings =
  document.querySelector<HTMLProgressElement>("#scan-progress-settings");
const progressLabelSettings =
  document.querySelector<HTMLDivElement>("#progress-label-settings");
const settingsPanel = document.querySelector<HTMLElement>("#settings-panel");
const closeSettingsBtn =
  document.querySelector<HTMLButtonElement>("#close-settings");
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
const clipListBody = clipTracksEl?.closest(".list-body") ?? null;
const clipPanel = clipTracksEl?.closest(".panel") ?? null;
const playlistPanel = playlistListEl?.closest(".panel") ?? null;
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
const gapBetweenTracksInput = document.querySelector<HTMLInputElement>(
  "#gap-between-tracks",
);
const gapBeforeTandaInput =
  document.querySelector<HTMLInputElement>("#gap-before-tanda");
const gapBeforeCortinaInput =
  document.querySelector<HTMLInputElement>("#gap-before-cortina");
const stopFadeInput =
  document.querySelector<HTMLInputElement>("#stop-fade-duration");
const playlistSequenceInput =
  document.querySelector<HTMLInputElement>("#playlist-sequence");
const playlistStyleMapInput =
  document.querySelector<HTMLTextAreaElement>("#playlist-style-map");
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
const waveformProgress =
  document.querySelector<HTMLDivElement>("#waveform-progress");
const waveformPlayhead =
  document.querySelector<HTMLDivElement>("#waveform-playhead");
const trackEditor = document.querySelector<HTMLElement>("#track-editor");
const trackEditorTitleInput =
  document.querySelector<HTMLInputElement>("#track-editor-title");
const trackEditorArtistInput =
  document.querySelector<HTMLInputElement>("#track-editor-artist");
const trackEditorAlbumInput =
  document.querySelector<HTMLInputElement>("#track-editor-album");
const trackEditorAlbumArtistInput =
  document.querySelector<HTMLInputElement>("#track-editor-album-artist");
const trackEditorYearInput =
  document.querySelector<HTMLInputElement>("#track-editor-year");
const trackEditorGenreInput =
  document.querySelector<HTMLSelectElement>("#track-editor-genre");
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

type TrackRow = {
  id: string;
  full_path: string;
  title: string;
  artist: string;
  artist_summary: string;
  album: string;
  album_artist: string;
  year: string;
  genre: string;
  bpm: number | null;
  duration_ms: number;
  start_offset_ms: number;
  end_trim_ms: number;
  instrumental?: boolean | null;
  gain_db: number | null;
  tag_error: string;
  analysis_error: string;
};

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

type SearchState = {
  items: TrackRow[];
  total: number;
  offsetStart: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  isLoading: boolean;
};

let searchState: SearchState = {
  items: [],
  total: 0,
  offsetStart: 0,
  sortBy: "title",
  sortDir: "asc",
  isLoading: false,
};
let clipboardTracks: TrackRow[] = [];
type PlaylistItem =
  | { kind: "track"; track: TrackRow }
  | { kind: "tanda"; tandaId: string; mismatch?: "style" | "count" };
let playlistItems: (PlaylistItem | null)[] = [null];
let selectedClipboardIndex: number | null = null;
let selectedClipboardTandaId: string | null = null;
let selectedStyles: string[] = [];
let availableStyles: string[] = [];

type TandaDraft = {
  id: string;
  name: string;
  styles: string[];
  rating: number;
  trackSlots: (string | null)[];
};

let tandaDrafts: TandaDraft[] = [];
let selectedTandaId: string | null = null;
let clipboardTandas: TandaDraft[] = [];
let tandaSearchResults: TandaSearchRow[] = [];

type RightPanelTab = "playlist-tab" | "tanda-designer-tab";
let activeRightTab: RightPanelTab = "playlist-tab";
type SearchTab = "search-tracks" | "search-tandas";
let activeSearchTab: SearchTab = "search-tracks";

type OutputMode = "prep" | "live";
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
};

const trackCache = new Map<string, TrackRow>();

type LanguageKey = "en" | "es" | "fr" | "de" | "pt";

const DEFAULT_PLAYLIST_SEQUENCE = "3t 3t 3w";
const DEFAULT_STYLE_MAP = "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga";

const translations: Record<LanguageKey, Record<string, string>> = {
  en: {
    appTitle: "Tanda Player 2",
    closeApp: "Close app",
    playlistStart: "Start",
    playlistResume: "Resume",
    playlistStop: "Stop",
    searchTitle: "Search",
    searchPlaceholder: "Search tracks or tandas",
    searchButton: "Search",
    styleLabel: "Styles",
    styleAll: "All",
    tabTracks: "Tracks",
    tabTandas: "Tandas",
    tabPlaylist: "Playlist",
    tabTandaDesigner: "Tanda Designer",
    clipboardTitle: "Clipboard",
    playlistTitle: "Playlist",
    playlistHint: "Click a clipboard item, then click a playlist slot to swap.",
    tandasEmpty: "Tandas coming soon.",
    playlistEmptySlot: "Empty tanda",
    playlistEmptyHint: "Drop a track here",
    headphonePreview: "Preview in headphones",
    searchResultsCount: "Results: {count}",
    modeLabel: "Mode",
    modePrep: "Preparation",
    modeLive: "Live",
    toggleTheme: "Toggle theme",
    toggleFullscreen: "Toggle fullscreen",
    openSettings: "Open Settings",
    settings: "Settings",
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
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Remove from clipboard",
    actionRemoveClipboardShort: "R",
    actionRemovePlaylist: "Remove from playlist",
    actionRemovePlaylistShort: "R",
    actionAddPlaylist: "Add to playlist",
    actionAddPlaylistShort: "P",
    actionEditTrack: "Edit track",
    actionEditTrackShort: "E",
    actionToggleTanda: "Toggle details",
    actionToggleTandaShort: "E",
    footerPlaceholder: "Footer area",
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
    trackEditorAlbumLabel: "Album",
    trackEditorAlbumArtistLabel: "Album artist",
    trackEditorYearLabel: "Year",
    trackEditorGenreLabel: "Style",
    trackEditorBpmLabel: "BPM",
    trackEditorTapTempo: "Tap tempo",
    trackEditorTapHint: "Tap to set BPM",
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
    defaultTandaSize: "Default tanda size",
    playlistSettingsTitle: "Playlist Settings",
    playlistSequenceLabel: "Tanda sequence",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Style mapping",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    scanIssues: "Scan Issues",
    scanIssuesHelp: "Recent scan problems and files that need attention.",
    scanIssuesMore: "...and {count} more",
    viewScanIssues: "View scan issues",
    eraseDatabase: "Erase Database",
    statusIssue: "Issue",
    statusOk: "OK",
    statusPreparingScan: "Preparing scan...",
    statusScanning: "Scanning...",
    statusScanProgress: "Scanning {current}/{total} ({root})",
    statusScanComplete:
      "Scan complete. Scanned {scanned}, added {added}, updated {updated}, removed {removed}.",
    statusScanIssues: "Scan complete. {count} issues.",
    statusScanFailed: "Scan failed.",
    statusScanFailedDetail: "Scan failed: {message}",
    statusScanFailedNoResponse: "Scan failed: no response from main process.",
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
    statusMissingRoots:
      "Some library folders are unavailable. Connect the drive or update Settings.",
    statusTandaSaved: "Tanda saved.",
    statusTandaDeleted: "Tanda deleted.",
    statusNoTandaSelected: "Select a tanda to add tracks.",
    statusTrackUpdated: "Track updated.",
    statusTrackUpdateFailed: "Track update failed.",
    statusPlaylistSequenceMismatch:
      "Tanda does not match playlist rule {rule}.",
    confirmPlaylistSequenceOverride:
      "This slot expects {expected} tracks ({rule}). This tanda has {count}. Use it anyway?",
    confirmPlaylistSequenceStyleOverride:
      "This slot expects {rule} style. Add this tanda anyway?",
    allowOverride: "Allow anyway",
    playlistMismatchTooltip: "Playlist rule mismatch.",
    statusStyleAdded: "Style added: {style}.",
    statusStyleAddFailed: "Could not add style.",
    statusTandaLocked: "This tanda is locked during live playback.",
    statusPlaylistLocked: "This playlist slot is locked during live playback.",
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
    tandaSave: "Save tanda",
    tandaDelete: "Delete tanda",
    tandaAddSlot: "Add slot",
    tandaToClipboard: "Send to clipboard",
    tandaRemoveTrack: "Send to clipboard",
    tandaMoveUp: "Move up",
    tandaMoveDown: "Move down",
    tandaRemoveTrackShort: "C",
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
  },
  es: {
    appTitle: "Tanda Player 2",
    closeApp: "Cerrar app",
    playlistStart: "Iniciar",
    playlistResume: "Reanudar",
    playlistStop: "Detener",
    searchTitle: "Buscar",
    searchPlaceholder: "Buscar temas o tandas",
    searchButton: "Buscar",
    styleLabel: "Estilos",
    styleAll: "Todos",
    tabTracks: "Temas",
    tabTandas: "Tandas",
    tabPlaylist: "Playlist",
    tabTandaDesigner: "Disenador de tandas",
    clipboardTitle: "Portapapeles",
    playlistTitle: "Lista",
    playlistHint: "Selecciona del portapapeles y luego un espacio en la lista.",
    tandasEmpty: "Tandas pronto.",
    playlistEmptySlot: "Tanda vacia",
    playlistEmptyHint: "Suelta un tema aqui",
    headphonePreview: "Preescuchar en auriculares",
    searchResultsCount: "Resultados: {count}",
    modeLabel: "Modo",
    modePrep: "Preparacion",
    modeLive: "En vivo",
    toggleTheme: "Cambiar tema",
    toggleFullscreen: "Pantalla completa",
    openSettings: "Abrir ajustes",
    settings: "Ajustes",
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
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Quitar del portapapeles",
    actionRemoveClipboardShort: "R",
    actionRemovePlaylist: "Quitar de la lista",
    actionRemovePlaylistShort: "R",
    actionAddPlaylist: "Agregar a la lista",
    actionAddPlaylistShort: "P",
    actionEditTrack: "Editar tema",
    actionEditTrackShort: "E",
    actionToggleTanda: "Ver detalles",
    actionToggleTandaShort: "E",
    footerPlaceholder: "Area del pie",
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
    trackEditorAlbumLabel: "Album",
    trackEditorAlbumArtistLabel: "Artista del album",
    trackEditorYearLabel: "Ano",
    trackEditorGenreLabel: "Estilo",
    trackEditorBpmLabel: "BPM",
    trackEditorTapTempo: "Marcar tempo",
    trackEditorTapHint: "Pulsa para BPM",
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
    defaultTandaSize: "Tamano de tanda",
    playlistSettingsTitle: "Ajustes de playlist",
    playlistSequenceLabel: "Secuencia de tandas",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Mapa de estilos",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    scanIssues: "Problemas de escaneo",
    scanIssuesHelp: "Problemas recientes y archivos pendientes.",
    scanIssuesMore: "...y {count} mas",
    viewScanIssues: "Ver problemas",
    eraseDatabase: "Borrar base de datos",
    statusIssue: "Problema",
    statusOk: "OK",
    statusPreparingScan: "Preparando escaneo...",
    statusScanning: "Escaneando...",
    statusScanProgress: "Escaneando {current}/{total} ({root})",
    statusScanComplete:
      "Escaneo completo. Escaneados {scanned}, agregados {added}, actualizados {updated}, eliminados {removed}.",
    statusScanIssues: "Escaneo completo. {count} problemas.",
    statusScanFailed: "Fallo de escaneo.",
    statusScanFailedDetail: "Fallo de escaneo: {message}",
    statusScanFailedNoResponse: "Fallo de escaneo: sin respuesta.",
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
    statusMissingRoots:
      "Algunas carpetas no estan disponibles. Conecta la unidad o actualiza Ajustes.",
    statusTandaSaved: "Tanda guardada.",
    statusTandaDeleted: "Tanda eliminada.",
    statusNoTandaSelected: "Selecciona una tanda para agregar temas.",
    statusTrackUpdated: "Tema actualizado.",
    statusTrackUpdateFailed: "Fallo al actualizar tema.",
    statusPlaylistSequenceMismatch:
      "La tanda no coincide con la regla {rule}.",
    confirmPlaylistSequenceOverride:
      "Este espacio espera {expected} temas ({rule}). Esta tanda tiene {count}. ¿Usarla de todos modos?",
    confirmPlaylistSequenceStyleOverride:
      "Este espacio espera el estilo {rule}. ¿Añadir esta tanda de todos modos?",
    allowOverride: "Permitir",
    playlistMismatchTooltip: "No coincide con la regla de la playlist.",
    statusStyleAdded: "Estilo agregado: {style}.",
    statusStyleAddFailed: "No se pudo agregar el estilo.",
    statusTandaLocked: "Esta tanda esta bloqueada durante la reproduccion.",
    statusPlaylistLocked: "Este slot esta bloqueado durante la reproduccion.",
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
    tandaSave: "Guardar tanda",
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
  },
  fr: {
    appTitle: "Tanda Player 2",
    closeApp: "Fermer l'application",
    playlistStart: "Demarrer",
    playlistResume: "Reprendre",
    playlistStop: "Arreter",
    searchTitle: "Recherche",
    searchPlaceholder: "Rechercher pistes ou tandas",
    searchButton: "Rechercher",
    styleLabel: "Styles",
    styleAll: "Tous",
    tabTracks: "Pistes",
    tabTandas: "Tandas",
    tabPlaylist: "Playlist",
    tabTandaDesigner: "Concepteur de tandas",
    clipboardTitle: "Presse-papiers",
    playlistTitle: "Playlist",
    playlistHint: "Cliquez un element puis une case de playlist.",
    tandasEmpty: "Tandas bientot.",
    playlistEmptySlot: "Tanda vide",
    playlistEmptyHint: "Deposez une piste ici",
    headphonePreview: "Pre-ecoute au casque",
    searchResultsCount: "Resultats: {count}",
    modeLabel: "Mode",
    modePrep: "Preparation",
    modeLive: "Live",
    toggleTheme: "Basculer le theme",
    toggleFullscreen: "Plein ecran",
    openSettings: "Ouvrir les reglages",
    settings: "Reglages",
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
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Retirer du presse-papiers",
    actionRemoveClipboardShort: "R",
    actionRemovePlaylist: "Retirer de la playlist",
    actionRemovePlaylistShort: "R",
    actionAddPlaylist: "Ajouter a la playlist",
    actionAddPlaylistShort: "P",
    actionEditTrack: "Editer piste",
    actionEditTrackShort: "E",
    actionToggleTanda: "Afficher les details",
    actionToggleTandaShort: "E",
    footerPlaceholder: "Zone de pied",
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
    trackEditorAlbumLabel: "Album",
    trackEditorAlbumArtistLabel: "Artiste album",
    trackEditorYearLabel: "Annee",
    trackEditorGenreLabel: "Style",
    trackEditorBpmLabel: "BPM",
    trackEditorTapTempo: "Tap tempo",
    trackEditorTapHint: "Tapez pour BPM",
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
    defaultTandaSize: "Taille de tanda",
    playlistSettingsTitle: "Reglages de playlist",
    playlistSequenceLabel: "Sequence de tandas",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Mapping de styles",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    scanIssues: "Problemes de scan",
    scanIssuesHelp: "Problemes recents et fichiers a traiter.",
    scanIssuesMore: "...et {count} de plus",
    viewScanIssues: "Voir les problemes",
    eraseDatabase: "Effacer la base",
    statusIssue: "Probleme",
    statusOk: "OK",
    statusPreparingScan: "Preparation du scan...",
    statusScanning: "Scan en cours...",
    statusScanProgress: "Scan {current}/{total} ({root})",
    statusScanComplete:
      "Scan termine. Scannes {scanned}, ajoutes {added}, maj {updated}, supprimes {removed}.",
    statusScanIssues: "Scan termine. {count} problemes.",
    statusScanFailed: "Echec du scan.",
    statusScanFailedDetail: "Echec du scan: {message}",
    statusScanFailedNoResponse: "Echec du scan: aucune reponse.",
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
    statusMissingRoots:
      "Certains dossiers sont indisponibles. Connectez le disque.",
    statusTandaSaved: "Tanda enregistree.",
    statusTandaDeleted: "Tanda supprimee.",
    statusNoTandaSelected: "Selectionnez une tanda pour ajouter des pistes.",
    statusTrackUpdated: "Piste mise a jour.",
    statusTrackUpdateFailed: "Echec de mise a jour.",
    statusPlaylistSequenceMismatch:
      "La tanda ne correspond pas a la regle {rule}.",
    confirmPlaylistSequenceOverride:
      "Ce slot attend {expected} pistes ({rule}). Cette tanda en a {count}. L'utiliser quand meme ?",
    confirmPlaylistSequenceStyleOverride:
      "Ce slot attend le style {rule}. Ajouter cette tanda quand meme ?",
    allowOverride: "Autoriser",
    playlistMismatchTooltip: "Ne respecte pas la regle de playlist.",
    statusStyleAdded: "Style ajoute: {style}.",
    statusStyleAddFailed: "Impossible d'ajouter le style.",
    statusTandaLocked: "Cette tanda est verrouillee en lecture.",
    statusPlaylistLocked: "Ce slot est verrouille en lecture.",
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
    tandaSave: "Enregistrer la tanda",
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
  },
  de: {
    appTitle: "Tanda Player 2",
    closeApp: "App schliessen",
    playlistStart: "Start",
    playlistResume: "Fortsetzen",
    playlistStop: "Stop",
    searchTitle: "Suche",
    searchPlaceholder: "Titel oder Tandas suchen",
    searchButton: "Suchen",
    styleLabel: "Stile",
    styleAll: "Alle",
    tabTracks: "Titel",
    tabTandas: "Tandas",
    tabPlaylist: "Playlist",
    tabTandaDesigner: "Tanda-Designer",
    clipboardTitle: "Zwischenablage",
    playlistTitle: "Playlist",
    playlistHint: "Zwischenablage auswahlen, dann Playlist-Slot anklicken.",
    tandasEmpty: "Tandas bald verfugbar.",
    playlistEmptySlot: "Leere Tanda",
    playlistEmptyHint: "Track hier ablegen",
    headphonePreview: "Vorschau im Kopfhoerer",
    searchResultsCount: "Ergebnisse: {count}",
    modeLabel: "Modus",
    modePrep: "Vorbereitung",
    modeLive: "Live",
    toggleTheme: "Theme umschalten",
    toggleFullscreen: "Vollbild umschalten",
    openSettings: "Einstellungen",
    settings: "Einstellungen",
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
    actionAddClipboardShort: "Z",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Aus Zwischenablage entfernen",
    actionRemoveClipboardShort: "R",
    actionRemovePlaylist: "Aus Playlist entfernen",
    actionRemovePlaylistShort: "R",
    actionAddPlaylist: "Zur Playlist hinzufugen",
    actionAddPlaylistShort: "P",
    actionEditTrack: "Track bearbeiten",
    actionEditTrackShort: "E",
    actionToggleTanda: "Details umschalten",
    actionToggleTandaShort: "E",
    footerPlaceholder: "Fussbereich",
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
    trackEditorAlbumLabel: "Album",
    trackEditorAlbumArtistLabel: "Album-Artist",
    trackEditorYearLabel: "Jahr",
    trackEditorGenreLabel: "Stil",
    trackEditorBpmLabel: "BPM",
    trackEditorTapTempo: "Tap tempo",
    trackEditorTapHint: "Tippen fur BPM",
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
    defaultTandaSize: "Tanda-Grosse",
    playlistSettingsTitle: "Playlist-Einstellungen",
    playlistSequenceLabel: "Tanda-Sequenz",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Stil-Zuordnung",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    scanIssues: "Scan-Probleme",
    scanIssuesHelp: "Aktuelle Probleme und Dateien.",
    scanIssuesMore: "...und {count} weitere",
    viewScanIssues: "Probleme anzeigen",
    eraseDatabase: "Datenbank loschen",
    statusIssue: "Problem",
    statusOk: "OK",
    statusPreparingScan: "Scan vorbereiten...",
    statusScanning: "Scanne...",
    statusScanProgress: "Scan {current}/{total} ({root})",
    statusScanComplete:
      "Scan fertig. Gescant {scanned}, hinzugefugt {added}, aktualisiert {updated}, entfernt {removed}.",
    statusScanIssues: "Scan fertig. {count} Probleme.",
    statusScanFailed: "Scan fehlgeschlagen.",
    statusScanFailedDetail: "Scan fehlgeschlagen: {message}",
    statusScanFailedNoResponse: "Scan fehlgeschlagen: keine Antwort.",
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
    statusMissingRoots:
      "Einige Ordner sind nicht verfugbar. Laufwerk verbinden.",
    statusTandaSaved: "Tanda gespeichert.",
    statusTandaDeleted: "Tanda geloscht.",
    statusNoTandaSelected: "Bitte eine Tanda auswahlen.",
    statusTrackUpdated: "Track aktualisiert.",
    statusTrackUpdateFailed: "Aktualisierung fehlgeschlagen.",
    statusPlaylistSequenceMismatch:
      "Tanda passt nicht zur Regel {rule}.",
    confirmPlaylistSequenceOverride:
      "Dieser Slot erwartet {expected} Titel ({rule}). Diese Tanda hat {count}. Trotzdem verwenden?",
    confirmPlaylistSequenceStyleOverride:
      "Dieser Slot erwartet Stil {rule}. Diese Tanda trotzdem hinzufugen?",
    allowOverride: "Zulassen",
    playlistMismatchTooltip: "Weicht von der Playlist-Regel ab.",
    statusStyleAdded: "Stil hinzugefugt: {style}.",
    statusStyleAddFailed: "Stil konnte nicht hinzugefugt werden.",
    statusTandaLocked: "Diese Tanda ist im Live-Modus gesperrt.",
    statusPlaylistLocked: "Dieser Playlist-Slot ist im Live-Modus gesperrt.",
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
    tandaSave: "Tanda speichern",
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
  },
  pt: {
    appTitle: "Tanda Player 2",
    closeApp: "Fechar app",
    playlistStart: "Iniciar",
    playlistResume: "Retomar",
    playlistStop: "Parar",
    searchTitle: "Busca",
    searchPlaceholder: "Buscar faixas ou tandas",
    searchButton: "Buscar",
    styleLabel: "Estilos",
    styleAll: "Todos",
    tabTracks: "Faixas",
    tabTandas: "Tandas",
    tabPlaylist: "Playlist",
    tabTandaDesigner: "Designer de tandas",
    clipboardTitle: "Area de transferencia",
    playlistTitle: "Playlist",
    playlistHint: "Clique no item e depois no slot da playlist.",
    tandasEmpty: "Tandas em breve.",
    playlistEmptySlot: "Tanda vazia",
    playlistEmptyHint: "Solte a faixa aqui",
    headphonePreview: "Prévia nos fones",
    searchResultsCount: "Resultados: {count}",
    modeLabel: "Modo",
    modePrep: "Preparacao",
    modeLive: "Ao vivo",
    toggleTheme: "Alternar tema",
    toggleFullscreen: "Tela cheia",
    openSettings: "Abrir ajustes",
    settings: "Ajustes",
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
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Remover do bloco",
    actionRemoveClipboardShort: "R",
    actionRemovePlaylist: "Remover da playlist",
    actionRemovePlaylistShort: "R",
    actionAddPlaylist: "Adicionar a playlist",
    actionAddPlaylistShort: "P",
    actionEditTrack: "Editar faixa",
    actionEditTrackShort: "E",
    actionToggleTanda: "Ver detalhes",
    actionToggleTandaShort: "E",
    footerPlaceholder: "Area do rodape",
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
    trackEditorAlbumLabel: "Album",
    trackEditorAlbumArtistLabel: "Artista do album",
    trackEditorYearLabel: "Ano",
    trackEditorGenreLabel: "Estilo",
    trackEditorBpmLabel: "BPM",
    trackEditorTapTempo: "Tap tempo",
    trackEditorTapHint: "Toque para BPM",
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
    defaultTandaSize: "Tamanho da tanda",
    playlistSettingsTitle: "Ajustes da playlist",
    playlistSequenceLabel: "Sequencia de tandas",
    playlistSequencePlaceholder: "3t 3t 3w",
    playlistStyleMapLabel: "Mapa de estilos",
    playlistStyleMapPlaceholder: "T=Tango;Tango Nuevo\nW=Vals;Waltz\nM=Milonga",
    scanIssues: "Problemas de scan",
    scanIssuesHelp: "Problemas recentes e arquivos pendentes.",
    scanIssuesMore: "...e mais {count}",
    viewScanIssues: "Ver problemas",
    eraseDatabase: "Apagar base",
    statusIssue: "Problema",
    statusOk: "OK",
    statusPreparingScan: "Preparando scan...",
    statusScanning: "Escaneando...",
    statusScanProgress: "Scan {current}/{total} ({root})",
    statusScanComplete:
      "Scan completo. Escaneados {scanned}, adicionados {added}, atualizados {updated}, removidos {removed}.",
    statusScanIssues: "Scan completo. {count} problemas.",
    statusScanFailed: "Falha no scan.",
    statusScanFailedDetail: "Falha no scan: {message}",
    statusScanFailedNoResponse: "Falha no scan: sem resposta.",
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
    statusMissingRoots:
      "Algumas pastas nao estao disponiveis. Conecte a unidade.",
    statusTandaSaved: "Tanda salva.",
    statusTandaDeleted: "Tanda apagada.",
    statusNoTandaSelected: "Selecione uma tanda para adicionar faixas.",
    statusTrackUpdated: "Faixa atualizada.",
    statusTrackUpdateFailed: "Falha ao atualizar faixa.",
    statusPlaylistSequenceMismatch:
      "A tanda nao corresponde a regra {rule}.",
    confirmPlaylistSequenceOverride:
      "Este slot espera {expected} faixas ({rule}). Esta tanda tem {count}. Usar mesmo assim?",
    confirmPlaylistSequenceStyleOverride:
      "Este slot espera o estilo {rule}. Adicionar esta tanda mesmo assim?",
    allowOverride: "Permitir",
    playlistMismatchTooltip: "Nao corresponde a regra da playlist.",
    statusStyleAdded: "Estilo adicionado: {style}.",
    statusStyleAddFailed: "Nao foi possivel adicionar o estilo.",
    statusTandaLocked: "Esta tanda esta bloqueada durante a reproducao.",
    statusPlaylistLocked: "Este slot esta bloqueado durante a reproducao.",
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
    tandaSave: "Salvar tanda",
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
  (["en", "es", "fr", "de", "pt"] as LanguageKey[]).forEach((code) => {
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
      element.setAttribute(attr, t(key));
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
    !trackEditorAlbumInput ||
    !trackEditorAlbumArtistInput ||
    !trackEditorYearInput ||
    !trackEditorGenreInput ||
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
  trackEditorAlbumInput.value = track.album ?? "";
  trackEditorAlbumArtistInput.value = track.album_artist ?? "";
  trackEditorYearInput.value = track.year ?? "";
  trackEditorGenreInput.value = track.genre ?? "";
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

const getPlaylistSequence = (): SequenceEntry[] =>
  parseSequence(getPlaylistSequenceInput());

const getPlaylistStyleMap = (): StyleMap =>
  parseStyleMap(getPlaylistStyleMapInput());

const getSequenceLabel = (rule: SequenceEntry) =>
  `${rule.count}${rule.code.toLowerCase()}`;

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

const updateWaveformSource = async (trackId: string | null) => {
  if (!waveformImage || !waveformContainer) {
    return;
  }
  if (!trackId) {
    waveformImage.src = "";
    waveformContainer.classList.add("hidden");
    waveformTrackId = null;
    return;
  }
  if (waveformTrackId === trackId && waveformImage.src) {
    return;
  }
  waveformTrackId = trackId;
  const requestId = (waveformRequestId += 1);
  const dataUrl = await window.tanda?.getWaveform(trackId);
  if (requestId !== waveformRequestId) {
    return;
  }
  if (dataUrl) {
    waveformImage.src = dataUrl;
    waveformContainer.classList.remove("hidden");
  } else {
    waveformImage.src = "";
    waveformContainer.classList.add("hidden");
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
  const startOffsetMs = track?.start_offset_ms ?? 0;
  const endTrimMs = track?.end_trim_ms ?? 0;
  const baseDurationMs = track?.duration_ms ?? 0;
  const effectiveDurationMs =
    baseDurationMs > 0
      ? Math.max(0, baseDurationMs - startOffsetMs - endTrimMs)
      : 0;
  const audioDurationSeconds = Number.isFinite(state.active?.duration)
    ? state.active?.duration ?? 0
    : 0;
  const fallbackDurationSeconds = effectiveDurationMs
    ? effectiveDurationMs / 1000
    : audioDurationSeconds;
  const currentSeconds = Math.max(
    0,
    (state.active?.currentTime ?? 0) - startOffsetMs / 1000,
  );
  const clampedCurrent = Math.min(
    currentSeconds,
    fallbackDurationSeconds || currentSeconds,
  );

  nowPlayingTrack.textContent = buildTrackLabel(track);
  nowPlayingSource.textContent =
    channel === "headphone"
      ? t("nowPlayingHeadphone")
      : t("nowPlayingMain");
  nowPlayingTime.textContent = t("nowPlayingTime", {
    current: formatTime(clampedCurrent),
    duration: formatTime(fallbackDurationSeconds),
  });
  const progress =
    fallbackDurationSeconds > 0 ? clampedCurrent / fallbackDurationSeconds : 0;
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
  const allow =
    active.channel === "headphone" ||
    (active.channel === "main" && appMode === "prep");
  if (!allow) {
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
  const startOffsetMs = track?.start_offset_ms ?? 0;
  const endTrimMs = track?.end_trim_ms ?? 0;
  const baseDurationMs = track?.duration_ms ?? 0;
  const effectiveDurationSeconds =
    baseDurationMs > 0
      ? Math.max(0, (baseDurationMs - startOffsetMs - endTrimMs) / 1000)
      : Number.isFinite(active.state.active.duration)
        ? active.state.active.duration ?? 0
        : 0;
  if (!Number.isFinite(effectiveDurationSeconds) || effectiveDurationSeconds <= 0) {
    return;
  }
  active.state.active.currentTime =
    startOffsetMs / 1000 + ratio * effectiveDurationSeconds;
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
  const tanda = tandaDrafts.find((item) => item.id === tandaId);
  if (!tanda) {
    return;
  }
  if (isTandaLocked(tandaId)) {
    setStatus(t("statusTandaLocked"));
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
    const totalDurationMs = sumEffectiveDurationMs(
      tanda.trackSlots.map((trackId) =>
        trackId ? trackCache.get(trackId) ?? null : null,
      ),
    );
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
    tandaDrafts = tandaDrafts.map((item) =>
      item.id === tanda.id ? { ...item, ...saved } : item,
    );
    saved.tracks.forEach((track) => trackCache.set(track.id, track));
    setStatus(t("statusTandaSaved"));
    renderTandaDesigner();
    await refreshSearch();
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
    clipboardTandas = [...clipboardTandas, cloneTanda(tanda)];
    renderClipboard();
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
  const steps = 12;
  const stepMs = durationMs / steps;
  let currentStep = 0;
  const fromStart = from ? Math.max(0, from.volume) : 0;
  to.volume = 0;
  const interval = window.setInterval(() => {
    currentStep += 1;
    const t = currentStep / steps;
    if (from) {
      from.volume = Math.max(0, fromStart * (1 - t));
    }
    to.volume = Math.min(targetVolume, targetVolume * t);
    if (currentStep >= steps) {
      window.clearInterval(interval);
      if (from) {
        from.pause();
        from.currentTime = 0;
      }
    }
  }, stepMs);
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
  const startAt = options?.startAtSeconds;
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
    updateNowPlayingDisplay();
  });
  next.addEventListener("pause", () => {
    updateNowPlayingDisplay();
  });
  next.addEventListener("timeupdate", () => {
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

const fadeOutAudio = async (audio: HTMLAudioElement, durationMs: number) => {
  const steps = 12;
  const stepMs = durationMs / steps;
  const startVolume = Math.max(0, audio.volume);
  let currentStep = 0;
  return new Promise<void>((resolve) => {
    const interval = window.setInterval(() => {
      currentStep += 1;
      const t = Math.min(1, currentStep / steps);
      audio.volume = Math.max(0, startVolume * (1 - t));
      if (currentStep >= steps) {
        window.clearInterval(interval);
        resolve();
      }
    }, stepMs);
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
  }

  const storedMain = localStorage.getItem("tanda-main-output");
  const storedHeadphone = localStorage.getItem("tanda-headphone-output");
  const mainId =
    storedMain && audioOutputs.some((device) => device.deviceId === storedMain)
      ? storedMain
      : audioOutputs[0]?.deviceId ?? null;
  let headphoneId =
    storedHeadphone &&
    audioOutputs.some((device) => device.deviceId === storedHeadphone)
      ? storedHeadphone
      : headphoneAvailable
        ? audioOutputs[1]?.deviceId ?? null
        : null;

  if (headphoneId && mainId && headphoneId === mainId) {
    headphoneId = null;
    headphoneAvailable = false;
  }

  if (mainId) {
    localStorage.setItem("tanda-main-output", mainId);
  }
  if (headphoneId) {
    localStorage.setItem("tanda-headphone-output", headphoneId);
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
  button.textContent = t(shortKey);
  button.setAttribute("aria-label", label);
  button.title = label;
  return button;
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
  actions.appendChild(
    buildActionButton(
      "actionEditTrack",
      "actionEditTrackShort",
      "edit-track",
    ),
  );
  if (context === "search") {
    actions.appendChild(
      buildActionButton(
        "actionAddClipboard",
        "actionAddClipboardShort",
        "add-clip",
      ),
    );
    actions.appendChild(
      buildActionButton(
        "actionAddTanda",
        "actionAddTandaShort",
        "add-tanda",
      ),
    );
  }
  if (context === "clipboard") {
    actions.appendChild(
      buildActionButton(
        "actionAddTanda",
        "actionAddTandaShort",
        "add-tanda",
      ),
    );
    actions.appendChild(
      buildActionButton(
        "actionRemoveClipboard",
        "actionRemoveClipboardShort",
        "remove-clip",
      ),
    );
  }
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
  const secondaryParts = [track.year, track.album, track.genre, bpmLabel].filter(
    (value) => value && value.trim().length > 0,
  );
  secondary.textContent = secondaryParts.join(" · ");
  secondary.title = secondary.textContent;
  details.append(primary, secondary);
  row.append(actions, details);
  attachRowDrag(row, track, context);
  return row;
};

const renderSearchResults = () => {
  if (!searchTracksEl) {
    return;
  }
  searchTracksEl.innerHTML = "";
  searchState.items.forEach((track) => {
    searchTracksEl.appendChild(renderTrackRow(track, "search"));
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

const buildTandaSummaryText = (tanda: TandaDraft, fallbackName?: string) => {
  const name = tanda.name || fallbackName || t("tandaPlaceholder");
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
      ? summary.artists.map((artist) => `${artist.name}(${artist.count})`).join(", ")
      : t("tandaUnknownArtist");
  const yearLabel =
    summary.years.length > 0 ? summary.years.join(",") : t("tandaUnknownYear");
  const instrumentalLabel = summary.instrumental
    ? t("tandaInstrumentalLabel")
    : t("tandaNonInstrumental");
  return `${name} - ${artistLabel} - ${instrumentalLabel} - ${yearLabel}`;
};

const buildTandaExpandedSummaryText = (
  tanda: TandaDraft,
  fallbackName?: string,
) => {
  const name = tanda.name || fallbackName || t("tandaPlaceholder");
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
  const yearLabel = getTandaYearRange(summary.years);
  const instrumentalLabel = summary.instrumental
    ? t("tandaInstrumentalLabel")
    : t("tandaNonInstrumental");
  const styleLabel =
    tanda.styles.length > 0 ? tanda.styles.join(", ") : t("tandaAnyStyle");
  const totalDurationMs = sumEffectiveDurationMs(tracks);
  const durationLabel = formatTime(totalDurationMs / 1000);
  return `${name} - ${styleLabel} - ${instrumentalLabel} - ${yearLabel} - ${durationLabel}`;
};

type TandaDetailLine = {
  text: string;
  trackId?: string;
};

const buildTandaDetailLines = (tanda: TandaDraft): TandaDetailLine[] => {
  const tracks = tanda.trackSlots
    .map((trackId) => (trackId ? trackCache.get(trackId) ?? null : null))
    .filter(Boolean) as TrackRow[];
  if (tracks.length === 0) {
    return [{ text: t("tandaPlaceholder") }];
  }
  return tracks.map((track) => {
    const year = track.year?.trim() || t("tandaUnknownYear");
    const duration = formatTime(effectiveDurationMs(track) / 1000);
    return {
      text: `${buildTrackLabel(track)} (${year}) · ${duration}`,
      trackId: track.id,
    };
  });
};

const renderTandaRow = (
  tanda: TandaDraft,
  context: "search" | "clipboard" | "playlist",
  nameOverride?: string,
  options?: {
    expanded?: boolean;
    activeTrackId?: string | null;
    played?: boolean;
    locked?: boolean;
  },
) => {
  const row = document.createElement("div");
  row.className = "list-row tanda-row";
  row.dataset.tandaId = tanda.id;
  row.dataset.context = context;
  const expanded = options?.expanded ?? false;
  row.classList.toggle("expanded", expanded);
  row.classList.toggle("played", options?.played ?? false);
  row.classList.toggle("locked", options?.locked ?? false);
  row.setAttribute("aria-expanded", expanded ? "true" : "false");
  const actions = document.createElement("div");
  actions.className = "row-actions";
  actions.appendChild(
    buildActionButton(
      "actionToggleTanda",
      "actionToggleTandaShort",
      "tanda-toggle",
    ),
  );
  if (context === "search") {
    actions.appendChild(
      buildActionButton(
        "actionAddClipboard",
        "actionAddClipboardShort",
        "add-clip-tanda",
      ),
    );
  }
  if (context === "clipboard") {
    actions.appendChild(
      buildActionButton(
        "actionAddPlaylist",
        "actionAddPlaylistShort",
        "add-playlist-tanda",
      ),
    );
  }
  if (context === "playlist") {
    actions.appendChild(
      buildActionButton(
        "actionRemovePlaylist",
        "actionRemovePlaylistShort",
        "remove-playlist-tanda",
      ),
    );
  }
  const summary = document.createElement("div");
  summary.className = "tanda-summary";
  summary.textContent = expanded
    ? buildTandaExpandedSummaryText(tanda, nameOverride)
    : buildTandaSummaryText(tanda, nameOverride);
  summary.title = summary.textContent ?? "";
  const badge = document.createElement("div");
  badge.className = "tanda-style-badge";
  badge.textContent = getTandaStyleBadge(tanda);
  const details = document.createElement("div");
  details.className = "tanda-details";
  buildTandaDetailLines(tanda).forEach((line) => {
    const lineEl = document.createElement("div");
    lineEl.className = "tanda-detail-line";
    if (line.trackId) {
      lineEl.dataset.trackId = line.trackId;
    }
    if (line.trackId && line.trackId === options?.activeTrackId) {
      lineEl.classList.add("active");
    }
    lineEl.textContent = line.text;
    if (line.trackId) {
      const editButton = buildActionButton(
        "actionEditTrack",
        "actionEditTrackShort",
        "edit-track",
      );
      editButton.classList.add("detail-edit");
      lineEl.appendChild(editButton);
    }
    details.appendChild(lineEl);
  });
  row.dataset.tandaName = nameOverride ?? "";
  row.append(actions, badge, summary, details);
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
  summaryEl.textContent = expanded
    ? buildTandaExpandedSummaryText(tanda, fallbackName)
    : buildTandaSummaryText(tanda, fallbackName);
  summaryEl.title = summaryEl.textContent ?? "";
};

const renderTandaSearchResults = () => {
  if (!searchTandasEl) {
    return;
  }
  searchTandasEl.innerHTML = "";
  if (tandaSearchResults.length === 0) {
    searchTandasEl.textContent = t("tandasEmpty");
    updateTabCount(searchTandasEl.closest(".panel"), "search-tandas", 0);
    return;
  }
  tandaSearchResults.forEach((tanda) => {
    const draft =
      tandaDrafts.find((item) => item.id === tanda.id) ??
      ({
        id: tanda.id,
        name: tanda.name,
        styles: tanda.styles,
        rating: tanda.rating,
        trackSlots: [],
      } as TandaDraft);
    searchTandasEl.appendChild(renderTandaRow(draft, "search", tanda.name));
  });
  updateTabCount(
    searchTandasEl.closest(".panel"),
    "search-tandas",
    tandaSearchResults.length,
  );
};

const loadTandaSearchResults = async () => {
  if (!window.tanda) {
    return;
  }
  const rows = await window.tanda.searchTandas(getSearchParams());
  tandaSearchResults = rows;
  renderTandaSearchResults();
  updateSearchCountDisplay();
};

const renderClipboard = () => {
  if (!clipTracksEl) {
    return;
  }
  const forcedStyles = getActiveStyleFilter();
  clipTracksEl.innerHTML = "";
  const selectedId =
    selectedClipboardIndex !== null
      ? clipboardTracks[selectedClipboardIndex]?.id ?? null
      : null;
  const filteredTracks =
    forcedStyles.length > 0
      ? clipboardTracks.filter((track) => forcedStyles.includes(track.genre))
      : clipboardTracks;
  filteredTracks.forEach((track, index) => {
    clipTracksEl.appendChild(
      renderTrackRow(track, "clipboard", selectedId === track.id),
    );
  });
  updateTabCount(
    clipTracksEl.closest(".panel"),
    "clip-tracks",
    filteredTracks.length,
  );
  if (clipTandasEl) {
    clipTandasEl.innerHTML = "";
    clipboardTandas.forEach((tanda) => {
      const row = renderTandaRow(tanda, "clipboard");
      if (selectedClipboardTandaId === tanda.id) {
        row.classList.add("selected");
      }
      clipTandasEl.appendChild(row);
    });
    updateTabCount(
      clipTandasEl.closest(".panel"),
      "clip-tandas",
      clipboardTandas.length,
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

const renderPlaylist = () => {
  if (!playlistListEl) {
    return;
  }
  normalizePlaylist();
  playlistListEl.innerHTML = "";
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
      playlistListEl.appendChild(row);
    } else if (item && item.kind === "tanda") {
      const tanda =
        resolveTandaDraft(item.tandaId) ?? createPlaceholderTanda(item.tandaId);
      const row = renderTandaRow(tanda, "playlist", tanda.name, {
        expanded: isActive,
        activeTrackId: isActive ? playlistPlayback.activeTrackId : null,
        played: isPlayed,
        locked: isLocked,
      });
      if (item.mismatch) {
        row.classList.add("mismatch");
        row.title = t("playlistMismatchTooltip");
      }
      row.dataset.index = index.toString();
      playlistListEl.appendChild(row);
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
      row.innerHTML = `<span></span><span>${t(
        "playlistEmptySlot",
      )}</span><span class="meta">${t(
        "playlistEmptyHint",
      )}</span><span></span><span></span>`;
      playlistListEl.appendChild(row);
    }
  });
  updateTabCount(playlistPanel, "playlist-tab", getPlaylistCount());
  updatePlaylistControls();
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

const runPlaylistPlayback = async (resume: boolean) => {
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
  renderPlaylist();

  while (isPlaylistRunActive(runId)) {
    if (playlistPlayback.currentIndex >= playlistItems.length) {
      playlistPlayback.status = "idle";
      playlistPlayback.activeTrackId = null;
      playlistPlayback.activeTandaId = null;
      playlistPlayback.resume = null;
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
    if (
      playlistPlayback.currentTrackIndex === 0 &&
      playlistPlayback.currentIndex > 0 &&
      !(isResumeSameItem && (resumeState?.resumeTime ?? 0) > 0)
    ) {
      const ok = await waitForGap(getGapBeforeTanda() * 1000, runId);
      if (!ok) {
        return;
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
        renderPlaylist();
        return;
      }
      const activeAudio = playback.main.active;
      if (!activeAudio) {
        playlistPlayback.status = "idle";
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
  void runPlaylistPlayback(true);
};

const renderAllLists = () => {
  renderSearchResults();
  renderTandaSearchResults();
  renderClipboard();
  renderPlaylist();
  renderTandaDesigner();
};

const renderTandaDesigner = () => {
  if (!tandaListEl) {
    return;
  }
  if (tandaDrafts.length === 0) {
    const draft = createEmptyTanda();
    tandaDrafts = [draft];
    selectedTandaId = draft.id;
  }
  const activeId = selectedTandaId ?? tandaDrafts[0]?.id ?? null;
  if (activeId && activeId !== selectedTandaId) {
    selectedTandaId = activeId;
  }
  tandaListEl.innerHTML = "";
  tandaDrafts.forEach((tanda) => {
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
    const totalDurationMs = sumEffectiveDurationMs(tracks);
    const instrumental = deriveInstrumental(tracks);
    metaRow.innerHTML = `
      <span class="tanda-meta">${t("tandaTrackCountLabel")}: ${tanda.trackSlots.filter(
        Boolean,
      ).length}</span>
      <span class="tanda-meta">${instrumental ? t("tandaInstrumentalYes") : t(
        "tandaNonInstrumental",
      )}</span>
      <span class="tanda-meta">${t("tandaDurationLabel")}: ${formatTime(
        totalDurationMs / 1000,
      )}</span>
    `;

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
        "tandaRemoveTrackShort",
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
    footerRow.append(addSlotButton, saveButton, deleteButton, clipButton);

    card.append(header, trackList, footerRow);
    card.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("button") || target.tagName === "INPUT" || target.tagName === "SELECT") {
        return;
      }
      setActiveTanda(tanda.id);
    });
    tandaListEl.appendChild(card);
  });
};

const addTrackToClipboard = (track: TrackRow) => {
  const existingIndex = clipboardTracks.findIndex((item) => item.id === track.id);
  if (existingIndex >= 0) {
    selectedClipboardIndex = existingIndex;
    activatePanelTab(clipPanel, "clip-tracks");
    renderClipboard();
    return;
  }
  clipboardTracks = [...clipboardTracks, track];
  selectedClipboardIndex = clipboardTracks.length - 1;
  trackCache.set(track.id, track);
  activatePanelTab(clipPanel, "clip-tracks");
  renderClipboard();
};

const appendTrackToPlaylist = (track: TrackRow) => {
  normalizePlaylist();
  const insertIndex = Math.max(0, playlistItems.length - 1);
  if (isPlaylistIndexLocked(insertIndex)) {
    setStatus(t("statusPlaylistLocked"));
    return;
  }
  playlistItems[insertIndex] = { kind: "track", track };
  normalizePlaylist();
  trackCache.set(track.id, track);
  activatePanelTab(playlistPanel, "playlist-tab");
  renderPlaylist();
};

const getDefaultTandaSize = () => {
  const raw = localStorage.getItem("tanda-default-size");
  const value = raw ? Number.parseInt(raw, 10) : 3;
  if (Number.isNaN(value) || value < 1) {
    return 3;
  }
  return Math.min(value, 10);
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

const createPlaceholderTanda = (tandaId: string): TandaDraft => ({
  id: tandaId,
  name: "",
  styles: [],
  rating: 0,
  trackSlots: Array.from({ length: getDefaultTandaSize() }, () => null),
});

const resolveTandaDraft = (tandaId: string) =>
  tandaDrafts.find((tanda) => tanda.id === tandaId) ?? null;

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
  if (track.genre && !tanda.styles.includes(track.genre)) {
    tanda.styles = [...tanda.styles, track.genre];
    if (isActive) {
      selectedStyles = [...tanda.styles];
    }
  }
  trackCache.set(track.id, track);
  const slotIndex = tanda.trackSlots.findIndex((slot) => slot === null);
  if (slotIndex >= 0) {
    tanda.trackSlots[slotIndex] = track.id;
  } else {
    tanda.trackSlots.push(track.id);
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
  return true;
};

const addTrackToActiveTanda = (track: TrackRow) =>
  addTrackToTanda(selectedTandaId, track);

const addTandaToClipboard = (tandaId: string) => {
  const tanda = tandaDrafts.find((item) => item.id === tandaId);
  if (!tanda) {
    return;
  }
  clipboardTandas = [...clipboardTandas, cloneTanda(tanda)];
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
  normalizePlaylist();
  const insertIndex = Math.max(0, playlistItems.length - 1);
  placeTandaInPlaylistSlot(tandaId, insertIndex);
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
    renderPlaylist();
    return true;
  }
  return false;
};

const removeClipboardTrack = (trackId: string) => {
  const index = clipboardTracks.findIndex((item) => item.id === trackId);
  if (index < 0) {
    return;
  }
  clipboardTracks = clipboardTracks.filter((_item, idx) => idx !== index);
  if (selectedClipboardIndex === index) {
    selectedClipboardIndex = null;
  } else if (
    selectedClipboardIndex !== null &&
    selectedClipboardIndex > index
  ) {
    selectedClipboardIndex -= 1;
  }
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

const showAlertAction = (
  message: string,
  actionLabel: string,
  onAction: () => void,
) => {
  if (!alertBanner) {
    return;
  }
  alertBanner.innerHTML = "";
  const text = document.createElement("span");
  text.textContent = message;
  const actions = document.createElement("div");
  actions.className = "alert-actions";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = actionLabel;
  button.addEventListener("click", () => {
    clearAlert();
    onAction();
  });
  actions.appendChild(button);
  alertBanner.append(text, actions);
  alertBanner.classList.add("visible", "pulse");
};

const loadStyles = async () => {
  if (!window.tanda || !styleOptions) {
    return;
  }
  const styles = await window.tanda.listStyles();
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
  return {
    query: searchInput?.value?.trim() ?? "",
    styles: getActiveStyleFilter(),
  };
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
  const targetTandaId =
    (event.target as HTMLElement)
      ?.closest<HTMLElement>(".tanda-card")
      ?.dataset.tandaId ?? selectedTandaId;
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
    row.innerHTML = `
      <span>${root.label}</span>
      <span>${root.kind === "music" ? t("rootMusic") : t("rootCortina")}</span>
      <span class="${root.available ? "ok" : "missing"}">${
        root.available ? t("rootAvailable") : t("rootMissing")
      }</span>
      <span class="path" title="${root.path}">${root.path}</span>
    `;
    rootList.appendChild(row);
  });
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
      await window.tanda?.closeApp();
    });
  }

  if (languageSelect) {
    const savedLanguage = getLanguage();
    languageSelect.value = savedLanguage;
    languageSelect.addEventListener("change", () => {
      localStorage.setItem("tanda-language", languageSelect.value);
      applyTranslations();
      loadStyles();
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

  if (modeSelect) {
    const savedMode = (localStorage.getItem("tanda-mode") ??
      "prep") as OutputMode;
    appMode = savedMode === "live" ? "live" : "prep";
    modeSelect.value = appMode;
    modeSelect.addEventListener("change", () => {
      appMode = modeSelect.value === "live" ? "live" : "prep";
      localStorage.setItem("tanda-mode", appMode);
      renderPlaylist();
      renderTandaDesigner();
    });
  }

  if (mainOutputSelect) {
    mainOutputSelect.addEventListener("change", async () => {
      localStorage.setItem("tanda-main-output", mainOutputSelect.value);
      if (
        headphoneOutputSelect &&
        headphoneOutputSelect.value === mainOutputSelect.value
      ) {
        localStorage.removeItem("tanda-headphone-output");
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
        localStorage.setItem(
          "tanda-headphone-output",
          headphoneOutputSelect.value,
        );
      } else {
        localStorage.removeItem("tanda-headphone-output");
        await ensureAudioOutputs();
        renderAllLists();
      }
    });
  }

  trackEditorTapBtn?.addEventListener("click", () => {
    handleTapTempo();
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
      album: trackEditorAlbumInput?.value ?? "",
      album_artist: trackEditorAlbumArtistInput?.value ?? "",
      year: trackEditorYearInput?.value ?? "",
      genre: trackEditorGenreInput?.value ?? "",
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
  fullscreenToggle?.addEventListener("click", () => {
    const isFullscreen = document.fullscreenElement !== null;
    if (!isFullscreen) {
      void document.documentElement.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  });
  nowPlayingSection?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      return;
    }
    if (appMode !== "prep") {
      return;
    }
    const isHeadphonePlaying =
      playback.headphone.active && !playback.headphone.active.paused;
    const isMainPlaying = playback.main.active && !playback.main.active.paused;
    if (!isHeadphonePlaying && !isMainPlaying) {
      return;
    }
    const fadeMs = getStopFadeSeconds() * 1000;
    await stopChannelPlayback("headphone", fadeMs);
    await stopChannelPlayback("main", fadeMs);
  });
  waveformContainer?.addEventListener("click", (event) => {
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
  });

  addCortinaBtn?.addEventListener("click", async () => {
    const selected = await window.tanda?.pickRoot("cortina");
    if (!selected) {
      return;
    }
    await window.tanda?.addRoot("cortina", selected);
    setStatus(t("statusAddedCortina", { path: selected }));
    await renderRoots();
  });

  const runScan = async () => {
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
      const summary = await window.tanda?.scanAll();
      if (!summary) {
        setStatus(t("statusScanFailedNoResponse"));
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
      await refreshSearch();
      renderAllLists();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? t("statusScanFailedDetail", { message: error.message })
          : t("statusScanFailed"),
      );
    }
  };

  scanSettingsBtn?.addEventListener("click", runScan);

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

  clipTandasEl?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".list-row");
    const tandaId = row?.dataset.tandaId;
    if (!tandaId) {
      return;
    }
    const editTrackId = target
      .closest<HTMLElement>(".tanda-detail-line")
      ?.dataset.trackId;
    const editAction = target.getAttribute("data-action");
    if (editAction === "edit-track" && editTrackId) {
      openTrackEditor(editTrackId);
      return;
    }
    const action = target.getAttribute("data-action");
    if (action === "tanda-toggle" && row) {
      toggleTandaRow(row);
      return;
    }
    if (action === "add-playlist-tanda") {
      const found = clipboardTandas.find((item) => item.id === tandaId) ?? null;
      addTandaToPlaylist(tandaId, found);
      return;
    }
    const found = clipboardTandas.find((item) => item.id === tandaId);
    if (!found) {
      return;
    }
    selectedClipboardTandaId = tandaId;
    selectedClipboardIndex = null;
    if (!tandaDrafts.some((item) => item.id === tandaId)) {
      tandaDrafts = [...tandaDrafts, found];
    }
    setActiveTanda(tandaId);
    activateRightTab("tanda-designer-tab");
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
    if (appMode === "live") {
      return;
    }
    const track = trackCache.get(trackId);
    if (!track) {
      return;
    }
    await playOnChannel(
      "main",
      track.full_path,
      track.id,
      track,
      track.gain_db ?? null,
    );
  });

  tandaListEl?.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  tandaListEl?.addEventListener("drop", (event) => {
    handleDropToTanda(event as DragEvent);
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
    const action = target.getAttribute("data-action");
    if (action === "edit-track") {
      openTrackEditor(data.trackId);
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
      return;
    }
    if (action === "add-clip") {
      addTrackToClipboard(track);
      activatePanelTab(clipPanel, "clip-tracks");
      return;
    }
    if (action === "add-tanda") {
      const added = addTrackToActiveTanda(track);
      if (!added) {
        setStatus(t("statusNoTandaSelected"));
      }
      return;
    }
    if (appMode !== "live") {
      await playOnChannel("main", data.filePath, data.trackId, track, data.gainDb);
    }
  });

  searchTandasEl?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".list-row");
    if (!row) {
      return;
    }
    const editTrackId = target
      .closest<HTMLElement>(".tanda-detail-line")
      ?.dataset.trackId;
    const editAction = target.getAttribute("data-action");
    if (editAction === "edit-track" && editTrackId) {
      openTrackEditor(editTrackId);
      return;
    }
    const tandaId = row.dataset.tandaId;
    if (!tandaId) {
      return;
    }
    const action = target.getAttribute("data-action");
    if (action === "tanda-toggle") {
      toggleTandaRow(row);
      return;
    }
    if (action === "remove-playlist-tanda") {
      const index = row.dataset.index ? Number.parseInt(row.dataset.index, 10) : -1;
      if (index < 0) {
        return;
      }
      if (isPlaylistIndexLocked(index)) {
        setStatus(t("statusPlaylistLocked"));
        return;
      }
      playlistItems[index] = null;
      normalizePlaylist();
      renderPlaylist();
      return;
    }
    if (action === "add-clip-tanda") {
      addTandaToClipboard(tandaId);
      activatePanelTab(clipPanel, "clip-tandas");
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
    const action = target.getAttribute("data-action");
    if (action === "edit-track") {
      openTrackEditor(data.trackId);
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
      return;
    }
    if (action === "add-tanda") {
      const added = addTrackToActiveTanda(clipTrack);
      if (!added) {
        setStatus(t("statusNoTandaSelected"));
      }
      return;
    }
    if (action === "remove-clip") {
      removeClipboardTrack(clipTrack.id);
      renderClipboard();
      return;
    }
    const index = clipboardTracks.findIndex((item) => item.id === data.trackId);
    if (index >= 0) {
      selectedClipboardIndex = index;
      selectedClipboardTandaId = null;
      renderClipboard();
    }
    if (appMode !== "live") {
      await playOnChannel(
        "main",
        data.filePath,
        data.trackId,
        clipTrack,
        data.gainDb,
      );
    }
  });

  playlistListEl?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".list-row");
    if (!row) {
      return;
    }
    const action = target.getAttribute("data-action");
    if (action === "edit-track") {
      const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
      const detailTrackId = detailLine?.dataset.trackId;
      const trackId = detailTrackId ?? row.dataset.trackId;
      if (trackId) {
        openTrackEditor(trackId);
      }
      return;
    }
    if (action === "tanda-toggle") {
      toggleTandaRow(row);
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
      return;
    }
    const index = row.dataset.index ? Number.parseInt(row.dataset.index, 10) : -1;
    const isLocked = index >= 0 ? isPlaylistIndexLocked(index) : false;
    if (index < 0) {
      return;
    }
    const detailLine = target.closest<HTMLElement>(".tanda-detail-line");
    const detailTrackId = detailLine?.dataset.trackId ?? null;
    if (selectedClipboardTandaId && !detailLine) {
      if (isLocked) {
        setStatus(t("statusPlaylistLocked"));
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
        if (!clipboardTandas.some((item) => item.id === replaced.tandaId)) {
          const draft =
            resolveTandaDraft(replaced.tandaId) ??
            createPlaceholderTanda(replaced.tandaId);
          clipboardTandas = [...clipboardTandas, cloneTanda(draft)];
        }
      } else if (replaced?.kind === "track") {
        if (!clipboardTracks.some((track) => track.id === replaced.track.id)) {
          clipboardTracks = [...clipboardTracks, replaced.track];
        }
      } else {
        clipboardTandas = clipboardTandas.filter(
          (item) => item.id !== selectedTanda.id,
        );
      }
      selectedClipboardTandaId = null;
      renderClipboard();
      renderPlaylist();
      return;
    }
    const mainActive = playback.main.active;
    const isMainPlaying = !!mainActive && !mainActive.paused;
    if (selectedClipboardIndex === null || detailLine) {
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
    const clipTrack = clipboardTracks[selectedClipboardIndex];
    const playlistItem = playlistItems[index];
    if (!clipTrack) {
      return;
    }
    if (playlistItem?.kind === "tanda") {
      return;
    }
    if (playlistItem?.kind === "track") {
      clipboardTracks[selectedClipboardIndex] = playlistItem.track;
      playlistItems[index] = { kind: "track", track: clipTrack };
    } else {
      playlistItems[index] = { kind: "track", track: clipTrack };
      clipboardTracks = clipboardTracks.filter(
        (_track, idx) => idx !== selectedClipboardIndex,
      );
    }
    selectedClipboardIndex = null;
    renderClipboard();
    renderPlaylist();
  });

  applyTranslations();
  updateSearchTabVisibility();
  await ensureAudioOutputs();
  if (navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", async () => {
      await ensureAudioOutputs();
      renderAllLists();
    });
  }
  await renderRoots();
  await loadStyles();
  await refreshSearch();
  renderAllLists();
  window.setInterval(updateNowPlayingDisplay, 500);
};

init().catch((error) => {
  setStatus(error instanceof Error ? error.message : t("statusUnknownError"));
});
