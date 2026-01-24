import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "fs";
import os from "os";
import { randomUUID } from "crypto";
import path from "path";
import { initDb, getDb, resetDb } from "./db";
import { scanLibraryRoots } from "./library/scan";
import type { LibraryRoot } from "./library/scan";
import { renderWaveformPng } from "./library/analysis";
import {
  buildJumpIndex,
  getSortKeySql,
  getSortSql,
  normalizeSortColumn,
  normalizeSortDirection,
} from "./library/query";
import { buildSearchWhere } from "./library/search";
import { normalizeStyleName, summarizeArtistName } from "../shared/tanda-utils";
import {
  deleteTanda,
  listTandas,
  saveTanda,
  searchTandas,
} from "./library/tandas";

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
};

const registerIpc = () => {
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
      const summary = await scanLibraryRoots(roots, (progress) => {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send("library:scanProgress", progress);
        });
      });
      const completedAt = new Date().toISOString();
      db.prepare(
        "update library_roots set last_scan_completed_at = ?",
      ).run(completedAt);
      return summary;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Scan failed.";
      db.prepare(
        "update library_roots set last_scan_error = ?",
      ).run(message);
      throw error;
    }
  });

  ipcMain.handle("library:listTracks", async () => {
    const db = getDb();
    return db
      .prepare(
        `select id, full_path, relative_path, title, artist, artist_summary, album, album_artist,
          year, genre, bpm, duration_ms, start_offset_ms, end_trim_ms, analysis_json,
          tag_error, analysis_error
         from tracks
         order by artist, title`,
      )
      .all();
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
      return db
        .prepare(
          `select id, full_path, relative_path, title, artist, artist_summary, album, album_artist,
            year, genre, bpm, duration_ms, start_offset_ms, end_trim_ms, analysis_json,
            loudness_db, gain_db, tag_error, analysis_error
           from tracks
           order by ${sortSql} ${sortDir}${extraSort}, id ${sortDir}
           limit ? offset ?`,
        )
        .all(limit, offset);
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
      },
    ) => {
      const db = getDb();
      const query = params.query?.trim() ?? "";
      const limit = Math.min(500, Math.max(1, params.limit ?? 200));
      const offset = Math.max(0, params.offset ?? 0);
      const sortBy = normalizeSortColumn(params.sortBy);
      const sortDir = normalizeSortDirection(params.sortDir);
      const { whereSql, values } = buildSearchWhere({
        query,
        styles: params.styles ?? [],
      });
      const sortSql = getSortSql(sortBy);

      const extraSort =
        sortBy === "artist" ? `, artist ${sortDir}` : "";
      return db
        .prepare(
          `select id, full_path, relative_path, title, artist, artist_summary, album, album_artist,
            year, genre, bpm, duration_ms, start_offset_ms, end_trim_ms, analysis_json,
            loudness_db, gain_db, tag_error, analysis_error
           from tracks
           ${whereSql}
           order by ${sortSql} ${sortDir}${extraSort}, id ${sortDir}
           limit ? offset ?`,
        )
        .all(...values, limit, offset);
    },
  );

  ipcMain.handle(
    "tracks:searchCount",
    async (_event, params: { query: string; styles: string[] }) => {
      const db = getDb();
      const { whereSql, values } = buildSearchWhere({
        query: params.query ?? "",
        styles: params.styles ?? [],
      });
      const row = db
        .prepare(`select count(*) as count from tracks ${whereSql}`)
        .get(...values) as { count: number };
      return row.count;
    },
  );

  ipcMain.handle(
    "tracks:searchJumpIndex",
    async (
      _event,
      params: { query: string; styles: string[]; sortBy?: string },
    ) => {
      const db = getDb();
      const sortBy = normalizeSortColumn(params.sortBy);
      const keySql = getSortKeySql(sortBy);
      const { whereSql, values } = buildSearchWhere({
        query: params.query ?? "",
        styles: params.styles ?? [],
      });
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
      },
    ) => {
      const db = getDb();
      const sortBy = normalizeSortColumn(params.sortBy);
      const sortDir = normalizeSortDirection(params.sortDir);
      const keySql = getSortKeySql(sortBy);
      const prefix = params.prefix.toUpperCase();
      const { whereSql, values } = buildSearchWhere({
        query: params.query ?? "",
        styles: params.styles ?? [],
      });
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
    return { ok: true };
  });

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
        album?: string | null;
        album_artist?: string | null;
        year?: string | null;
        genre?: string | null;
        bpm?: number | null;
      },
    ) => {
      const db = getDb();
      const title = payload.title?.trim() ?? "";
      const artist = payload.artist?.trim() ?? "";
      const album = payload.album?.trim() ?? "";
      const albumArtist = payload.album_artist?.trim() ?? "";
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
      const artistSummary = artist ? summarizeArtistName(artist) : "";
      const updatedAt = new Date().toISOString();
      db.prepare(
        `update tracks
          set title = ?, artist = ?, artist_summary = ?, album = ?, album_artist = ?,
              year = ?, genre = ?, bpm = ?, updated_at = ?
          where id = ?`,
      ).run(
        title || null,
        artist || null,
        artistSummary || null,
        album || null,
        albumArtist || null,
        year || null,
        genre || null,
        bpm,
        updatedAt,
        payload.id,
      );
      const row = db
        .prepare(
          `select id, full_path, relative_path, title, artist, artist_summary, album, album_artist,
            year, genre, bpm, duration_ms, start_offset_ms, end_trim_ms, analysis_json,
            loudness_db, gain_db, tag_error, analysis_error
           from tracks where id = ?`,
        )
        .get(payload.id);
      return row ?? null;
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
    const waveDir = path.join(app.getPath("userData"), "waveforms");
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

  ipcMain.handle(
    "tandas:list",
    async () => {
      const db = getDb();
      return listTandas(db);
    },
  );

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
    return { ok: true };
  });

  ipcMain.handle("app:close", async () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.close();
    } else {
      app.quit();
    }
  });

  ipcMain.handle(
    "app:logClientError",
    async (_event, params: { message: string; stack?: string }) => {
      const logDir = app.getPath("userData");
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});
