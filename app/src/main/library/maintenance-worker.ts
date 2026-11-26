import { parentPort, workerData } from "worker_threads";
import { openMaintenanceDb, closeDb } from "../db";
import { importLegacyData } from "../legacy-import";
import { getRootRemovalPreview, removeLibraryRoot } from "./root-removal";

void (async () => {
  let lastPercent = -1;
  const progress = (value: number) => {
    const percent = Math.min(99, Math.floor(value));
    if (percent <= lastPercent) return;
    lastPercent = percent;
    parentPort?.postMessage({ type: "progress", percent });
  };
  try {
    const db = openMaintenanceDb(workerData.filename);
    progress(0);
    let result;
    if (workerData.operation === "import") {
      // Async filesystem reads/copies remain inside this worker. Roll back all
      // database changes on failure, including already imported track rows.
      db.exec("begin immediate");
      try {
        result = await importLegacyData(workerData.rootPath, workerData.roots, {
          waveformsDir: workerData.waveformsDir, onProgress: progress,
        });
        db.exec("commit");
      } catch (error) {
        db.exec("rollback");
        throw error;
      }
    } else if (workerData.operation === "preview") {
      result = getRootRemovalPreview(db, workerData.rootId);
    } else {
      result = removeLibraryRoot(db, workerData.rootId, progress);
    }
    closeDb();
    parentPort?.postMessage({ type: "result", result });
  } catch (error) {
    closeDb();
    parentPort?.postMessage({ type: "error", error: error instanceof Error ? error.message : String(error) });
  }
})();
