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

describe("display window movement", () => {
  it("provides a generous drag region without a full-window no-drag override", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "app/src/renderer/display.css"),
      "utf8",
    );
    const bodyRule = css.match(/body\s*\{([^}]*)\}/)?.[1] ?? "";
    const dragStripRule = css.match(/\.drag-strip\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(bodyRule).not.toContain("app-region: no-drag");
    expect(dragStripRule).toContain("height: 64px;");
    expect(dragStripRule).toMatch(/(?:^|\n)\s*app-region: drag;/);
    expect(dragStripRule).toMatch(/(?:^|\n)\s*-webkit-app-region: drag;/);
  });
});

describe("display text wrapping", () => {
  it("caps two-line text blocks without exposing a partial third line", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "app/src/renderer/display.css"),
      "utf8",
    );

    const expectedRules = [
      ["display-title", "1.15", "2.3"],
      ["display-artist", "1.15", "2.3"],
      ["display-singer", "1.15", "2.3"],
    ] as const;

    expectedRules.forEach(([className, lineHeight, maxHeight]) => {
      const rule =
        css.match(new RegExp(`(?:^|\\n)\\.${className}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      expect(rule).toContain("-webkit-line-clamp: 2;");
      expect(rule).toContain(`line-height: ${lineHeight};`);
      expect(rule).not.toContain("padding-");
      expect(rule).toContain(`max-height: ${maxHeight}em;`);
    });
  });

  it("can measure and shrink individual overflowing fields", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "app/src/renderer/display.css"),
      "utf8",
    );
    const runtime = fs.readFileSync(
      path.join(process.cwd(), "app/src/renderer/display.js"),
      "utf8",
    );

    expect(css).toContain("var(--display-field-fit-scale)");
    expect(runtime).toContain("const fieldTextFits =");
    expect(runtime).toContain("probe.scrollHeight <= lineHeight * lineLimit + 1");
    expect(runtime).toContain("const compactMinScale = 0.72;");
    expect(runtime).toContain("for (let attempt = 0; attempt < 10; attempt += 1)");
  });
});
