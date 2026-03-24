import { app, BrowserWindow, dialog, ipcMain, nativeImage, session } from "electron";

if (process.platform === "darwin" && process.arch === "x64") {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
}
import fs from "fs";
import { createHash, randomUUID } from "crypto";
import path from "path";
import { initDb, getDb, resetDb, reopenDb, closeDb } from "./db";
import { getDataPaths, getDataRoot, getDefaultDataPath, setDataRoot } from "./data-location";
import {
  appendLogEntry,
  clearDiagnosticsLogs,
  getDiagnosticsDataReadiness,
  getDiagnosticsPaths,
  PLAYBACK_DIAGNOSTIC_LOG,
  readLogTail,
  RENDERER_ERROR_LOG,
  verifyCachedFiles,
} from "./diagnostics";
import { scanLibraryRoots } from "./library/scan";
import type { LibraryRoot } from "./library/scan";
import {
  hasUsableCompressedRender,
  hasUsableWaveformPng,
  getCustomFfmpegToolsDir,
  getResolvedFfmpegInfo,
  getResolvedFfmpegPath,
  getResolvedFfprobeInfo,
  getResolvedFfprobePath,
  renderCompressedAudio,
  renderWaveformPng,
  setCustomFfmpegToolsDir,
} from "./library/analysis";
import { buildCompressedCacheKey, buildCompressedCachePath } from "./library/compression-cache";
import {
  auditCompressionReadiness,
  listCompressionEligibleTracks,
} from "./library/compression-readiness";
import {
  buildJumpIndex,
  getSortKeySql,
  getSortSql,
  normalizeSortColumn,
  normalizeSortDirection,
} from "./library/query";
import type { SortColumn } from "./library/query";
import {
  buildStyleWhere,
  getPrefixForTrack,
  getSortKeyForTrack,
  matchesPrefix,
  normalizeSearchConfig,
  type SearchSortColumn,
} from "./search-config";
import {
  countFuzzyTracks,
  fetchSearchCandidates,
  fuzzySearchTracks,
} from "./library/search";
import type { CortinaTrackRow, DisplayUpdatePayload, E2ESeedPayload } from "../shared/types";
import { filterAndScoreTracks } from "./library/fuzzy-search";
import {
  DEFAULT_CORTINA_SET_ID,
  getCortinaSetName,
} from "../shared/cortina-utils";
import { type CompressionRenderProfile } from "../shared/audio-compression";
import { normalizeStyleName, summarizeArtistName } from "../shared/tanda-utils";
import { mergeStyleAliases, parseStyleDefinition } from "../shared/style-definitions";
import {
  deleteTanda,
  getTandasByIds,
  listRecentTandaIds,
  listTandas,
  saveTanda,
  searchTandas,
} from "./library/tandas";
import {
  detectLegacyFromRoots,
  detectLegacyRoot,
  importLegacyData,
  listLegacyStyles,
  type LegacyTrackOverride,
} from "./legacy-import";
import {
  deserializeLegacyOverrides,
  serializeLegacyOverrides,
} from "../shared/legacy-overrides";
import { computeSearchDiversityStats } from "./search-diversity";
import {
  buildSystemBackupFolderName,
  isPathWithin,
  readSystemBackupManifest,
  restoreSystemBackup,
  SYSTEM_BACKUP_VERSION,
  writeSystemBackup,
} from "./system-transfer";
import type { StartupFlowPhase } from "../shared/types";
import {
  buildPlaylistExportFileName,
  buildTandasExportFileName,
  buildTandasExportManifest,
  importPlaylistFile,
  serializePlaylistExportAsM3u,
  writePlaylistExport,
  writeTandasExport,
} from "./library-transfer";
import type { PlaylistExportManifest } from "../shared/library-transfer";

const forcedUserDataRoot = process.env.TANDA_USER_DATA_ROOT?.trim();
if (forcedUserDataRoot) {
  app.setPath("userData", path.resolve(forcedUserDataRoot));
}

let scanInProgress = false;
let legacyOverridesByRootId = new Map<string, Map<string, LegacyTrackOverride>>();
const LEGACY_OVERRIDES_STATE_KEY = "legacy-overrides-v1";
const FFMPEG_TOOLS_DIR_STATE_KEY = "ffmpeg-tools-dir-v1";
const closeStateByWebContentsId = new Map<
  number,
  { allowClose: boolean; closeRequested: boolean }
>();
let mainAppWindow: BrowserWindow | null = null;
let displayWindow: BrowserWindow | null = null;
let lastDisplayPayload: DisplayUpdatePayload = {};
const DEFAULT_MAIN_WINDOW_ZOOM_FACTOR = 0.72;

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);
const audioExtensions = new Set([
  ".mp3",
  ".m4a",
  ".flac",
  ".wav",
  ".aac",
  ".ogg",
  ".aiff",
]);
const compressedRenderInFlight = new Map<string, Promise<string>>();
const MAX_CONCURRENT_COMPRESSED_RENDERS = 1;
let activeCompressedRenderCount = 0;
const compressedRenderWaiters: Array<() => void> = [];

const acquireCompressedRenderSlot = async () => {
  if (activeCompressedRenderCount < MAX_CONCURRENT_COMPRESSED_RENDERS) {
    activeCompressedRenderCount += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    compressedRenderWaiters.push(resolve);
  });
  activeCompressedRenderCount += 1;
};

const releaseCompressedRenderSlot = () => {
  activeCompressedRenderCount = Math.max(0, activeCompressedRenderCount - 1);
  const next = compressedRenderWaiters.shift();
  if (next) {
    next();
  }
};

const runWithCompressedRenderSlot = async <T>(task: () => Promise<T>) => {
  await acquireCompressedRenderSlot();
  try {
    return await task();
  } finally {
    releaseCompressedRenderSlot();
  }
};

const toDataUrl = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
          ? "image/gif"
          : ext === ".bmp"
            ? "image/bmp"
            : "image/jpeg";
  const data = fs.readFileSync(filePath);
  return `data:${mime};base64,${data.toString("base64")}`;
};

const walkImageFiles = async (rootPath: string): Promise<string[]> => {
  const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkImageFiles(fullPath)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (imageExtensions.has(ext)) {
      files.push(fullPath);
    }
  }
  return files;
};

const getCompressedCacheDir = () => path.join(getDataRoot(), "compressed-audio-cache");

const getCompressedCacheOutputPath = (
  filePath: string,
  stat: fs.Stats,
  params: {
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
  },
) => buildCompressedCachePath(getCompressedCacheDir(), filePath, stat, params);

const detectCortinaSetsFromRoot = (rootPath: string) => {
  const sets = new Set<string>();
  if (!rootPath || !fs.existsSync(rootPath)) {
    return sets;
  }
  let rootHasAudio = false;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(rootPath, { withFileTypes: true });
  } catch {
    return sets;
  }
  entries.forEach((entry) => {
    if (entry.name.startsWith(".")) {
      return;
    }
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (audioExtensions.has(ext)) {
        rootHasAudio = true;
      }
      return;
    }
    if (!entry.isDirectory()) {
      return;
    }
    let hasAudioInDir = false;
    try {
      const nested = fs.readdirSync(fullPath, { withFileTypes: true });
      hasAudioInDir = nested.some((nestedEntry) => {
        if (!nestedEntry.isFile()) {
          return false;
        }
        const ext = path.extname(nestedEntry.name).toLowerCase();
        return audioExtensions.has(ext);
      });
    } catch {
      hasAudioInDir = false;
    }
    if (hasAudioInDir) {
      sets.add(entry.name);
    }
  });
  if (rootHasAudio) {
    sets.add(DEFAULT_CORTINA_SET_ID);
  }
  return sets;
};

const clearCachedArtifacts = () => {
  const { waveformsDir, compressedCacheDir } = getDataPaths();
  try {
    if (fs.existsSync(waveformsDir)) {
      fs.rmSync(waveformsDir, { recursive: true, force: true });
    }
  } catch {
    // Best-effort cleanup; cache clear should not fail if waveform deletion fails.
  }
  try {
    if (fs.existsSync(compressedCacheDir)) {
      fs.rmSync(compressedCacheDir, { recursive: true, force: true });
    }
  } catch {
    // Best-effort cleanup; cache clear should not fail if compressed cache deletion fails.
  }
};

const clearDiagnosticsArtifacts = () => {
  const { logDir } = getDataPaths();
  [RENDERER_ERROR_LOG, PLAYBACK_DIAGNOSTIC_LOG].forEach((logFile) => {
    try {
      const logPath = path.join(logDir, logFile);
      if (fs.existsSync(logPath)) {
        fs.unlinkSync(logPath);
      }
    } catch {
      // Best-effort cleanup; reset should not fail if log deletion fails.
    }
  });
};

type CompressionRenderConfig = CompressionRenderProfile;

const precomputeCompressedTracksWithProgress = async (
  sender: Electron.WebContents,
  params: CompressionRenderConfig,
) => {
  const db = getDb();
  const rows = listCompressionEligibleTracks(db);
  const cacheDir = getCompressedCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });
  let rendered = 0;
  let cached = 0;
  let failed = 0;
  const errors: { filePath: string; message: string }[] = [];
  const total = rows.length;
  const pushProgress = (
    done: boolean,
    currentFile?: string | null,
    latestError?: { filePath: string; message: string } | null,
  ) => {
    sender.send("audio:precomputeProgress", {
      current: rendered + cached + failed,
      total,
      rendered,
      cached,
      failed,
      currentFile: currentFile ?? null,
      latestError: latestError ?? null,
      done,
    });
  };
  pushProgress(false);
  for (const row of rows) {
    const relativeFile = row.relativePath;
    try {
      if (!row.fullPath || !fs.existsSync(row.fullPath)) {
        failed += 1;
        const latestError = {
          filePath: row.fullPath || row.id,
          message: "Compression: Track file not found",
        };
        errors.push(latestError);
        pushProgress(false, relativeFile, latestError);
        continue;
      }
      const stat = fs.statSync(row.fullPath);
      const renderParams = {
        loudnessDb: row.loudnessDb,
        depthPercent: 100,
        ...params,
      } as const;
      const outputPath = getCompressedCacheOutputPath(row.fullPath, stat, renderParams);
      if (hasUsableCompressedRender(outputPath)) {
        cached += 1;
        pushProgress(false, relativeFile);
        continue;
      }
      fs.rmSync(outputPath, { force: true });
      await runWithCompressedRenderSlot(async () => {
        await renderCompressedAudio(row.fullPath, outputPath, renderParams);
      });
      rendered += 1;
      pushProgress(false, relativeFile);
    } catch (error) {
      failed += 1;
      const latestError = {
        filePath: row.fullPath,
        message: `Compression: ${
          error instanceof Error ? error.message : "Compression render failed"
        }`,
      };
      errors.push(latestError);
      pushProgress(false, relativeFile, latestError);
    }
  }
  pushProgress(true);
  const readiness = auditCompressionReadiness(cacheDir, rows, params);
  return {
    rendered,
    cached,
    failed,
    eligible: readiness.eligible,
    ready: readiness.ready,
    missing: readiness.missing,
    invalidSource: readiness.invalidSource,
    missingTracks: readiness.tracks.filter((track) => track.status !== "ready"),
    errors,
  };
};

const saveLegacyOverrides = () => {
  const db = getDb();
  const now = new Date().toISOString();
  if (legacyOverridesByRootId.size === 0) {
    db.prepare("delete from app_state where key = ?").run(LEGACY_OVERRIDES_STATE_KEY);
    return;
  }
  db.prepare(
    `insert into app_state (key, value, updated_at)
     values (?, ?, ?)
     on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`,
  ).run(
    LEGACY_OVERRIDES_STATE_KEY,
    serializeLegacyOverrides(legacyOverridesByRootId),
    now,
  );
};

const getAppStateValue = (key: string) => {
  const db = getDb();
  const row = db
    .prepare("select value from app_state where key = ?")
    .get(key) as { value?: string } | undefined;
  return typeof row?.value === "string" ? row.value : null;
};

const setAppStateValue = (key: string, value: string | null) => {
  const db = getDb();
  if (!value?.trim()) {
    db.prepare("delete from app_state where key = ?").run(key);
    return;
  }
  const now = new Date().toISOString();
  db.prepare(
    `insert into app_state (key, value, updated_at)
     values (?, ?, ?)
     on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value.trim(), now);
};

const loadLegacyOverrides = () => {
  legacyOverridesByRootId = deserializeLegacyOverrides(
    getAppStateValue(LEGACY_OVERRIDES_STATE_KEY),
  );
};

const loadFfmpegToolsDir = () => {
  setCustomFfmpegToolsDir(getAppStateValue(FFMPEG_TOOLS_DIR_STATE_KEY));
};

const persistFfmpegToolsDir = (dirPath: string | null) => {
  const trimmed = dirPath?.trim() ?? "";
  setAppStateValue(FFMPEG_TOOLS_DIR_STATE_KEY, trimmed || null);
  setCustomFfmpegToolsDir(trimmed || null);
  return { path: trimmed };
};

const setDockIcon = () => {
  if (process.platform !== "darwin") {
    return;
  }
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icons", "icon.png")
    : path.join(app.getAppPath(), "app", "resources", "icons", "icon.png");
  if (!fs.existsSync(iconPath)) {
    return;
  }
  app.dock.setIcon(nativeImage.createFromPath(iconPath));
};

const createWindow = () => {
  setDockIcon();
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    fullscreen: false,
    fullscreenable: true,
    backgroundColor: "#111827",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: DEFAULT_MAIN_WINDOW_ZOOM_FACTOR,
      // Keep timers/audio smooth when app is not focused (avoid background jumps).
      backgroundThrottling: false,
    },
  });
  mainAppWindow = mainWindow;
  mainWindow.webContents.setZoomFactor(DEFAULT_MAIN_WINDOW_ZOOM_FACTOR);

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.setZoomFactor(DEFAULT_MAIN_WINDOW_ZOOM_FACTOR);
  });
  mainWindow.once("ready-to-show", () => {
    if (mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.setZoomFactor(DEFAULT_MAIN_WINDOW_ZOOM_FACTOR);
    mainWindow.show();
  });

  const windowId = mainWindow.webContents.id;
  const closeState = { allowClose: false, closeRequested: false };
  closeStateByWebContentsId.set(windowId, closeState);

  mainWindow.on("close", (event) => {
    if (!app.isPackaged) {
      event.preventDefault();
      app.exit(0);
      return;
    }
    if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
      return;
    }
    if (closeState.allowClose) {
      return;
    }
    event.preventDefault();
    if (closeState.closeRequested) {
      return;
    }
    closeState.closeRequested = true;
    if (!mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send("app:request-close");
    }
  });

  mainWindow.on("closed", () => {
    closeState.allowClose = true;
    closeState.closeRequested = false;
    closeStateByWebContentsId.delete(windowId);
    if (mainAppWindow === mainWindow) {
      mainAppWindow = null;
    }
  });
};

const ensureDisplayWindow = () => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    return displayWindow;
  }
  displayWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hidden" : undefined,
    fullscreenable: true,
    autoHideMenuBar: true,
    backgroundColor: "#0b0d12",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Prevent renderer throttling on external display window transitions.
      backgroundThrottling: false,
    },
  });
  displayWindow.loadFile(path.join(__dirname, "../renderer/display.html"));
  displayWindow.once("ready-to-show", () => {
    if (!displayWindow || displayWindow.isDestroyed()) {
      return;
    }
    displayWindow.show();
    if (Object.keys(lastDisplayPayload).length > 0) {
      displayWindow.webContents.send("display:update", lastDisplayPayload);
    }
  });
  displayWindow.on("closed", () => {
    displayWindow = null;
  });
  return displayWindow;
};

const registerIpc = () => {
  ipcMain.handle("app:close-response", async (event, allowed: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const closeState = closeStateByWebContentsId.get(event.sender.id);
    if (!window || window.isDestroyed() || !closeState) {
      return;
    }
    if (allowed) {
      closeState.allowClose = true;
      closeState.closeRequested = false;
      if (!window.isDestroyed()) {
        window.close();
      }
    } else {
      closeState.closeRequested = false;
    }
  });

  ipcMain.handle("app:close", async (event) => {
    if (!app.isPackaged) {
      app.exit(0);
      return;
    }
    const window = BrowserWindow.fromWebContents(event.sender);
    const closeState = closeStateByWebContentsId.get(event.sender.id);
    if (!window || window.isDestroyed() || !closeState) {
      const focused = BrowserWindow.getFocusedWindow();
      if (focused) {
        focused.close();
      } else {
        app.quit();
      }
      return;
    }
    closeState.allowClose = true;
    closeState.closeRequested = false;
    if (!window.isDestroyed()) {
      window.close();
    }
  });

  ipcMain.handle("app:toggleFullscreen", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow();
    if (!window || window.isDestroyed()) {
      return { fullscreen: false };
    }
    if (process.platform === "darwin") {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      return { fullscreen: window.isMaximized() };
    }
    const next = !window.isFullScreen();
    window.setFullScreen(next);
    return { fullscreen: window.isFullScreen() };
  });

  ipcMain.handle(
    "library:pickRoot",
    async (_event, kind: "music" | "cortina" | "background") => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title:
        kind === "music"
          ? "Select Music Folder"
          : kind === "cortina"
            ? "Select Cortina Folder"
            : "Select Background Folder",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
    },
  );

  ipcMain.handle("data:pickLocation", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select Data Location",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle("data:getLocation", async () => ({
    path: getDataRoot(),
    defaultPath: getDefaultDataPath(),
  }));

  ipcMain.handle("data:setLocation", async (_event, selectedPath: string | null) => {
    const next = setDataRoot(selectedPath);
    legacyOverridesByRootId = new Map();
    reopenDb();
    loadLegacyOverrides();
    loadFfmpegToolsDir();
    return { path: next };
  });

  ipcMain.handle("diagnostics:pickFfmpegToolsDir", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select FFmpeg Tools Folder",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle("diagnostics:getFfmpegToolsDir", async () => ({
    path: getCustomFfmpegToolsDir() ?? "",
  }));

  ipcMain.handle("diagnostics:setFfmpegToolsDir", async (_event, dirPath: string | null) =>
    persistFfmpegToolsDir(dirPath),
  );

  ipcMain.handle("app:exportSystemData", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose Export Location",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, cancelled: true, path: "" };
    }
    const createdAt = new Date().toISOString();
    const exportRoot = path.join(
      result.filePaths[0],
      buildSystemBackupFolderName(createdAt),
    );
    writeSystemBackup(getDataRoot(), exportRoot, {
      format: "tanda-forge-system-backup",
      version: SYSTEM_BACKUP_VERSION,
      createdAt,
      appVersion: app.getVersion(),
    });
    return { ok: true, cancelled: false, path: exportRoot };
  });

  ipcMain.handle("app:importSystemData", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Choose System Backup Folder",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, cancelled: true, path: "" };
    }
    const backupRoot = path.resolve(result.filePaths[0]);
    const targetRoot = getDataRoot();
    if (backupRoot === targetRoot || isPathWithin(targetRoot, backupRoot)) {
      return {
        ok: false,
        cancelled: false,
        path: backupRoot,
        error: "Backup folder must be outside the active data directory",
      };
    }
    const manifest = readSystemBackupManifest(backupRoot);
    if (!manifest) {
      return {
        ok: false,
        cancelled: false,
        path: backupRoot,
        error: "Selected folder is not a valid Tanda Forge system backup",
      };
    }
    closeDb();
    restoreSystemBackup(backupRoot, targetRoot);
    reopenDb();
    loadLegacyOverrides();
    loadFfmpegToolsDir();
    return { ok: true, cancelled: false, path: backupRoot };
  });

  ipcMain.handle("app:exportTandasData", async () => {
    const createdAt = new Date().toISOString();
    const result = await dialog.showSaveDialog({
      title: "Export Tandas",
      defaultPath: buildTandasExportFileName(createdAt),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false, cancelled: true, path: "" };
    }
    const db = getDb();
    const manifest = buildTandasExportManifest(listTandas(db), createdAt, app.getVersion());
    writeTandasExport(result.filePath, manifest);
    return { ok: true, cancelled: false, path: result.filePath };
  });

  ipcMain.handle("app:exportPlaylistData", async (_event, manifest: PlaylistExportManifest) => {
    const createdAt = new Date().toISOString();
    const result = await dialog.showSaveDialog({
      title: "Save Playlist",
      defaultPath: buildPlaylistExportFileName(createdAt),
      filters: [
        { name: "JSON", extensions: ["json"] },
        { name: "M3U", extensions: ["m3u", "m3u8"] },
      ],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false, cancelled: true, path: "" };
    }
    const exportManifest = {
      ...manifest,
      appVersion: app.getVersion(),
    };
    const ext = path.extname(result.filePath).toLowerCase();
    if (ext === ".m3u" || ext === ".m3u8") {
      fs.writeFileSync(result.filePath, serializePlaylistExportAsM3u(exportManifest), "utf-8");
    } else {
      writePlaylistExport(result.filePath, exportManifest);
    }
    return { ok: true, cancelled: false, path: result.filePath };
  });

  ipcMain.handle("app:importPlaylistData", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import Playlist",
      properties: ["openFile"],
      filters: [
        { name: "Playlist files", extensions: ["json", "m3u", "m3u8"] },
        { name: "JSON", extensions: ["json"] },
        { name: "M3U", extensions: ["m3u", "m3u8"] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, cancelled: true, path: "" };
    }
    const filePath = result.filePaths[0];
    try {
      const db = getDb();
      const imported = importPlaylistFile(db, filePath);
      return {
        ok: true,
        cancelled: false,
        path: filePath,
        format: imported.format,
        state: imported.state,
        warnings: imported.warnings,
      };
    } catch (error) {
      return {
        ok: false,
        cancelled: false,
        path: filePath,
        error: error instanceof Error ? error.message : "Playlist import failed",
      };
    }
  });

  ipcMain.handle(
    "library:addRoot",
    async (_event, kind: "music" | "cortina" | "background", rootPath: string) => {
      const db = getDb();
      const now = new Date().toISOString();
      const id = randomUUID();
      const label = path.basename(rootPath);
      db.prepare(
        "insert or ignore into library_roots (id, kind, path, label, created_at) values (?, ?, ?, ?, ?)",
      ).run(id, kind, rootPath, label, now);
      return { id, kind, path: rootPath, label };
    },
  );

  ipcMain.handle("library:listRoots", async () => {
    const db = getDb();
    const roots = db
      .prepare("select id, kind, path, label from library_roots order by label")
      .all() as { id: string; kind: string; path: string; label: string }[];
    return roots.map((root) => ({
      ...root,
      available: fs.existsSync(root.path),
    }));
  });

  ipcMain.handle("legacy:detect", async (_event, candidatePath?: string | null) => {
    if (candidatePath) {
      const detected = detectLegacyRoot(candidatePath);
      return detected
        ? { available: true, rootPath: detected.rootPath }
        : { available: false, rootPath: "" };
    }
    const db = getDb();
    const roots = db
      .prepare("select id, kind, path, label from library_roots")
      .all() as LibraryRoot[];
    const detected = detectLegacyFromRoots(roots);
    return detected
      ? { available: true, rootPath: detected.rootPath }
      : { available: false, rootPath: "" };
  });

  ipcMain.handle("legacy:import", async (_event, rootPath: string) => {
    const db = getDb();
    const roots = db
      .prepare("select id, kind, path, label from library_roots")
      .all() as LibraryRoot[];
    const { waveformsDir } = getDataPaths();
    const result = await importLegacyData(rootPath, roots, { waveformsDir });
    legacyOverridesByRootId = result.overridesByRootId;
    saveLegacyOverrides();
    return {
      tandasImported: result.tandasImported,
      tracksUpdated: result.tracksUpdated,
      missingTracks: result.missingTracks,
      missingFiles: result.missingFiles,
      rootPath: result.rootPath,
    };
  });

  ipcMain.handle("legacy:listStyles", async (_event, rootPath: string) => {
    const detected = detectLegacyRoot(rootPath);
    if (!detected) {
      return {
        ok: false,
        styles: [] as Array<{
          value: string;
          normalized: string;
          count: number;
          mappedTo: string;
        }>,
      };
    }
    const db = getDb();
    const styleRows = db
      .prepare("select name, normalized from styles")
      .all() as { name: string; normalized: string }[];
    const styleMap = new Map(
      styleRows.map((row) => [row.normalized.toLowerCase(), row.name]),
    );
    const aliasRows = db
      .prepare("select style_name, alias_normalized from style_aliases")
      .all() as { style_name: string; alias_normalized: string }[];
    const aliasMap = new Map(
      aliasRows.map((row) => [row.alias_normalized.toLowerCase(), row.style_name]),
    );
    const styles = listLegacyStyles(detected.libraryPath).map((entry) => {
      const key = entry.normalized.toLowerCase();
      const mappedTo = styleMap.get(key) ?? aliasMap.get(key) ?? "";
      return { ...entry, mappedTo };
    });
    return { ok: true, styles };
  });

  const runScan = async (roots: LibraryRoot[]) => {
    if (scanInProgress) {
      const error = new Error("SCAN_IN_PROGRESS");
      throw error;
    }
    scanInProgress = true;
    try {
      const { waveformsDir } = getDataPaths();
      return await scanLibraryRoots(
        roots,
        (progress) => {
          BrowserWindow.getAllWindows().forEach((window) => {
            window.webContents.send("library:scanProgress", progress);
          });
        },
        {
          waveformsDir,
          getLegacyMetadata: (root, relativePath) =>
            legacyOverridesByRootId.get(root.id)?.get(relativePath) ?? null,
        },
      );
    } finally {
      scanInProgress = false;
    }
  };

  ipcMain.handle("library:scanAll", async () => {
    const db = getDb();
    const roots = db
      .prepare("select id, kind, path, label from library_roots")
      .all() as LibraryRoot[];
    const scanRoots = roots.filter(
      (root) => root.kind === "music" || root.kind === "cortina",
    );
    const startedAt = new Date().toISOString();
    db.prepare(
      "update library_roots set last_scan_started_at = ?, last_scan_error = null where kind in ('music','cortina')",
    ).run(startedAt);

    try {
      const summary = await runScan(scanRoots);
      const completedAt = new Date().toISOString();
      db.prepare(
        "update library_roots set last_scan_completed_at = ? where kind in ('music','cortina')",
      ).run(completedAt);
      return summary;
    } catch (error) {
      if (error instanceof Error && error.message === "SCAN_IN_PROGRESS") {
        return {
          scanned: 0,
          added: 0,
          updated: 0,
          removed: 0,
          errors: [],
          inProgress: true,
        };
      }
      const message =
        error instanceof Error ? error.message : "Scan failed.";
      db.prepare(
        "update library_roots set last_scan_error = ? where kind in ('music','cortina')",
      ).run(message);
      throw error;
    }
  });

  ipcMain.handle("library:scanKind", async (_event, kind: "music" | "cortina") => {
    const db = getDb();
    const roots = db
      .prepare("select id, kind, path, label from library_roots where kind = ?")
      .all(kind) as LibraryRoot[];
    const startedAt = new Date().toISOString();
    db.prepare(
      "update library_roots set last_scan_started_at = ?, last_scan_error = null where kind = ?",
    ).run(startedAt, kind);
    try {
      const summary = await runScan(roots);
      const completedAt = new Date().toISOString();
      db.prepare(
        "update library_roots set last_scan_completed_at = ? where kind = ?",
      ).run(completedAt, kind);
      return summary;
    } catch (error) {
      if (error instanceof Error && error.message === "SCAN_IN_PROGRESS") {
        return {
          scanned: 0,
          added: 0,
          updated: 0,
          removed: 0,
          errors: [],
          inProgress: true,
        };
      }
      const message =
        error instanceof Error ? error.message : "Scan failed.";
      db.prepare(
        "update library_roots set last_scan_error = ? where kind = ?",
      ).run(message, kind);
      throw error;
    }
  });

  ipcMain.handle(
    "library:runStartupFlow",
    async (_event, params: CompressionRenderConfig) => {
      const pushStartupFlowPhase = (phase: StartupFlowPhase) => {
        _event.sender.send("library:startupFlowProgress", { phase });
      };
      try {
        const db = getDb();
        const roots = db
          .prepare("select id, kind, path, label from library_roots")
          .all() as LibraryRoot[];
        const musicRoots = roots.filter((root) => root.kind === "music");
        const cortinaRoots = roots.filter((root) => root.kind === "cortina");
        if (musicRoots.length === 0 && cortinaRoots.length === 0) {
          return {
            ok: false,
            error: "Configure music or cortina roots before running setup",
          };
        }
        pushStartupFlowPhase("music");
        const musicScan =
          musicRoots.length > 0
            ? await runScan(musicRoots)
            : { scanned: 0, added: 0, updated: 0, removed: 0, errors: [] };
        pushStartupFlowPhase("cortina");
        const cortinaScan =
          cortinaRoots.length > 0
            ? await runScan(cortinaRoots)
            : { scanned: 0, added: 0, updated: 0, removed: 0, errors: [] };
        pushStartupFlowPhase("compression");
        const precompute = await precomputeCompressedTracksWithProgress(_event.sender, params);
        pushStartupFlowPhase("complete");
        return {
          ok: true,
          musicScan,
          cortinaScan,
          precompute,
        };
      } catch (error) {
        pushStartupFlowPhase("failed");
        throw error;
      }
    },
  );

  const normalizeTrackRow = (row: any) =>
    row
      ? {
          ...row,
          instrumental:
            row.instrumental === null ? null : Boolean(row.instrumental),
        }
      : row;
  const normalizeTrackRows = (rows: any[]) => rows.map(normalizeTrackRow);

  ipcMain.handle("library:listTracks", async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `select t.id, t.full_path, t.relative_path, t.title, t.artist, t.artist_summary, t.singer, t.album,
          t.year, t.genre, t.bpm, t.notes, t.instrumental, t.duration_ms, t.start_offset_ms, t.end_trim_ms, t.analysis_json,
          t.loudness_db, t.gain_db, t.tag_error, t.analysis_error
         from tracks t
         join library_roots r on r.id = t.root_id
         where r.kind = 'music'
         order by t.artist, t.title`,
      )
      .all();
    return normalizeTrackRows(rows);
  });

  ipcMain.handle(
    "tracks:listPage",
    async (
      _event,
      params: {
        offset?: number;
        limit?: number;
        sortBy?: string;
        sortDir?: string;
      },
    ) => {
      const db = getDb();
      const sortBy = normalizeSortColumn(params.sortBy);
      const sortDir = normalizeSortDirection(params.sortDir);
      const offset = Math.max(0, params.offset ?? 0);
      const limit = Math.min(500, Math.max(1, params.limit ?? 200));
      const sortSql = getSortSql(sortBy);
      const extraSort =
        sortBy === "artist" ? `, t.artist ${sortDir}` : "";
      const rows = db
        .prepare(
          `select t.id, t.full_path, t.relative_path, t.title, t.artist, t.artist_summary, t.singer, t.album,
            t.year, t.genre, t.bpm, t.notes, t.instrumental, t.duration_ms, t.start_offset_ms, t.end_trim_ms, t.analysis_json,
            t.loudness_db, t.gain_db, t.tag_error, t.analysis_error
           from tracks t
           join library_roots r on r.id = t.root_id
           where r.kind = 'music'
           order by ${sortSql} ${sortDir}${extraSort}, t.id ${sortDir}
           limit ? offset ?`,
        )
        .all(limit, offset);
      return normalizeTrackRows(rows);
    },
  );

  ipcMain.handle(
    "tracks:search",
    async (
      _event,
      params: {
        query: string;
        styles: string[];
        limit?: number;
        offset?: number;
        sortBy?: string;
        sortDir?: string;
        minScore?: number;
        bpmRange?: number;
      },
    ) => {
      const db = getDb();
      const query = params.query?.trim() ?? "";
      const limit = Math.min(500, Math.max(1, params.limit ?? 200));
      const offset = Math.max(0, params.offset ?? 0);
      const sortByRaw = params.sortBy?.toLowerCase() ?? "";
      const isScoreSort = sortByRaw === "score";
      const sortBy: SearchSortColumn = isScoreSort
        ? "score"
        : normalizeSortColumn(params.sortBy);
      const sortDir = normalizeSortDirection(params.sortDir);
      const styles = params.styles ?? [];
      const { minScore, bpmRange } = normalizeSearchConfig(params);
      if (!query) {
        const { whereSql, values } = buildStyleWhere(styles);
        const sortSql = getSortSql(normalizeSortColumn(sortBy));
        const extraSort =
          sortBy === "artist" ? `, t.artist ${sortDir}` : "";
        const rows = db
          .prepare(
            `select t.id, t.full_path, t.relative_path, t.title, t.artist, t.artist_summary, t.singer, t.album,
              t.year, t.genre, t.bpm, t.notes, t.instrumental, t.duration_ms, t.start_offset_ms, t.end_trim_ms, t.analysis_json,
              t.loudness_db, t.gain_db, t.tag_error, t.analysis_error
             from tracks t
             join library_roots r on r.id = t.root_id
             ${whereSql}
             order by ${sortSql} ${sortDir}${extraSort}, t.id ${sortDir}
             limit ? offset ?`,
          )
          .all(...values, limit, offset);
        return normalizeTrackRows(rows);
      }
      const result = fuzzySearchTracks(
        db,
        { query, styles, minScore, bpmRange },
        limit,
        offset,
        sortBy,
        sortDir,
      );
      return normalizeTrackRows(result.page);
    },
  );

  ipcMain.handle(
    "tracks:searchCount",
    async (
      _event,
      params: { query: string; styles: string[]; minScore?: number; bpmRange?: number },
    ) => {
      const db = getDb();
      const query = params.query?.trim() ?? "";
      const styles = params.styles ?? [];
      if (!query) {
        const { whereSql, values } = buildStyleWhere(styles);
        const row = db
          .prepare(
            `select count(*) as count
             from tracks t
             join library_roots r on r.id = t.root_id
             ${whereSql}`,
          )
          .get(...values) as { count: number };
        return row.count;
      }
      const { minScore, bpmRange } = normalizeSearchConfig(params);
      return countFuzzyTracks(db, { query, styles, minScore, bpmRange });
    },
  );

  ipcMain.handle(
    "tracks:searchJumpIndex",
    async (
      _event,
      params: {
        query: string;
        styles: string[];
        sortBy?: string;
        minScore?: number;
        bpmRange?: number;
      },
    ) => {
      const db = getDb();
      const query = params.query?.trim() ?? "";
      const sortByRaw = params.sortBy?.toLowerCase() ?? "";
      const isScoreSort = sortByRaw === "score";
      const sortBy: SearchSortColumn = isScoreSort
        ? "score"
        : normalizeSortColumn(params.sortBy);
      if (query) {
        const { minScore, bpmRange } = normalizeSearchConfig(params);
        const candidates = fetchSearchCandidates(db, params.styles ?? []);
        const scored = filterAndScoreTracks(candidates, {
          query,
          minScore,
          bpmRange,
          sortBy,
          sortDir: "asc",
        });
        if (isScoreSort) {
          return buildJumpIndex([]);
        }
        const prefixes = scored.map((entry) =>
          getPrefixForTrack(isScoreSort ? "title" : sortBy, entry.track),
        );
        return buildJumpIndex(prefixes);
      }
      const keySql = getSortKeySql(normalizeSortColumn(sortBy));
      const { whereSql, values } = buildStyleWhere(params.styles ?? []);
      const filterSql = `${whereSql} and ${keySql} != ''`;
      const prefixes = db
        .prepare(
          `select distinct substr(${keySql}, 1, 1) as prefix
           from tracks t
           join library_roots r on r.id = t.root_id
           ${filterSql}`,
        )
        .all(...values)
        .map((row) => (row as { prefix: string }).prefix);
      return buildJumpIndex(prefixes);
    },
  );

  ipcMain.handle(
    "tracks:searchJumpToPrefix",
    async (
      _event,
      params: {
        query: string;
        styles: string[];
        prefix: string;
        sortBy?: string;
        sortDir?: string;
        minScore?: number;
        bpmRange?: number;
      },
    ) => {
      const db = getDb();
      const query = params.query?.trim() ?? "";
      const sortByRaw = params.sortBy?.toLowerCase() ?? "";
      const isScoreSort = sortByRaw === "score";
      const sortBy: SearchSortColumn = isScoreSort
        ? "score"
        : normalizeSortColumn(params.sortBy);
      const sortDir = normalizeSortDirection(params.sortDir);
      if (query) {
        const { minScore, bpmRange } = normalizeSearchConfig(params);
        const candidates = fetchSearchCandidates(db, params.styles ?? []);
        const scored = filterAndScoreTracks(candidates, {
          query,
          minScore,
          bpmRange,
          sortBy,
          sortDir,
        });
        if (isScoreSort) {
          return { offset: 0 };
        }
        const prefix = params.prefix.toUpperCase();
        const index = scored.findIndex((entry) =>
          matchesPrefix(
            prefix,
            getSortKeyForTrack(isScoreSort ? "title" : sortBy, entry.track),
          ),
        );
        return { offset: Math.max(0, index) };
      }
      const keySql = getSortKeySql(normalizeSortColumn(sortBy));
      const prefix = params.prefix.toUpperCase();
      const { whereSql, values } = buildStyleWhere(params.styles ?? []);
      let whereClause = "key like ?";
      let matchValue = `${prefix}%`;
      if (prefix === "0-9") {
        whereClause = "key glob '[0-9]*'";
      } else if (prefix === "#") {
        whereClause = "key glob '[^A-Z0-9]*'";
      }

      const row = db
        .prepare(
          `select offset from (
            select row_number() over (order by ${keySql} ${sortDir}, t.id ${sortDir}) - 1 as offset,
                   ${keySql} as key
            from tracks t
            join library_roots r on r.id = t.root_id
            ${whereSql}
          ) where ${whereClause}
          limit 1`,
        )
        .get(
          ...(prefix === "0-9" || prefix === "#"
            ? values
            : [...values, matchValue]),
        ) as { offset: number } | undefined;

      return { offset: row?.offset ?? 0 };
    },
  );

  ipcMain.handle("cortinas:listSets", async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `select t.relative_path as relative_path, r.label as root_label, r.path as root_path
         from tracks t
         join library_roots r on r.id = t.root_id
         where r.kind = 'cortina'`,
      )
      .all() as { relative_path: string; root_label?: string | null; root_path?: string | null }[];
    const sets = new Set<string>();
    rows.forEach((row) => {
      if (!row.relative_path) {
        return;
      }
      sets.add(getCortinaSetName(row.relative_path, row.root_label, row.root_path));
    });
    if (sets.size === 0) {
      const roots = db
        .prepare("select path from library_roots where kind = 'cortina'")
        .all() as { path: string }[];
      roots.forEach((root) => {
        detectCortinaSetsFromRoot(root.path).forEach((setName) => sets.add(setName));
      });
    }
    if (rows.length > 0 && sets.size === 0) {
      sets.add(DEFAULT_CORTINA_SET_ID);
    }
    return Array.from(sets).sort();
  });

  ipcMain.handle(
    "cortinas:listTracks",
    async (_event, setName: string): Promise<CortinaTrackRow[]> => {
      const db = getDb();
      const rows = db
        .prepare(
          `select t.id, t.full_path, t.relative_path, t.title, t.artist, t.artist_summary, t.singer,
            t.album, t.year, t.genre, t.bpm, t.instrumental, t.duration_ms,
            t.start_offset_ms, t.end_trim_ms, t.analysis_json, t.loudness_db, t.gain_db,
            t.tag_error, t.analysis_error, r.label as root_label, r.path as root_path
           from tracks t
           join library_roots r on r.id = t.root_id
           where r.kind = 'cortina'`,
        )
        .all() as (CortinaTrackRow & { root_label?: string | null; root_path?: string | null })[];
      const normalized = normalizeTrackRows(rows) as (CortinaTrackRow & {
        root_label?: string | null;
        root_path?: string | null;
      })[];
      return normalized
        .map((row) => ({
          ...row,
          cortina_set: getCortinaSetName(
            row.relative_path ?? "",
            row.root_label,
            row.root_path,
          ),
        }))
        .filter((row) => row.cortina_set === setName);
    },
  );

  ipcMain.handle(
    "cortinas:searchTracks",
    async (
      _event,
      params: { query: string; setName?: string },
    ): Promise<CortinaTrackRow[]> => {
      const db = getDb();
      const query = params.query?.trim() ?? "";
      const rows = db
        .prepare(
          `select t.id, t.full_path, t.relative_path, t.title, t.artist, t.artist_summary, t.singer,
            t.album, t.year, t.genre, t.bpm, t.instrumental, t.duration_ms,
            t.start_offset_ms, t.end_trim_ms, t.analysis_json, t.loudness_db, t.gain_db,
            t.tag_error, t.analysis_error, r.label as root_label, r.path as root_path
           from tracks t
           join library_roots r on r.id = t.root_id
           where r.kind = 'cortina'`,
        )
        .all() as (CortinaTrackRow & { root_label?: string | null; root_path?: string | null })[];
      const normalized = normalizeTrackRows(rows) as (CortinaTrackRow & {
        root_label?: string | null;
        root_path?: string | null;
      })[];
      const filtered = normalized
        .map((row) => ({
          ...row,
          cortina_set: getCortinaSetName(
            row.relative_path ?? "",
            row.root_label,
            row.root_path,
          ),
        }))
        .filter((row) =>
          params.setName ? row.cortina_set === params.setName : true,
        );
      if (!query) {
        return filtered;
      }
      const q = query.toLowerCase();
      return filtered.filter((row) =>
        [
          row.title,
          row.artist,
          row.album,
          row.year,
          row.genre,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q)),
      );
    },
  );

  ipcMain.handle("tracks:getStyles", async () => {
    const db = getDb();
    return db
      .prepare("select name from styles order by name")
      .all()
      .map((row) => (row as { name: string }).name);
  });

  ipcMain.handle("styles:list", async () => {
    const db = getDb();
    return db
      .prepare("select name from styles order by name")
      .all()
      .map((row) => (row as { name: string }).name);
  });

  ipcMain.handle("styles:listDefinitions", async () => {
    const db = getDb();
    const styles = db
      .prepare("select name from styles order by name")
      .all()
      .map((row) => (row as { name: string }).name);
    const aliasRows = db
      .prepare("select style_name, alias from style_aliases order by style_name, alias")
      .all() as { style_name: string; alias: string }[];
    const aliasMap = new Map<string, string[]>();
    aliasRows.forEach((row) => {
      const list = aliasMap.get(row.style_name) ?? [];
      list.push(row.alias);
      aliasMap.set(row.style_name, list);
    });
    return styles.map((name) => ({
      name,
      aliases: aliasMap.get(name) ?? [],
    }));
  });

  ipcMain.handle("styles:add", async (_event, name: string) => {
    const db = getDb();
    const parsed = parseStyleDefinition(name);
    if (!parsed.canonical) {
      return { ok: false };
    }
    const transaction = db.transaction(() => {
      db.prepare("insert or ignore into styles (name, normalized) values (?, ?)").run(
        parsed.canonical,
        parsed.canonical.toLowerCase(),
      );
      const existingAliases = db
        .prepare("select alias from style_aliases where style_name = ?")
        .all(parsed.canonical) as { alias: string }[];
      const aliases = mergeStyleAliases(
        existingAliases.map((row) => row.alias),
        parsed.aliases,
      );
      db.prepare("delete from style_aliases where style_name = ?").run(parsed.canonical);
      aliases.forEach((alias) => {
        db.prepare(
          `insert into style_aliases (style_name, alias, alias_normalized)
           values (?, ?, ?)
           on conflict(alias_normalized) do update set
             style_name = excluded.style_name,
             alias = excluded.alias`,
        ).run(parsed.canonical, alias, alias.toLowerCase());
      });
    });
    transaction();
    return { ok: true };
  });

  ipcMain.handle("styles:remove", async (_event, name: string) => {
    const db = getDb();
    const normalized = normalizeStyleName(name);
    if (!normalized) {
      return { ok: false };
    }
    db.prepare("delete from styles where normalized = ?").run(
      normalized.toLowerCase(),
    );
    db.prepare("delete from style_aliases where style_name = ?").run(normalized);
    db.prepare("update tracks set genre = null where genre = ?").run(normalized);
    db.prepare("delete from tanda_styles where style_name = ?").run(normalized);
    return { ok: true };
  });

  ipcMain.handle(
    "styles:replaceDefaults",
    async (
      _event,
      payload: { oldStyles: string[]; newStyles: string[] },
    ) => {
      const db = getDb();
      const oldStyles = payload.oldStyles ?? [];
      const newStyles = payload.newStyles ?? [];
      if (newStyles.length === 0) {
        return { ok: false };
      }
      const normalizedNew = newStyles
        .map((style) => normalizeStyleName(style))
        .filter(Boolean);
      if (normalizedNew.length === 0) {
        return { ok: false };
      }
      const normalizedOld = oldStyles
        .map((style) => normalizeStyleName(style))
        .filter(Boolean);
      const transactional = db.transaction(() => {
        normalizedOld.forEach((oldStyle, index) => {
          const newStyle = normalizedNew[index];
          if (!newStyle || oldStyle === newStyle) {
            return;
          }
          db.prepare("update tracks set genre = ? where genre = ?").run(
            newStyle,
            oldStyle,
          );
          db.prepare(
            "update tanda_styles set style_name = ? where style_name = ?",
          ).run(newStyle, oldStyle);
        });
        db.prepare("delete from styles").run();
        db.prepare("delete from style_aliases").run();
        normalizedNew.forEach((style) => {
          db.prepare(
            "insert or ignore into styles (name, normalized) values (?, ?)",
          ).run(style, style.toLowerCase());
        });
      });
      transactional();
      return { ok: true };
    },
  );

  ipcMain.handle(
    "tracks:jumpToPrefix",
    async (
      _event,
      params: { prefix: string; sortBy?: string; sortDir?: string },
    ) => {
      const db = getDb();
      const sortBy = normalizeSortColumn(params.sortBy);
      const sortDir = normalizeSortDirection(params.sortDir);
      const keySql = getSortKeySql(sortBy);
      const prefix = params.prefix.toUpperCase();
      let whereClause = "key like ?";
      let matchValue = `${prefix}%`;
      if (prefix === "0-9") {
        whereClause = "key glob '[0-9]*'";
      } else if (prefix === "#") {
        whereClause = "key glob '[^A-Z0-9]*'";
      }

      const row = db
        .prepare(
          `select offset from (
            select row_number() over (order by ${keySql} ${sortDir}, t.id ${sortDir}) - 1 as offset,
                   ${keySql} as key
            from tracks t
            join library_roots r on r.id = t.root_id
            where r.kind = 'music'
          ) where ${whereClause}
          limit 1`,
        )
        .get(prefix === "0-9" || prefix === "#" ? [] : [matchValue]) as
        | { offset: number }
        | undefined;

      return { offset: row?.offset ?? 0 };
    },
  );

  ipcMain.handle("tracks:getJumpIndex", async (_event, params: { sortBy?: string }) => {
    const db = getDb();
    const sortBy = normalizeSortColumn(params.sortBy);
    const keySql = getSortKeySql(sortBy);
    const prefixes = db
      .prepare(
        `select distinct substr(${keySql}, 1, 1) as prefix
         from tracks t
         join library_roots r on r.id = t.root_id
         where r.kind = 'music' and ${keySql} != ''`,
      )
      .all()
      .map((row) => (row as { prefix: string }).prefix);
    return buildJumpIndex(prefixes);
  });

  ipcMain.handle(
    "tracks:update",
    async (
      _event,
      payload: {
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
      },
    ) => {
      const db = getDb();
      const title = payload.title?.trim() ?? "";
      const artist = payload.artist?.trim() ?? "";
      const singer = payload.singer?.trim() ?? "";
      const album = payload.album?.trim() ?? "";
      const year = payload.year?.trim() ?? "";
      const genreRaw = payload.genre?.trim() ?? "";
      const genreNormalized = genreRaw ? normalizeStyleName(genreRaw) : "";
      const styleRow = genreNormalized
        ? (db
            .prepare(
              `select s.name as name
               from styles s
               where s.normalized = ?
               union all
               select sa.style_name as name
               from style_aliases sa
               where sa.alias_normalized = ?
               limit 1`,
            )
            .get(
              genreNormalized.toLowerCase(),
              genreNormalized.toLowerCase(),
            ) as { name: string } | undefined)
        : undefined;
      const genre = styleRow?.name ?? "";
      const bpm =
        payload.bpm !== null && payload.bpm !== undefined && Number.isFinite(payload.bpm)
          ? Math.max(0, payload.bpm)
          : null;
      const notes = payload.notes?.trim() ?? "";
      const artistSummary = artist ? summarizeArtistName(artist) : "";
      const updatedAt = new Date().toISOString();
      const instrumental =
        payload.instrumental === null || payload.instrumental === undefined
          ? null
          : payload.instrumental
            ? 1
            : 0;
      db.prepare(
        `update tracks
          set title = ?, artist = ?, artist_summary = ?, singer = ?, album = ?,
              year = ?, genre = ?, bpm = ?, notes = ?, instrumental = ?, updated_at = ?
          where id = ?`,
      ).run(
        title || null,
        artist || null,
        artistSummary || null,
        singer || null,
        album || null,
        year || null,
        genre || null,
        bpm,
        notes || null,
        instrumental,
        updatedAt,
        payload.id,
      );
      const row = db
        .prepare(
          `select id, full_path, relative_path, title, artist, artist_summary, singer, album,
            year, genre, bpm, notes, instrumental, duration_ms, start_offset_ms, end_trim_ms, analysis_json,
            loudness_db, gain_db, tag_error, analysis_error
           from tracks where id = ?`,
        )
        .get(payload.id);
      return row ? normalizeTrackRow(row) : null;
    },
  );

  ipcMain.handle("tracks:getWaveform", async (_event, trackId: string) => {
    const db = getDb();
    const row = db
      .prepare("select full_path from tracks where id = ?")
      .get(trackId) as { full_path?: string } | undefined;
    if (!row?.full_path) {
      return null;
    }
    const { waveformsDir: waveDir } = getDataPaths();
    const wavePath = path.join(waveDir, `${trackId}.png`);
    try {
      fs.mkdirSync(waveDir, { recursive: true });
      if (!hasUsableWaveformPng(wavePath)) {
        fs.rmSync(wavePath, { force: true });
        await renderWaveformPng(row.full_path, wavePath);
      }
      const data = fs.readFileSync(wavePath);
      return `data:image/png;base64,${data.toString("base64")}`;
    } catch {
      return null;
    }
  });

  ipcMain.handle("tracks:generateWaveform", async (_event, trackId: string) => {
    const db = getDb();
    const row = db
      .prepare("select full_path from tracks where id = ?")
      .get(trackId) as { full_path?: string } | undefined;
    if (!row?.full_path) {
      return { ok: false, error: "Track not found" };
    }
    const { waveformsDir: waveDir } = getDataPaths();
    const wavePath = path.join(waveDir, `${trackId}.png`);
    try {
      fs.mkdirSync(waveDir, { recursive: true });
      fs.rmSync(wavePath, { force: true });
      await renderWaveformPng(row.full_path, wavePath);
      return { ok: true, path: wavePath };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Waveform failed",
      };
    }
  });

  ipcMain.handle(
    "audio:getCompressedTrackPath",
    async (
      _event,
      params: {
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
      },
    ) => {
      try {
        if (!params?.filePath || !fs.existsSync(params.filePath)) {
          return { ok: false, error: "Track file not found" };
        }
        const stat = fs.statSync(params.filePath);
        const outputPath = getCompressedCacheOutputPath(params.filePath, stat, params);
        if (hasUsableCompressedRender(outputPath)) {
          return { ok: true, filePath: outputPath, cached: true };
        }
        return { ok: true, filePath: undefined, cached: false };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Compression cache lookup failed",
        };
      }
    },
  );

  ipcMain.handle(
    "audio:renderCompressedTrack",
    async (
      _event,
      params: {
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
      },
    ) => {
      try {
        if (!params?.filePath || !fs.existsSync(params.filePath)) {
          return { ok: false, error: "Track file not found" };
        }
        const stat = fs.statSync(params.filePath);
        const cacheKey = buildCompressedCacheKey(params.filePath, stat, params);
        const cacheDir = getCompressedCacheDir();
        const outputPath = getCompressedCacheOutputPath(params.filePath, stat, params);
        fs.mkdirSync(cacheDir, { recursive: true });
        if (hasUsableCompressedRender(outputPath)) {
          return { ok: true, filePath: outputPath, cached: true };
        }
        fs.rmSync(outputPath, { force: true });
        const existing = compressedRenderInFlight.get(cacheKey);
        if (existing) {
          const filePath = await existing;
          return { ok: true, filePath, cached: true };
        }
        const renderPromise = (async () => {
          await runWithCompressedRenderSlot(async () => {
            await renderCompressedAudio(params.filePath, outputPath, params);
          });
          return outputPath;
        })();
        compressedRenderInFlight.set(cacheKey, renderPromise);
        const filePath = await renderPromise;
        return { ok: true, filePath, cached: false };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Compression render failed",
        };
      } finally {
        if (params?.filePath && fs.existsSync(params.filePath)) {
          try {
            const stat = fs.statSync(params.filePath);
            const cacheKey = buildCompressedCacheKey(params.filePath, stat, params);
            compressedRenderInFlight.delete(cacheKey);
          } catch {
            // Ignore cleanup errors.
          }
        }
      }
    },
  );

  ipcMain.handle(
    "audio:precomputeCompressedTracks",
    async (event, params: CompressionRenderConfig) => {
      try {
        const result = await precomputeCompressedTracksWithProgress(event.sender, params);
        return { ok: true, ...result };
      } catch (error) {
        event.sender.send("audio:precomputeProgress", {
          current: 0,
          total: 0,
          rendered: 0,
          cached: 0,
          failed: 0,
          currentFile: null,
          latestError: null,
          done: true,
        });
        return {
          ok: false,
          rendered: 0,
          cached: 0,
          failed: 0,
          eligible: 0,
          ready: 0,
          missing: 0,
          invalidSource: 0,
          missingTracks: [],
          errors: [],
          error: error instanceof Error ? error.message : "Precompute failed",
        };
      }
    },
  );

  ipcMain.handle("diagnostics:getPaths", () => {
    return getDiagnosticsPaths(
      getDataPaths,
      getResolvedFfmpegInfo(),
      getResolvedFfprobeInfo(),
      getCustomFfmpegToolsDir(),
    );
  });

  ipcMain.handle("diagnostics:verifyCaches", async () => {
    return verifyCachedFiles(getDb(), getDataPaths);
  });

  ipcMain.handle(
    "diagnostics:getLogs",
    async (
      _event,
      params: { kind: "playback" | "renderer"; limit?: number },
    ) => {
      const kind = params?.kind === "renderer" ? "renderer" : "playback";
      const logName =
        kind === "renderer" ? RENDERER_ERROR_LOG : PLAYBACK_DIAGNOSTIC_LOG;
      return readLogTail(getDataPaths, logName, params?.limit ?? 200);
    },
  );

  ipcMain.handle("diagnostics:clearLogs", async () => {
    clearDiagnosticsLogs(getDataPaths);
    return { ok: true };
  });

  ipcMain.handle("diagnostics:getDataReadiness", async () => {
    return getDiagnosticsDataReadiness(getDb(), getDataPaths);
  });

  ipcMain.handle(
    "backgrounds:list",
    async (
      _event,
      group: "images" | "cortina_images" = "images",
    ): Promise<string[]> => {
    const db = getDb();
    const roots = db
      .prepare("select path from library_roots where kind = 'background'")
      .all() as { path: string }[];
    const imageFiles: string[] = [];
    for (const root of roots) {
      if (!root.path || !fs.existsSync(root.path)) {
        continue;
      }
      try {
        const groupPath = path.join(root.path, group);
        if (!fs.existsSync(groupPath)) {
          continue;
        }
        imageFiles.push(...(await walkImageFiles(groupPath)));
      } catch {
        // Continue with other roots when one path is not readable.
      }
    }
    const uniqueFiles = Array.from(new Set(imageFiles));
    return uniqueFiles.map((filePath) => toDataUrl(filePath));
    },
  );

  ipcMain.handle("display:open", async () => {
    const window = ensureDisplayWindow();
    if (!window.isVisible()) {
      window.show();
    }
    window.focus();
    return { ok: true };
  });

  ipcMain.handle("display:status", async () => ({
    open: Boolean(displayWindow && !displayWindow.isDestroyed() && displayWindow.isVisible()),
    lastPayload: lastDisplayPayload ?? null,
  }));

  ipcMain.handle("display:update", async (_event, payload: DisplayUpdatePayload) => {
    lastDisplayPayload = payload ?? {};
    if (!displayWindow || displayWindow.isDestroyed()) {
      return;
    }
    displayWindow.webContents.send("display:update", lastDisplayPayload);
  });

  ipcMain.handle("tracks:getByIds", async (_event, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    const db = getDb();
    const placeholders = ids.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `select id, full_path, relative_path, title, artist, artist_summary, singer,
                album, year, genre, bpm, notes, instrumental, duration_ms,
                start_offset_ms, end_trim_ms, analysis_json, loudness_db,
                gain_db, tag_error, analysis_error
         from tracks where id in (${placeholders})`,
      )
      .all(...ids);
    return normalizeTrackRows(rows);
  });

  ipcMain.handle(
    "tracks:listRecent",
    async (_event, limit: number): Promise<string[]> => {
      const db = getDb();
      const safeLimit =
        Number.isFinite(limit) && limit > 0 ? Math.min(500, Math.floor(limit)) : 0;
      if (safeLimit <= 0) {
        return [];
      }
      const rows = db
        .prepare(
          `select t.id
           from tracks t
           join library_roots r on r.id = t.root_id
           where r.kind = 'music'
           order by t.created_at desc
           limit ?`,
        )
        .all(safeLimit) as { id: string }[];
      return rows.map((row) => row.id);
    },
  );

  ipcMain.handle(
    "tandas:list",
    async () => {
      const db = getDb();
      return listTandas(db);
    },
  );

  ipcMain.handle(
    "tandas:listRecent",
    async (_event, limit: number): Promise<string[]> => {
      const db = getDb();
      const safeLimit =
        Number.isFinite(limit) && limit > 0 ? Math.min(200, Math.floor(limit)) : 0;
      if (safeLimit <= 0) {
        return [];
      }
      return listRecentTandaIds(db, safeLimit);
    },
  );

  ipcMain.handle("tandas:getByIds", async (_event, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    const db = getDb();
    return getTandasByIds(db, ids);
  });

  ipcMain.handle(
    "tandas:save",
    async (
      _event,
      payload: {
        id: string;
        name: string;
        styles: string[];
        rating: number;
        instrumental: boolean;
        total_duration_ms: number;
        track_slots: (string | null)[];
      },
    ) => {
      const db = getDb();
      return saveTanda(db, payload);
    },
  );

  ipcMain.handle("tandas:delete", async (_event, id: string) => {
    const db = getDb();
    deleteTanda(db, id);
    return { ok: true };
  });

  ipcMain.handle(
    "tandas:search",
    async (
      _event,
      params: { query: string; styles: string[] },
    ) => {
      const db = getDb();
      return searchTandas(db, {
        query: params.query ?? "",
        styles: params.styles ?? [],
      });
    },
  );

  ipcMain.handle("stats:getSearchDiversity", async () => {
    const db = getDb();
    return computeSearchDiversityStats(db);
  });

  ipcMain.handle("app:resetDatabase", async () => {
    resetDb();
    legacyOverridesByRootId = new Map();
    clearDiagnosticsArtifacts();
    return { ok: true };
  });

  ipcMain.handle("app:clearCachedFiles", async () => {
    clearCachedArtifacts();
    return { ok: true };
  });

  ipcMain.handle("e2e:seedData", async (_event, payload: E2ESeedPayload) => {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("e2e seeding is only available in test mode");
    }
    const db = getDb();
    const now = new Date().toISOString();
    const runSeed = db.transaction((seed: E2ESeedPayload) => {
      db.exec(`
        delete from playlist_items;
        delete from playlists;
        delete from tanda_styles;
        delete from tanda_tracks;
        delete from tandas;
        delete from tracks;
        delete from styles;
        delete from library_roots;
      `);

      const insertRoot = db.prepare(`
        insert into library_roots (id, kind, path, label, created_at)
        values (?, ?, ?, ?, ?)
      `);
      insertRoot.run("root-music", "music", seed.roots.musicRoot, "music", now);
      insertRoot.run("root-cortina", "cortina", seed.roots.cortinaRoot, "cortinas", now);
      insertRoot.run("root-background", "background", seed.roots.backgroundRoot, "backgrounds", now);

      const insertStyle = db.prepare("insert into styles (name, normalized) values (?, ?)");
      seed.styles.forEach((styleName) => {
        insertStyle.run(styleName, normalizeStyleName(styleName));
      });

      const insertTrack = db.prepare(`
        insert into tracks (
          id, root_id, relative_path, full_path, file_hash, file_size, file_mtime_ms,
          title, artist, artist_summary, album, album_artist, singer, year, genre, bpm,
          notes, instrumental, duration_ms, start_offset_ms, end_trim_ms, loudness_db,
          gain_db, tag_error, analysis_error, tag_json, analysis_json, created_at, updated_at, last_scanned_at
        ) values (
          @id, @root_id, @relative_path, @full_path, @file_hash, @file_size, @file_mtime_ms,
          @title, @artist, @artist_summary, @album, @album_artist, @singer, @year, @genre, @bpm,
          @notes, @instrumental, @duration_ms, 0, 0, -14.5, -1.5, '', '', '{}', '{}', @created_at, @updated_at, @last_scanned_at
        )
      `);
      seed.tracks.forEach((track) => {
        insertTrack.run({
          ...track,
          created_at: now,
          updated_at: now,
          last_scanned_at: now,
        });
      });

      const insertTanda = db.prepare(`
        insert into tandas (
          id, name, rating, instrumental, total_duration_ms, slot_count, invalid, updated_at
        ) values (?, ?, ?, ?, ?, ?, 0, ?)
      `);
      const insertTandaTrack = db.prepare(
        "insert into tanda_tracks (tanda_id, track_id, position) values (?, ?, ?)",
      );
      const insertTandaStyle = db.prepare(
        "insert into tanda_styles (tanda_id, style_name) values (?, ?)",
      );
      seed.tandas.forEach((tanda) => {
        insertTanda.run(
          tanda.id,
          tanda.name,
          tanda.rating,
          tanda.instrumental,
          tanda.tracks.length * 180000,
          tanda.tracks.length,
          now,
        );
        tanda.tracks.forEach((trackId, index) => {
          insertTandaTrack.run(tanda.id, trackId, index);
        });
        insertTandaStyle.run(tanda.id, tanda.style);
      });
    });
    runSeed(payload);
    return { ok: true };
  });

  ipcMain.handle(
    "app:logClientError",
    async (_event, params: { message: string; stack?: string }) => {
      appendLogEntry(getDataPaths, RENDERER_ERROR_LOG, [
        new Date().toISOString(),
        params.message,
        params.stack ?? "",
      ]);
    },
  );

  ipcMain.handle(
    "app:logPlaybackDiagnostic",
    async (
      _event,
      params: {
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
      },
    ) => {
      const payload = {
        at: new Date().toISOString(),
        channel: params.channel,
        mode: params.mode,
        playlistStatus: params.playlistStatus,
        playlistIndex: params.playlistIndex,
        trackIndex: params.trackIndex,
        trackId: params.trackId,
        title: params.title,
        artist: params.artist,
        gainSource: params.gainSource,
        gainDb: params.gainDb,
        loudnessDb: params.loudnessDb,
        linearGain: params.linearGain,
        correctionDb: params.correctionDb ?? 0,
        driftDb: params.driftDb ?? 0,
        targetLoudnessDb: params.targetLoudnessDb ?? null,
        expectedOutputLoudnessDb: params.expectedOutputLoudnessDb ?? null,
        requestedOutputDeviceId: params.requestedOutputDeviceId ?? null,
        appliedOutputDeviceId: params.appliedOutputDeviceId ?? null,
        outputRouteMethod: params.outputRouteMethod ?? "none",
        outputRouteError: params.outputRouteError ?? null,
        attemptedOutputDeviceIds: params.attemptedOutputDeviceIds ?? [],
      };
      appendLogEntry(getDataPaths, PLAYBACK_DIAGNOSTIC_LOG, [JSON.stringify(payload)]);
    },
  );
};

const configureSessionPermissions = () => {
  const defaultSession = session.defaultSession;
  if (!defaultSession) {
    return;
  }
  const allowPermission = (permission: string) =>
    permission === "speaker-selection" ||
    permission === "media" ||
    permission === "audioCapture";
  defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (allowPermission(permission)) {
      return true;
    }
    return true;
  });
  defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (allowPermission(permission)) {
        callback(true);
        return;
      }
      callback(false);
    },
  );
};

app.whenReady().then(() => {
  try {
    initDb();
    loadLegacyOverrides();
    loadFfmpegToolsDir();
  } catch (error) {
    dialog.showErrorBox(
      "Database Error",
      error instanceof Error ? error.message : "Failed to initialize database.",
    );
    app.quit();
    return;
  }
  configureSessionPermissions();
  registerIpc();
  createWindow();
});

app.on("activate", () => {
  if (!mainAppWindow || mainAppWindow.isDestroyed()) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
