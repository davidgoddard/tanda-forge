export type TrackDurationFields = {
  duration_ms: number;
  start_offset_ms: number;
  end_trim_ms: number;
  instrumental?: boolean | null;
};

const stripDiacritics = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const titleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) =>
      part
        .split("'")
        .map((segment) =>
          segment ? segment.slice(0, 1).toUpperCase() + segment.slice(1) : segment,
        )
        .join("'"),
    )
    .join(" ");

const artistNoise = [
  "ORQUESTA",
  "TIPICO",
  "TIPICA",
  "ORCHESTA",
  "ORCHESTRA",
  "ORCHESTRE",
  "ORUUESTA",
  "CUARTETO",
  "Y SU",
  "Y SUS",
  "SUS",
  "HIS",
  "GRAN",
  "ORQ.",
  "ORQ",
  "TIP.",
  "TIP",
  "INSTR.",
  "INSTR",
  "QUINTETO DEL A",
  "ENSEMBLE",
  "SEIN",
  "TANZORCHESTRA",
  "CUARTETO TIPICO DE",
  "CUARTETO VICTOR DE",
  "CUARTETO TIPICO",
  "CUARTETO VICTOR",
];

const artistSwaps = new Map<string, string>([
  ["A.AMOR", "ALBERTO AMOR"],
  ["A.ECHAGUE", "ALBERTO ECHAGUE"],
  ["A.MARINO", "ALBERTO MARINO"],
  ["A.MORAN", "ALBERTO MORAN"],
  ["A.PIAZZOLA", "ASTOR PIAZZOLA"],
  ["A.PODESTA", "ALBERTO PODESTA"],
  ["C.GARDEL", "CARLOS GARDEL"],
  ["C.SAAVEDRA", "CARLOS SAAVEDRA"],
  ["E.DONATO", "EDGARDO DONATO"],
  ["E.FAMA", "ERNESTO FAMA"],
  ["F.CANARO", "FRANCISCO CANARO"],
  ["F.FIORENTINO", "FRANCISCO FIORENTINO"],
  ["F.GUTIERREZ", "FELIX GUTIERREZ"],
  ["F.RUIZ", "FLOREAL RUIZ"],
  ["H.LAGOS", "HORACIO LAGOS"],
  ["H.MAURE", "HECTOR MAURE"],
  ["J.ARIENZO", "JUAN ARIENZO"],
  ["L.MORALES", "LITA MORALES"],
  ["M.BUSTOS", "MARIO BUSTOS"],
  ["M.CALO", "MIGUEL CALO"],
  ["N.OMAR", "NELLY OMAR"],
  ["O.PUGLIESE", "OSVALDO PUGLIESE"],
  ["O.RIBO", "OSVALDO RIBO"],
  ["P.CONTURSI", "PASCUAL CONTURSI"],
  ["Q.PIRINCHO", "QUINTETO PIRINCHO"],
  ["R.BERON", "RAUL BERON"],
  ["R.CHANEL", "ROBERTO CHANEL"],
  ["R.FIRPO", "ROBERTO FIRPO"],
  ["R.GAVIO", "ROMEO GAVIOLI"],
  ["R.MAIDA", "ROEBERTO MAIDA"],
  ["R.RUFINO", "ROBERTO RUFINO"],
  ["A. AMOR", "ALBERTO AMOR"],
  ["A. ECHAGUE", "ALBERTO ECHAGUE"],
  ["A. MARINO", "ALBERTO MARINO"],
  ["A. MORAN", "ALBERTO MORAN"],
  ["A. PIAZZOLA", "ASTOR PIAZZOLA"],
  ["A. PODESTA", "ALBERTO PODESTA"],
  ["C. GARDEL", "CARLOS GARDEL"],
  ["C. SAAVEDRA", "CARLOS SAAVEDRA"],
  ["E. DONATO", "EDGARDO DONATO"],
  ["E. FAMA", "ERNESTO FAMA"],
  ["F. CANARO", "FRANCISCO CANARO"],
  ["F. FIORENTINO", "FRANCISCO FIORENTINO"],
  ["F. GUTIERREZ", "FELIX GUTIERREZ"],
  ["F. RUIZ", "FLOREAL RUIZ"],
  ["H. LAGOS", "HORACIO LAGOS"],
  ["H. MAURE", "HECTOR MAURE"],
  ["J. ARIENZO", "JUAN ARIENZO"],
  ["L. MORALES", "LITA MORALES"],
  ["M. BUSTOS", "MARIO BUSTOS"],
  ["M. CALO", "MIGUEL CALO"],
  ["N. OMAR", "NELLY OMAR"],
  ["O. PUGLIESE", "OSVALDO PUGLIESE"],
  ["O. RIBO", "OSVALDO RIBO"],
  ["P. CONTURSI", "PASCUAL CONTURSI"],
  ["Q. PIRINCHO", "QUINTETO PIRINCHO"],
  ["R. BERON", "RAUL BERON"],
  ["R. CHANEL", "ROBERTO CHANEL"],
  ["R. FIRPO", "ROBERTO FIRPO"],
  ["R. GAVIO", "ROMEO GAVIOLI"],
  ["R. MAIDA", "ROEBERTO MAIDA"],
  ["R. RUFINO", "ROBERTO RUFINO"],
]);

const singerWordMarkerPattern =
  /\b(?:WITH|CON|CANTA:|CANTA|CANTAN|CANT|CANTOR(?:ES)?|SINGS?)\b/i;
const singerFeaturingMarkerPattern = /\b(?:FEATURING|FEAT|FT)\.?/i;
const singerMarkerTailPattern = /(?=$|[\s,;:/\\()[\]&+\-])/i;

const findSingerMarker = (input: string) => {
  const wordMatch = singerWordMarkerPattern.exec(input);
  const featuringMatch = singerFeaturingMarkerPattern.exec(input);
  const candidates = [wordMatch, featuringMatch]
    .filter((match): match is RegExpExecArray => Boolean(match && match.index !== undefined))
    .sort((a, b) => {
      const indexDelta = (a.index ?? 0) - (b.index ?? 0);
      if (indexDelta !== 0) {
        return indexDelta;
      }
      return b[0].length - a[0].length;
    });
  const match = candidates[0];
  if (!match || match.index === undefined) {
    return null;
  }
  const tail = input.slice(match.index + match[0].length);
  if (!singerMarkerTailPattern.test(tail)) {
    return null;
  }
  return match;
};

const artistSeparators =
  /(( +(FEAT(?:\.|URING)?|FT\.?|CANTOR|CANTA|CANTA:|CANTAN|CANTORES|AND|WITH|MEETS|MEET|CON|Y|&) +)|[>\(\)\-\:\;\~\_\+\/\\])/g;

const cleanArtistCandidate = (value: string) => {
  const trimmed = collapseWhitespace(value);
  if (!trimmed) {
    return "";
  }
  const swapped = artistSwaps.get(trimmed) ?? trimmed;
  return titleCase(swapped.toLowerCase());
};

const stripSingerSuffixForArtistSummary = (input: string) => {
  const raw = collapseWhitespace(input);
  if (!raw) {
    return "";
  }
  const normalized = stripDiacritics(raw).toUpperCase();
  const singerMarkerMatch = findSingerMarker(normalized);
  if (singerMarkerMatch && singerMarkerMatch.index !== undefined) {
    return raw.slice(0, singerMarkerMatch.index).trim().replace(/[,:;/\-\s]+$/, "");
  }
  const commaIndex = raw.indexOf(",");
  if (commaIndex > 0) {
    const leaderPart = raw.slice(0, commaIndex).trim();
    const tailPart = raw.slice(commaIndex + 1).trim();
    if (
      leaderPart.split(/\s+/).filter(Boolean).length > 1 &&
      /[\/&]/.test(tailPart)
    ) {
      return leaderPart;
    }
  }
  return raw;
};

export const extractArtistCandidates = (input: string) => {
  const raw = stripSingerSuffixForArtistSummary(input);
  if (!raw) {
    return [];
  }
  let work = stripDiacritics(raw).toUpperCase();
  work = work.replace(/,| ' /g, " , ");
  work = work.replace(/\./g, ". ");
  work = collapseWhitespace(work);
  work = ` ${work} `;
  artistNoise.forEach((token) => {
    const pattern = new RegExp(`\\s${token}\\s`, "g");
    work = work.replace(pattern, " ");
  });
  const bits = work.replace(artistSeparators, "|").split("|");
  const candidates: string[] = [];
  bits.forEach((bit) => {
    const value = bit.trim();
    if (value.length <= 1) {
      return;
    }
    if (value.includes(",")) {
      const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length === 2) {
        const swapped = `${parts[1]} ${parts[0]}`;
        const cleaned = cleanArtistCandidate(swapped);
        if (cleaned) {
          candidates.push(cleaned);
        }
        return;
      }
      parts.forEach((part) => {
        const cleaned = cleanArtistCandidate(part);
        if (cleaned) {
          candidates.push(cleaned);
        }
      });
      return;
    }
    const cleaned = cleanArtistCandidate(value);
    if (cleaned) {
      candidates.push(cleaned);
    }
  });
  const unique = Array.from(new Set(candidates));
  return unique;
};

export const summarizeArtistName = (input: string) => {
  const raw = stripSingerSuffixForArtistSummary(input);
  const candidates = extractArtistCandidates(raw);
  if (candidates.length > 0) {
    return candidates[0];
  }
  const cleaned = collapseWhitespace(stripDiacritics(raw));
  return cleaned ? titleCase(cleaned.toLowerCase()) : "";
};

export const normalizeArtistName = (input: string) => summarizeArtistName(input);

const extractSingerNameFromText = (input: string) => {
  const raw = collapseWhitespace(input);
  if (!raw) {
    return "";
  }
  const normalized = stripDiacritics(raw).toUpperCase();
  const match = findSingerMarker(normalized);
  if (!match || match.index === undefined) {
    return "";
  }
  const singerPart = raw.slice(match.index + match[0].length).trim();
  if (!singerPart) {
    return "";
  }
  const normalizedMarker = stripDiacritics(match[0]).toUpperCase();
  const normalizedSinger = stripDiacritics(singerPart).toUpperCase();
  const nonSingerTokens = [
    "ORCHESTRA",
    "ORCHESTA",
    "ORCHESTRE",
    "ORQUESTA",
    "ORQUESTA TIPICA",
    "ORQUESTA TIPICO",
    "ORQ",
    "ORQ.",
    "TIPICA",
    "TIPICO",
    "CUARTETO",
    "QUINTETO",
    "ENSEMBLE",
    "TANZORCHESTRA",
  ];
  const nonSingerPhrases = [
    "HIS ORCHESTRA",
    "SU ORQUESTA",
    "Y SU ORQUESTA",
    "Y SU ORQUESTA TIPICA",
  ];
  const genericVocalCreditPattern =
    /^(?:CANTO|CANTO Y ESTRIBILLO|ESTRIBILLO|VOCAL(?:ES)?|VOCES|CORO(?:S)?)$/;
  if (normalizedMarker === "CON" && genericVocalCreditPattern.test(normalizedSinger)) {
    return "";
  }
  if (
    nonSingerPhrases.some((phrase) => normalizedSinger.includes(phrase)) ||
    nonSingerTokens.some((token) =>
      new RegExp(`\\b${token}\\b`).test(normalizedSinger),
    )
  ) {
    return "";
  }
  const candidates = extractArtistCandidates(singerPart);
  if (candidates.length > 0) {
    return candidates.join(" / ");
  }
  return summarizeArtistName(singerPart);
};

const extractSingerNameFromTitle = (title: string) => {
  const raw = collapseWhitespace(title);
  if (!raw) {
    return "";
  }
  const parentheticalBlocks = Array.from(raw.matchAll(/\(([^)]*)\)/g))
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean);
  for (const block of parentheticalBlocks) {
    const singer = extractSingerNameFromText(block);
    if (singer) {
      return singer;
    }
  }
  const normalized = stripDiacritics(raw).toUpperCase();
  const match = singerFeaturingMarkerPattern.exec(normalized);
  if (!match || match.index === undefined) {
    return "";
  }
  const tail = normalized.slice(match.index + match[0].length);
  if (!singerMarkerTailPattern.test(tail)) {
    return "";
  }
  const singerPart = raw.slice(match.index + match[0].length).trim();
  if (!singerPart) {
    return "";
  }
  const candidates = extractArtistCandidates(singerPart);
  if (candidates.length > 0) {
    return candidates.join(" / ");
  }
  return summarizeArtistName(singerPart);
};

export const extractSingerName = (artistOrCredit: string, title = "") =>
  extractSingerNameFromText(artistOrCredit) || extractSingerNameFromTitle(title);

export const normalizeStyleName = (
  input: string | string[] | undefined,
) => {
  if (!input) {
    return "";
  }
  const raw = Array.isArray(input)
    ? input.find((value) => value && value.trim().length > 0) ?? ""
    : input;
  const first = raw.split(/[;,/|]+/)[0] ?? "";
  const simplified = collapseWhitespace(stripDiacritics(first).toLowerCase());
  return simplified ? titleCase(simplified) : "";
};

export type TrackStyleFields = {
  genre?: string | null;
};

export const collectStylesFromTracks = (
  tracks: (TrackStyleFields | null)[],
  availableStyles: string[],
) => {
  const styleMap = new Map<string, string>();
  availableStyles.forEach((style) => {
    const normalized = normalizeStyleName(style);
    if (normalized) {
      styleMap.set(normalized, style);
    }
  });
  const styles = new Set<string>();
  tracks.forEach((track) => {
    if (!track?.genre) {
      return;
    }
    const normalized = normalizeStyleName(track.genre);
    const canonical = normalized ? styleMap.get(normalized) : undefined;
    if (canonical) {
      styles.add(canonical);
    }
  });
  return Array.from(styles);
};

export const effectiveDurationMs = (
  track: TrackDurationFields | null,
): number => {
  if (!track) {
    return 0;
  }
  const trimmed =
    track.duration_ms - track.start_offset_ms - track.end_trim_ms;
  return Math.max(0, trimmed);
};

export const sumEffectiveDurationMs = (
  tracks: (TrackDurationFields | null)[],
): number => tracks.reduce((sum, track) => sum + effectiveDurationMs(track), 0);

export const deriveInstrumental = (
  tracks: (TrackDurationFields | null)[],
): boolean => {
  const populated = tracks.filter(Boolean) as TrackDurationFields[];
  if (populated.length === 0) {
    return false;
  }
  return populated.every((track) => track.instrumental === true);
};

export type TandaSummaryTrack = {
  artist?: string | null;
  year?: string | null;
  instrumental?: boolean | null;
};

export const summarizeTandaTracks = (tracks: (TandaSummaryTrack | null)[]) => {
  const artistCounts = new Map<string, number>();
  const years = new Set<string>();
  const populated = tracks.filter(Boolean) as TandaSummaryTrack[];
  populated.forEach((track) => {
    const artist = track.artist?.trim();
    if (artist) {
      artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    }
    const year = track.year?.trim();
    if (year) {
      years.add(year);
    }
  });
  const artists = Array.from(artistCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const yearList = Array.from(years).sort((a, b) => a.localeCompare(b));
  const hasInstrumental = populated.some((track) => track.instrumental === true);
  const hasSung = populated.some((track) => track.instrumental !== true);
  const instrumental = populated.length > 0 && hasInstrumental && !hasSung;
  const instrumentalStatus = hasInstrumental && hasSung
    ? "mixed"
    : hasInstrumental
      ? "instrumental"
      : "sung";
  return {
    artists,
    years: yearList,
    instrumental,
    instrumentalStatus,
  };
};

export const buildTandaArtistSortKey = (
  summary: ReturnType<typeof summarizeTandaTracks>,
  unknownLabel: string,
) => {
  const label =
    summary.artists.length > 0
      ? summary.artists.map((artist) => artist.name).join(", ")
      : unknownLabel;
  return label.toLowerCase();
};
