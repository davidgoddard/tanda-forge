import { randomUUID } from "crypto";
import type Database from "better-sqlite3";
import type {
  AudioSimilarityCandidateGroup,
  AudioSimilarityMetadataChange,
  AudioSimilarityMetadataMutationResult,
  AudioSimilarityMember,
  AudioSimilarityTandaReference,
  AudioSimilarityReport,
  AudioSimilarityRelationshipType,
  ConfirmedAudioSimilarityGroup,
  ReplicableAudioSimilarityField,
} from "../../shared/audio-similarity";
import { AUDIO_SIMILARITY_ALGORITHM_VERSION } from "../../shared/audio-similarity";
import { getAudioSimilarityStatus } from "./service";

const orderedPair = (leftTrackId: string, rightTrackId: string) =>
  leftTrackId < rightTrackId
    ? [leftTrackId, rightTrackId] as const
    : [rightTrackId, leftTrackId] as const;

export const ensureAudioSimilaritySchema = (database: Database.Database) => {
  database.exec(`
    create table if not exists audio_similarity_runs (
      id text primary key,
      algorithm_version integer not null,
      status text not null,
      started_at text not null,
      completed_at text,
      error text,
      total_tracks integer not null default 0,
      processed_tracks integer not null default 0,
      failed_tracks integer not null default 0,
      candidate_pairs integer not null default 0,
      matching_pairs integer not null default 0
    );

    create table if not exists audio_similarity_features (
      track_id text primary key,
      algorithm_version integer not null,
      file_hash text not null,
      file_size integer,
      file_mtime_ms integer,
      effective_duration_ms integer not null,
      envelope_json text not null,
      chroma_json text not null,
      transition_json text not null,
      coarse_json text not null,
      updated_at text not null
    );

    create table if not exists audio_similarity_failures (
      run_id text not null,
      track_id text not null,
      message text not null,
      created_at text not null,
      primary key (run_id, track_id)
    );

    create table if not exists audio_similarity_candidate_groups (
      id text primary key,
      run_id text not null,
      confidence real not null,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists audio_similarity_candidate_members (
      group_id text not null,
      track_id text not null,
      primary key (group_id, track_id)
    );

    create table if not exists audio_similarity_candidate_edges (
      group_id text not null,
      left_track_id text not null,
      right_track_id text not null,
      score real not null,
      envelope_score real not null,
      chroma_score real not null,
      transition_score real not null,
      coarse_score real not null,
      pitch_shift integer not null,
      decision text not null default 'pending',
      updated_at text not null,
      primary key (left_track_id, right_track_id),
      check (left_track_id < right_track_id)
    );

    create table if not exists audio_similarity_confirmed_groups (
      id text primary key,
      relationship_type text not null,
      preferred_track_id text,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists audio_similarity_confirmed_members (
      group_id text not null,
      track_id text not null unique,
      primary key (group_id, track_id)
    );

    create table if not exists audio_similarity_rejections (
      left_track_id text not null,
      right_track_id text not null,
      created_at text not null,
      updated_at text not null,
      primary key (left_track_id, right_track_id),
      check (left_track_id < right_track_id)
    );

    create table if not exists hidden_tracks (
      track_id text primary key,
      hidden_at text not null
    );

    create index if not exists idx_audio_features_version
      on audio_similarity_features (algorithm_version);
    create index if not exists idx_audio_candidate_groups_run
      on audio_similarity_candidate_groups (run_id);
    create index if not exists idx_audio_candidate_members_track
      on audio_similarity_candidate_members (track_id);
    create index if not exists idx_audio_confirmed_members_group
      on audio_similarity_confirmed_members (group_id);
    create index if not exists idx_audio_failures_run
      on audio_similarity_failures (run_id);
  `);
  const runColumnRows = database.prepare(
    "select name from pragma_table_info('audio_similarity_runs')",
  ).all() as Array<{ name: string }>;
  const runColumns = new Set(runColumnRows.map((column) => column.name));
  if (!runColumns.has("comparison_pairs_processed")) {
    database.exec("alter table audio_similarity_runs add column comparison_pairs_processed integer not null default 0");
  }
  if (!runColumns.has("comparison_pairs_total")) {
    database.exec("alter table audio_similarity_runs add column comparison_pairs_total integer not null default 0");
  }
  const memberIndexes = database.prepare(
    "select name, [unique] as isUnique from pragma_index_list('audio_similarity_confirmed_members')",
  ).all() as Array<{ name: string; isUnique: number }>;
  const hasLegacyTrackUniqueness = memberIndexes.some((index) => index.isUnique === 1
    && (database.prepare(`select name from pragma_index_info(?) order by seqno`)
      .all(index.name) as Array<{ name: string }>).map((column) => column.name).join(",") === "track_id");
  if (hasLegacyTrackUniqueness) {
    database.transaction(() => {
      database.exec(`
        alter table audio_similarity_confirmed_members rename to audio_similarity_confirmed_members_legacy;
        create table audio_similarity_confirmed_members (
          group_id text not null,
          track_id text not null,
          primary key (group_id, track_id)
        );
        insert into audio_similarity_confirmed_members (group_id, track_id)
          select group_id, track_id from audio_similarity_confirmed_members_legacy;
        drop table audio_similarity_confirmed_members_legacy;
        create index if not exists idx_audio_confirmed_members_group
          on audio_similarity_confirmed_members (group_id);
        create index if not exists idx_audio_confirmed_members_track
          on audio_similarity_confirmed_members (track_id);
      `);
    })();
  } else {
    database.exec(`create index if not exists idx_audio_confirmed_members_track
      on audio_similarity_confirmed_members (track_id)`);
  }
};

export const recoverInterruptedAudioSimilarityRuns = (database: Database.Database) => {
  database.prepare(`
    update audio_similarity_runs
    set status = 'failed', completed_at = coalesce(completed_at, ?),
      error = coalesce(error, 'Analysis was interrupted before it completed. Generate the report again.')
    where status in ('running', 'cancelling')
  `).run(new Date().toISOString());
};

const validateTrackIds = (trackIds: string[]) => {
  const unique = [...new Set(trackIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length < 2) {
    throw new Error("A confirmed similarity group requires at least two tracks.");
  }
  return unique;
};

const removeEquivalentConfirmedGroup = (
  database: Database.Database,
  trackIds: string[],
  relationshipType: AudioSimilarityRelationshipType,
) => {
  const wanted = [...trackIds].sort().join("\u0000");
  for (const group of listConfirmedAudioSimilarityGroups(database)) {
    if (group.relationshipType !== relationshipType
      || [...group.trackIds].sort().join("\u0000") !== wanted) continue;
    withdrawConfirmedAudioSimilarityGroup(database, group.id);
  }
};

export const confirmAudioSimilarityGroup = (
  database: Database.Database,
  trackIds: string[],
  relationshipType: AudioSimilarityRelationshipType,
  preferredTrackId: string | null = null,
) => database.transaction(() => {
  const members = validateTrackIds(trackIds);
  if (relationshipType === "identical" && !preferredTrackId) {
    throw new Error("Identical versions require a preferred master track.");
  }
  if (preferredTrackId && !members.includes(preferredTrackId)) {
    throw new Error("The preferred track must belong to the confirmed group.");
  }
  const now = new Date().toISOString();
  const groupId = randomUUID();
  removeEquivalentConfirmedGroup(database, members, relationshipType);
  if (relationshipType === "same-recording" && !preferredTrackId) {
    preferredTrackId = listConfirmedAudioSimilarityGroups(database)
      .filter((group) => group.relationshipType === "identical"
        && group.preferredTrackId && group.trackIds.every((id) => members.includes(id)))
      .sort((left, right) => right.trackIds.length - left.trackIds.length)[0]?.preferredTrackId
      ?? [...members].sort()[0];
  }
  database.prepare(`
    insert into audio_similarity_confirmed_groups
      (id, relationship_type, preferred_track_id, created_at, updated_at)
    values (?, ?, ?, ?, ?)
  `).run(groupId, relationshipType, preferredTrackId, now, now);
  const insertMember = database.prepare(`
    insert into audio_similarity_confirmed_members (group_id, track_id)
    values (?, ?)
  `);
  const clearRejection = database.prepare(`
    delete from audio_similarity_rejections
    where left_track_id = ? and right_track_id = ?
  `);
  for (const trackId of members) insertMember.run(groupId, trackId);
  for (let left = 0; left < members.length; left += 1) {
    for (let right = left + 1; right < members.length; right += 1) {
      clearRejection.run(...orderedPair(members[left], members[right]));
    }
  }
  return groupId;
})();

export const approveCandidateSubset = (
  database: Database.Database,
  candidateTrackIds: string[],
  acceptedTrackIds: string[],
  relationshipType: AudioSimilarityRelationshipType,
  preferredTrackId: string | null = null,
) => database.transaction(() => {
  const candidates = [...new Set(candidateTrackIds)];
  const accepted = validateTrackIds(acceptedTrackIds);
  if (accepted.some((id) => !candidates.includes(id))) {
    throw new Error("Accepted tracks must belong to the candidate group.");
  }
  const groupId = confirmAudioSimilarityGroup(
    database, accepted, relationshipType, preferredTrackId,
  );
  return groupId;
})();

export const rejectAudioSimilarityPair = (
  database: Database.Database,
  leftTrackId: string,
  rightTrackId: string,
) => database.transaction(() => {
  if (!leftTrackId || !rightTrackId || leftTrackId === rightTrackId) {
    throw new Error("A rejection requires two different tracks.");
  }
  const [left, right] = orderedPair(leftTrackId, rightTrackId);
  const now = new Date().toISOString();
  database.prepare(`
    insert into audio_similarity_rejections
      (left_track_id, right_track_id, created_at, updated_at)
    values (?, ?, ?, ?)
    on conflict (left_track_id, right_track_id) do update set updated_at = excluded.updated_at
  `).run(left, right, now, now);
  database.prepare(`
    update audio_similarity_candidate_edges
    set decision = 'rejected', updated_at = ?
    where left_track_id = ? and right_track_id = ?
  `).run(now, left, right);
})();

export const reconsiderAudioSimilarityPair = (
  database: Database.Database,
  leftTrackId: string,
  rightTrackId: string,
) => database.transaction(() => {
  const [left, right] = orderedPair(leftTrackId, rightTrackId);
  database.prepare(`
    delete from audio_similarity_rejections
    where left_track_id = ? and right_track_id = ?
  `).run(left, right);
  database.prepare(`
    update audio_similarity_candidate_edges
    set decision = 'pending', updated_at = ?
    where left_track_id = ? and right_track_id = ?
  `).run(new Date().toISOString(), left, right);
})();

export const withdrawConfirmedAudioSimilarityGroup = (
  database: Database.Database,
  groupId: string,
) => database.transaction(() => {
  database.prepare(
    "delete from audio_similarity_confirmed_members where group_id = ?",
  ).run(groupId);
  database.prepare(
    "delete from audio_similarity_confirmed_groups where id = ?",
  ).run(groupId);
})();

export const detachTrackFromConfirmedAudioSimilarityGroup = (
  database: Database.Database,
  groupId: string,
  trackId: string,
  rejectRemainingPairs = false,
) => database.transaction(() => {
  const remaining = database.prepare(`
    select track_id as trackId from audio_similarity_confirmed_members
    where group_id = ? and track_id <> ?
  `).all(groupId, trackId) as { trackId: string }[];
  database.prepare(`
    delete from audio_similarity_confirmed_members
    where group_id = ? and track_id = ?
  `).run(groupId, trackId);
  database.prepare(`
    update audio_similarity_confirmed_groups
    set preferred_track_id = null, updated_at = ?
    where id = ? and preferred_track_id = ?
  `).run(new Date().toISOString(), groupId, trackId);
  if (rejectRemainingPairs) {
    for (const member of remaining) {
      rejectAudioSimilarityPair(database, trackId, member.trackId);
    }
  }
  if (remaining.length < 2) withdrawConfirmedAudioSimilarityGroup(database, groupId);
})();

export const listConfirmedAudioSimilarityGroups = (
  database: Database.Database,
): ConfirmedAudioSimilarityGroup[] => {
  const rows = database.prepare(`
    select g.id, g.relationship_type as relationshipType,
      g.preferred_track_id as preferredTrackId, g.updated_at as updatedAt,
      m.track_id as trackId
    from audio_similarity_confirmed_groups g
    join audio_similarity_confirmed_members m on m.group_id = g.id
    order by g.updated_at desc, m.track_id
  `).all() as Array<{
    id: string;
    relationshipType: AudioSimilarityRelationshipType;
    preferredTrackId: string | null;
    updatedAt: string;
    trackId: string;
  }>;
  const groups = new Map<string, ConfirmedAudioSimilarityGroup>();
  for (const row of rows) {
    const group = groups.get(row.id) ?? {
      id: row.id,
      relationshipType: row.relationshipType,
      preferredTrackId: row.preferredTrackId,
      trackIds: [],
      updatedAt: row.updatedAt,
    };
    group.trackIds.push(row.trackId);
    groups.set(row.id, group);
  }
  return [...groups.values()];
};

export const buildConfirmedAudioSimilarityLookup = (
  groups: ConfirmedAudioSimilarityGroup[],
) => {
  const lookup = new Map<string, ReadonlySet<string>>();
  for (const group of [...groups].sort((left, right) => left.trackIds.length - right.trackIds.length)) {
    const members = new Set(group.trackIds);
    for (const trackId of members) lookup.set(trackId, members);
  }
  return lookup;
};

export const setTrackHidden = (
  database: Database.Database,
  trackId: string,
  hidden: boolean,
) => {
  if (!trackId) throw new Error("A track is required.");
  if (hidden) {
    database.prepare(`
      insert into hidden_tracks (track_id, hidden_at) values (?, ?)
      on conflict (track_id) do update set hidden_at = excluded.hidden_at
    `).run(trackId, new Date().toISOString());
  } else {
    database.prepare("delete from hidden_tracks where track_id = ?").run(trackId);
  }
};

export const getAudioSimilarityReport = (
  database: Database.Database,
): AudioSimilarityReport => {
  const groupRows = database.prepare(`
    select g.id, g.run_id as runId, g.confidence,
      t.id as trackId, coalesce(t.title, '') as title,
      coalesce(t.artist, '') as artist, coalesce(t.album, '') as album,
      coalesce(t.artist_summary, '') as artistSummary,
      t.full_path as fullPath, t.file_hash as fileHash,
      coalesce(t.duration_ms, 0) as durationMs,
      coalesce(t.start_offset_ms, 0) as startOffsetMs,
      coalesce(t.end_trim_ms, 0) as endTrimMs,
      coalesce(t.year, '') as year, coalesce(t.genre, '') as genre,
      t.bpm, coalesce(t.notes, '') as notes, coalesce(t.singer, '') as singer,
      t.instrumental,
      t.loudness_db as loudnessDb, t.gain_db as gainDb,
      case when h.track_id is null then 0 else 1 end as hidden
    from audio_similarity_candidate_groups g
    join audio_similarity_candidate_members m on m.group_id = g.id
    join tracks t on t.id = m.track_id
    left join hidden_tracks h on h.track_id = t.id
    where h.track_id is null
    order by g.confidence desc, g.id, t.id
  `).all() as Array<{
    id: string; runId: string; confidence: number; trackId: string;
    title: string; artist: string; artistSummary: string; album: string; fullPath: string; fileHash: string; hidden: number;
    durationMs: number; startOffsetMs: number; endTrimMs: number;
    year: string; genre: string; bpm: number | null; notes: string;
    singer: string; instrumental: number | null;
    loudnessDb: number | null; gainDb: number | null;
  }>;
  const edgeRows = database.prepare(`
    select e.group_id as groupId, e.left_track_id as leftTrackId,
      e.right_track_id as rightTrackId, e.score, e.envelope_score as envelopeScore,
      e.chroma_score as chromaScore, e.transition_score as transitionScore,
      e.coarse_score as coarseScore, e.pitch_shift as pitchShift, e.decision,
      e.updated_at as updatedAt
    from audio_similarity_candidate_edges e
    left join hidden_tracks hidden_left on hidden_left.track_id = e.left_track_id
    left join hidden_tracks hidden_right on hidden_right.track_id = e.right_track_id
    where hidden_left.track_id is null and hidden_right.track_id is null
    order by e.score desc
  `).all() as Array<Record<string, unknown> & { groupId: string }>;
  const groups = new Map<string, AudioSimilarityCandidateGroup>();
  for (const row of groupRows) {
    const group = groups.get(row.id) ?? {
      id: row.id, runId: row.runId, confidence: row.confidence, members: [], edges: [],
    };
    group.members.push({
      trackId: row.trackId, title: row.title, artist: row.artist,
      artistSummary: row.artistSummary,
      album: row.album, fullPath: row.fullPath, hidden: Boolean(row.hidden),
      fileHash: row.fileHash,
      durationMs: row.durationMs, startOffsetMs: row.startOffsetMs, endTrimMs: row.endTrimMs,
      year: row.year, genre: row.genre, bpm: row.bpm, notes: row.notes,
      singer: row.singer,
      instrumental: row.instrumental === null ? null : Boolean(row.instrumental),
      loudnessDb: row.loudnessDb, gainDb: row.gainDb,
      usages: [],
    });
    groups.set(row.id, group);
  }
  for (const row of edgeRows) {
    const group = groups.get(row.groupId);
    if (group) {
      const { groupId: _groupId, ...edge } = row;
      group.edges.push(edge as unknown as AudioSimilarityCandidateGroup["edges"][number]);
    }
  }
  const usageRows = database.prepare(`
    select tt.track_id as trackId, tt.tanda_id as tandaId, ta.name as tandaName,
      tt.position, group_concat(distinct p.name) as playlistNames
    from tanda_tracks tt join tandas ta on ta.id = tt.tanda_id
    left join playlist_items pi on pi.tanda_id = ta.id
    left join playlists p on p.id = pi.playlist_id
    group by tt.track_id, tt.tanda_id, ta.name, tt.position
  `).all() as Array<{
    trackId: string; tandaId: string; tandaName: string;
    position: number; playlistNames: string | null;
  }>;
  const membersById = new Map([...groups.values()].flatMap((group) =>
    group.members.map((member) => [member.trackId, member] as const)));
  for (const usage of usageRows) {
    membersById.get(usage.trackId)?.usages.push({
      tandaId: usage.tandaId, tandaName: usage.tandaName, position: usage.position,
      playlistNames: usage.playlistNames?.split(",").filter(Boolean) ?? [],
      contextTracks: database.prepare(`select t.id as trackId,
        coalesce(t.title, '') as title, coalesce(t.artist, '') as artist,
        coalesce(t.album, '') as album,
        t.full_path as fullPath, coalesce(t.duration_ms, 0) as durationMs,
        coalesce(t.start_offset_ms, 0) as startOffsetMs,
        coalesce(t.end_trim_ms, 0) as endTrimMs,
        t.loudness_db as loudnessDb, t.gain_db as gainDb
        from tanda_tracks tt join tracks t on t.id = tt.track_id
        where tt.tanda_id = ? order by tt.position`)
        .all(usage.tandaId) as AudioSimilarityMember["usages"][number]["contextTracks"],
    });
  }
  const latestRun = getAudioSimilarityStatus(database).runId;
  const failures = latestRun
    ? database.prepare(`
        select f.track_id as trackId, coalesce(t.title, t.relative_path, f.track_id) as title,
          f.message from audio_similarity_failures f
        left join tracks t on t.id = f.track_id where f.run_id = ? order by title
      `).all(latestRun) as AudioSimilarityReport["failures"]
    : [];
  return {
    hasCompletedReport: Boolean(database.prepare(`
      select 1 as found from audio_similarity_runs where status = 'completed' limit 1
    `).get()),
    status: getAudioSimilarityStatus(database),
    integrity: getAudioSimilarityIntegrity(database),
    candidateGroups: [...groups.values()].filter((group) => group.members.length >= 2),
    confirmedGroups: listConfirmedAudioSimilarityGroups(database),
    failures,
    hiddenTrackIds: (database.prepare("select track_id as trackId from hidden_tracks order by hidden_at desc")
      .all() as Array<{ trackId: string }>).map((row) => row.trackId),
    hiddenTracks: database.prepare(`select t.id as trackId,
      coalesce(t.title, '') as title, coalesce(t.artist, '') as artist,
      t.full_path as fullPath from hidden_tracks h join tracks t on t.id = h.track_id
      order by h.hidden_at desc`).all() as AudioSimilarityReport["hiddenTracks"],
  };
};

export const getAudioSimilarityIntegrity = (
  database: Database.Database,
): import("../../shared/audio-similarity").AudioSimilarityIntegrity => {
  const counts = database.prepare(`select
    count(*) as activeTracks,
    sum(case when f.track_id is not null and f.algorithm_version = ?
      and f.file_hash = t.file_hash
      and coalesce(f.file_size, -1) = coalesce(t.file_size, -1)
      and coalesce(f.file_mtime_ms, -1) = coalesce(t.file_mtime_ms, -1)
      then 1 else 0 end) as readyTracks
    from tracks t join library_roots r on r.id = t.root_id
    left join audio_similarity_features f on f.track_id = t.id
    where r.kind = 'music' and t.deleted_at is null`)
    .get(AUDIO_SIMILARITY_ALGORITHM_VERSION) as {
      activeTracks: number; readyTracks: number | null;
    };
  const orphanedFeatures = (database.prepare(`select count(*) as count
    from audio_similarity_features f left join tracks t on t.id = f.track_id
    where t.id is null or t.deleted_at is not null`).get() as { count: number }).count;
  const orphanedConfirmedMembers = (database.prepare(`select count(*) as count
    from audio_similarity_confirmed_members m left join tracks t on t.id = m.track_id
    where t.id is null or t.deleted_at is not null`).get() as { count: number }).count;
  const activeTracks = counts.activeTracks;
  const readyTracks = counts.readyTracks ?? 0;
  const staleTracks = Math.max(0, activeTracks - readyTracks);
  return {
    algorithmVersion: AUDIO_SIMILARITY_ALGORITHM_VERSION,
    activeTracks,
    readyTracks,
    staleTracks,
    orphanedFeatures,
    orphanedConfirmedMembers,
    healthy: staleTracks === 0 && orphanedFeatures === 0 && orphanedConfirmedMembers === 0,
  };
};

const REPLICABLE_FIELDS = new Set<ReplicableAudioSimilarityField>([
  "title", "artist", "artist_summary", "singer", "year", "genre",
  "bpm", "notes", "instrumental",
]);

export const replicateAudioSimilarityMetadata = (
  database: Database.Database,
  sourceTrackId: string,
  targetTrackIds: string[],
  field: ReplicableAudioSimilarityField,
): AudioSimilarityMetadataMutationResult => database.transaction(() => {
  if (!REPLICABLE_FIELDS.has(field)) throw new Error("That metadata field cannot be replicated.");
  const targets = [...new Set(targetTrackIds)].filter((id) => id && id !== sourceTrackId);
  if (!sourceTrackId || targets.length === 0) return { updated: 0, conflicts: [], changes: [] };
  const source = database.prepare(`select ${field} as value from tracks where id = ?`)
    .get(sourceTrackId) as { value: AudioSimilarityMetadataChange["newValue"] } | undefined;
  if (!source) throw new Error("The source track is no longer available.");
  const readTarget = database.prepare(`select ${field} as value from tracks where id = ?`);
  const update = database.prepare(`update tracks set ${field} = ?, updated_at = ? where id = ?`);
  const now = new Date().toISOString();
  const changes: AudioSimilarityMetadataChange[] = [];
  for (const target of targets) {
    const current = readTarget.get(target) as { value: AudioSimilarityMetadataChange["oldValue"] } | undefined;
    if (!current) continue;
    const oldValue = field === "instrumental" && current.value !== null
      ? Boolean(current.value) : current.value;
    const newValue = field === "instrumental" && source.value !== null
      ? Boolean(source.value) : source.value;
    if (oldValue === newValue) continue;
    update.run(source.value, now, target);
    changes.push({ trackId: target, field, oldValue, newValue });
  }
  return { updated: changes.length, conflicts: [], changes };
})();

export const undoAudioSimilarityMetadata = (
  database: Database.Database,
  changes: AudioSimilarityMetadataChange[],
): AudioSimilarityMetadataMutationResult => database.transaction(() => {
  if (!Array.isArray(changes)) throw new Error("Invalid metadata undo request.");
  const restored: AudioSimilarityMetadataChange[] = [];
  const conflicts: string[] = [];
  const now = new Date().toISOString();
  for (const change of changes) {
    if (!change?.trackId || !REPLICABLE_FIELDS.has(change.field)) {
      throw new Error("That metadata field cannot be restored.");
    }
    const current = database.prepare(`select ${change.field} as value from tracks where id = ?`)
      .get(change.trackId) as { value: AudioSimilarityMetadataChange["newValue"] } | undefined;
    const normalized = change.field === "instrumental" && current?.value !== null
      ? Boolean(current?.value) : current?.value;
    if (!current || normalized !== change.newValue) {
      conflicts.push(change.trackId);
      continue;
    }
    const restoredValue = change.field === "instrumental" && typeof change.oldValue === "boolean"
      ? (change.oldValue ? 1 : 0)
      : change.oldValue;
    database.prepare(`update tracks set ${change.field} = ?, updated_at = ? where id = ?`)
      .run(restoredValue, now, change.trackId);
    restored.push(change);
  }
  return { updated: restored.length, conflicts, changes: restored };
})();

export const replaceAudioSimilarityTandaTrack = (
  database: Database.Database,
  tandaId: string,
  position: number,
  replacementTrackId: string,
) => database.transaction(() => {
  if (!tandaId || !replacementTrackId || !Number.isInteger(position) || position < 0) {
    throw new Error("Invalid tanda replacement request.");
  }
  const exists = database.prepare(`select 1 as found from tracks
    where id = ? and deleted_at is null`).get(replacementTrackId);
  if (!exists) throw new Error("The replacement track is unavailable.");
  const changed = database.prepare(`update tanda_tracks set track_id = ?
    where tanda_id = ? and position = ?`).run(replacementTrackId, tandaId, position).changes;
  if (changed === 0) throw new Error("The tanda position is no longer available.");
  const summary = database.prepare(`select count(tt.track_id) as slotCount,
      coalesce(sum(max(0, coalesce(t.duration_ms, 0) - coalesce(t.start_offset_ms, 0)
        - coalesce(t.end_trim_ms, 0))), 0) as totalDurationMs
    from tanda_tracks tt join tracks t on t.id = tt.track_id where tt.tanda_id = ?`)
    .get(tandaId) as { slotCount: number; totalDurationMs: number };
  database.prepare(`update tandas set slot_count = ?, total_duration_ms = ?,
    invalid = 0, updated_at = ? where id = ?`)
    .run(summary.slotCount, summary.totalDurationMs, new Date().toISOString(), tandaId);
})();

export const replaceAudioSimilarityTandaReferences = (
  database: Database.Database,
  references: AudioSimilarityTandaReference[],
  replacementTrackId: string,
) => database.transaction(() => {
  if (!replacementTrackId || !Array.isArray(references) || references.length === 0) {
    throw new Error("Select at least one tanda use to replace.");
  }
  const unique = new Map<string, AudioSimilarityTandaReference>();
  for (const reference of references) {
    if (!reference?.tandaId || !Number.isInteger(reference.position) || reference.position < 0) {
      throw new Error("Invalid tanda replacement selection.");
    }
    unique.set(`${reference.tandaId}\0${reference.position}`, reference);
  }
  const replacement = database.prepare(`select 1 as found from tracks
    where id = ? and deleted_at is null`).get(replacementTrackId);
  if (!replacement) throw new Error("The replacement track is unavailable.");
  const findPosition = database.prepare(`select 1 as found from tanda_tracks
    where tanda_id = ? and position = ?`);
  for (const reference of unique.values()) {
    if (!findPosition.get(reference.tandaId, reference.position)) {
      throw new Error("A selected tanda position is no longer available.");
    }
  }
  for (const reference of unique.values()) {
    replaceAudioSimilarityTandaTrack(
      database, reference.tandaId, reference.position, replacementTrackId,
    );
  }
  return { updated: unique.size };
})();

export const removeAudioSimilarityTrackState = (
  database: Database.Database,
  trackIds: string[],
) => {
  const ids = [...new Set(trackIds)].filter(Boolean);
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  database.transaction(() => {
    database.prepare(`delete from audio_similarity_features where track_id in (${placeholders})`).run(...ids);
    database.prepare(`delete from audio_similarity_candidate_members where track_id in (${placeholders})`).run(...ids);
    database.prepare(`delete from audio_similarity_candidate_edges where left_track_id in (${placeholders}) or right_track_id in (${placeholders})`).run(...ids, ...ids);
    database.prepare(`delete from audio_similarity_rejections where left_track_id in (${placeholders}) or right_track_id in (${placeholders})`).run(...ids, ...ids);
    database.prepare(`delete from hidden_tracks where track_id in (${placeholders})`).run(...ids);
    const groups = database.prepare(`select distinct group_id as id from audio_similarity_confirmed_members where track_id in (${placeholders})`).all(...ids) as { id: string }[];
    database.prepare(`delete from audio_similarity_confirmed_members where track_id in (${placeholders})`).run(...ids);
    for (const group of groups) {
      const count = (database.prepare(`select count(*) as count from audio_similarity_confirmed_members where group_id = ?`).get(group.id) as { count: number }).count;
      if (count < 2) withdrawConfirmedAudioSimilarityGroup(database, group.id);
    }
    database.prepare(`delete from audio_similarity_candidate_groups where id not in (select distinct group_id from audio_similarity_candidate_members)`).run();
  })();
};
