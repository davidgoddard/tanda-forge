import fs from "fs";
import path from "path";
import type { E2ESeedPayload, E2ESeedTanda, E2ESeedTrack } from "../../../app/src/shared/types";

export type SeedKind = "empty" | "full";

export type SeedContext = {
  dataRoot: string;
  musicRoot: string;
  cortinaRoot: string;
  backgroundRoot: string;
  payload: E2ESeedPayload | null;
};

type SeedTrackFixture = {
  id: string;
  rootId: "root-music" | "root-cortina";
  relativePath: string;
  title: string;
  artist: string;
  album: string;
  singer?: string;
  year: string;
  genre: string;
  bpm: number;
  notes?: string;
  instrumental?: 0 | 1;
  durationMs?: number;
};

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const writeFile = (filePath: string) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, "");
};

const TRACK_FIXTURES: SeedTrackFixture[] = [
  {
    id: "t1",
    rootId: "root-music",
    relativePath: "tango/alberto-uno.mp3",
    title: "Alberto Gomez Tango Uno",
    artist: "Alberto Gomez",
    album: "Tango Seeds",
    year: "1938",
    genre: "Tango",
    bpm: 66,
    notes: "seed tango one",
    instrumental: 1,
  },
  {
    id: "t2",
    rootId: "root-music",
    relativePath: "tango/alberto-dos.mp3",
    title: "Alberto Gomez Tango Dos",
    artist: "Alberto Gomez",
    album: "Tango Seeds",
    year: "1939",
    genre: "Tango",
    bpm: 67,
    notes: "seed tango two",
    instrumental: 1,
  },
  {
    id: "t3",
    rootId: "root-music",
    relativePath: "milonga/milonga-prueba.mp3",
    title: "Milonga de Prueba",
    artist: "Carlos Di Sarli",
    album: "Milonga Seeds",
    year: "1940",
    genre: "Milonga",
    bpm: 72,
    notes: "seed milonga",
    instrumental: 0,
  },
  {
    id: "t4",
    rootId: "root-music",
    relativePath: "waltz/vals-prueba.mp3",
    title: "Vals de Prueba",
    artist: "Rodolfo Biagi",
    album: "Waltz Seeds",
    year: "1941",
    genre: "Waltz",
    bpm: 60,
    notes: "seed waltz",
    instrumental: 0,
  },
  {
    id: "t5",
    rootId: "root-music",
    relativePath: "tango/darienzo-busqueda.mp3",
    title: "Busqueda Artistica",
    artist: "Juan D'Arienzo",
    album: "Search Cases",
    year: "1941",
    genre: "Tango",
    bpm: 64,
    notes: "search similar",
    instrumental: 0,
  },
  {
    id: "t6",
    rootId: "root-music",
    relativePath: "milonga/milonga-rapida.mp3",
    title: "Milonga Rapida",
    artist: "Francisco Canaro",
    album: "Milonga Seeds",
    year: "1942",
    genre: "Milonga",
    bpm: 74,
    notes: "fast milonga",
    instrumental: 1,
  },
  {
    id: "t7",
    rootId: "root-music",
    relativePath: "milonga/milonga-lenta.mp3",
    title: "Milonga Lenta",
    artist: "Francisco Canaro",
    album: "Milonga Seeds",
    year: "1943",
    genre: "Milonga",
    bpm: 70,
    notes: "slow milonga",
    instrumental: 0,
  },
  {
    id: "t8",
    rootId: "root-music",
    relativePath: "waltz/waltz-needle.mp3",
    title: "Needle Waltz",
    artist: "Osvaldo Pugliese",
    album: "Waltz Seeds",
    year: "1943",
    genre: "Waltz",
    bpm: 62,
    notes: "needle waltz",
    instrumental: 1,
  },
  {
    id: "t9",
    rootId: "root-music",
    relativePath: "waltz/waltz-night.mp3",
    title: "Night Waltz",
    artist: "Osvaldo Pugliese",
    album: "Waltz Seeds",
    year: "1944",
    genre: "Waltz",
    bpm: 63,
    notes: "night waltz",
    instrumental: 0,
  },
  {
    id: "t10",
    rootId: "root-music",
    relativePath: "tango/notes-case.mp3",
    title: "Find Me By Notes",
    artist: "Anibal Troilo",
    album: "Search Cases",
    year: "1942",
    genre: "Tango",
    bpm: 65,
    notes: "rare violin phrase",
    instrumental: 0,
  },
  {
    id: "t11",
    rootId: "root-music",
    relativePath: "tango/year-case.mp3",
    title: "Year 1943 Test",
    artist: "Anibal Troilo",
    album: "Search Cases",
    year: "1943",
    genre: "Tango",
    bpm: 65,
    notes: "year specific",
    instrumental: 1,
  },
  {
    id: "t12",
    rootId: "root-music",
    relativePath: "tango/tempo-case.mp3",
    title: "Tempo 72 Test",
    artist: "Ricardo Tanturi",
    album: "Search Cases",
    year: "1942",
    genre: "Tango",
    bpm: 72,
    notes: "tempo specific",
    instrumental: 0,
  },
  {
    id: "t13",
    rootId: "root-music",
    relativePath: "milonga/canaro-milonga-uno.mp3",
    title: "Canaro Milonga Uno",
    artist: "Francisco Canaro",
    album: "Canaro Milonga E2E",
    year: "1937",
    genre: "Milonga",
    bpm: 70,
    notes: "canaro milonga uno",
    instrumental: 0,
  },
  {
    id: "t14",
    rootId: "root-music",
    relativePath: "milonga/canaro-milonga-dos.mp3",
    title: "Canaro Milonga Dos",
    artist: "Francisco Canaro",
    album: "Canaro Milonga E2E",
    year: "1938",
    genre: "Milonga",
    bpm: 71,
    notes: "canaro milonga dos",
    instrumental: 0,
  },
  {
    id: "t15",
    rootId: "root-music",
    relativePath: "milonga/canaro-milonga-tres.mp3",
    title: "Canaro Milonga Tres",
    artist: "Francisco Canaro",
    album: "Canaro Milonga E2E",
    year: "1939",
    genre: "Milonga",
    bpm: 72,
    notes: "canaro milonga tres",
    instrumental: 0,
  },
  {
    id: "t16",
    rootId: "root-music",
    relativePath: "tango/canaro-tango-uno.mp3",
    title: "Canaro Tango Uno",
    artist: "Francisco Canaro",
    album: "Canaro Tango E2E",
    year: "1940",
    genre: "Tango",
    bpm: 62,
    notes: "canaro tango uno",
    instrumental: 0,
  },
  {
    id: "t17",
    rootId: "root-music",
    relativePath: "tango/canaro-tango-dos.mp3",
    title: "Canaro Tango Dos",
    artist: "Francisco Canaro",
    album: "Canaro Tango E2E",
    year: "1941",
    genre: "Tango",
    bpm: 63,
    notes: "canaro tango dos",
    instrumental: 0,
  },
  {
    id: "t18",
    rootId: "root-music",
    relativePath: "tango/canaro-tango-tres.mp3",
    title: "Canaro Tango Tres",
    artist: "Francisco Canaro",
    album: "Canaro Tango E2E",
    year: "1942",
    genre: "Tango",
    bpm: 64,
    notes: "canaro tango tres",
    instrumental: 0,
  },
  {
    id: "c1",
    rootId: "root-cortina",
    relativePath: "default/cortina-only.mp3",
    title: "CORTINA ONLY TRACK",
    artist: "Cortina Artist",
    album: "Cortina Set",
    year: "1950",
    genre: "Cortina",
    bpm: 120,
    notes: "cortina only",
    instrumental: 1,
    durationMs: 60000,
  },
];

const TANDA_FIXTURES: E2ESeedTanda[] = [
  { id: "td1", name: "Tango Trio", rating: 4, instrumental: 0, tracks: ["t1", "t2", "t5"], style: "Tango" },
  { id: "td2", name: "Milonga Trio", rating: 3, instrumental: 0, tracks: ["t3", "t6", "t7"], style: "Milonga" },
  { id: "td3", name: "Waltz Trio", rating: 5, instrumental: 0, tracks: ["t4", "t8", "t9"], style: "Waltz" },
  { id: "td4", name: "Tango Four", rating: 2, instrumental: 0, tracks: ["t10", "t11", "t1", "t2"], style: "Tango" },
  { id: "td5", name: "Canaro Milonga Pack A", rating: 3, instrumental: 0, tracks: ["t13", "t14", "t15"], style: "Milonga" },
  { id: "td6", name: "Canaro Milonga Pack B", rating: 2, instrumental: 0, tracks: ["t6", "t13", "t14"], style: "Milonga" },
  { id: "td7", name: "Canaro Tango Pack", rating: 4, instrumental: 0, tracks: ["t16", "t17", "t18"], style: "Tango" },
];

const buildPayload = (
  musicRoot: string,
  cortinaRoot: string,
  backgroundRoot: string,
): E2ESeedPayload => {
  const tracks: E2ESeedTrack[] = TRACK_FIXTURES.map((track) => {
    const baseRoot = track.rootId === "root-cortina" ? cortinaRoot : musicRoot;
    const fullPath = path.join(baseRoot, track.relativePath);
    writeFile(fullPath);
    const stat = fs.statSync(fullPath);
    return {
      id: track.id,
      root_id: track.rootId,
      relative_path: track.relativePath,
      full_path: fullPath,
      file_hash: `hash-${track.id}`,
      file_size: stat.size,
      file_mtime_ms: stat.mtimeMs,
      title: track.title,
      artist: track.artist,
      artist_summary: track.artist,
      album: track.album,
      album_artist: track.artist,
      singer: track.singer ?? "",
      year: track.year,
      genre: track.genre,
      bpm: track.bpm,
      notes: track.notes ?? "",
      instrumental: track.instrumental ?? 0,
      duration_ms: track.durationMs ?? 180000,
    };
  });
  return {
    roots: {
      musicRoot,
      cortinaRoot,
      backgroundRoot,
    },
    styles: ["Tango", "Milonga", "Waltz"],
    tracks,
    tandas: TANDA_FIXTURES,
  };
};

export const seedDataRoot = (dataRoot: string, kind: SeedKind): SeedContext => {
  ensureDir(dataRoot);
  const musicRoot = path.join(dataRoot, "music");
  const cortinaRoot = path.join(dataRoot, "cortinas");
  const backgroundRoot = path.join(dataRoot, "backgrounds");
  ensureDir(musicRoot);
  ensureDir(cortinaRoot);
  ensureDir(backgroundRoot);

  return {
    dataRoot,
    musicRoot,
    cortinaRoot,
    backgroundRoot,
    payload: kind === "full" ? buildPayload(musicRoot, cortinaRoot, backgroundRoot) : null,
  };
};
