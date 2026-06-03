import { describe, expect, it } from "vitest";
import { getRootRemovalPreview, removeLibraryRoot } from "../app/src/main/library/root-removal";

type RootRow = {
  id: string;
  kind: "music" | "cortina" | "background";
  path: string;
  label: string;
};

type TrackRow = {
  id: string;
  root_id: string;
};

type TandaRow = {
  id: string;
  invalid: number;
};

type PlaylistRow = {
  id: string;
  invalid: number;
};

type TandaTrackRow = {
  tanda_id: string;
  track_id: string;
};

type PlaylistItemRow = {
  playlist_id: string;
  tanda_id: string;
};

type FakeState = {
  libraryRoots: RootRow[];
  tracks: TrackRow[];
  tandas: TandaRow[];
  playlists: PlaylistRow[];
  tandaTracks: TandaTrackRow[];
  playlistItems: PlaylistItemRow[];
};

const createFakeDb = (state: FakeState) =>
  ({
    prepare: (sql: string) => ({
      get: (...args: unknown[]) => {
        if (sql === "select id, kind, path, label from library_roots where id = ?") {
          return state.libraryRoots.find((root) => root.id === args[0]);
        }
        if (sql === "select count(*) as count from tracks where root_id = ?") {
          return { count: state.tracks.filter((track) => track.root_id === args[0]).length };
        }
        if (
          sql.includes("select count(distinct tt.tanda_id) as count") &&
          sql.includes("join tracks t on t.id = tt.track_id")
        ) {
          const trackIds = new Set(
            state.tracks.filter((track) => track.root_id === args[0]).map((track) => track.id),
          );
          return {
            count: new Set(
              state.tandaTracks
                .filter((row) => trackIds.has(row.track_id))
                .map((row) => row.tanda_id),
            ).size,
          };
        }
        if (
          sql.includes("select count(distinct pi.playlist_id) as count") &&
          sql.includes("join tracks t on t.id = tt.track_id")
        ) {
          const trackIds = new Set(
            state.tracks.filter((track) => track.root_id === args[0]).map((track) => track.id),
          );
          const tandaIds = new Set(
            state.tandaTracks
              .filter((row) => trackIds.has(row.track_id))
              .map((row) => row.tanda_id),
          );
          return {
            count: new Set(
              state.playlistItems
                .filter((row) => tandaIds.has(row.tanda_id))
                .map((row) => row.playlist_id),
            ).size,
          };
        }
        if (sql === "select count(*) as count from library_roots where id = ?") {
          return { count: state.libraryRoots.filter((root) => root.id === args[0]).length };
        }
        if (sql === "select invalid from tandas where id = ?") {
          return state.tandas.find((row) => row.id === args[0]);
        }
        if (sql === "select invalid from playlists where id = ?") {
          return state.playlists.find((row) => row.id === args[0]);
        }
        throw new Error(`Unexpected get SQL: ${sql}`);
      },
      all: () => {
        if (
          sql.includes("select distinct tanda_id as id") &&
          sql.includes("where track_id not in (select id from tracks)")
        ) {
          const trackIds = new Set(state.tracks.map((track) => track.id));
          return state.tandaTracks
            .filter((row) => !trackIds.has(row.track_id))
            .map((row) => ({ id: row.tanda_id }))
            .filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index);
        }
        throw new Error(`Unexpected all SQL: ${sql}`);
      },
      run: (...args: unknown[]) => {
        if (sql === "delete from tracks where root_id = ?") {
          state.tracks = state.tracks.filter((track) => track.root_id !== args[0]);
          return;
        }
        if (sql.startsWith("update tandas set invalid = 1 where id in (")) {
          const ids = new Set(args as string[]);
          state.tandas = state.tandas.map((row) =>
            ids.has(row.id) ? { ...row, invalid: 1 } : row,
          );
          return;
        }
        if (sql.includes("update playlists set invalid = 1")) {
          const tandaIds = new Set(args as string[]);
          const playlistIds = new Set(
            state.playlistItems
              .filter((row) => tandaIds.has(row.tanda_id))
              .map((row) => row.playlist_id),
          );
          state.playlists = state.playlists.map((row) =>
            playlistIds.has(row.id) ? { ...row, invalid: 1 } : row,
          );
          return;
        }
        if (sql === "delete from library_roots where id = ?") {
          state.libraryRoots = state.libraryRoots.filter((root) => root.id !== args[0]);
          return;
        }
        throw new Error(`Unexpected run SQL: ${sql}`);
      },
    }),
    transaction:
      <T>(fn: () => T) =>
      () =>
        fn(),
  }) as const;

describe("root removal", () => {
  it("previews impacted tracks, tandas, and playlists for a root", () => {
    const state: FakeState = {
      libraryRoots: [
        { id: "music-root", kind: "music", path: "/music", label: "Music" },
        { id: "other-root", kind: "music", path: "/other", label: "Other" },
      ],
      tracks: [
        { id: "track-a", root_id: "music-root" },
        { id: "track-b", root_id: "music-root" },
        { id: "track-c", root_id: "other-root" },
      ],
      tandas: [
        { id: "tanda-1", invalid: 0 },
        { id: "tanda-2", invalid: 0 },
      ],
      playlists: [{ id: "playlist-1", invalid: 0 }],
      tandaTracks: [
        { tanda_id: "tanda-1", track_id: "track-a" },
        { tanda_id: "tanda-1", track_id: "track-c" },
        { tanda_id: "tanda-2", track_id: "track-b" },
      ],
      playlistItems: [{ playlist_id: "playlist-1", tanda_id: "tanda-1" }],
    };

    expect(getRootRemovalPreview(createFakeDb(state) as never, "music-root")).toEqual({
      rootId: "music-root",
      kind: "music",
      path: "/music",
      label: "Music",
      trackCount: 2,
      tandaCount: 2,
      playlistCount: 1,
    });
  });

  it("removes root tracks and invalidates dependent tandas and playlists", () => {
    const state: FakeState = {
      libraryRoots: [
        { id: "music-root", kind: "music", path: "/music", label: "Music" },
        { id: "other-root", kind: "music", path: "/other", label: "Other" },
      ],
      tracks: [
        { id: "track-a", root_id: "music-root" },
        { id: "track-b", root_id: "other-root" },
      ],
      tandas: [
        { id: "tanda-invalidated", invalid: 0 },
        { id: "tanda-ok", invalid: 0 },
      ],
      playlists: [
        { id: "playlist-invalidated", invalid: 0 },
        { id: "playlist-ok", invalid: 0 },
      ],
      tandaTracks: [
        { tanda_id: "tanda-invalidated", track_id: "track-a" },
        { tanda_id: "tanda-ok", track_id: "track-b" },
      ],
      playlistItems: [
        { playlist_id: "playlist-invalidated", tanda_id: "tanda-invalidated" },
        { playlist_id: "playlist-ok", tanda_id: "tanda-ok" },
      ],
    };
    const db = createFakeDb(state);

    expect(removeLibraryRoot(db as never, "music-root")).toEqual({
      rootId: "music-root",
      kind: "music",
      path: "/music",
      label: "Music",
      trackCount: 1,
      tandaCount: 1,
      playlistCount: 1,
      removed: true,
    });

    expect(db.prepare("select count(*) as count from library_roots where id = ?").get("music-root")).toEqual({
      count: 0,
    });
    expect(db.prepare("select count(*) as count from tracks where root_id = ?").get("music-root")).toEqual({
      count: 0,
    });
    expect(db.prepare("select invalid from tandas where id = ?").get("tanda-invalidated")).toEqual({
      id: "tanda-invalidated",
      invalid: 1,
    });
    expect(db.prepare("select invalid from tandas where id = ?").get("tanda-ok")).toEqual({
      id: "tanda-ok",
      invalid: 0,
    });
    expect(
      db.prepare("select invalid from playlists where id = ?").get("playlist-invalidated"),
    ).toEqual({
      id: "playlist-invalidated",
      invalid: 1,
    });
    expect(db.prepare("select invalid from playlists where id = ?").get("playlist-ok")).toEqual({
      id: "playlist-ok",
      invalid: 0,
    });
  });
});
