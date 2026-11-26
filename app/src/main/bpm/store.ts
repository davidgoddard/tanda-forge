import type Database from "better-sqlite3";
import { roundBpm } from "../../shared/bpm";
import type { BpmConfig, BpmTrack } from "../../shared/bpm";

// Keep tracks.bpm authoritative for every existing SQL/search/display consumer.
// The guard distinguishes internal policy writes from legacy/import metadata writes.
const effectiveSql = `round(case (select preference from bpm_config where id=1)
  when 'derived-only' then coalesce(case when bpm_override_active=1 then bpm_override end,derived_bpm)
  when 'prefer-user' then coalesce(bpm_override,derived_bpm,user_bpm)
  else coalesce(bpm_override,user_bpm,derived_bpm) end)`;
export const ensureBpmSchema = (db: Database.Database) => {
  db.transaction(() => {
    const columns = new Set((db.prepare("pragma table_info(tracks)").all() as {name:string}[]).map(c=>c.name));
    const migrating = !columns.has("user_bpm");
    for (const [name,type] of Object.entries({user_bpm:"real",derived_bpm:"real",bpm_override:"real",bpm_analysis_key:"text",bpm_error:"text",bpm_analyzed_at:"text",bpm_warnings:"text",bpm_pending:"integer not null default 0",bpm_override_active:"integer not null default 1"})) {
      if (!columns.has(name)) db.exec(`alter table tracks add column ${name} ${type}`);
    }
    db.exec(`create table if not exists bpm_config (
      id integer primary key check(id=1), enabled integer not null default 0,
      preference text not null default 'default-only', configured integer not null default 0,
      paused integer not null default 0, internal_write integer not null default 0);
      insert or ignore into bpm_config(id) values(1);`);
    const policyColumns = new Set((db.prepare("pragma table_info(bpm_config)").all() as {name:string}[]).map(c=>c.name));
    if (!policyColumns.has("policy_version")) {
      db.exec("alter table bpm_config add column policy_version integer not null default 2");
      // Old prefer-user meant imported first. Preserve that choice on upgrade.
      db.exec("update bpm_config set preference='default-only' where preference='prefer-user'");
    }
    if (migrating) db.exec("update tracks set user_bpm=case when bpm>0 then bpm else null end");
    db.exec(`
      drop trigger if exists bpm_track_insert;
      drop trigger if exists bpm_metadata_write;
      drop trigger if exists bpm_source_write;
      drop trigger if exists bpm_file_changed;
      create trigger if not exists bpm_track_insert after insert on tracks begin
        update bpm_config set internal_write=1 where id=1;
        update tracks set user_bpm=coalesce(new.user_bpm,case when new.bpm>0 then new.bpm else null end), bpm_pending=(select enabled from bpm_config where id=1) where id=new.id;
        update tracks set bpm=${effectiveSql} where id=new.id;
        update bpm_config set internal_write=0 where id=1;
      end;
      create trigger if not exists bpm_metadata_write after update of bpm on tracks
      when (select internal_write from bpm_config where id=1)=0 begin
        update bpm_config set internal_write=1 where id=1;
        update tracks set user_bpm=case when new.bpm>0 then new.bpm else null end where id=new.id;
        update tracks set bpm=${effectiveSql} where id=new.id;
        update bpm_config set internal_write=0 where id=1;
      end;
      create trigger if not exists bpm_source_write after update of user_bpm,derived_bpm,bpm_override,bpm_override_active on tracks
      when (select internal_write from bpm_config where id=1)=0 begin
        update bpm_config set internal_write=1 where id=1;
        update tracks set bpm=${effectiveSql} where id=new.id;
        update bpm_config set internal_write=0 where id=1;
      end;
      create trigger if not exists bpm_file_changed after update of file_hash,file_size,file_mtime_ms on tracks
      when new.file_hash is not old.file_hash or new.file_size is not old.file_size or new.file_mtime_ms is not old.file_mtime_ms begin
        update tracks set derived_bpm=null, bpm_analysis_key=null, bpm_error=null,
          bpm_pending=(select enabled from bpm_config where id=1) where id=new.id;
      end;
    `);
    // Upgrade existing estimates without decoding audio again. Preserve the original
    // entered/imported field while rounding the value used by displays and searches.
    db.exec(`
      update bpm_config set internal_write=1 where id=1;
      update tracks set derived_bpm=round(derived_bpm), bpm_override=round(bpm_override)
        where derived_bpm is not round(derived_bpm) or bpm_override is not round(bpm_override);
      update tracks set bpm=${effectiveSql} where bpm is not (${effectiveSql});
      update bpm_config set internal_write=0 where id=1;
    `);
  })();
};
export const getBpmConfig = (db: Database.Database): BpmConfig => {
  const row = db.prepare("select * from bpm_config where id=1").get() as any;
  return { enabled:!!row.enabled, preference:row.preference, configured:!!row.configured, paused:!!row.paused };
};
export const setBpmConfig = (db: Database.Database, config: BpmConfig) => {
  if (typeof config.enabled !== "boolean" || typeof config.paused !== "boolean" ||
      !["prefer-user","derived-only","default-only"].includes(config.preference)) throw Error("Invalid BPM settings");
  db.transaction(() => {
    const previous = getBpmConfig(db);
    // Enabling Always starts a new derived baseline.
    // Mode changes, pause/resume and reanalysis retain later manual choices.
    const reset = config.preference === "derived-only" && !previous.enabled && config.enabled;
    db.prepare("update bpm_config set enabled=?, preference=?, configured=1, paused=?, internal_write=1 where id=1")
      .run(+config.enabled,config.preference,+config.paused);
    if (reset) db.exec("update tracks set bpm_override_active=0");
    db.exec(`update tracks set bpm=${effectiveSql} where bpm is not (${effectiveSql})`);
    db.exec("update bpm_config set internal_write=0 where id=1");
  })();
};
export const getTrackBpm = (db: Database.Database,id:string): BpmTrack | null =>
  (db.prepare("select user_bpm,derived_bpm,bpm_override,bpm_override_active,bpm,bpm_error,bpm_analysis_key from tracks where id=?").get(id) as BpmTrack) ?? null;
export const saveTrackBpm = (db: Database.Database,id:string,user:number|null,correction?:number|null) => {
  for (const value of [user,correction]) if (value != null && (!Number.isFinite(value)||value<=0||value>1000)) throw Error("Invalid BPM");
  const value = correction === undefined ? user : correction;
  // A blank editor is not a request to discard a deliberate manual correction.
  if (value != null) db.prepare("update tracks set bpm_override=?,bpm_override_active=1 where id=?").run(roundBpm(value),id);
};
