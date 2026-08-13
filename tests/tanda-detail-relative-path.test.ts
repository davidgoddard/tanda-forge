import { describe, expect, it } from "vitest";
import { getTandasByIds } from "../app/src/main/library/tandas";

describe("tanda detail loading", () => {
  it("preserves track relative_path for renderer consumers", () => {
    const db = {
      prepare: (sql: string) => {
        if (sql.includes("from tandas") && sql.includes("where id = ?")) {
          return {
            get: () => ({
              id: "t1",
              name: "Test Tanda",
              rating: 4,
              instrumental: 0,
              total_duration_ms: 123000,
              slot_count: 3,
            }),
          };
        }
        if (sql.includes("from tanda_styles where tanda_id = ?")) {
          return { all: () => [{ style_name: "Tango" }] };
        }
        if (sql.includes("from tanda_tracks tt")) {
          return {
            all: () => [
              {
                track_id: "track-a",
                position: 0,
                title: "Song A",
                artist: "Artist A",
                artist_summary: "Artist A",
                album: "Album A",
                singer: "Singer A",
                genre: "Tango",
                year: "1941",
                bpm: 64,
                notes: "Notes A",
                full_path: "/music/Tango/song-a.mp3",
                relative_path: "Tango/song-a.mp3",
                instrumental: 0,
                duration_ms: 123000,
                start_offset_ms: 0,
                end_trim_ms: 0,
                loudness_db: -14,
                gain_db: 0,
              },
            ],
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    };

    const tandas = getTandasByIds(db as never, ["t1"]);
    expect(tandas).toHaveLength(1);
    expect(tandas[0]?.tracks[0]?.relative_path).toBe("Tango/song-a.mp3");
  });
});
