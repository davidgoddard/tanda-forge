import fs from "fs";
import os from "os";
import path from "path";
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import type { SeedKind } from "./seed-data";
import { seedDataRoot } from "./seed-data";

export type LaunchedApp = {
  app: ElectronApplication;
  page: Page;
  tempRoot: string;
  close: () => Promise<void>;
};

export const launchSeededApp = async (kind: SeedKind): Promise<LaunchedApp> => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tpl-e2e-"));
  const dataRoot = path.join(tempRoot, "data");
  const userDataRoot = path.join(tempRoot, "user-data");
  seedDataRoot(dataRoot, kind);
  fs.mkdirSync(userDataRoot, { recursive: true });

  const app = await electron.launch({
    args: ["."],
    env: {
      ...process.env,
      NODE_ENV: "test",
      TANDA_DATA_ROOT: dataRoot,
      TANDA_USER_DATA_ROOT: userDataRoot,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector("#search-input");

  const close = async () => {
    await app.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  };

  return { app, page, tempRoot, close };
};
