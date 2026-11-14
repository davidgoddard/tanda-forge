import { parentPort, workerData } from "worker_threads";
import { pathToFileURL } from "url";
import path from "path";
// Preserve the analyser's native ESM module graph when the host compiles to CJS.
const importModule = new Function("url", "return import(url)") as (url:string)=>Promise<any>;
void (async () => {
  try {
    const api = await importModule(pathToFileURL(path.join(__dirname,"analyzer/api.js")).href);
    const result = await api.analyzeFile(workerData.filename,{ffmpegPath:workerData.ffmpegPath});
    parentPort?.postMessage({bpm:result.bpm,warnings:result.warnings});
  } catch(error) {
    parentPort?.postMessage({error:error instanceof Error ? error.message : String(error)});
  }
})();
