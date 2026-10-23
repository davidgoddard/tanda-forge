import { spawn } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import type Database from "better-sqlite3";
import { getResolvedFfmpegPath } from "../library/analysis";
import {
  AUDIO_SIMILARITY_ALGORITHM_VERSION,
  type AudioSimilarityStatus,
  type GenerateAudioSimilarityOptions,
} from "../../shared/audio-similarity";
import {
  extractComparableAudioFeatures,
  findComparableAudioMatches,
  groupComparableAudioMatches,
  SIMILARITY_SAMPLE_RATE,
  type ComparableAudioFeatures,
  type ComparableAudioRecord,
} from "./algorithm";

type SourceTrack = {
  id: string;
  fullPath: string;
  fileHash: string;
  fileSize: number | null;
  fileMtimeMs: number | null;
  durationMs: number;
  startOffsetMs: number;
  endTrimMs: number;
};

let activeAbortController: AbortController | null = null;

export const runBoundedAudioSimilarityJobs = async <T>(
  items: T[],
  concurrency: number,
  signal: AbortSignal,
  worker: (item: T) => Promise<void>,
  settled: (item: T, error: unknown | null) => void,
) => {
  let nextIndex = 0;
  const runNext = async (): Promise<void> => {
    if (signal.aborted) throw new Error("Analysis was cancelled.");
    const index = nextIndex;
    nextIndex += 1;
    if (index >= items.length) return;
    const item = items[index];
    let failure: unknown | null = null;
    try {
      await worker(item);
    } catch (error) {
      if (signal.aborted) throw new Error("Analysis was cancelled.");
      failure = error;
    }
    settled(item, failure);
    await new Promise<void>((resolve) => setImmediate(resolve));
    return runNext();
  };
  const workers = Math.min(items.length, Math.max(1, Math.floor(concurrency) || 1));
  await Promise.all(Array.from({ length: workers }, runNext));
};

const sourceTracks = (database: Database.Database) => database.prepare(`
  select t.id, t.full_path as fullPath, t.file_hash as fileHash,
    t.file_size as fileSize, t.file_mtime_ms as fileMtimeMs,
    coalesce(t.duration_ms, 0) as durationMs,
    coalesce(t.start_offset_ms, 0) as startOffsetMs,
    coalesce(t.end_trim_ms, 0) as endTrimMs
  from tracks t
  join library_roots r on r.id = t.root_id
  where r.kind = 'music' and t.deleted_at is null
  order by t.id
`).all() as SourceTrack[];

const decodeTrack = (track: SourceTrack, signal: AbortSignal) => new Promise<Int16Array>(
  (resolve, reject) => {
    if (!fs.existsSync(track.fullPath)) {
      reject(new Error("The source audio file is unavailable."));
      return;
    }
    const effectiveDurationMs = Math.max(0, track.durationMs - track.startOffsetMs - track.endTrimMs);
    const args = ["-v", "error"];
    if (track.startOffsetMs > 0) args.push("-ss", (track.startOffsetMs / 1000).toFixed(3));
    args.push("-i", track.fullPath);
    if (effectiveDurationMs > 0) args.push("-t", (effectiveDurationMs / 1000).toFixed(3));
    args.push("-vn", "-ac", "1", "-ar", String(SIMILARITY_SAMPLE_RATE), "-f", "s16le", "pipe:1");
    const child = spawn(getResolvedFfmpegPath(), args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    const abort = () => child.kill();
    signal.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) {
        reject(new Error("Analysis was cancelled."));
        return;
      }
      if (code !== 0) {
        reject(new Error(Buffer.concat(errors).toString("utf8").trim() || `FFmpeg exited with code ${code}.`));
        return;
      }
      const pcm = Buffer.concat(chunks);
      const aligned = pcm.subarray(0, pcm.length - (pcm.length % 2));
      const samples = new Int16Array(aligned.length / 2);
      for (let index = 0; index < samples.length; index += 1) samples[index] = aligned.readInt16LE(index * 2);
      resolve(samples);
    });
  },
);

const parseFeatureRow = (row: {
  trackId: string;
  effectiveDurationMs: number;
  envelopeJson: string;
  chromaJson: string;
  transitionJson: string;
  coarseJson: string;
}): ComparableAudioRecord => ({
  trackId: row.trackId,
  effectiveDurationMs: row.effectiveDurationMs,
  features: {
    envelope: JSON.parse(row.envelopeJson),
    chroma: JSON.parse(row.chromaJson),
    transition: JSON.parse(row.transitionJson),
    coarse: JSON.parse(row.coarseJson),
  },
});

const currentStatus = (database: Database.Database): AudioSimilarityStatus => {
  const row = database.prepare(`
    select id as runId, status as state, total_tracks as totalTracks,
      processed_tracks as processedTracks, failed_tracks as failedTracks,
      candidate_pairs as candidatePairs, matching_pairs as matchingPairs,
      started_at as startedAt, completed_at as completedAt, error
    from audio_similarity_runs order by started_at desc limit 1
  `).get() as Omit<AudioSimilarityStatus, "staleTracks"> | undefined;
  const stale = (database.prepare(`
    select count(*) as count from tracks t
    join library_roots r on r.id = t.root_id
    left join audio_similarity_features f on f.track_id = t.id
    where r.kind = 'music' and t.deleted_at is null and (
      f.track_id is null or f.algorithm_version <> ? or f.file_hash <> t.file_hash
      or coalesce(f.file_size, -1) <> coalesce(t.file_size, -1)
      or coalesce(f.file_mtime_ms, -1) <> coalesce(t.file_mtime_ms, -1)
    )
  `).get(AUDIO_SIMILARITY_ALGORITHM_VERSION) as { count: number }).count;
  return row
    ? { ...row, staleTracks: stale }
    : {
        state: "idle", runId: null, totalTracks: 0, processedTracks: 0,
        failedTracks: 0, candidatePairs: 0, matchingPairs: 0,
        staleTracks: stale, startedAt: null, completedAt: null, error: null,
      };
};

export const getAudioSimilarityStatus = currentStatus;

export const cancelAudioSimilarityAnalysis = () => {
  activeAbortController?.abort();
};

export const generateAudioSimilarityReport = async (
  database: Database.Database,
  options: GenerateAudioSimilarityOptions = {},
) => {
  if (activeAbortController) throw new Error("Audio similarity analysis is already running.");
  const abortController = new AbortController();
  activeAbortController = abortController;
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const tracks = sourceTracks(database);
  database.prepare(`
    insert into audio_similarity_runs
      (id, algorithm_version, status, started_at, total_tracks)
    values (?, ?, 'running', ?, ?)
  `).run(runId, AUDIO_SIMILARITY_ALGORITHM_VERSION, startedAt, tracks.length);
  const updateProgress = database.prepare(`
    update audio_similarity_runs set processed_tracks = ?, failed_tracks = ? where id = ?
  `);
  const upsertFeature = database.prepare(`
    insert into audio_similarity_features
      (track_id, algorithm_version, file_hash, file_size, file_mtime_ms,
       effective_duration_ms, envelope_json, chroma_json, transition_json,
       coarse_json, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict (track_id) do update set
      algorithm_version=excluded.algorithm_version, file_hash=excluded.file_hash,
      file_size=excluded.file_size, file_mtime_ms=excluded.file_mtime_ms,
      effective_duration_ms=excluded.effective_duration_ms,
      envelope_json=excluded.envelope_json, chroma_json=excluded.chroma_json,
      transition_json=excluded.transition_json, coarse_json=excluded.coarse_json,
      updated_at=excluded.updated_at
  `);
  const cachedIdentity = database.prepare(`
    select algorithm_version as algorithmVersion, file_hash as fileHash,
      file_size as fileSize, file_mtime_ms as fileMtimeMs
    from audio_similarity_features where track_id = ?
  `);
  let processed = 0;
  let failed = 0;
  try {
    await runBoundedAudioSimilarityJobs(
      tracks,
      2,
      abortController.signal,
      async (track) => {
      const cached = cachedIdentity.get(track.id) as {
        algorithmVersion: number; fileHash: string; fileSize: number | null; fileMtimeMs: number | null;
      } | undefined;
      const reusable = !options.fullRebuild && cached
        && cached.algorithmVersion === AUDIO_SIMILARITY_ALGORITHM_VERSION
        && cached.fileHash === track.fileHash && cached.fileSize === track.fileSize
        && cached.fileMtimeMs === track.fileMtimeMs;
      if (!reusable) {
        const samples = await decodeTrack(track, abortController.signal);
        const features: ComparableAudioFeatures = extractComparableAudioFeatures(samples);
        const effectiveDurationMs = Math.max(0, track.durationMs - track.startOffsetMs - track.endTrimMs);
        upsertFeature.run(
          track.id, AUDIO_SIMILARITY_ALGORITHM_VERSION, track.fileHash,
          track.fileSize, track.fileMtimeMs, effectiveDurationMs,
          JSON.stringify(features.envelope), JSON.stringify(features.chroma),
          JSON.stringify(features.transition), JSON.stringify(features.coarse),
          new Date().toISOString(),
        );
      }
      },
      (track, error) => {
        if (error) {
          failed += 1;
          database.prepare(`
            insert into audio_similarity_failures (run_id, track_id, message, created_at)
            values (?, ?, ?, ?)
          `).run(runId, track.id, error instanceof Error ? error.message : String(error), new Date().toISOString());
        }
        processed += 1;
        updateProgress.run(processed, failed, runId);
      },
    );
    const featureRows = database.prepare(`
      select f.track_id as trackId, f.effective_duration_ms as effectiveDurationMs,
        f.envelope_json as envelopeJson, f.chroma_json as chromaJson,
        f.transition_json as transitionJson, f.coarse_json as coarseJson
      from audio_similarity_features f join tracks t on t.id = f.track_id
      join library_roots r on r.id = t.root_id
      where r.kind = 'music' and t.deleted_at is null and f.algorithm_version = ?
    `).all(AUDIO_SIMILARITY_ALGORITHM_VERSION) as Parameters<typeof parseFeatureRow>[0][];
    const records = featureRows.map(parseFeatureRow);
    const result = findComparableAudioMatches(records);
    const groups = groupComparableAudioMatches(result.matches);
    database.transaction(() => {
      database.prepare("delete from audio_similarity_candidate_edges").run();
      database.prepare("delete from audio_similarity_candidate_members").run();
      database.prepare("delete from audio_similarity_candidate_groups").run();
      const now = new Date().toISOString();
      for (const members of groups) {
        const groupId = randomUUID();
        const groupMatches = result.matches.filter((match) =>
          members.includes(match.leftTrackId) && members.includes(match.rightTrackId));
        const confidence = Math.max(...groupMatches.map((match) => match.score));
        database.prepare(`insert into audio_similarity_candidate_groups
          (id, run_id, confidence, created_at, updated_at) values (?, ?, ?, ?, ?)`)
          .run(groupId, runId, confidence, now, now);
        const addMember = database.prepare(`insert into audio_similarity_candidate_members
          (group_id, track_id) values (?, ?)`);
        for (const member of members) addMember.run(groupId, member);
        const addEdge = database.prepare(`insert into audio_similarity_candidate_edges
          (group_id, left_track_id, right_track_id, score, envelope_score,
           chroma_score, transition_score, coarse_score, pitch_shift, decision, updated_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?,
            case when exists (select 1 from audio_similarity_rejections
              where left_track_id = ? and right_track_id = ?) then 'rejected' else 'pending' end, ?)`);
        for (const match of groupMatches) addEdge.run(
          groupId, match.leftTrackId, match.rightTrackId, match.score,
          match.envelopeScore, match.chromaScore, match.transitionScore,
          match.coarseScore, match.pitchShift, match.leftTrackId,
          match.rightTrackId, now,
        );
      }
    })();
    database.prepare(`update audio_similarity_runs set status='completed', completed_at=?,
      processed_tracks=?, failed_tracks=?, candidate_pairs=?, matching_pairs=? where id=?`)
      .run(new Date().toISOString(), processed, failed, result.candidatePairs, result.matches.length, runId);
  } catch (error) {
    const cancelled = abortController.signal.aborted;
    database.prepare(`update audio_similarity_runs set status=?, completed_at=?, error=? where id=?`)
      .run(cancelled ? "cancelled" : "failed", new Date().toISOString(),
        error instanceof Error ? error.message : String(error), runId);
    if (!cancelled) throw error;
  } finally {
    activeAbortController = null;
  }
  return currentStatus(database);
};
