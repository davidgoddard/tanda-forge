import { describe, expect, it } from "vitest";
import {
  filterAndScoreTracks,
  normalizeSearchQuery,
  scoreTrackAgainstQuery,
} from "../app/src/main/library/fuzzy-search";
import type { TrackRow } from "../app/src/shared/types";

const buildTrack = (overrides: Partial<TrackRow>): TrackRow => ({
  id: "1",
  full_path: "/tmp/file.mp3",
  relative_path: "file.mp3",
  title: "",
  artist: "",
  artist_summary: "",
  singer: null,
  album: "",
  album_artist: "",
  year: "",
  genre: "",
  bpm: null,
  notes: "",
  duration_ms: 0,
  start_offset_ms: 0,
  end_trim_ms: 0,
  analysis_json: "",
  loudness_db: null,
  gain_db: null,
  tag_error: "",
  analysis_error: "",
  ...overrides,
});

describe("fuzzy search helpers", () => {
  it("normalizes text to ASCII lowercase tokens", () => {
    expect(normalizeSearchQuery("Ángel D'Árienzo"))
      .toBe("angel d arienzo");
  });

  it("scores year queries against year ranges", () => {
    const track = buildTrack({ year: "1931-1932" });
    const score = scoreTrackAgainstQuery("1932", track, 5);
    expect(score).toBeGreaterThan(0.5);
  });

  it("scores bpm queries within configured range", () => {
    const track = buildTrack({ bpm: 60 });
    const score = scoreTrackAgainstQuery("63", track, 5);
    expect(score).toBe(1);
    const outOfRange = scoreTrackAgainstQuery("70", track, 5);
    expect(outOfRange).toBe(0);
  });

  it("matches common misspellings via trigrams", () => {
    const track = buildTrack({ title: "La Cumparsita" });
    const result = filterAndScoreTracks([track], {
      query: "cumprasita",
      minScore: 0.2,
      bpmRange: 5,
    });
    expect(result.length).toBe(1);
    expect(result[0].score).toBeGreaterThan(0.2);
  });

  it("matches notes text in search", () => {
    const track = buildTrack({ notes: "Great for early milonga set" });
    const result = filterAndScoreTracks([track], {
      query: "milonga",
      minScore: 0.2,
      bpmRange: 5,
    });
    expect(result.length).toBe(1);
  });

  it("matches singer text in search", () => {
    const track = buildTrack({ singer: "Ada Falcon" });
    const result = filterAndScoreTracks([track], {
      query: "falcon",
      minScore: 0.2,
      bpmRange: 5,
    });
    expect(result.length).toBe(1);
  });

  it("prefers closer token matches when trigrams tie", () => {
    const francisco = buildTrack({ artist: "Francisco Canaro", title: "Test A" });
    const francini = buildTrack({ artist: "Francini - Pontier", title: "Test B" });
    const result = filterAndScoreTracks([francisco, francini], {
      query: "francico",
      minScore: 0,
      bpmRange: 5,
    });
    expect(result[0].track.artist).toBe("Francisco Canaro");
  });

  it("sorts by score before title when sortBy is score", () => {
    const closer = buildTrack({ artist: "Julio De Caro", title: "Todo Corazon" });
    const farther = buildTrack({ artist: "Random Artist", title: "A Song" });
    const result = filterAndScoreTracks([farther, closer], {
      query: "Julio De Caro Todo Corazon",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.artist).toBe("Julio De Caro");
  });
});
