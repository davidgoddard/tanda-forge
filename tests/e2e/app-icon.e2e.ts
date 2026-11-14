import { _electron as electron, expect, test } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

test("sets the Tanda Forge Dock icon after the main window is visible", async () => {
  test.skip(process.platform !== "darwin", "The Dock API is macOS-only");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-icon-test-"));
  const observer = path.join(root, "observe-icon.cjs");
  fs.writeFileSync(observer, `
    const { app, BrowserWindow, nativeImage } = require('electron');
    const original = app.dock.setIcon.bind(app.dock);
    globalThis.tandaTestDockCalls = [];
    app.dock.setIcon = image => {
      const decoded = typeof image === 'string' ? nativeImage.createFromPath(image) : image;
      globalThis.tandaTestDockCalls.push({
        visible: BrowserWindow.getAllWindows().some(window => window.isVisible()),
        empty: decoded.isEmpty(),
        png: decoded.toPNG().toString('base64'),
      });
      return original(image);
    };
  `);
  const env = {
    ...process.env,
    NODE_ENV: "test",
    TANDA_DATA_ROOT: path.join(root, "data"),
    TANDA_USER_DATA_ROOT: path.join(root, "user"),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  let launched: Awaited<ReturnType<typeof electron.launch>> | undefined;
  try {
    launched = await electron.launch({ args: ["--require", observer, "."], env });
    const page = await launched.firstWindow();
    await page.waitForSelector("#search-input");
    await expect.poll(() => launched!.evaluate(() =>
      (globalThis as any).tandaTestDockCalls?.length ?? 0,
    )).toBeGreaterThan(0);
    const result = await launched.evaluate(({ app, nativeImage }) => ({
      calls: (globalThis as any).tandaTestDockCalls as Array<{ visible: boolean; empty: boolean; png: string }>,
      expected: nativeImage.createFromPath(`${app.getAppPath()}/app/resources/icons/icon.png`).toPNG().toString("base64"),
    }));
    expect(result.calls.at(-1)).toEqual({ visible: true, empty: false, png: result.expected });
  } finally {
    await launched?.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
