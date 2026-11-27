import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { filterAndSortCortinaTracks } from "../app/src/renderer/controllers/cortina-picker-controller";
import type { TrackRow } from "../app/src/shared/types";

const track = (id: string, title: string, artist: string): TrackRow => ({
  id,
  title,
  artist,
  full_path: `/music/${id}.mp3`,
  relative_path: `${id}.mp3`,
  artist_summary: "",
  singer: null,
  album: "",
  year: "",
  genre: "",
  bpm: null,
  notes: "",
  instrumental: null,
  duration_ms: 0,
  start_offset_ms: 0,
  end_trim_ms: 0,
  analysis_json: "",
  loudness_db: null,
  gain_db: null,
  tag_error: "",
  analysis_error: "",
});

describe("cortina picker", () => {
  it("wires each result headphone button to headphone playback", () => {
    const controller = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/src/renderer/controllers/cortina-picker-controller.ts",
      ),
      "utf8",
    );
    expect(controller).toContain('headphone.addEventListener("click"');
    expect(controller).toContain("await deps.actions.playHeadphone(track)");
    expect(controller).toContain("event.stopPropagation()");
  });

  it("filters title and artist case-insensitively and sorts by title then artist", () => {
    const tracks = [
      track("3", "Zeta", "Orquesta A"),
      track("2", "Alpha", "Orquesta B"),
      track("1", "Alpha", "Orquesta A"),
    ];

    expect(filterAndSortCortinaTracks(tracks, "orquesta").map(({ id }) => id))
      .toEqual(["1", "2", "3"]);
    expect(filterAndSortCortinaTracks(tracks, "ZET").map(({ id }) => id))
      .toEqual(["3"]);
  });
});
