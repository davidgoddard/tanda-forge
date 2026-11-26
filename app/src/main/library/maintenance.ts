import { Worker } from "worker_threads";
import path from "path";

export const maintenanceWorkerPath = (directory: string) => path.join(
  directory.split(path.sep).map(part => part === "app.asar" ? "app.asar.unpacked" : part).join(path.sep),
  "maintenance-worker.js",
);

export const runLibraryMaintenance = <T>(
  data: Record<string, unknown>,
  progress: (percent: number) => void,
): Promise<T> => new Promise((resolve, reject) => {
  const worker = new Worker(maintenanceWorkerPath(__dirname), { workerData: data });
  let outcome: { result: T } | { error: Error } | undefined;
  worker.on("message", message => {
    if (message.type === "progress") progress(message.percent);
    if (message.type === "result") outcome = { result: message.result };
    if (message.type === "error") outcome = { error: new Error(message.error) };
  });
  worker.once("error", reject);
  // Wait for the connection to close and worker to exit before unblocking writes.
  worker.once("exit", code => {
    if (code !== 0 || !outcome) reject(new Error(`Library worker exited without completing (${code})`));
    else if ("error" in outcome) reject(outcome.error);
    else { progress(100); resolve(outcome.result); }
  });
});
