import { Worker } from "worker_threads";
import path from "path";
import { stat } from "fs/promises";
import type Database from "better-sqlite3";
import { getBpmConfig } from "./store";
import { roundBpm } from "../../shared/bpm";
import type { BpmStatus } from "../../shared/bpm";

// Workers and native ESM imports use real files in installed Electron builds.
export const bpmWorkerPath = (directory: string) => path.join(
  directory.split(path.sep).map(part => part === "app.asar" ? "app.asar.unpacked" : part).join(path.sep),
  "worker.js",
);

export const BPM_ALGORITHM = "stft-windowed-recurrence-v3";
type Item = {id:string; full_path:string; file_hash:string; file_size:number; file_mtime_ms:number};
export const analysisKey = (item:Item) => JSON.stringify([BPM_ALGORITHM,item.file_hash,item.file_size,item.file_mtime_ms]);
export class BpmService {
  private timer:ReturnType<typeof setInterval>|null=null;
  private busy=false;
  private stopped=false;
  private permittedUntil=0;
  revision=0;
  constructor(private database:()=>Database.Database,private ffmpeg:()=>string,private blocked:()=>boolean) {}
  // Renderer renews this lease only outside live mode/main playback. Missing UI is safe.
  permit(allowed:boolean) { this.permittedUntil=allowed ? Date.now()+5000 : 0; }
  async waitUntilIdle() {
    while (this.busy) await new Promise(resolve => setTimeout(resolve, 25));
  }
  start() { this.timer=setInterval(()=>{void this.tick();},2000); this.timer.unref(); }
  stop() { this.stopped=true; if(this.timer) clearInterval(this.timer); }
  status():BpmStatus {
    const db=this.database();
    const counts=db.prepare(`select count(*) total,
      coalesce(sum(bpm_analysis_key is not null and bpm_error is null),0) completed,
      coalesce(sum(bpm_error is not null),0) failed from tracks t join library_roots r on r.id=t.root_id
      where t.deleted_at is null and r.kind='music'`).get() as any;
    return {...getBpmConfig(db),...counts,running:this.busy,suspended:this.blocked()||Date.now()>this.permittedUntil,revision:this.revision};
  }
  retry() { this.database().exec("update tracks set bpm_analysis_key=null,bpm_error=null where bpm_error is not null"); }
  async tick() {
    if(this.busy||this.stopped||this.blocked()||Date.now()>this.permittedUntil) return;
    const db=this.database(),config=getBpmConfig(db);
    if(!config.enabled||config.paused) return;
    const item=db.prepare(`select t.id,t.full_path,t.file_hash,t.file_size,t.file_mtime_ms from tracks t
      join library_roots r on r.id=t.root_id where t.deleted_at is null and r.kind='music'
      and t.bpm_analysis_key is null order by t.created_at,t.id limit 1`).get() as Item|undefined;
    if(!item) return;
    this.busy=true;
    const key=analysisKey(item);
    try {
      const before=await stat(item.full_path);
      const result=await new Promise<{bpm?:number|null;warnings?:string[];error?:string}>((resolve,reject)=>{
        const worker=new Worker(bpmWorkerPath(__dirname),{workerData:{filename:item.full_path,ffmpegPath:this.ffmpeg()}});
        const timeout=setTimeout(()=>{void worker.terminate();reject(Error("BPM analysis timed out"));},180000);
        worker.once("message",value=>{clearTimeout(timeout);resolve(value);});
        worker.once("error",error=>{clearTimeout(timeout);reject(error);});
        worker.once("exit",code=>{clearTimeout(timeout);reject(Error(`BPM worker exited before returning a result (${code})`));});
      });
      const after=await stat(item.full_path);
      if(before.size!==after.size||before.mtimeMs!==after.mtimeMs) throw Error("Audio changed during BPM analysis; retry after scanning");
      if(result.error) throw Error(result.error);
      if(result.bpm!=null&&(!Number.isFinite(result.bpm)||result.bpm<=0)) throw Error("Invalid analyser result");
      if(this.stopped||this.database()!==db) return;
      db.prepare(`update tracks set derived_bpm=?,bpm_analysis_key=?,bpm_error=?,bpm_analyzed_at=?,bpm_warnings=?
        where id=? and file_hash=? and file_size is ? and file_mtime_ms is ? and deleted_at is null`)
        .run(roundBpm(result.bpm),key,result.bpm==null?"No tempo found":null,new Date().toISOString(),JSON.stringify(result.warnings??[]),item.id,item.file_hash,item.file_size,item.file_mtime_ms);
      this.revision++;
    } catch(error) {
      if(!this.stopped&&this.database()===db) db.prepare(`update tracks set bpm_analysis_key=?,bpm_error=? where id=?
        and file_hash=? and file_size is ? and file_mtime_ms is ?`).run(key,error instanceof Error?error.message:String(error),item.id,item.file_hash,item.file_size,item.file_mtime_ms);
    } finally {
      this.busy=false;
      // Continue a backlog promptly; the periodic timer discovers future imports.
      // tick rechecks pause, playback permission, scans and the enable setting.
      if (!this.stopped) setTimeout(() => { void this.tick(); }, 250).unref();
    }
  }
}
