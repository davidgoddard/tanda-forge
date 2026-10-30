import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("cortina picker", () => {
  it("wires each result headphone button to headphone playback", () => {
    const renderer = fs.readFileSync(
      path.join(process.cwd(), "app/src/renderer/renderer.ts"),
      "utf8",
    );
    const resultRenderer = renderer.slice(
      renderer.indexOf("const renderCortinaResults"),
      renderer.indexOf("const openCortinaModal"),
    );
    expect(resultRenderer).toContain('headphone.addEventListener("click"');
    expect(resultRenderer).toContain('"headphone",\n          track.full_path');
    expect(resultRenderer).toContain("event.stopPropagation()");
  });
});
