import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { normalizeStyleName, summarizeArtistName } from "../../shared/tanda-utils";
import { composeStyleLabel, splitStyleLabel } from "../../shared/style-families";
import { saveTrackBpm } from "../bpm/store";
import { parseResearchCsv, researchBaseColumns, researchResultColumns } from "./metadata-research-csv";
import { requiresResearchResolution, researchFields as fields, type ResearchEdit, type ResearchRow, type ResearchTrack as Track } from "../../shared/metadata-research";

type Field = typeof fields[number];
type Values = Partial<Record<Field, string | number | null>>;

export function ensureResearchSchema(db: Database.Database) {
  if (Number(db.pragma("user_version", { simple: true })) !== 3) return;
  db.transaction(() => {
    db.exec(`
      create table metadata_research_imports (
        id text primary key, csv text not null, imported_at text not null
      );
      create table metadata_research_rows (
        batch text not null, line integer not null, track_id text not null,
        data text not null, primary key (batch, line)
      );
      create index metadata_research_by_track on metadata_research_rows(track_id);
      create table metadata_research_exports (
        batch text not null, track_id text not null, exported_at text not null,
        primary key (batch, track_id)
      );
      pragma user_version = 4;
    `);
  })();
}

const trackQuery = `select t.id,t.title,t.artist,t.singer,t.album,t.year,t.genre,t.bpm,
  t.duration_ms as duration,t.instrumental,t.user_bpm,t.updated_at from tracks t
  join library_roots r on r.id=t.root_id where r.kind='music' and t.deleted_at is null
  and not exists(select 1 from hidden_tracks h where h.track_id=t.id)`;
const trackById = (db: Database.Database, id: string) =>
  (db.prepare(`${trackQuery} and t.id=?`).get(id) as Track | undefined) ?? null;
export const missingResearchValue = (value: string | number | null) =>
  value === null || (typeof value === "string" && ["", "?"].includes(value.trim()));

export function listResearchTracks(db: Database.Database) {
  return db.prepare(`select q.*,
    exists(select 1 from metadata_research_exports e where e.track_id=q.id) as exported,
    exists(select 1 from metadata_research_rows s where s.track_id=q.id
      and json_extract(s.data,'$.state') in ('applied','reviewed')) as completed
    from (${trackQuery}) q order by q.artist,q.title,q.id`).all() as Array<Track & {
      exported: number; completed: number;
    }>;
}

export const needsResearch = (track: Pick<Track, "genre" | "year">) =>
  missingResearchValue(track.genre) || missingResearchValue(track.year);

export function recordResearchExport(db: Database.Database, batch: string, ids: string[]) {
  const insert = db.prepare("insert into metadata_research_exports values (?,?,?)");
  const now = new Date().toISOString();
  db.transaction(() => ids.forEach((id) => insert.run(batch, id, now)))();
}

export const listResearchRows = (db: Database.Database) =>
  (db.prepare("select data from metadata_research_rows order by rowid desc").all() as { data: string }[])
    .map(({ data }) => recoverResearchGenre(db, JSON.parse(data) as ResearchRow));

function saveRow(db: Database.Database, row: ResearchRow) {
  db.prepare(`insert into metadata_research_rows values (?,?,?,?)
    on conflict(batch,line) do update set data=excluded.data`)
    .run(row.batch, row.line, row.id, JSON.stringify(row));
}

const styleKey = (style: string) => normalizeStyleName(style).toLowerCase();
const waltzNames = ["waltz", "vals", "valse", "walzer", "valsa", "valzer"];
const familyKey = (style: string) => {
  const key = styleKey(splitStyleLabel(style).base);
  return waltzNames.includes(key) ? "waltz" : key;
};

function lookupStyle(db: Database.Database, value: string): string | undefined {
  const key = styleKey(value);
  return db.prepare(`select name from styles where normalized=?
    union all select style_name from style_aliases where alias_normalized=? limit 1`).pluck().get(key, key) as string | undefined;
}

function resolveResearchGenre(db: Database.Database, original: ResearchRow["original"], currentGenre: Values["genre"]) {
  const current = typeof currentGenre === "string" ? currentGenre : "";
  const genre = original.suggested_genre?.trim();
  const suggestedStyle = original.suggested_style?.trim();
  if (!genre && !suggestedStyle) return undefined;
  const { base, variant } = splitStyleLabel(genre || current || "");
  if (!base || base === "?") throw Error("Style requires a genre mapping");
  const canonical = lookupStyle(db, genre || base);
  if (genre && variant && canonical) return canonical;
  const family = familyKey(canonical || base);
  // A family match confirms the existing classification, including custom variants.
  const sameFamily = current && family === familyKey(lookupStyle(db, current) || current);
  if (sameFamily && !variant && (!suggestedStyle || splitStyleLabel(current).variant)) return current;
  const bases = [splitStyleLabel(canonical || base).base];
  if (family === "waltz") bases.push(...waltzNames);
  const subtype = variant || suggestedStyle;
  if (subtype) {
    for (const candidate of bases) {
      const match = lookupStyle(db, composeStyleLabel(candidate, subtype));
      if (match) return match;
    }
  }
  if (!variant) {
    if (sameFamily) return current;
    for (const candidate of bases) {
      const match = lookupStyle(db, candidate);
      if (match) return match;
    }
  }
  if (canonical) return canonical;
  throw Error("Invalid genre");
}

function recoverResearchGenre(db: Database.Database, row: ResearchRow) {
  if (row.state !== "pending" || !row.snapshot ||
    !row.issues.some(isGenreIssue)) return row;
  try {
    const value = resolveResearchGenre(db, row.original, row.snapshot.genre);
    if (value === undefined) return row;
    row.issues = row.issues.filter((issue) => !isGenreIssue(issue));
    if (value !== row.snapshot.genre) row.proposed.genre = value;
  } catch {
    // An unmapped genre still needs explicit review.
  }
  return row;
}

const isGenreIssue = (issue: string) => issue === "Invalid genre" || issue === "Style requires a genre mapping";

function validateValue(db: Database.Database, field: Field, value: unknown): string | number | null {
  if (field === "bpm") {
    const bpm = typeof value === "number" || (typeof value === "string" && /^\d+(\.\d+)?$/.test(value))
      ? Number(value) : NaN;
    if (bpm > 0 && bpm <= 1000) return bpm;
  } else if (field === "instrumental") {
    if (value === 0 || value === 1) return value;
  } else if (typeof value === "string" && value.trim() && value.length <= 2000) {
    value = value.trim();
    if (field === "year") {
      if (/^\d{4}$/.test(value as string) && Number(value) >= 1800 &&
        Number(value) <= new Date().getFullYear()) return value as string;
    } else if (field === "genre") {
      const style = lookupStyle(db, value as string);
      if (typeof style === "string") return style;
    } else {
      return value as string;
    }
  }
  throw Error(`Invalid ${field}`);
}

export function stageResearchCsv(db: Database.Database, csv: string) {
  const batch = createHash("sha256").update(csv).digest("hex");
  if (db.prepare("select 1 from metadata_research_imports where id=?").get(batch)) return { batch, duplicate: true };
  const [header, ...records] = parseResearchCsv(csv);
  const columns = header?.fields;
  if (!columns || header.error || new Set(columns).size !== columns.length ||
    !researchBaseColumns.every((column) => columns.includes(column))) throw Error("Invalid research CSV header");
  const allowed = new Set<string>([...researchBaseColumns, ...researchResultColumns]);
  const unexpected = columns.filter((column) => !allowed.has(column));
  const importedAt = new Date().toISOString();
  const ids = new Map<string, number>();
  for (const record of records) {
    const id = record.fields[columns.indexOf("id")] ?? "";
    ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  const pendingIds = new Set(listResearchRows(db).filter((row) =>
    row.state === "pending" || row.state === "approved").map((row) => row.id));
  db.transaction(() => {
    db.prepare("insert into metadata_research_imports values (?,?,?)").run(batch, csv, importedAt);
    for (const record of records) {
      const original = Object.fromEntries(columns.map((column, i) => [column, record.fields[i] ?? ""]));
      const id = original.id;
      const snapshot = trackById(db, id);
      const issues = [];
      if (record.error) issues.push(record.error);
      if (record.fields.length !== columns.length) issues.push("Unexpected field count");
      if (!snapshot) issues.push("Unknown track ID");
      if ((ids.get(id) ?? 0) > 1) issues.push("Duplicate track ID");
      if (pendingIds.has(id)) issues.push("Track already has a pending review");
      if (unexpected.length) issues.push(`Unsupported columns: ${unexpected.join(", ")}`);
      if (original.confidence && !/^(high|medium|low|unknown)$/i.test(original.confidence)) issues.push("Invalid confidence");
      if (original.recording_date) {
        const date = new Date(original.recording_date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(original.recording_date) ||
          !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== original.recording_date) {
          issues.push("Invalid recording date");
        }
      }
      const conflict = !!snapshot && researchBaseColumns.some((key) => original[key] !== String(snapshot[key] ?? ""));
      const proposed: Values = {};
      const suggestions: Partial<Record<Field, unknown>> = {
        title: original.suggested_title, artist: original.suggested_artist,
        singer: original.suggested_singer,
        year: original.recording_year, bpm: original.suggested_bpm,
      };
      try {
        const genre = resolveResearchGenre(db, original, snapshot?.genre);
        if (genre !== undefined && genre !== snapshot?.genre) proposed.genre = genre;
      } catch (error) { issues.push((error as Error).message); }
      const vocal = original.vocal_status?.trim().toLowerCase();
      if (vocal === "instrumental") {
        suggestions.instrumental = 1;
        if (original.suggested_singer?.trim()) issues.push("Instrumental recording has a suggested singer");
      } else if (vocal === "vocal" || vocal === "sung") {
        suggestions.instrumental = 0;
      } else if (vocal && vocal !== "unknown") issues.push("Invalid vocal status");
      for (const field of fields) {
        const raw = suggestions[field];
        if (raw === undefined || raw === "" || (typeof raw === "string" && !raw.trim())) continue;
        try {
          const value = validateValue(db, field, raw);
          if (snapshot?.[field] !== value) proposed[field] = value;
        } catch (error) { issues.push((error as Error).message); }
      }
      saveRow(db, { batch, line: record.line, id, original, snapshot, proposed, issues, conflict,
        state: "pending", approved: {}, importedAt });
    }
  })();
  return { batch, duplicate: false };
}

const sameTrack = (a: Track | null, b: Track | null) => JSON.stringify(a) === JSON.stringify(b);

export function reviewResearchRows(db: Database.Database, edits: ResearchEdit[]) {
  const lookup = db.prepare("select data from metadata_research_rows where batch=? and line=?").pluck();
  db.transaction(() => {
    for (const edit of edits) {
      if (!["pending", "approved", "rejected"].includes(edit.state)) throw Error("Invalid review status");
      const raw = lookup.get(edit.batch, edit.line);
      if (typeof raw !== "string") throw Error("Research row no longer exists");
      const row = recoverResearchGenre(db, JSON.parse(raw) as ResearchRow);
      if (row.state === "applied" || row.state === "undone") throw Error("Previously applied review");
      if (edit.recheck === true) {
        if (edit.state !== "pending") throw Error("Rechecking a track requires a fresh review");
        const snapshot = trackById(db, row.id);
        if (!snapshot) throw Error("Track no longer exists");
        row.snapshot = snapshot;
        row.conflict = false;
        if (row.issues.includes("Track already has a pending review")) {
          const otherPending = listResearchRows(db).some((other) => other.id === row.id &&
            (other.batch !== row.batch || other.line !== row.line) &&
            (other.state === "pending" || other.state === "approved") &&
            !other.issues.includes("Track already has a pending review"));
          if (!otherPending) row.issues = row.issues.filter((issue) => issue !== "Track already has a pending review");
        }
      }
      const approved: Values = {};
      const draft: Values = {};
      if (edit.state === "pending" && edit.values) {
        for (const field of fields) {
          const value = edit.values[field];
          if (value === null || typeof value === "number" ||
            (typeof value === "string" && value.length <= 2000)) draft[field] = value;
        }
      }
      if (edit.state === "approved") {
        if (requiresResearchResolution(row) && edit.resolved !== true) throw Error("Resolve the recording-match warning before approving");
        const blockingIssues = row.issues.filter((issue) => {
          // An unmapped suggestion is advisory for manual review. Any submitted
          // genre is still validated below, and an omitted genre stays untouched.
          if (isGenreIssue(issue)) return false;
          if (edit.values?.year !== undefined && issue === "Invalid year") return false;
          if (edit.values?.bpm !== undefined && issue === "Invalid bpm") return false;
          return true;
        });
        if (blockingIssues.length || row.conflict || !row.snapshot ||
          !sameTrack(row.snapshot, trackById(db, row.id))) throw Error("Resolve research conflicts before approving");
        for (const field of fields) {
          const value = edit.values?.[field];
          if (value === undefined) continue;
          const validated = value === null && field === "singer" &&
            (edit.values?.instrumental ?? row.snapshot.instrumental) === 1
            ? null : validateValue(db, field, value);
          if (row.snapshot[field] !== validated) approved[field] = validated;
        }
        if (!Object.keys(approved).length && edit.allowNoChanges !== true) throw Error("Select at least one correction");
        if ((approved.instrumental ?? row.snapshot.instrumental) === 1 &&
          typeof approved.singer === "string") throw Error("Instrumental recording cannot have a singer correction");
      }
      const state = edit.state === "approved" && !Object.keys(approved).length ? "reviewed" : edit.state;
      saveRow(db, { ...row, approved, draft, state,
        approvedAt: edit.state === "approved" ? new Date().toISOString() : undefined });
    }
  })();
}

function updateTrack(db: Database.Database, id: string, values: Values, bpm: number | null | undefined) {
  if (bpm !== undefined) saveTrackBpm(db, id, bpm);
  const assignments = ["updated_at=?"];
  const args: Array<string | number | null> = [new Date().toISOString()];
  for (const field of fields) {
    const value = values[field];
    if (field === "bpm" || value === undefined) continue;
    assignments.push(`${field}=?`);
    args.push(value);
    if (field === "artist") {
      assignments.push("artist_summary=?");
      args.push(typeof value === "string" ? summarizeArtistName(value) : null);
    }
  }
  db.prepare(`update tracks set ${assignments.join(",")} where id=?`).run(...args, id);
}

export function applyResearch(db: Database.Database) {
  return db.transaction(() => {
    const rows = listResearchRows(db).filter((row) => row.state === "approved");
    const ids = new Set<string>();
    let count = 0;
    for (const row of rows) {
      if (ids.has(row.id) || !row.snapshot || !sameTrack(row.snapshot, trackById(db, row.id))) {
        throw Error(`Track changed since review: ${row.id}`);
      }
      ids.add(row.id);
      if (row.approved.genre !== undefined) validateValue(db, "genre", row.approved.genre);
      updateTrack(db, row.id, row.approved, row.approved.bpm as number | undefined);
      saveRow(db, { ...row, state: "applied", appliedAt: new Date().toISOString(),
        after: trackById(db, row.id)! });
      count += Object.keys(row.approved).length;
    }
    return { tracks: rows.length, fields: count };
  })();
}

export function undoResearch(db: Database.Database, batch: string, line?: number) {
  return db.transaction(() => {
    const rows = listResearchRows(db).filter((row) =>
      row.state === "applied" && row.batch === batch && (line === undefined || row.line === line));
    for (const row of rows) {
      if (!row.snapshot || !row.after || !sameTrack(row.after, trackById(db, row.id))) {
        throw Error(`Track changed since applying research: ${row.id}`);
      }
      const values: Values = {};
      for (const field of fields) if (field in row.approved) values[field] = row.snapshot[field];
      updateTrack(db, row.id, values, "bpm" in values ? row.snapshot.user_bpm : undefined);
      saveRow(db, { ...row, state: "undone", undoneAt: new Date().toISOString() });
    }
    return rows.length;
  })();
}
