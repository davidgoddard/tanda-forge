import { Worker } from "worker_threads";
import path from "path";
import { stat } from "fs/promises";
import type Database from "better-sqlite3";
import { getBpmConfig } from "./store";
import { getStyleConfig, mapDerivedStyle } from "../style/store";
import { roundBpm } from "../../shared/bpm";
import type { AudioAnalysisResult } from "./pipeline";
import type { BpmStatus } from "../../shared/bpm";

export const bpmWorkerPath = (directory: string) => path.join(
  directory.split(path.sep).map(part => part === "app.asar" ? "app.asar.unpacked" : part).join(path.sep),
  "worker.js",
);
export const BPM_ALGORITHM = "stft-windowed-recurrence-v3";
export const STYLE_ALGORITHM = "dtoty-rhythm-1";
type Kind = "bpm" | "style";
type Item = {id:string; full_path:string; file_hash:string; file_size:number; file_mtime_ms:number; bpm_pending:number;style_pending:number};
export const analysisKey = (item:Pick<Item,"file_hash"|"file_size"|"file_mtime_ms">,kind:Kind="bpm") =>
  JSON.stringify([kind==="bpm"?BPM_ALGORITHM:`${STYLE_ALGORITHM}/${BPM_ALGORITHM}`,item.file_hash,item.file_size,item.file_mtime_ms]);
type Result = AudioAnalysisResult;
export class BpmService {
  private timer:ReturnType<typeof setInterval>|null=null;
  private busy=false;
  private activeKinds:Kind[]=[];
  private stopped=false;
  private permittedUntil=0;
  revision=0;
  constructor(private database:()=>Database.Database,private ffmpeg:()=>string,private blocked:()=>boolean,
    private changed:()=>void=()=>{}) {}
  permit(allowed:boolean) { this.permittedUntil=allowed ? Date.now()+5000 : 0; }
  async waitUntilIdle() { while (this.busy) await new Promise(resolve => setTimeout(resolve,25)); }
  start() { this.timer=setInterval(()=>{void this.tick();},2000); this.timer.unref(); }
  stop() { this.stopped=true; if(this.timer) clearInterval(this.timer); }
  status(kind:Kind="bpm"):BpmStatus {
    const db=this.database();
    const counts=db.prepare(`select count(*) total,
      coalesce(sum(${kind}_analysis_key is not null and ${kind}_error is null and ${kind}_pending=0),0) completed,
      coalesce(sum(${kind}_error is not null and ${kind}_pending=0),0) failed from tracks t join library_roots r on r.id=t.root_id
      where t.deleted_at is null and r.kind='music'`).get() as any;
    return {...(kind==="bpm"?getBpmConfig(db):getStyleConfig(db)),...counts,
      running:this.busy&&this.activeKinds.includes(kind),suspended:this.blocked()||Date.now()>this.permittedUntil,revision:this.revision};
  }
  retry(kind:Kind="bpm") { this.queue(kind,true); }
  analyse(kind:Kind="bpm") { this.queue(kind,false); }
  private queue(kind:Kind,failedOnly:boolean) {
    // Incrementing pending also invalidates a result already in flight when reanalysis is requested.
    this.database().exec(`update tracks set ${kind}_pending=${kind}_pending+1
      where deleted_at is null and root_id in (select id from library_roots where kind='music')
      ${failedOnly?`and ${kind}_error is not null`:""}`);
    this.revision++;
  }
  async tick() {
    if(this.busy||this.stopped||this.blocked()||Date.now()>this.permittedUntil) return;
    const db=this.database(),bpm=getBpmConfig(db),style=getStyleConfig(db);
    const bpmEnabled=bpm.enabled&&!bpm.paused,styleEnabled=style.enabled&&!style.paused;
    if(!bpmEnabled&&!styleEnabled) return;
    const item=db.prepare(`select t.id,t.full_path,t.file_hash,t.file_size,t.file_mtime_ms,t.bpm_pending,t.style_pending from tracks t
      join library_roots r on r.id=t.root_id where t.deleted_at is null and r.kind='music'
      and ((? and t.bpm_pending>0) or (? and t.style_pending>0)) order by t.created_at,t.id limit 1`)
      .get(+bpmEnabled,+styleEnabled) as Item|undefined;
    if(!item) return;
    const kinds:Kind[]=[];
    if(bpmEnabled&&item.bpm_pending>0) kinds.push("bpm");
    if(styleEnabled&&item.style_pending>0) kinds.push("style");
    this.busy=true;this.activeKinds=kinds;
    let result:Result;
    try {
      const before=await stat(item.full_path);
      result=await new Promise<Result>((resolve,reject)=>{
        const worker=new Worker(bpmWorkerPath(__dirname),{workerData:{filename:item.full_path,ffmpegPath:this.ffmpeg(),style:kinds.includes("style")}});
        const timeout=setTimeout(()=>{void worker.terminate();reject(Error("Audio analysis timed out"));},180000);
        worker.once("message",value=>{clearTimeout(timeout);resolve(value);});
        worker.once("error",error=>{clearTimeout(timeout);reject(error);});
        worker.once("exit",code=>{clearTimeout(timeout);reject(Error(`Analysis worker exited before returning a result (${code})`));});
      });
      const after=await stat(item.full_path);
      if(before.size!==after.size||before.mtimeMs!==after.mtimeMs) throw Error("Audio changed during analysis; retry after scanning");
      if(result.bpm!=null&&(!Number.isFinite(result.bpm)||result.bpm<=0)) throw Error("Invalid analyser result");
    } catch(error) { result={error:error instanceof Error?error.message:String(error)}; }
    try {
      if(this.stopped||this.database()!==db) return;
      db.transaction(()=>{
        for(const kind of kinds) {
          let value:number|string|null=null;
          let error=result.error??null;
          if(!error) {
            if(kind==="bpm") { value=roundBpm(result.bpm);error=value==null?"No tempo found":null; }
            else {
              error=result.styleError??null;
              try { value=!error&&result.style?mapDerivedStyle(db,result.style):null; }
              catch(e) { error=e instanceof Error?e.message:String(e); }
              if(value==null&&!error) error="No style found";
            }
          }
          const update = db.prepare(`update tracks set derived_${kind}=?,${kind}_analysis_key=?,${kind}_error=?,${kind}_analyzed_at=?,${kind}_pending=0
            where id=? and file_hash=? and file_size is ? and file_mtime_ms is ? and deleted_at is null and ${kind}_pending=?`)
            .run(value,analysisKey(item,kind),error,new Date().toISOString(),item.id,item.file_hash,item.file_size,item.file_mtime_ms,item[`${kind}_pending`]);
          if(kind === "bpm" && update.changes) db.prepare("update tracks set bpm_warnings=? where id=?")
            .run(JSON.stringify(result.warnings ?? []),item.id);
        }
      })();
      this.revision++;this.changed();
    } finally {
      this.busy=false;this.activeKinds=[];
      if (!this.stopped) setTimeout(() => { void this.tick(); },250).unref();
    }
  }
}
