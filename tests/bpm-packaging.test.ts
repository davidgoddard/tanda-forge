import {describe,it,expect} from "vitest";
import path from "path";
import {bpmWorkerPath} from "../app/src/main/bpm/service";
import { maintenanceWorkerPath } from "../app/src/main/library/maintenance";
import config from "../package.json";

describe("BPM worker packaging",()=>{
  it("uses the compiled worker during development",()=>{
    expect(bpmWorkerPath(path.join("project","dist","main","bpm")))
      .toBe(path.join("project","dist","main","bpm","worker.js"));
  });
  it("uses unpacked real files in an installed application",()=>{
    expect(bpmWorkerPath(path.join("resources","app.asar","dist","main","bpm")))
      .toBe(path.join("resources","app.asar.unpacked","dist","main","bpm","worker.js"));
    expect(maintenanceWorkerPath(path.join("resources", "app.asar", "dist", "main", "library")))
      .toBe(path.join("resources", "app.asar.unpacked", "dist", "main", "library", "maintenance-worker.js"));
    for (const file of [
      "dist/main/bpm/worker.js", "dist/main/bpm/service.js",
      "dist/main/library/maintenance-worker.js", "dist/main/library/root-removal.js",
      "dist/main/db.js", "dist/main/legacy-import.js", "dist/shared/legacy-path.js",
    ]) {
      expect(config.build.asarUnpack.some(pattern => path.matchesGlob(file, pattern)), file).toBe(true);
    }
  });
});
