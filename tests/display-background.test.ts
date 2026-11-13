import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("display abstract background", () => {
  it("uses the lighter strong overlay in both initial and runtime fallback state", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "app/src/renderer/display.css"),
      "utf8",
    );
    const runtime = fs.readFileSync(
      path.join(process.cwd(), "app/src/renderer/display.js"),
      "utf8",
    );

    expect(css).toContain("--display-overlay-strong: 0.28;");
    expect(runtime).toContain("const strong = hasNormalImages ? imageDimOpacity : 0.28;");
  });
});
