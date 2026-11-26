import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { ensureBpmSchema, getBpmConfig, getTrackBpm, saveTrackBpm, setBpmConfig } from "../app/src/main/bpm/store";
import { ensureStyleAnalysisSchema, getTrackStyle, saveTrackStyle, setStyleConfig, mapDerivedStyle } from "../app/src/main/style/store";
import { effectiveBpm, resolveAnalysisValue } from "../app/src/shared/bpm";
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
  db.exec(`create table tracks(id text primary key,bpm real,genre text,file_hash text,file_size integer,file_mtime_ms integer);
    insert into tracks values('a',64,'Tango','hash',100,1),('b',null,null,'hash-b',200,2);`);
  ensureBpmSchema(db);ensureStyleAnalysisSchema(db);return db;
};
afterEach(()=>directories.splice(0).forEach(dir=>fs.rmSync(dir,{recursive:true,force:true})));

describe("independent audio analysis sources",()=>{
  it("migrates existing metadata once and starts disabled with default-only policy",()=>{
    const db=database();expect(getBpmConfig(db)).toMatchObject({enabled:false,preference:"default-only"});
    expect(getTrackBpm(db,"a")).toMatchObject({user_bpm:64,bpm_override:null,bpm:64});
    expect(getTrackStyle(db,"a")).toMatchObject({imported_style:"Tango",user_style:null,genre:"Tango"});
    db.exec("update tracks set derived_bpm=66,derived_style='Waltz' where id='a'");
    ensureBpmSchema(db);ensureStyleAnalysisSchema(db);
    expect(getTrackStyle(db,"a")).toMatchObject({imported_style:"Tango",derived_style:"Waltz",genre:"Tango"});
  });
  it("applies all three policies with every combination of missing sources, including failed analysis",()=>{
    const db=database();
    for(const enabled of [true,false])for(const preference of ["derived-only","prefer-user","default-only"] as const) {
      const config={enabled,preference,configured:true,paused:false};setBpmConfig(db,config);setStyleConfig(db,config);
      for(const imported of [null,64])for(const derived of [null,66])for(const user of [null,68]) {
        db.prepare("update tracks set bpm_override_active=1,user_style_active=1,user_bpm=?,derived_bpm=?,bpm_override=?,imported_style=?,derived_style=?,user_style=? where id='a'")
          .run(imported,derived,user,imported===null?null:"Tango",derived===null?null:"Waltz",user===null?null:"Milonga");
        expect(getTrackBpm(db,"a")?.bpm).toBe(effectiveBpm(config,imported,derived,user));
        expect(getTrackStyle(db,"a")?.genre).toBe(resolveAnalysisValue(config,imported===null?null:"Tango",derived===null?null:"Waltz",user===null?null:"Milonga"));
      }
    }
  });
  it("preserves manual values across reanalysis, disable, re-enable, and source-file replacement",()=>{
    const db=database();const config={enabled:true,preference:"prefer-user" as const,configured:true,paused:false};
    setBpmConfig(db,config);setStyleConfig(db,config);
    saveTrackBpm(db,"a",71.7);saveTrackStyle(db,"a","Milonga");
    db.exec("update tracks set derived_bpm=65,derived_style='Waltz',bpm_analysis_key='done',style_analysis_key='done' where id='a'");
    expect(getTrackBpm(db,"a")).toMatchObject({user_bpm:64,bpm_override:72,bpm:72});
    expect(getTrackStyle(db,"a")).toMatchObject({imported_style:"Tango",user_style:"Milonga",genre:"Milonga"});
    setBpmConfig(db,{...config,enabled:false});setStyleConfig(db,{...config,enabled:false});
    expect(getTrackBpm(db,"a")?.bpm).toBe(72);expect(getTrackStyle(db,"a")?.genre).toBe("Milonga");
    setBpmConfig(db,config);setStyleConfig(db,config);
    db.exec("update tracks set file_hash='changed' where id='a'");
    expect(getTrackBpm(db,"a")).toMatchObject({derived_bpm:null,bpm_analysis_key:null,bpm_override:72,bpm:72});
    expect(getTrackStyle(db,"a")).toMatchObject({derived_style:null,style_analysis_key:null,user_style:"Milonga",genre:"Milonga"});
    saveTrackBpm(db,"a",null);saveTrackStyle(db,"a",null);
    expect(getTrackBpm(db,"a")?.bpm).toBe(72);expect(getTrackStyle(db,"a")?.genre).toBe("Milonga");
  });
  it("Always resets previous overrides but retains later deliberate edits across reanalysis and restart",()=>{
    const db=database();const config={enabled:true,preference:"derived-only" as const,configured:true,paused:false};
    saveTrackBpm(db,"a",70);saveTrackStyle(db,"a","Milonga");
    setBpmConfig(db,config);setStyleConfig(db,config);
    expect(getTrackBpm(db,"a")).toMatchObject({bpm:null,bpm_override:70,bpm_override_active:0});
    expect(getTrackStyle(db,"a")).toMatchObject({genre:null,user_style:"Milonga",user_style_active:0});
    db.exec("update tracks set derived_bpm=65,derived_style='Waltz' where id='a'");
    expect(getTrackBpm(db,"a")?.bpm).toBe(65);expect(getTrackStyle(db,"a")?.genre).toBe("Waltz");
    // Deliberately selecting the same retained value also reinstates it.
    saveTrackBpm(db,"a",70);saveTrackStyle(db,"a","Milonga");
    db.exec("update tracks set derived_bpm=66,derived_style='Tango' where id='a'");
    setBpmConfig(db,{...config,paused:true});setStyleConfig(db,{...config,paused:true});
    setBpmConfig(db,config);setStyleConfig(db,config);
    ensureBpmSchema(db);ensureStyleAnalysisSchema(db);
    expect(getTrackBpm(db,"a")?.bpm).toBe(70);expect(getTrackStyle(db,"a")?.genre).toBe("Milonga");
    setBpmConfig(db,{...config,preference:"default-only"});setStyleConfig(db,{...config,preference:"default-only"});
    setBpmConfig(db,config);setStyleConfig(db,config);
    expect(getTrackBpm(db,"a")?.bpm).toBe(70);expect(getTrackStyle(db,"a")?.genre).toBe("Milonga");
    setBpmConfig(db,{...config,enabled:false});setStyleConfig(db,{...config,enabled:false});
    expect(getTrackBpm(db,"a")?.bpm).toBe(70);
    setBpmConfig(db,config);setStyleConfig(db,config);
    expect(getTrackBpm(db,"a")).toMatchObject({bpm:66,bpm_override:70,bpm_override_active:0});
    expect(getTrackStyle(db,"a")).toMatchObject({genre:"Tango",user_style:"Milonga",user_style_active:0});
    setBpmConfig(db,{...config,preference:"prefer-user"});setStyleConfig(db,{...config,preference:"prefer-user"});
    expect(getTrackBpm(db,"a")?.bpm).toBe(70);expect(getTrackStyle(db,"a")?.genre).toBe("Milonga");
  });
  it("retains imported provenance on insert and repeated metadata writes, even when equal to the effective value",()=>{
    const db=database();const config={enabled:true,preference:"derived-only" as const,configured:true,paused:false};
    setBpmConfig(db,config);setStyleConfig(db,config);
    db.exec("insert into tracks(id,bpm,genre) values('new',80,'Milonga')");
    expect(getTrackBpm(db,"new")).toMatchObject({user_bpm:80,bpm:null});
    expect(getTrackStyle(db,"new")).toMatchObject({imported_style:"Milonga",genre:null});
    db.exec("update tracks set derived_bpm=66,derived_style='Waltz' where id='a'");
    db.exec("update tracks set bpm=66,genre='Waltz' where id='a'");
    expect(getTrackBpm(db,"a")).toMatchObject({user_bpm:66,derived_bpm:66});
    expect(getTrackStyle(db,"a")).toMatchObject({imported_style:"Waltz",derived_style:"Waltz"});
    expect(db.prepare("select bpm_pending,style_pending from tracks where id='new'").get()).toEqual({bpm_pending:1,style_pending:1});
  });
  it("updates search consumers while leaving explicit tanda styles intact",()=>{
    const db=database();db.exec(`create table tanda_styles(tanda_id text,style_name text);
      insert into tanda_styles values('tanda','Tango');
      create virtual table derived_search using fts5(id unindexed,bpm,genre);
      insert into derived_search select id,bpm,genre from tracks;
      create trigger search_update after update of bpm,genre on tracks begin
        delete from derived_search where id=new.id;
        insert into derived_search values(new.id,new.bpm,new.genre);
      end;`);
    const config={enabled:true,preference:"prefer-user" as const,configured:true,paused:false};setBpmConfig(db,config);setStyleConfig(db,config);
    db.exec("update tracks set derived_bpm=66,derived_style='Waltz' where id='a'");
    expect(db.prepare("select id from derived_search where derived_search match 'Waltz'").all()).toEqual([{id:"a"}]);
    saveTrackStyle(db,"a","Milonga");
    expect(db.prepare("select id from derived_search where derived_search match 'Waltz'").all()).toEqual([]);
    expect(db.prepare("select * from tanda_styles").all()).toEqual([{tanda_id:"tanda",style_name:"Tango"}]);
  });
  it("maps waltz onto configured base styles and aliases without creating subtypes",()=>{
    const db=database();db.exec("create table styles(name text,normalized text unique); create table style_aliases(style_name text,alias_normalized text);");
    db.exec("insert into styles values('Vals','vals');");
    expect(mapDerivedStyle(db,"Waltz")).toBe("Vals");
    expect(mapDerivedStyle(db,"Tango")).toBe("Tango");
    expect(()=>mapDerivedStyle(db,"Other")).toThrow();
    expect(db.prepare("select name from styles order by name").all()).toEqual([{name:"Tango"},{name:"Vals"}]);
  });
  it("rejects invalid manual tempos and configurations",()=>{
    const db=database();expect(()=>saveTrackBpm(db,"a",NaN)).toThrow("Invalid BPM");
    expect(()=>saveTrackBpm(db,"a",-1)).toThrow("Invalid BPM");
    expect(()=>setBpmConfig(db,{enabled:true,preference:"bad",paused:false} as any)).toThrow();
  });
});

describe("legacy unknown style markers",()=>{
  it("repairs existing unknown user styles on startup without replacing real overrides",()=>{
    const db=database();
    // Simulate persisted data written before source normalization existed.
    db.exec("update style_analysis_config set internal_write=1; update tracks set imported_style='Milonga',derived_style='Milonga',user_style=' ? ',genre='?' where id='a'; update style_analysis_config set internal_write=0;");
    ensureStyleAnalysisSchema(db);
    expect(getTrackStyle(db,"a")).toMatchObject({imported_style:"Milonga",derived_style:"Milonga",user_style:null,genre:"Milonga"});
    saveTrackStyle(db,"a","Tango");ensureStyleAnalysisSchema(db);
    expect(getTrackStyle(db,"a")).toMatchObject({user_style:"Tango",genre:"Tango"});
  });
  it("never lets unknown markers win precedence in any mode or create a user override",()=>{
    const db=database();
    for(const preference of ["derived-only","prefer-user","default-only"] as const) {
      setStyleConfig(db,{enabled:true,preference,configured:true,paused:false});
      db.exec("update tracks set imported_style='Milonga',derived_style='Milonga',user_style='?',user_style_active=1 where id='a'");
      expect(getTrackStyle(db,"a")).toMatchObject({user_style:null,genre:"Milonga"});
      saveTrackStyle(db,"a"," ? ");
      expect(getTrackStyle(db,"a")).toMatchObject({user_style:null,genre:"Milonga"});
      db.exec("update tracks set imported_style='?',derived_style=' ',user_style=' ? ' where id='a'");
      expect(getTrackStyle(db,"a")).toMatchObject({imported_style:null,derived_style:null,user_style:null,genre:null});
    }
  });
});
