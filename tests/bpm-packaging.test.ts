import {describe,it,expect} from "vitest";
import path from "path";
import {bpmWorkerPath} from "../app/src/main/bpm/service";
import config from "../package.json";

describe("BPM worker packaging",()=>{
  it("uses the compiled worker during development",()=>{
    expect(bpmWorkerPath(path.join("project","dist","main","bpm")))
      .toBe(path.join("project","dist","main","bpm","worker.js"));
  });
  it("uses unpacked real files in an installed application",()=>{
    expect(bpmWorkerPath(path.join("resources","app.asar","dist","main","bpm")))
      .toBe(path.join("resources","app.asar.unpacked","dist","main","bpm","worker.js"));
    expect(config.build.asarUnpack).toContain("dist/main/bpm/**/*");
  });
});
