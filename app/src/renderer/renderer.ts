import {
  deriveInstrumental,
  effectiveDurationMs,
  sumEffectiveDurationMs,
  summarizeTandaTracks,
} from "../shared/tanda-utils.js";

const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const addMusicBtn = document.querySelector<HTMLButtonElement>("#add-music");
const addCortinaBtn = document.querySelector<HTMLButtonElement>("#add-cortina");
const scanSettingsBtn =
  document.querySelector<HTMLButtonElement>("#scan-settings");
const errorList = document.querySelector<HTMLUListElement>("#error-list");
const progressEl = document.querySelector<HTMLProgressElement>("#scan-progress");
const progressLabel = document.querySelector<HTMLDivElement>("#progress-label");
const settingsBtn = document.querySelector<HTMLButtonElement>("#settings");
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
const clipListBody = clipTracksEl?.closest(".list-body") ?? null;
const clipPanel = clipTracksEl?.closest(".panel") ?? null;
const playlistPanel = playlistListEl?.closest(".panel") ?? null;
const panelTabButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".panel .tab-bar button[data-tab]"),
);
const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle");
const closeAppBtn = document.querySelector<HTMLButtonElement>("#close-app");
const languageSelect =
  document.querySelector<HTMLSelectElement>("#language-select");
const modeSelect = document.querySelector<HTMLSelectElement>("#mode-select");
const mainOutputSelect =
  document.querySelector<HTMLSelectElement>("#main-output-select");
const headphoneOutputSelect =
  document.querySelector<HTMLSelectElement>("#headphone-output-select");
const tandaSizeInput =
  document.querySelector<HTMLInputElement>("#tanda-size-input");
const searchButton = document.querySelector<HTMLButtonElement>("#search-button");
const searchCount = document.querySelector<HTMLDivElement>("#search-count");
const alertBanner = document.querySelector<HTMLDivElement>("#alert-banner");
const nowPlayingTrack =
  document.querySelector<HTMLDivElement>("#now-playing-track");
const nowPlayingTime =
  document.querySelector<HTMLSpanElement>("#now-playing-time");
const nowPlayingSource =
  document.querySelector<HTMLSpanElement>("#now-playing-source");

let headphoneAvailable = false;
let audioOutputs: MediaDeviceInfo[] = [];

type TrackRow = {
  id: string;
  full_path: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
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
  | { kind: "tanda"; tanda: TandaDraft };
let playlistItems: (PlaylistItem | null)[] = [null];
let selectedClipboardIndex: number | null = null;
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

const trackCache = new Map<string, TrackRow>();

type LanguageKey = "en" | "es" | "fr" | "de" | "pt";

const translations: Record<LanguageKey, Record<string, string>> = {
  en: {
    appTitle: "Tanda Player 2",
    closeApp: "Close app",
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
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Remove from clipboard",
    actionRemoveClipboardShort: "R",
    actionAddPlaylist: "Add to playlist",
    actionAddPlaylistShort: "P",
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
    actionAddClipboard: "Add to clipboard",
    actionAddTanda: "Add to tanda",
    colStatus: "Status",
    tabLibrary: "Library",
    tabDiagnostics: "Diagnostics",
    tabSystem: "System",
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
    defaultTandaSize: "Default tanda size",
    scanIssues: "Scan Issues",
    scanIssuesHelp: "Recent scan problems and files that need attention.",
    scanIssuesMore: "...and {count} more",
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
    outputSelectionFailed: "Output selection failed.",
    outputSelectionFailedDetail: "Output selection failed: {message}",
    playbackFailed: "Playback failed.",
    playbackFailedDetail: "Playback failed: {message}",
    outputDefault: "Default Output",
    outputSelectHeadphones: "Select headphones output",
    outputNoSecondary: "No secondary output available",
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
    tandaNonInstrumental: "Not instrumental",
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
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Quitar del portapapeles",
    actionRemoveClipboardShort: "R",
    actionAddPlaylist: "Agregar a la lista",
    actionAddPlaylistShort: "P",
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
    actionAddClipboard: "Agregar al portapapeles",
    actionAddTanda: "Agregar a tanda",
    colStatus: "Estado",
    tabLibrary: "Biblioteca",
    tabDiagnostics: "Diagnostico",
    tabSystem: "Sistema",
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
    defaultTandaSize: "Tamano de tanda",
    scanIssues: "Problemas de escaneo",
    scanIssuesHelp: "Problemas recientes y archivos pendientes.",
    scanIssuesMore: "...y {count} mas",
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
    outputSelectionFailed: "Fallo al seleccionar salida.",
    outputSelectionFailedDetail: "Fallo al seleccionar salida: {message}",
    playbackFailed: "Fallo de reproduccion.",
    playbackFailedDetail: "Fallo de reproduccion: {message}",
    outputDefault: "Salida predeterminada",
    outputSelectHeadphones: "Seleccionar salida de auriculares",
    outputNoSecondary: "No hay salida secundaria",
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
    tandaNonInstrumental: "No instrumental",
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
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Retirer du presse-papiers",
    actionRemoveClipboardShort: "R",
    actionAddPlaylist: "Ajouter a la playlist",
    actionAddPlaylistShort: "P",
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
    actionAddClipboard: "Ajouter au presse-papiers",
    actionAddTanda: "Ajouter a la tanda",
    colStatus: "Statut",
    tabLibrary: "Bibliotheque",
    tabDiagnostics: "Diagnostic",
    tabSystem: "Systeme",
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
    defaultTandaSize: "Taille de tanda",
    scanIssues: "Problemes de scan",
    scanIssuesHelp: "Problemes recents et fichiers a traiter.",
    scanIssuesMore: "...et {count} de plus",
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
    outputSelectionFailed: "Selection de sortie impossible.",
    outputSelectionFailedDetail: "Selection de sortie impossible: {message}",
    playbackFailed: "Lecture impossible.",
    playbackFailedDetail: "Lecture impossible: {message}",
    outputDefault: "Sortie par defaut",
    outputSelectHeadphones: "Selectionner sortie casque",
    outputNoSecondary: "Pas de sortie secondaire",
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
    tandaNonInstrumental: "Non instrumental",
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
    actionAddClipboardShort: "Z",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Aus Zwischenablage entfernen",
    actionRemoveClipboardShort: "R",
    actionAddPlaylist: "Zur Playlist hinzufugen",
    actionAddPlaylistShort: "P",
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
    actionAddClipboard: "Zur Zwischenablage",
    actionAddTanda: "Zur Tanda",
    colStatus: "Status",
    tabLibrary: "Bibliothek",
    tabDiagnostics: "Diagnose",
    tabSystem: "System",
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
    defaultTandaSize: "Tanda-Grosse",
    scanIssues: "Scan-Probleme",
    scanIssuesHelp: "Aktuelle Probleme und Dateien.",
    scanIssuesMore: "...und {count} weitere",
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
    outputSelectionFailed: "Auswahl fehlgeschlagen.",
    outputSelectionFailedDetail: "Auswahl fehlgeschlagen: {message}",
    playbackFailed: "Wiedergabe fehlgeschlagen.",
    playbackFailedDetail: "Wiedergabe fehlgeschlagen: {message}",
    outputDefault: "Standardausgang",
    outputSelectHeadphones: "Kopfhorerausgang wahlen",
    outputNoSecondary: "Keine zweite Ausgabe",
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
    tandaNonInstrumental: "Nicht instrumental",
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
    actionAddClipboardShort: "C",
    actionAddTandaShort: "T",
    actionRemoveClipboard: "Remover do bloco",
    actionRemoveClipboardShort: "R",
    actionAddPlaylist: "Adicionar a playlist",
    actionAddPlaylistShort: "P",
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
    actionAddClipboard: "Adicionar ao bloco",
    actionAddTanda: "Adicionar a tanda",
    colStatus: "Status",
    tabLibrary: "Biblioteca",
    tabDiagnostics: "Diagnostico",
    tabSystem: "Sistema",
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
    defaultTandaSize: "Tamanho da tanda",
    scanIssues: "Problemas de scan",
    scanIssuesHelp: "Problemas recentes e arquivos pendentes.",
    scanIssuesMore: "...e mais {count}",
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
    outputSelectionFailed: "Falha ao selecionar saida.",
    outputSelectionFailedDetail: "Falha ao selecionar saida: {message}",
    playbackFailed: "Falha na reproducao.",
    playbackFailedDetail: "Falha na reproducao: {message}",
    outputDefault: "Saida padrao",
    outputSelectHeadphones: "Selecionar saida de fone",
    outputNoSecondary: "Sem saida secundaria",
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
    tandaNonInstrumental: "Nao instrumental",
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
  updatePlayingIndicators();
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
      tandaDrafts = tandas.map((tanda) => ({
        id: tanda.id,
        name: tanda.name ?? "",
        styles: Array.isArray(tanda.styles) ? tanda.styles : [],
        rating: Number.isFinite(tanda.rating) ? tanda.rating : 0,
        trackSlots:
          Array.isArray(tanda.track_slots) && tanda.track_slots.length > 0
            ? tanda.track_slots
            : Array.from({ length: getDefaultTandaSize() }, () => null),
      }));
      tandas.forEach((tanda) => {
        tanda.tracks.forEach((track) => trackCache.set(track.id, track));
      });
      selectedTandaId = tandaDrafts[0].id;
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

const playOnChannel = async (
  channel: OutputChannel,
  filePath: string,
  trackId: string,
  track: TrackRow | null,
  gainDb: number | null | undefined,
): Promise<boolean> => {
  const state = playback[channel];
  if (state.currentTrackId === trackId && state.active) {
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
  const secondaryParts = [track.year, track.album, track.genre].filter(
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

const buildTandaSummaryText = (tanda: TandaDraft, fallbackName?: string) => {
  const name = tanda.name || fallbackName || t("tandaPlaceholder");
  const tracks = tanda.trackSlots.map((trackId) =>
    trackId ? trackCache.get(trackId) ?? null : null,
  );
  const summary = summarizeTandaTracks(tracks);
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

const buildTandaDetailLines = (tanda: TandaDraft) => {
  const tracks = tanda.trackSlots
    .map((trackId) => (trackId ? trackCache.get(trackId) ?? null : null))
    .filter(Boolean) as TrackRow[];
  if (tracks.length === 0) {
    return [t("tandaPlaceholder")];
  }
  return tracks.map((track) => {
    const year = track.year?.trim() || t("tandaUnknownYear");
    return `${buildTrackLabel(track)} (${year})`;
  });
};

const renderTandaRow = (
  tanda: TandaDraft,
  context: "search" | "clipboard" | "playlist",
  nameOverride?: string,
) => {
  const row = document.createElement("div");
  row.className = "list-row tanda-row";
  row.dataset.tandaId = tanda.id;
  row.dataset.context = context;
  row.setAttribute("aria-expanded", "false");
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
  const summary = document.createElement("div");
  summary.className = "tanda-summary";
  summary.textContent = buildTandaSummaryText(tanda, nameOverride);
  summary.title = summary.textContent ?? "";
  const details = document.createElement("div");
  details.className = "tanda-details";
  buildTandaDetailLines(tanda).forEach((line) => {
    const lineEl = document.createElement("div");
    lineEl.className = "tanda-detail-line";
    lineEl.textContent = line;
    details.appendChild(lineEl);
  });
  row.append(actions, summary, details);
  return row;
};

const toggleTandaRow = (row: HTMLElement) => {
  const expanded = row.classList.toggle("expanded");
  row.setAttribute("aria-expanded", expanded ? "true" : "false");
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
      clipTandasEl.appendChild(renderTandaRow(tanda, "clipboard"));
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
    if (item && item.kind === "track") {
      const row = renderTrackRow(item.track, "playlist");
      row.dataset.index = index.toString();
      playlistListEl.appendChild(row);
    } else if (item && item.kind === "tanda") {
      const row = renderTandaRow(item.tanda, "playlist");
      row.dataset.index = index.toString();
      playlistListEl.appendChild(row);
    } else {
      const row = document.createElement("div");
      row.className = "list-row";
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
    const card = document.createElement("div");
    card.className = `tanda-card${tanda.id === selectedTandaId ? " selected" : ""}`;
    card.dataset.tandaId = tanda.id;

    const header = document.createElement("div");
    header.className = "tanda-header";

    const nameRow = document.createElement("div");
    nameRow.className = "tanda-row";
    const nameInput = document.createElement("input");
    nameInput.className = "tanda-name";
    nameInput.value = tanda.name;
    nameInput.placeholder = t("tandaNameLabel");
    nameInput.addEventListener("input", () => {
      tanda.name = nameInput.value;
    });
    const ratingLabel = document.createElement("span");
    ratingLabel.className = "tanda-meta";
    ratingLabel.textContent = t("tandaRatingLabel");
    const ratingSelect = document.createElement("select");
    ratingSelect.className = "tanda-rating";
    ratingSelect.setAttribute("aria-label", t("tandaRatingLabel"));
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
    anyButton.addEventListener("click", () => {
      tanda.styles = [];
      setActiveTanda(tanda.id);
    });
    styleOptions.appendChild(anyButton);
    availableStyles.forEach((style) => {
      const button = document.createElement("button");
      button.textContent = style;
      button.classList.toggle("active", tanda.styles.includes(style));
      button.addEventListener("click", () => {
        if (tanda.styles.includes(style)) {
          tanda.styles = tanda.styles.filter((value) => value !== style);
        } else {
          tanda.styles = [...tanda.styles, style];
        }
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
      <span class="tanda-meta">${t("tandaInstrumentalLabel")}: ${
        instrumental ? t("tandaInstrumentalYes") : t("tandaInstrumentalNo")
      }</span>
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
      const upButton = buildActionButton(
        "tandaMoveUp",
        "tandaMoveUpShort",
        "tanda-up",
      );
      const downButton = buildActionButton(
        "tandaMoveDown",
        "tandaMoveDownShort",
        "tanda-down",
      );
      const removeButton = buildActionButton(
        "tandaRemoveTrack",
        "tandaRemoveTrackShort",
        "tanda-remove",
      );
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
    const saveButton = document.createElement("button");
    saveButton.textContent = t("tandaSave");
    saveButton.dataset.action = "tanda-save";
    saveButton.dataset.tandaId = tanda.id;
    const deleteButton = document.createElement("button");
    deleteButton.textContent = t("tandaDelete");
    deleteButton.dataset.action = "tanda-delete";
    deleteButton.dataset.tandaId = tanda.id;
    const clipButton = document.createElement("button");
    clipButton.textContent = t("tandaToClipboard");
    clipButton.dataset.action = "tanda-clip";
    clipButton.dataset.tandaId = tanda.id;
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
    renderClipboard();
    return;
  }
  clipboardTracks = [...clipboardTracks, track];
  selectedClipboardIndex = clipboardTracks.length - 1;
  trackCache.set(track.id, track);
  renderClipboard();
};

const appendTrackToPlaylist = (track: TrackRow) => {
  normalizePlaylist();
  const insertIndex = Math.max(0, playlistItems.length - 1);
  playlistItems[insertIndex] = { kind: "track", track };
  normalizePlaylist();
  trackCache.set(track.id, track);
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

const getActiveTanda = () =>
  tandaDrafts.find((tanda) => tanda.id === selectedTandaId) ?? null;

const setActiveTanda = (tandaId: string | null) => {
  selectedTandaId = tandaId;
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

const addTrackToTanda = (tandaId: string | null, track: TrackRow) => {
  const tanda = tandaDrafts.find((item) => item.id === tandaId);
  if (!tanda) {
    return false;
  }
  if (tanda.styles.length > 0 && !tanda.styles.includes(track.genre)) {
    return false;
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
  renderClipboard();
};

const addTandaToPlaylist = (tandaId: string) => {
  const tanda = tandaDrafts.find((item) => item.id === tandaId);
  if (!tanda) {
    return;
  }
  normalizePlaylist();
  const insertIndex = Math.max(0, playlistItems.length - 1);
  playlistItems[insertIndex] = { kind: "tanda", tanda: cloneTanda(tanda) };
  normalizePlaylist();
  renderPlaylist();
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
};

const clearAlert = () => {
  if (!alertBanner) {
    return;
  }
  alertBanner.textContent = "";
  alertBanner.classList.remove("visible");
};

const loadStyles = async () => {
  if (!window.tanda || !styleOptions) {
    return;
  }
  const styles = await window.tanda.getTrackStyles();
  availableStyles = styles.length > 0 ? styles : ["Tango", "Waltz", "Milonga"];
  const forcedStyles = getActiveStyleFilter();
  styleOptions.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.textContent = t("styleAll");
  allButton.classList.toggle(
    "active",
    (forcedStyles.length > 0 ? forcedStyles : selectedStyles).length === 0,
  );
  allButton.disabled = forcedStyles.length > 0;
  allButton.addEventListener("click", () => {
    selectedStyles = [];
    loadStyles();
    refreshSearch();
  });
  styleOptions.appendChild(allButton);
  availableStyles.forEach((style) => {
    const button = document.createElement("button");
    button.textContent = style;
    const activeSet = forcedStyles.length > 0 ? forcedStyles : selectedStyles;
    button.classList.toggle("active", activeSet.includes(style));
    button.disabled = forcedStyles.length > 0;
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
};

let searchTimer: number | undefined;

const getActiveStyleFilter = () => {
  const tanda = getActiveTanda();
  return tanda && tanda.styles.length > 0 ? tanda.styles : [];
};

const getSearchParams = () => {
  const forcedStyles = getActiveStyleFilter();
  return {
    query: searchInput?.value?.trim() ?? "",
    styles: forcedStyles.length > 0 ? forcedStyles : selectedStyles,
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

  if (targetIndex === null || Number.isNaN(targetIndex)) {
    appendTrackToPlaylist(track);
    if (payload.context === "clipboard") {
      removeClipboardTrack(payload.trackId);
      renderClipboard();
    } else if (payload.context === "playlist" && payload.index) {
      const sourceIndex = Number.parseInt(payload.index, 10);
      if (!Number.isNaN(sourceIndex) && playlistItems[sourceIndex]) {
        playlistItems[sourceIndex] = null;
      }
    }
    normalizePlaylist();
    renderPlaylist();
    return;
  }

  const replaced = playlistItems[targetIndex];
  playlistItems[targetIndex] = { kind: "track", track };

  if (payload.context === "playlist" && payload.index) {
    const sourceIndex = Number.parseInt(payload.index, 10);
    if (!Number.isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      playlistItems[sourceIndex] = replaced ?? null;
    }
  } else if (payload.context === "clipboard") {
    removeClipboardTrack(payload.trackId);
    if (replaced?.kind === "track") {
      addTrackToClipboard(replaced.track);
    } else if (replaced?.kind === "tanda") {
      clipboardTandas = [...clipboardTandas, cloneTanda(replaced.tanda)];
      renderClipboard();
    }
  } else if (payload.context === "search" && replaced?.kind === "track") {
    addTrackToClipboard(replaced.track);
  } else if (payload.context === "search" && replaced?.kind === "tanda") {
    clipboardTandas = [...clipboardTandas, cloneTanda(replaced.tanda)];
    renderClipboard();
  }

  normalizePlaylist();
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

  if (modeSelect) {
    const savedMode = (localStorage.getItem("tanda-mode") ??
      "prep") as OutputMode;
    appMode = savedMode === "live" ? "live" : "prep";
    modeSelect.value = appMode;
    modeSelect.addEventListener("change", () => {
      appMode = modeSelect.value === "live" ? "live" : "prep";
      localStorage.setItem("tanda-mode", appMode);
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
  });

  settingsBtn?.addEventListener("click", () => setSettingsOpen(true));
  closeSettingsBtn?.addEventListener("click", () => setSettingsOpen(false));
  openSettingsBtn?.addEventListener("click", () => setSettingsOpen(true));

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (!tab) {
        return;
      }
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabPanels.forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      tabPanels
        .filter((panel) => panel.dataset.tab === tab)
        .forEach((panel) => panel.classList.add("active"));
    });
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
    if (progressEl) {
      progressEl.value = 0;
      progressEl.max = 1;
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
    const action = target.getAttribute("data-action");
    if (action === "tanda-toggle" && row) {
      toggleTandaRow(row);
      return;
    }
    if (action === "add-playlist-tanda") {
      addTandaToPlaylist(tandaId);
      return;
    }
    const found = clipboardTandas.find((item) => item.id === tandaId);
    if (!found) {
      return;
    }
    if (!tandaDrafts.some((item) => item.id === tandaId)) {
      tandaDrafts = [...tandaDrafts, found];
    }
    setActiveTanda(tandaId);
    activateRightTab("tanda-designer-tab");
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
    const tandaId = row.dataset.tandaId;
    if (!tandaId) {
      return;
    }
    const action = target.getAttribute("data-action");
    if (action === "tanda-toggle") {
      toggleTandaRow(row);
      return;
    }
    if (action === "add-clip-tanda") {
      addTandaToClipboard(tandaId);
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
    if (index < 0 || selectedClipboardIndex === null) {
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
