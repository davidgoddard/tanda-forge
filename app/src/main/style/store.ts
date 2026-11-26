import type Database from "better-sqlite3";
import { normalizeStyleValue } from "../../shared/style-analysis";
import type { StyleConfig, StyleTrack } from "../../shared/style-analysis";

const clean = (expression: string) => `case when trim(coalesce(${expression},'')) in ('','?') then null else trim(${expression}) end`;
const effectiveSql = `case (select preference from style_analysis_config where id=1)
  when 'derived-only' then coalesce(case when user_style_active=1 then ${clean("user_style")} end,${clean("derived_style")})
  when 'prefer-user' then coalesce(${clean("user_style")},${clean("derived_style")},${clean("imported_style")})
  else coalesce(${clean("user_style")},${clean("imported_style")},${clean("derived_style")}) end`;
export const ensureStyleAnalysisSchema = (db: Database.Database) => {
  db.transaction(() => {
    const columns = new Set((db.prepare("pragma table_info(tracks)").all() as {name:string}[]).map(c=>c.name));
    for (const [name,type] of Object.entries({imported_style:"text",user_style:"text",derived_style:"text",style_analysis_key:"text",style_error:"text",style_analyzed_at:"text",style_pending:"integer not null default 0",user_style_active:"integer not null default 1"})) {
      if (!columns.has(name)) db.exec(`alter table tracks add column ${name} ${type}`);
    }
    db.exec(`create table if not exists style_analysis_config (
      id integer primary key check(id=1), enabled integer not null default 0,
      preference text not null default 'default-only', configured integer not null default 0,
      paused integer not null default 0, internal_write integer not null default 0);
      insert or ignore into style_analysis_config(id) values(1);`);
    // Historical genre has no edit provenance; retain it as the imported baseline.
    if (!columns.has("imported_style")) db.exec(`update tracks set imported_style=${clean("genre")}`);
    db.exec(`
      drop trigger if exists style_track_insert;
      drop trigger if exists style_metadata_write;
      drop trigger if exists style_source_write;
      drop trigger if exists style_file_changed;
      create trigger style_track_insert after insert on tracks begin
        update style_analysis_config set internal_write=1 where id=1;
        update tracks set imported_style=coalesce(${clean("new.imported_style")},${clean("new.genre")}),
          user_style=${clean("new.user_style")},derived_style=${clean("new.derived_style")},
          style_pending=(select enabled from style_analysis_config where id=1) where id=new.id;
        update tracks set genre=${effectiveSql} where id=new.id;
        update style_analysis_config set internal_write=0 where id=1;
      end;
      create trigger style_metadata_write after update of genre on tracks
      when (select internal_write from style_analysis_config where id=1)=0 begin
        update style_analysis_config set internal_write=1 where id=1;
        update tracks set imported_style=${clean("new.genre")} where id=new.id;
        update tracks set genre=${effectiveSql} where id=new.id;
        update style_analysis_config set internal_write=0 where id=1;
      end;
      create trigger style_source_write after update of imported_style,user_style,derived_style,user_style_active on tracks
      when (select internal_write from style_analysis_config where id=1)=0 begin
        update style_analysis_config set internal_write=1 where id=1;
        update tracks set imported_style=${clean("imported_style")},user_style=${clean("user_style")},derived_style=${clean("derived_style")} where id=new.id;
        update tracks set genre=${effectiveSql} where id=new.id;
        update style_analysis_config set internal_write=0 where id=1;
      end;
      create trigger style_file_changed after update of file_hash,file_size,file_mtime_ms on tracks
      when new.file_hash is not old.file_hash or new.file_size is not old.file_size or new.file_mtime_ms is not old.file_mtime_ms begin
        update tracks set derived_style=null,style_analysis_key=null,style_error=null,
          style_pending=(select enabled from style_analysis_config where id=1) where id=new.id;
      end;
      update style_analysis_config set internal_write=1 where id=1;
      update tracks set imported_style=${clean("imported_style")},user_style=${clean("user_style")},derived_style=${clean("derived_style")}
        where imported_style is not (${clean("imported_style")}) or user_style is not (${clean("user_style")}) or derived_style is not (${clean("derived_style")});
      update tracks set genre=${effectiveSql} where genre is not (${effectiveSql});
      update style_analysis_config set internal_write=0 where id=1;
    `);
  })();
};
export const getStyleConfig = (db: Database.Database): StyleConfig => {
  const row = db.prepare("select * from style_analysis_config where id=1").get() as any;
  return {enabled:!!row.enabled,preference:row.preference,configured:!!row.configured,paused:!!row.paused};
};
export const setStyleConfig = (db: Database.Database, config: StyleConfig) => {
  if (typeof config.enabled !== "boolean" || typeof config.paused !== "boolean" ||
    !["prefer-user","derived-only","default-only"].includes(config.preference)) throw Error("Invalid style analysis settings");
  db.transaction(() => {
    const previous = getStyleConfig(db);
    // Enabling Always starts a new derived baseline.
    // Mode changes, pause/resume and reanalysis retain later manual choices.
    const reset = config.preference === "derived-only" && !previous.enabled && config.enabled;
    db.prepare("update style_analysis_config set enabled=?,preference=?,configured=1,paused=?,internal_write=1 where id=1")
      .run(+config.enabled,config.preference,+config.paused);
    if (reset) db.exec("update tracks set user_style_active=0");
    db.exec(`update tracks set genre=${effectiveSql} where genre is not (${effectiveSql})`);
    db.exec("update style_analysis_config set internal_write=0 where id=1");
  })();
};
export const getTrackStyle = (db: Database.Database,id:string): StyleTrack | null =>
  (db.prepare("select imported_style,user_style,derived_style,user_style_active,genre,style_error,style_analysis_key from tracks where id=?").get(id) as StyleTrack) ?? null;
export const saveTrackStyle = (db: Database.Database,id:string,style:string|null) => {
  const value = normalizeStyleValue(style);
  if (value) db.prepare("update tracks set user_style=?,user_style_active=1 where id=?").run(value,id);
};
/** Resolve acoustic labels through configured base names and aliases; never invent subtypes. */
export const mapDerivedStyle = (db: Database.Database, label: string): string => {
  const alternatives = label.toLowerCase() === "vals" || label.toLowerCase() === "waltz"
    ? ["waltz","vals","valse","walzer","valzer","valsa","valsur"] : [label.toLowerCase()];
  if (!alternatives.some(value => ["waltz","vals","valse","tango","milonga"].includes(value))) throw Error("Unknown derived style");
  for (const normalized of alternatives) {
    const row = db.prepare(`select name from styles where lower(normalized)=? union all
      select style_name as name from style_aliases where lower(alias_normalized)=? limit 1`).get(normalized,normalized) as {name:string}|undefined;
    if (row && !row.name.includes(" - ")) return row.name;
  }
  const name = alternatives[0] === "waltz" ? "Waltz" : label[0].toUpperCase()+label.slice(1).toLowerCase();
  db.prepare("insert or ignore into styles(name,normalized) values(?,?)").run(name,name.toLowerCase());
  return name;
};
