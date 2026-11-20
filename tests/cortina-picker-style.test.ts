import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("cortina picker styling", () => {
  it("uses clean transparent rows instead of the playlist cortina fill", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "app/src/renderer/styles.css"),
      "utf8",
    );
    const rule = css.match(
      /#cortina-modal \.list-row\.cortina-result\s*\{([^}]*)\}/,
    )?.[1] ?? "";

    expect(rule).toContain("background: transparent;");
    expect(rule).toContain("border-radius: 0;");
    expect(rule).toContain("border-bottom: 1px solid var(--border);");
  });
});
