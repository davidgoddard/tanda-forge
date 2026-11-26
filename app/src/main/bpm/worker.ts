import { parentPort, workerData } from "worker_threads";
import { pathToFileURL } from "url";
import path from "path";
import { analyzeAudio } from "./pipeline";
// Preserve the analysers' native ESM module graphs in the CJS Electron worker.
const importModule = new Function("url", "return import(url)") as (url:string)=>Promise<any>;
void (async () => {
  try {
    const decoder = await importModule(pathToFileURL(path.join(__dirname,"analyzer/analyze.js")).href);
    const tempo = await importModule(pathToFileURL(path.join(__dirname,"analyzer/api.js")).href);
    let analyzeStyle: ((pcm: Float32Array,bpm: number|null)=>{style:string}) | undefined;
    if (workerData.style) {
      try {
        analyzeStyle = (await importModule(pathToFileURL(path.join(__dirname,"../style/analyzer/api.js")).href)).analyzeStyle;
      } catch(error) { analyzeStyle = () => { throw error; }; }
    }
    const result = await analyzeAudio(
      () => decoder.decodeFile(workerData.filename,{ffmpegPath:workerData.ffmpegPath}),
      tempo.analyzeSamples,
      analyzeStyle,
    );
    parentPort?.postMessage(result);
  } catch(error) {
    parentPort?.postMessage({error:error instanceof Error ? error.message : String(error)});
  }
})();
