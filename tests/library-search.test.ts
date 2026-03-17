import { describe, expect, it } from "vitest";
import {
  filterAndScoreTracks,
  normalizeSearchQuery,
  parseScopedSearchQuery,
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
  instrumental: false,
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

  it("prioritizes exact artist+title+year+bpm match over partial artist matches", () => {
    const exact = buildTrack({
      id: "exact",
      artist: "Enrique Alessio",
      singer: "Alberto Castillo",
      title: "Recuerdo",
      year: "1937",
      bpm: 62,
    });
    const partial = buildTrack({
      id: "partial",
      artist: "Enrique Alessio",
      singer: "Alberto Castillo",
      title: "Remolino",
      year: "2013",
      bpm: 88,
    });
    const result = filterAndScoreTracks([partial, exact], {
      query: "Enrique Alessio Alberto Castillo Recuerdo 1937 62",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("exact");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("prioritizes style/artist/singer/year/bpm over title-only matches", () => {
    const styleArtistMatch = buildTrack({
      id: "style-artist",
      genre: "Tango",
      artist: "Enrique Alessio",
      singer: "Alberto Castillo",
      year: "1937",
      bpm: 62,
      notes: "session favorite",
      title: "Remolino",
    });
    const titleOnly = buildTrack({
      id: "title-only",
      genre: "Tango",
      artist: "Another Artist",
      singer: "Another Singer",
      year: "2012",
      bpm: 91,
      notes: "different session",
      title: "Recuerdo",
    });
    const result = filterAndScoreTracks([titleOnly, styleArtistMatch], {
      query: "Tango Enrique Alessio Alberto Castillo 62 1937 session Recuerdo",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("style-artist");
  });

  it("uses lookup mode when query has only text and favors exact title matches", () => {
    const titleMatch = buildTrack({
      id: "title-match",
      title: "Misterio",
      artist: "Francisco Canaro",
    });
    const artistOnly = buildTrack({
      id: "artist-only",
      title: "Otra Cosa",
      artist: "Francisco Canaro",
    });
    const result = filterAndScoreTracks([artistOnly, titleMatch], {
      query: "mistero canaro",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("title-match");
  });

  it("prioritizes exact multi-token artist coverage over title and genre partials", () => {
    const artistExact = buildTrack({
      id: "artist-exact",
      artist: "Orquesta Color Tango",
      artist_summary: "Color Tango",
      title: "Emancipacion",
      genre: "Tango",
    });
    const titleExact = buildTrack({
      id: "title-exact",
      artist: "One Hundred Tandas",
      title: "Yunta de oro Color Tango",
      genre: "Tango",
    });
    const partial = buildTrack({
      id: "partial",
      artist: "Julio De Caro",
      title: "Color De Rosa",
      genre: "Tango",
    });
    const result = filterAndScoreTracks([partial, titleExact, artistExact], {
      query: "Color Tango",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("artist-exact");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("keeps exact artist token coverage above partial title matches with extra words", () => {
    const exactArtist = buildTrack({
      id: "exact-artist",
      title: "La mariposa",
      artist: "Color Tango",
    });
    const partialTitle = buildTrack({
      id: "partial-title",
      title: "Pasion Y Tango",
      artist: "Sexteto Mayor",
      album: "Tango Soho",
    });
    const result = filterAndScoreTracks([partialTitle, exactArtist], {
      query: "color tango",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("exact-artist");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("rewards full multi-token title coverage over partial title matches", () => {
    const exactTitle = buildTrack({
      id: "exact-title",
      title: "Nada Mas Corazon",
      artist: "Some Artist",
    });
    const partialTitle = buildTrack({
      id: "partial-title",
      title: "Nada de Ayer",
      artist: "Different Artist",
    });
    const result = filterAndScoreTracks([partialTitle, exactTitle], {
      query: "Nada Mas Corazon",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("exact-title");
  });

  it("does not let short article tokens overwhelm an exact title match", () => {
    const exactTitle = buildTrack({
      id: "exact-title",
      title: "A La Gran Muñeca",
      artist: "Carlos Di Sarli",
      genre: "Tango",
    });
    const unrelatedA = buildTrack({
      id: "unrelated-a",
      title: "Lullaby",
      artist: "Sigala & Paloma Faith",
      album: "Lullaby - Single",
    });
    const unrelatedLa = buildTrack({
      id: "unrelated-la",
      title: "Alexanderplatz Tango",
      artist: "Tanghetto",
      genre: "Tango",
    });
    const result = filterAndScoreTracks([unrelatedA, unrelatedLa, exactTitle], {
      query: "A La Gran Muñeca",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("exact-title");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("treats typed style words as normal text terms, not hidden style intent", () => {
    const textualMatch = buildTrack({
      id: "textual-match",
      title: "Yunta de oro",
      artist: "Color Tango",
      genre: "Milonga",
    });
    const genreOnly = buildTrack({
      id: "genre-only",
      title: "Color De Rosa",
      artist: "Julio De Caro",
      genre: "Tango",
    });
    const result = filterAndScoreTracks([genreOnly, textualMatch], {
      query: "color tango",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("textual-match");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("uses similarity mode when numeric tokens are present and favors close year/tempo", () => {
    const close = buildTrack({
      id: "close",
      artist: "Juan D'Arienzo",
      year: "1942",
      bpm: 65,
      genre: "Tango",
    });
    const far = buildTrack({
      id: "far",
      artist: "Juan D'Arienzo",
      year: "1958",
      bpm: 88,
      genre: "Tango",
    });
    const result = filterAndScoreTracks([far, close], {
      query: "darienzo 1942 65",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("close");
  });

  it("treats short orchestra-like text queries as similarity searches", () => {
    const close = buildTrack({
      id: "close",
      artist: "Francisco Canaro",
      title: "A",
      year: "1942",
      bpm: 65,
      genre: "Tango",
    });
    const far = buildTrack({
      id: "far",
      artist: "Francisco Canaro",
      title: "B",
      year: "1958",
      bpm: 88,
      genre: "Tango",
    });
    const result = filterAndScoreTracks([far, close], {
      query: "canaro 65",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("close");
  });

  it("boosts quoted title phrase matching in lookup queries", () => {
    const phrase = buildTrack({
      id: "phrase",
      title: "Recuerdo de Copas",
      artist: "Orquesta X",
      year: "1940",
      bpm: 64,
    });
    const artistOnly = buildTrack({
      id: "artist",
      title: "Otra",
      artist: "Orquesta X",
      year: "1940",
      bpm: 64,
    });
    const result = filterAndScoreTracks([artistOnly, phrase], {
      query: "\"recuerdo de copas\" orquesta x",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("phrase");
  });

  it("keeps plain two-token text queries in lookup mode and promotes notes matches", () => {
    const notesMatch = buildTrack({
      id: "notes-match",
      title: "Para Ti Madre",
      artist: "Osmar Maderna",
      notes: "Guitar modern",
    });
    const artistOnly = buildTrack({
      id: "artist-only",
      title: "Otra",
      artist: "Osmar Maderna",
      notes: "",
    });
    const result = filterAndScoreTracks([artistOnly, notesMatch], {
      query: "Guitar modern",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("notes-match");
  });

  it("boosts quoted notes phrases in lookup queries", () => {
    const notesPhrase = buildTrack({
      id: "notes-phrase",
      title: "Track A",
      artist: "Artist One",
      notes: "Guitar modern color in the intro",
    });
    const noPhrase = buildTrack({
      id: "no-phrase",
      title: "Track B",
      artist: "Artist One",
      notes: "Traditional arrangement",
    });
    const result = filterAndScoreTracks([noPhrase, notesPhrase], {
      query: "\"guitar modern\" artist",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("notes-phrase");
  });

  it("matches canonical orchestra query against alias-only artist metadata", () => {
    const canonicalQueryAliasTrack = buildTrack({
      id: "alias-track",
      artist: "Pacho",
      title: "Track A",
    });
    const unrelated = buildTrack({
      id: "other-track",
      artist: "Random Artist",
      title: "Track B",
    });
    const result = filterAndScoreTracks([unrelated, canonicalQueryAliasTrack], {
      query: "Juan Maglio",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("alias-track");
  });

  it("matches alias query against canonical orchestra artist metadata", () => {
    const canonicalTrack = buildTrack({
      id: "canonical-track",
      artist: "Juan Maglio",
      title: "Track A",
    });
    const unrelated = buildTrack({
      id: "other-track",
      artist: "Random Artist",
      title: "Track B",
    });
    const result = filterAndScoreTracks([unrelated, canonicalTrack], {
      query: "Pacho",
      minScore: 0,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result[0].track.id).toBe("canonical-track");
  });

  it("parses artist-scoped queries and normalizes the scoped part", () => {
    const parsed = parseScopedSearchQuery("artist: D'Aríenzo");
    expect(parsed.scope).toBe("artist");
    expect(normalizeSearchQuery("artist: D'Aríenzo")).toBe("d arienzo");
  });

  it("limits artist-scoped search to artist field (not title)", () => {
    const artistMatch = buildTrack({
      id: "artist-match",
      artist: "Juan D'Arienzo",
      title: "Random Title",
    });
    const titleOnly = buildTrack({
      id: "title-only",
      artist: "Different Orchestra",
      title: "Juan D'Arienzo Special",
    });
    const result = filterAndScoreTracks([titleOnly, artistMatch], {
      query: "artist: darienzo",
      minScore: 0.2,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result).toHaveLength(1);
    expect(result[0].track.id).toBe("artist-match");
  });

  it("matches alias-equivalent artists in artist-scoped search", () => {
    const aliasTrack = buildTrack({
      id: "alias-track",
      artist: "Pacho",
      title: "Track A",
    });
    const unrelated = buildTrack({
      id: "other-track",
      artist: "Random Artist",
      title: "Track B",
    });
    const result = filterAndScoreTracks([unrelated, aliasTrack], {
      query: "artist: Juan Maglio",
      minScore: 0.2,
      bpmRange: 5,
      sortBy: "score",
      sortDir: "desc",
    });
    expect(result).toHaveLength(1);
    expect(result[0].track.id).toBe("alias-track");
  });
});
