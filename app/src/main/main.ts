import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "fs";
import os from "os";
import { randomUUID } from "crypto";
import path from "path";
import { initDb, getDb, resetDb } from "./db";
import { scanLibraryRoots } from "./library/scan";
import type { LibraryRoot } from "./library/scan";
import {
  buildJumpIndex,
  getSortKeySql,
  getSortSql,
  normalizeSortColumn,
  normalizeSortDirection,
} from "./library/query";
import { buildSearchWhere } from "./library/search";

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true,
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
        `select id, full_path, relative_path, title, artist, album, album_artist,
          year, genre, duration_ms, start_offset_ms, end_trim_ms, analysis_json,
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
      return db
        .prepare(
          `select id, full_path, relative_path, title, artist, album, album_artist,
            year, genre, duration_ms, start_offset_ms, end_trim_ms, analysis_json,
            loudness_db, gain_db, tag_error, analysis_error
           from tracks
           order by ${sortSql} ${sortDir}, id ${sortDir}
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

      return db
        .prepare(
          `select id, full_path, relative_path, title, artist, album, album_artist,
            year, genre, duration_ms, start_offset_ms, end_trim_ms, analysis_json,
            loudness_db, gain_db, tag_error, analysis_error
           from tracks
           ${whereSql}
           order by ${sortSql} ${sortDir}, id ${sortDir}
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
    const rows = db
      .prepare(
        "select distinct genre from tracks where genre is not null and genre != '' order by genre",
      )
      .all() as { genre: string }[];
    return rows.map((row) => row.genre);
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
