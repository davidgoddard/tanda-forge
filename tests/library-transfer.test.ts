import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPlaylistExportFileName,
  buildTandasExportFileName,
  importPlaylistFile,
  serializePlaylistExportAsM3u,
} from "../app/src/main/library-transfer";
import {
  isValidPlaylistExportManifest,
  isValidTandasExportManifest,
  parseM3uRecords,
  parseM3uEntries,
  PLAYLIST_EXPORT_VERSION,
  TANDAS_EXPORT_VERSION,
  type PlaylistExportManifest,
} from "../app/src/shared/library-transfer";

describe("library transfer helpers", () => {
  it("parses m3u entries and ignores bom, comments, and blank lines", () => {
    expect(parseM3uEntries("\uFEFF#EXTM3U\n#EXTINF:123,Track\nmusic/song.mp3\n\nsecond.flac\n")).toEqual([
      "music/song.mp3",
      "second.flac",
    ]);
  });

  it("parses grouped m3u records with EXTINF and EXTGRP metadata", () => {
    expect(
      parseM3uRecords(
        '#EXTM3U\n#EXTGRP:Tanda One\n#EXTINF:-1 group-title="Tanda One",Track A\nmusic/a.mp3\n#EXTINF:-1,Loose Track\nmusic/b.mp3\n',
      ),
    ).toEqual([
      { location: "music/a.mp3", groupTitle: "Tanda One", displayTitle: "Track A" },
      { location: "music/b.mp3", groupTitle: "Tanda One", displayTitle: "Loose Track" },
    ]);
  });

  it("validates playlist export manifests", () => {
    expect(
      isValidPlaylistExportManifest({
        format: "tanda-forge-playlist",
        version: PLAYLIST_EXPORT_VERSION,
        createdAt: "2026-03-23T10:11:12.345Z",
        appVersion: "0.1.1",
        items: [
          {
            kind: "track",
            track: {
              fullPath: "/music/song.mp3",
              relativePath: "set/song.mp3",
              title: "Song",
              artist: "Artist",
            },
          },
        ],
      }),
    ).toBe(true);

    expect(
      isValidPlaylistExportManifest({
        format: "tanda-forge-playlist",
        version: PLAYLIST_EXPORT_VERSION,
        createdAt: "2026-03-23T10:11:12.345Z",
        appVersion: "0.1.1",
        items: [{ kind: "track", track: { relativePath: "missing.mp3" } }],
      }),
    ).toBe(false);
  });

  it("validates tandas export manifests", () => {
    expect(
      isValidTandasExportManifest({
        format: "tanda-forge-tandas",
        version: TANDAS_EXPORT_VERSION,
        createdAt: "2026-03-23T10:11:12.345Z",
        appVersion: "0.1.1",
        tandas: [
          {
            name: "Late Night",
            styles: ["Tango"],
            rating: 4,
            instrumental: false,
            trackRefs: [
              {
                fullPath: "/music/song.mp3",
                relativePath: "set/song.mp3",
                title: "Song",
                artist: "Artist",
              },
            ],
          },
        ],
      }),
    ).toBe(true);

    expect(
      isValidTandasExportManifest({
        format: "tanda-forge-tandas",
        version: TANDAS_EXPORT_VERSION,
        createdAt: "2026-03-23T10:11:12.345Z",
        appVersion: "0.1.1",
        tandas: [
          {
            name: "Broken",
            styles: ["Tango"],
            rating: "4",
            instrumental: false,
            trackRefs: [],
          },
        ],
      }),
    ).toBe(false);
  });

  it("builds stable export file names from timestamps", () => {
    expect(buildTandasExportFileName("2026-03-23T10:11:12.345Z")).toBe(
      "tanda-forge-tandas-2026-03-23t10-11-12-345z.json",
    );
    expect(buildPlaylistExportFileName("2026-03-23T10:11:12.345Z")).toBe(
      "tanda-forge-playlist-2026-03-23t10-11-12-345z.json",
    );
  });
});

describe("playlist file import", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  });

  const createFixture = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-transfer-"));
    tempDirs.push(tempDir);
    const libraryRoot = path.join(tempDir, "library");
    fs.mkdirSync(path.join(libraryRoot, "Tango"), { recursive: true });
    const absoluteTrack = path.join(libraryRoot, "Tango", "song-a.mp3");
    const rows = [
      {
        id: "track-a",
        full_path: absoluteTrack,
        relative_path: "Tango/song-a.mp3",
        title: "Song A",
        artist: "Artist A",
      },
    ];
    const db = {
      prepare: (sql: string) => ({
        all: () => {
          expect(sql).toContain("select id, full_path, relative_path, title, artist from tracks");
          return rows;
        },
      }),
    };
    return { db, tempDir, libraryRoot, absoluteTrack };
  };

  it("imports tanda forge playlist json by matching absolute paths", () => {
    const { db, tempDir, absoluteTrack } = createFixture();
    const manifest: PlaylistExportManifest = {
      format: "tanda-forge-playlist",
      version: PLAYLIST_EXPORT_VERSION,
      createdAt: "2026-03-23T10:11:12.345Z",
      appVersion: "0.1.1",
      items: [
        {
          kind: "track",
          track: {
            fullPath: absoluteTrack,
            relativePath: "Tango/song-a.mp3",
            title: "Song A",
            artist: "Artist A",
          },
        },
      ],
    };
    const jsonPath = path.join(tempDir, "playlist.json");
    fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2), "utf-8");

    expect(importPlaylistFile(db as never, jsonPath)).toEqual({
      format: "tanda-forge-playlist",
      state: {
        version: 2,
        items: [{ kind: "track", id: "track-a" }],
        cortinaAssignments: [],
      },
      warnings: [],
    });
  });

  it("imports m3u playlists and warns about missing or remote entries", () => {
    const { db, tempDir } = createFixture();
    const m3uPath = path.join(tempDir, "setlist.m3u");
    fs.writeFileSync(
      m3uPath,
      "#EXTM3U\nTango/song-a.mp3\nmissing/song-b.mp3\nhttps://example.com/live.mp3\n",
      "utf-8",
    );

    expect(importPlaylistFile(db as never, m3uPath)).toEqual({
      format: "m3u",
      state: {
        version: 2,
        items: [{ kind: "track", id: "track-a" }, null, null],
        cortinaAssignments: [],
      },
      warnings: [
        "Missing track: missing/song-b.mp3",
        "Unsupported remote entry: https://example.com/live.mp3",
      ],
    });
  });

  it("imports grouped m3u entries as tanda snapshots", () => {
    const { tempDir, absoluteTrack } = createFixture();
    const rows = [
      {
        id: "track-a",
        full_path: absoluteTrack,
        relative_path: "Tango/song-a.mp3",
        title: "Song A",
        artist: "Artist A",
      },
      {
        id: "track-b",
        full_path: path.join(tempDir, "library", "Tango", "song-b.mp3"),
        relative_path: "Tango/song-b.mp3",
        title: "Song B",
        artist: "Artist B",
      },
    ];
    const db = {
      prepare: () => ({
        all: () => rows,
      }),
    };
    const m3uPath = path.join(tempDir, "grouped.m3u");
    fs.writeFileSync(
      m3uPath,
      '#EXTM3U\n#EXTINF:-1 group-title="Late Tango",Artist A - Song A\nTango/song-a.mp3\n#EXTINF:-1 group-title="Late Tango",Artist B - Song B\nTango/song-b.mp3\n',
      "utf-8",
    );

    expect(importPlaylistFile(db as never, m3uPath)).toEqual({
      format: "m3u",
      state: {
        version: 2,
        items: [
          {
            kind: "tanda",
            id: "m3u-1-Late Tango",
            snapshot: {
              id: "m3u-1-Late Tango",
              name: "Late Tango",
              styles: [],
              rating: 0,
              trackSlots: ["track-a", "track-b"],
            },
          },
        ],
        cortinaAssignments: [],
      },
      warnings: [],
    });
  });

  it("imports tanda forge playlist json by matching a unique relative-path suffix", () => {
    const { tempDir } = createFixture();
    const rows = [
      {
        id: "track-a",
        full_path: path.join(tempDir, "library", "2026", "Tango", "song-a.mp3"),
        relative_path: "2026/Tango/song-a.mp3",
        title: "Song A",
        artist: "Artist A",
      },
    ];
    const db = {
      prepare: () => ({
        all: () => rows,
      }),
    };
    const manifest: PlaylistExportManifest = {
      format: "tanda-forge-playlist",
      version: PLAYLIST_EXPORT_VERSION,
      createdAt: "2026-03-23T10:11:12.345Z",
      appVersion: "0.1.1",
      items: [
        {
          kind: "track",
          track: {
            fullPath: "G:\\music\\Tango\\song-a.mp3",
            relativePath: "Tango/song-a.mp3",
            title: "Song A",
            artist: "Artist A",
          },
        },
      ],
    };
    const jsonPath = path.join(tempDir, "playlist-suffix.json");
    fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2), "utf-8");

    expect(importPlaylistFile(db as never, jsonPath)).toEqual({
      format: "tanda-forge-playlist",
      state: {
        version: 2,
        items: [{ kind: "track", id: "track-a" }],
        cortinaAssignments: [],
      },
      warnings: [],
    });
  });

  it("imports tanda forge playlist json by matching unique artist and title metadata", () => {
    const { tempDir } = createFixture();
    const rows = [
      {
        id: "track-a",
        full_path: path.join(tempDir, "library", "Elsewhere", "renamed-song-a.mp3"),
        relative_path: "Elsewhere/renamed-song-a.mp3",
        title: "Song A",
        artist: "Artist A",
      },
    ];
    const db = {
      prepare: () => ({
        all: () => rows,
      }),
    };
    const manifest: PlaylistExportManifest = {
      format: "tanda-forge-playlist",
      version: PLAYLIST_EXPORT_VERSION,
      createdAt: "2026-03-23T10:11:12.345Z",
      appVersion: "0.1.1",
      items: [
        {
          kind: "track",
          track: {
            fullPath: "G:\\music\\Tango\\song-a.mp3",
            relativePath: "Tango/song-a.mp3",
            title: "Song A",
            artist: "Artist A",
          },
        },
      ],
    };
    const jsonPath = path.join(tempDir, "playlist-metadata.json");
    fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2), "utf-8");

    expect(importPlaylistFile(db as never, jsonPath)).toEqual({
      format: "tanda-forge-playlist",
      state: {
        version: 2,
        items: [{ kind: "track", id: "track-a" }],
        cortinaAssignments: [],
      },
      warnings: [],
    });
  });

  it("serializes tanda playlist items to grouped m3u output", () => {
    const manifest: PlaylistExportManifest = {
      format: "tanda-forge-playlist",
      version: PLAYLIST_EXPORT_VERSION,
      createdAt: "2026-03-23T10:11:12.345Z",
      appVersion: "0.1.1",
      items: [
        {
          kind: "tanda",
          name: "Late Tango",
          styles: ["Tango"],
          rating: 0,
          instrumental: false,
          trackRefs: [
            {
              fullPath: "/music/Tango/song-a.mp3",
              relativePath: "Tango/song-a.mp3",
              title: "Song A",
              artist: "Artist A",
            },
            {
              fullPath: "/music/Tango/song-b.mp3",
              relativePath: "Tango/song-b.mp3",
              title: "Song B",
              artist: "Artist B",
            },
          ],
        },
      ],
    };

    expect(serializePlaylistExportAsM3u(manifest)).toContain('#EXTGRP:Late Tango');
    expect(serializePlaylistExportAsM3u(manifest)).toContain(
      '#EXTINF:-1 group-title="Late Tango",Artist A - Song A',
    );
    expect(serializePlaylistExportAsM3u(manifest)).toContain("Tango/song-b.mp3");
  });
});
