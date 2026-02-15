import { app, BrowserWindow, dialog, ipcMain, nativeImage } from "electron";

if (process.platform === "darwin" && process.arch === "x64") {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
}
import fs from "fs";
import os from "os";
import { randomUUID } from "crypto";
import path from "path";
import { initDb, getDb, resetDb, reopenDb } from "./db";
import { getDataPaths, getDataRoot, getDefaultDataPath, setDataRoot } from "./data-location";
import { scanLibraryRoots } from "./library/scan";
import type { LibraryRoot } from "./library/scan";
import {
  getResolvedFfmpegPath,
  getResolvedFfprobePath,
  renderWaveformPng,
} from "./library/analysis";
import {
  buildJumpIndex,
  getSortKeySql,
  getSortSql,
  normalizeSortColumn,
  normalizeSortDirection,
} from "./library/query";
import type { SortColumn } from "./library/query";
import {
  countFuzzyTracks,
  fetchSearchCandidates,
  fuzzySearchTracks,
} from "./library/search";
import type { CortinaTrackRow } from "../shared/types";
import { filterAndScoreTracks } from "./library/fuzzy-search";
import {
  DEFAULT_CORTINA_SET_ID,
  getCortinaSetName,
} from "../shared/cortina-utils";
import { normalizeStyleName, summarizeArtistName } from "../shared/tanda-utils";
import {
  deleteTanda,
  getTandasByIds,
  listTandas,
  saveTanda,
  searchTandas,
} from "./library/tandas";
import {
  detectLegacyFromRoots,
  detectLegacyRoot,
  importLegacyData,
  type LegacyTrackOverride,
} from "./legacy-import";

const buildStyleWhere = (styles: string[]) => {
  if (!styles || styles.length === 0) {
    return { whereSql: "", values: [] as unknown[] };
  }
  const placeholders = styles.map(() => "?").join(", ");
  return {
    whereSql: `where genre in (${placeholders})`,
    values: [...styles],
  };
};

let scanInProgress = false;
let legacyOverridesByRootId = new Map<string, Map<string, LegacyTrackOverride>>();
const closeStateByWebContentsId = new Map<
  number,
  { allowClose: boolean; closeRequested: boolean }
>();

const getSortKeyForTrack = (sortBy: string, track: { [key: string]: unknown }) => {
  if (sortBy === "artist") {
    const artistSummary = track.artist_summary as string | undefined;
    const artist = track.artist as string | undefined;
    return (artistSummary || artist || "").toUpperCase();
  }
  const value = track[sortBy] as string | number | undefined | null;
  return `${value ?? ""}`.toUpperCase();
};

const getPrefixForTrack = (sortBy: string, track: { [key: string]: unknown }) => {
  const key = getSortKeyForTrack(sortBy, track).trim();
  return key ? key.slice(0, 1) : "";
};

type SearchSortColumn = SortColumn | "score";

const matchesPrefix = (prefix: string, key: string) => {
  const upper = key.toUpperCase();
  if (!upper) {
    return false;
  }
  if (prefix === "0-9") {
    return /^[0-9]/.test(upper);
  }
  if (prefix === "#") {
    return /^[^A-Z0-9]/.test(upper);
  }
  return upper.startsWith(prefix);
};

const normalizeSearchConfig = (params: {
  minScore?: number;
  bpmRange?: number;
}) => {
  const minScore = Number.isFinite(params.minScore)
    ? Math.min(1, Math.max(0, params.minScore ?? 0))
    : 0.25;
  const bpmRange = Number.isFinite(params.bpmRange)
    ? Math.min(20, Math.max(0, params.bpmRange ?? 0))
    : 5;
  return { minScore, bpmRange };
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
    fullscreen: false,
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

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
  });
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

  ipcMain.handle("library:pickRoot", async (_event, kind: "music" | "cortina") => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: kind === "music" ? "Select Music Folder" : "Select Cortina Folder",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

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
    return { path: next };
  });

  ipcMain.handle(
    "library:addRoot",
    async (_event, kind: "music" | "cortina", rootPath: string) => {
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
    const result = importLegacyData(rootPath, roots);
    legacyOverridesByRootId = result.overridesByRootId;
    return {
      tandasImported: result.tandasImported,
      tracksUpdated: result.tracksUpdated,
      missingTracks: result.missingTracks,
      rootPath: result.rootPath,
    };
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
    const startedAt = new Date().toISOString();
    db.prepare(
      "update library_roots set last_scan_started_at = ?, last_scan_error = null",
    ).run(startedAt);

    try {
      const summary = await runScan(roots);
      const completedAt = new Date().toISOString();
      db.prepare(
        "update library_roots set last_scan_completed_at = ?",
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
        "update library_roots set last_scan_error = ?",
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
        `select id, full_path, relative_path, title, artist, artist_summary, singer, album,
          year, genre, bpm, notes, instrumental, duration_ms, start_offset_ms, end_trim_ms, analysis_json,
          tag_error, analysis_error
         from tracks
         order by artist, title`,
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
        sortBy === "artist" ? `, artist ${sortDir}` : "";
      const rows = db
        .prepare(
          `select id, full_path, relative_path, title, artist, artist_summary, singer, album,
            year, genre, bpm, notes, instrumental, duration_ms, start_offset_ms, end_trim_ms, analysis_json,
            loudness_db, gain_db, tag_error, analysis_error
           from tracks
           order by ${sortSql} ${sortDir}${extraSort}, id ${sortDir}
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
          sortBy === "artist" ? `, artist ${sortDir}` : "";
        const rows = db
          .prepare(
            `select id, full_path, relative_path, title, artist, artist_summary, singer, album,
              year, genre, bpm, notes, instrumental, duration_ms, start_offset_ms, end_trim_ms, analysis_json,
              loudness_db, gain_db, tag_error, analysis_error
             from tracks
             ${whereSql}
             order by ${sortSql} ${sortDir}${extraSort}, id ${sortDir}
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
          .prepare(`select count(*) as count from tracks ${whereSql}`)
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
      const filterSql = whereSql
        ? `${whereSql} and ${keySql} != ''`
        : `where ${keySql} != ''`;
      const prefixes = db
        .prepare(
          `select distinct substr(${keySql}, 1, 1) as prefix from tracks ${filterSql}`,
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
            select row_number() over (order by ${keySql} ${sortDir}, id ${sortDir}) - 1 as offset,
                   ${keySql} as key
            from tracks
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

  ipcMain.handle("styles:add", async (_event, name: string) => {
    const db = getDb();
    const normalized = normalizeStyleName(name);
    if (!normalized) {
      return { ok: false };
    }
    db.prepare("insert or ignore into styles (name, normalized) values (?, ?)").run(
      normalized,
      normalized.toLowerCase(),
    );
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
            select row_number() over (order by ${keySql} ${sortDir}, id ${sortDir}) - 1 as offset,
                   ${keySql} as key
            from tracks
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
      .prepare(`select distinct substr(${keySql}, 1, 1) as prefix from tracks where ${keySql} != ''`)
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
            .prepare("select name from styles where normalized = ?")
            .get(genreNormalized.toLowerCase()) as { name: string } | undefined)
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
      if (!fs.existsSync(wavePath)) {
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
      await renderWaveformPng(row.full_path, wavePath);
      return { ok: true, path: wavePath };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Waveform failed",
      };
    }
  });

  ipcMain.handle("diagnostics:getPaths", () => {
    const userData = getDataRoot();
    return {
      userData,
      waveformsDir: path.join(userData, "waveforms"),
      ffmpegPath: getResolvedFfmpegPath(),
      ffprobePath: getResolvedFfprobePath(),
    };
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

  ipcMain.handle("app:resetDatabase", async () => {
    const window = BrowserWindow.getFocusedWindow();
    const response = window
      ? await dialog.showMessageBox(window, {
          type: "warning",
          buttons: ["Cancel", "Erase Database"],
          defaultId: 0,
          cancelId: 0,
          title: "Erase Database",
          message:
            "This will permanently delete your library scan, tandas, playlists, and settings stored in this app.",
          detail:
            "You can re-import music folders afterward, but this action cannot be undone.",
        })
      : await dialog.showMessageBox({
        type: "warning",
        buttons: ["Cancel", "Erase Database"],
        defaultId: 0,
        cancelId: 0,
        title: "Erase Database",
        message:
          "This will permanently delete your library scan, tandas, playlists, and settings stored in this app.",
        detail:
          "You can re-import music folders afterward, but this action cannot be undone.",
      });

    if (response.response !== 1) {
      return { ok: false };
    }

    resetDb();
    legacyOverridesByRootId = new Map();
    return { ok: true };
  });

  ipcMain.handle(
    "app:logClientError",
    async (_event, params: { message: string; stack?: string }) => {
      const { logDir } = getDataPaths();
      const logPath = path.join(logDir, "renderer-errors.log");
      const entry = [
        new Date().toISOString(),
        params.message,
        params.stack ?? "",
      ].join(os.EOL);
      fs.appendFileSync(logPath, `${entry}${os.EOL}`);
    },
  );
};

app.whenReady().then(() => {
  try {
    initDb();
  } catch (error) {
    dialog.showErrorBox(
      "Database Error",
      error instanceof Error ? error.message : "Failed to initialize database.",
    );
    app.quit();
    return;
  }
  registerIpc();
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
