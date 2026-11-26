import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureBpmSchema, setBpmConfig } from "../app/src/main/bpm/store";
import { ensureStyleAnalysisSchema, setStyleConfig } from "../app/src/main/style/store";
import { BpmService } from "../app/src/main/bpm/service";

const workerState=vi.hoisted(()=>({calls:[] as any[],result:{} as any,beforeReply:undefined as (()=>void)|undefined}));
vi.mock("worker_threads",async()=>{
  const {EventEmitter}=await import("node:events");
  return {Worker:class extends EventEmitter {
    constructor(_path:string,options:any) {
      super();workerState.calls.push(options.workerData);
      queueMicrotask(()=>{workerState.beforeReply?.();this.emit("message",workerState.result);});
    }
    terminate(){return Promise.resolve(0);}
  }};
});
const directories:string[]=[];
const database=()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"tanda-analysis-queue-"));directories.push(directory);
  const filename=path.join(directory,"track.wav");fs.writeFileSync(filename,"audio");
  const file=path.join(directory,"test.db");
  const execute=(sql:string)=>execFileSync("sqlite3",["-json",file,sql],{encoding:"utf8"}).trim();
  const bind=(sql:string,values:unknown[])=>{let i=0;return sql.replace(/\?/g,()=>{
    const value=values[i++];return value==null?"null":typeof value==="number"?String(value):`'${String(value).replace(/'/g,"''")}'`;
  });};
  const db:any={exec:(sql:string)=>execute(sql),transaction:(fn:()=>unknown)=>fn,prepare:(sql:string)=>({
    run:(...values:unknown[])=>JSON.parse(execute(bind(sql,values)+";select changes() as changes;")||"[]")[0],
    all:(...values:unknown[])=>JSON.parse(execute(bind(sql,values))||"[]"),
    get:(...values:unknown[])=>JSON.parse(execute(bind(sql,values))||"[]")[0],
  })};
  db.exec(`create table library_roots(id text,kind text); insert into library_roots values('music','music'),('cortina','cortina');
    create table tracks(id text primary key,root_id text,full_path text,bpm real,genre text,file_hash text,file_size integer,file_mtime_ms integer,deleted_at text,created_at text);
    create table styles(name text,normalized text unique);create table style_aliases(style_name text,alias_normalized text);`);
  ensureBpmSchema(db);ensureStyleAnalysisSchema(db);
  db.prepare("insert into tracks(id,root_id,full_path,bpm,genre,file_hash,created_at) values('a','music',?,66,'Tango','hash','now')").run(filename);
  return db;
};
const config={enabled:true,preference:"prefer-user" as const,configured:true,paused:false};
beforeEach(()=>{vi.useFakeTimers();workerState.calls=[];workerState.result={bpm:64,style:"Vals",warnings:[]};workerState.beforeReply=undefined;});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();directories.splice(0).forEach(dir=>fs.rmSync(dir,{recursive:true,force:true}));});

describe("shared playback-safe analysis queue",()=>{
  it("waits for Analyse for existing files, honours the playback lease and maintenance, and shares work",async()=>{
    const db=database();setBpmConfig(db,config);setStyleConfig(db,config);
    let blocked=false;const service=new BpmService(()=>db,()=>"ffmpeg",()=>blocked);
    service.permit(true);await service.tick();expect(workerState.calls).toHaveLength(0);
    service.analyse();service.analyse("style");service.permit(false);
    await service.tick();expect(workerState.calls).toHaveLength(0);
    service.permit(true);blocked=true;await service.tick();expect(workerState.calls).toHaveLength(0);
    blocked=false;await service.tick();expect(workerState.calls).toHaveLength(1);
    expect(workerState.calls[0].style).toBe(true);
    expect(db.prepare("select bpm,genre,bpm_pending,style_pending from tracks where id='a'").get())
      .toEqual({bpm:64,genre:"Waltz",bpm_pending:0,style_pending:0});
    expect(service.status("style").completed).toBe(1);service.stop();
  });
  it("runs style independently without writing BPM and excludes deleted files and cortinas",async()=>{
    const db=database();setStyleConfig(db,config);
    db.exec("insert into tracks(id,root_id) values('c','cortina'); insert into tracks(id,root_id,deleted_at) values('d','music','deleted')");
    const service=new BpmService(()=>db,()=>"ffmpeg",()=>false);service.permit(true);service.analyse("style");
    await service.tick();await service.tick();
    expect(workerState.calls).toHaveLength(1);
    expect(db.prepare("select bpm,derived_bpm,genre from tracks where id='a'").get()).toEqual({bpm:66,derived_bpm:null,genre:"Waltz"});
    service.stop();
  });
  it("does not consume a newer reanalysis request with a result already in flight",async()=>{
    const db=database();setStyleConfig(db,config);
    const service=new BpmService(()=>db,()=>"ffmpeg",()=>false);service.permit(true);service.analyse("style");
    workerState.beforeReply=()=>service.analyse("style");await service.tick();
    expect(db.prepare("select derived_style,style_pending from tracks where id='a'").get()).toEqual({derived_style:null,style_pending:2});
    workerState.beforeReply=undefined;await service.tick();
    expect(db.prepare("select derived_style,style_pending from tracks where id='a'").get()).toEqual({derived_style:"Waltz",style_pending:0});service.stop();
  });
  it("clears previous derived results on failure, retains manual values, and retries explicitly",async()=>{
    const db=database();setBpmConfig(db,config);setStyleConfig(db,config);
    db.exec("update tracks set bpm_override=72,user_style='Milonga',derived_bpm=64,derived_style='Waltz'");
    const service=new BpmService(()=>db,()=>"ffmpeg",()=>false);service.permit(true);service.analyse();service.analyse("style");
    workerState.result={error:"Invalid audio"};await service.tick();
    expect(db.prepare("select bpm,genre,derived_bpm,derived_style from tracks where id='a'").get()).toEqual({bpm:72,genre:"Milonga",derived_bpm:null,derived_style:null});
    expect(service.status().failed).toBe(1);expect(service.status("style").failed).toBe(1);
    await service.tick();expect(workerState.calls).toHaveLength(1);
    workerState.result={bpm:65,style:"Tango"};service.retry();service.retry("style");await service.tick();
    expect(service.status().failed).toBe(0);expect(service.status("style").completed).toBe(1);
    expect(db.prepare("select bpm,genre from tracks where id='a'").get()).toEqual({bpm:72,genre:"Milonga"});service.stop();
  });
});
