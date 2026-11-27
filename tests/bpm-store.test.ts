import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { ensureBpmSchema, getBpmConfig, getTrackBpm, saveTrackBpm, setBpmConfig } from "../app/src/main/bpm/store";
import { effectiveBpm } from "../app/src/shared/bpm";

// Exercise real SQLite triggers even when the native addon targets Electron's ABI.
const directories:string[]=[];
const database=()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"tanda-bpm-test-"));directories.push(dir);
  const file=path.join(dir,"test.db");
  const execute=(sql:string)=>execFileSync("sqlite3",["-json",file,"pragma trusted_schema=on;"+sql],{encoding:"utf8"}).trim();
  const bind=(sql:string,values:unknown[])=>{let i=0;return sql.replace(/\?/g,()=>{
    const value=values[i++];return value==null?"null":typeof value==="number"?String(value):`'${String(value).replace(/'/g,"''")}'`;
  });};
  const db:any={exec:(sql:string)=>execute(sql),transaction:(fn:()=>unknown)=>fn,prepare:(sql:string)=>({
    run:(...values:unknown[])=>execute(bind(sql,values)),
    all:(...values:unknown[])=>JSON.parse(execute(bind(sql,values))||"[]"),
    get:(...values:unknown[])=>JSON.parse(execute(bind(sql,values))||"[]")[0],
  })};
  db.exec(`create table tracks(id text primary key,bpm real,file_hash text,file_size integer,file_mtime_ms integer);
    insert into tracks values('a',64,'hash',100,1),('b',null,'hash-b',200,2);`);
  ensureBpmSchema(db);return db;
};
afterEach(()=>directories.splice(0).forEach(dir=>fs.rmSync(dir,{recursive:true,force:true})));
const enable=(db:any,preference:"prefer-user"|"derived-only"="prefer-user")=>setBpmConfig(db,{enabled:true,preference,configured:true,paused:false});
describe("BPM source preservation",()=>{
  it("preserves entered BPM on unrelated edits and applies a manual BPM in derived-only mode",()=>{
    const db=database();enable(db,"derived-only");
    db.exec("update tracks set derived_bpm=55 where id='b'");
    saveTrackBpm(db,"b",undefined);
    expect(getTrackBpm(db,"b")).toMatchObject({user_bpm:null,bpm:55});
    saveTrackBpm(db,"b",undefined,57);
    expect(getTrackBpm(db,"b")).toMatchObject({user_bpm:null,bpm:57});
    saveTrackBpm(db,"b",60,60);
    expect(getTrackBpm(db,"b")).toMatchObject({user_bpm:60,derived_bpm:55,bpm:60});
    saveTrackBpm(db,"b",null,null);
    expect(getTrackBpm(db,"b")).toMatchObject({user_bpm:null,bpm_override:null,bpm:55});
  });
  it("migrates existing values once and starts disabled",()=>{
    const db=database();expect(getBpmConfig(db).enabled).toBe(false);
    expect(getTrackBpm(db,"a")?.user_bpm).toBe(64);
    enable(db,"derived-only");db.exec("update tracks set derived_bpm=66 where id='a'");
    ensureBpmSchema(db);
    expect(getTrackBpm(db,"a")).toMatchObject({user_bpm:64,derived_bpm:66,bpm:66});
  });
  it("applies both policies, including unknown results and tracks with no entered BPM",()=>{
    const db=database();enable(db);
    db.exec("update tracks set derived_bpm=66");
    expect(getTrackBpm(db,"a")?.bpm).toBe(64);expect(getTrackBpm(db,"b")?.bpm).toBe(66);
    enable(db,"derived-only");expect(getTrackBpm(db,"a")?.bpm).toBe(66);
    db.exec("update tracks set derived_bpm=null where id='a'");expect(getTrackBpm(db,"a")?.bpm).toBeNull();
  });
  it("keeps corrections across new results, disable and re-enable without changing entered data",()=>{
    const db=database();enable(db);db.exec("update tracks set derived_bpm=66 where id='a'");
    saveTrackBpm(db,"a",64,68);db.exec("update tracks set derived_bpm=67 where id='a'");
    expect(getTrackBpm(db,"a")).toMatchObject({user_bpm:64,derived_bpm:67,bpm_override:68,bpm:68});
    setBpmConfig(db,{...getBpmConfig(db),enabled:false});expect(getTrackBpm(db,"a")?.bpm).toBe(64);
    enable(db,"derived-only");expect(getTrackBpm(db,"a")?.bpm).toBe(68);
    saveTrackBpm(db,"a",64,null);expect(getTrackBpm(db,"a")?.bpm).toBe(67);
  });
  it("keeps metadata writes and new imports separate from the effective value",()=>{
    const db=database();enable(db,"derived-only");
    db.exec("insert into tracks(id,bpm) values('new',80)");
    expect(getTrackBpm(db,"new")).toMatchObject({user_bpm:80,bpm:null});
    db.exec("update tracks set derived_bpm=66 where id='a'");
    saveTrackBpm(db,"a",66);expect(getTrackBpm(db,"a")?.user_bpm).toBe(66);
    db.exec("update tracks set user_bpm=70 where id='a'");
    expect(getTrackBpm(db,"a")).toMatchObject({user_bpm:70,bpm:66});
    db.exec("update tracks set bpm=72 where id='a'");
    expect(getTrackBpm(db,"a")).toMatchObject({user_bpm:72,bpm:66});
  });
  it("invalidates stale audio results while retaining entered data",()=>{
    const db=database();enable(db,"derived-only");
    db.exec("update tracks set derived_bpm=66,bpm_analysis_key='done',bpm_override=68 where id='a'");
    db.exec("update tracks set file_hash='replacement' where id='a'");
    expect(getTrackBpm(db,"a")).toMatchObject({user_bpm:64,derived_bpm:null,bpm_override:null,bpm_analysis_key:null,bpm:null});
  });
  it("updates a search index when policy or correction changes",()=>{
    const db=database();db.exec(`create virtual table tempo_search using fts5(id unindexed,bpm);
      insert into tempo_search select id,bpm from tracks;
      create trigger test_tempo_search after update of bpm on tracks begin
        delete from tempo_search where id=new.id;
        insert into tempo_search values(new.id,new.bpm);
      end;`);
    enable(db,"derived-only");db.exec("update tracks set derived_bpm=66 where id='a'");
    expect(db.prepare("select id from tempo_search where tempo_search match '66'").all()).toEqual([{id:"a"}]);
    saveTrackBpm(db,"a",64,68);
    expect(db.prepare("select id from tempo_search where tempo_search match '66'").all()).toEqual([]);
    expect(db.prepare("select id from tempo_search where tempo_search match '68'").all()).toEqual([{id:"a"}]);
  });
  it("rejects invalid corrections and corrections while disabled",()=>{
    const db=database();expect(()=>saveTrackBpm(db,"a",64,68)).toThrow("disabled");
    enable(db);expect(()=>saveTrackBpm(db,"a",64,NaN)).toThrow("Invalid BPM");
    expect(()=>saveTrackBpm(db,"a",64,-1)).toThrow("Invalid BPM");
  });
  it("rounds existing estimates without rescanning or changing original imported values",()=>{
    const db=database();enable(db,"derived-only");
    db.exec("update tracks set user_bpm=63.4,derived_bpm=64.17871522752691,bpm_analysis_key='complete' where id='a'");
    ensureBpmSchema(db);
    expect(getTrackBpm(db,"a")).toMatchObject({user_bpm:63.4,derived_bpm:64,bpm:64,bpm_analysis_key:"complete"});
    saveTrackBpm(db,"a",63,70.7);
    expect(getTrackBpm(db,"a")).toMatchObject({user_bpm:63,bpm_override:71,bpm:71});
    setBpmConfig(db,{...getBpmConfig(db),enabled:false});
    expect(getTrackBpm(db,"a")?.bpm).toBe(63);
  });
  it("agrees with the policy function for all source combinations",()=>{
    const db=database();
    for(const enabled of [false,true]) for(const preference of ["prefer-user","derived-only"] as const) {
      const config={enabled,preference,configured:true,paused:false};setBpmConfig(db,config);
      for(const user of [null,64.2]) for(const derived of [null,66.8]) for(const correction of [null,68.4]) {
        db.prepare("update tracks set user_bpm=?,derived_bpm=?,bpm_override=? where id='a'").run(user,derived,correction);
        expect(getTrackBpm(db,"a")?.bpm).toBe(effectiveBpm(config,user,derived,correction));
      }
    }
  });
});
