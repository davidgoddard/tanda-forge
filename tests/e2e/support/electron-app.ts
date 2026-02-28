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
  close: (options?: { cleanup?: boolean }) => Promise<void>;
};

const launchWithRoots = async (
  tempRoot: string,
  dataRoot: string,
  userDataRoot: string,
): Promise<LaunchedApp> => {
  fs.mkdirSync(userDataRoot, { recursive: true });
  delete process.env.ELECTRON_RUN_AS_NODE;
  const launchEnv = {
    ...process.env,
    NODE_ENV: "test",
    TANDA_DATA_ROOT: dataRoot,
    TANDA_USER_DATA_ROOT: userDataRoot,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
    ELECTRON_RUN_AS_NODE: "",
  } as NodeJS.ProcessEnv;

  const app = await electron.launch({
    args: ["."],
    env: launchEnv,
  });

  const page = await app.firstWindow();
  await page.waitForSelector("#search-input");

  const close = async (options?: { cleanup?: boolean }) => {
    await app.close();
    if (options?.cleanup ?? true) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  };

  return { app, page, tempRoot, close };
};

export const launchSeededApp = async (kind: SeedKind): Promise<LaunchedApp> => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tpl-e2e-"));
  const dataRoot = path.join(tempRoot, "data");
  const userDataRoot = path.join(tempRoot, "user-data");
  const seeded = seedDataRoot(dataRoot, kind);
  const launched = await launchWithRoots(tempRoot, dataRoot, userDataRoot);
  if (seeded.payload) {
    await launched.page.evaluate(async (payload) => {
      await window.tanda?.seedE2eData(payload);
    }, seeded.payload);
    await launched.page.reload();
    await launched.page.waitForSelector("#search-input");
  }
  return launched;
};

export const relaunchSeededApp = async (tempRoot: string): Promise<LaunchedApp> => {
  const dataRoot = path.join(tempRoot, "data");
  const userDataRoot = path.join(tempRoot, "user-data");
  return launchWithRoots(tempRoot, dataRoot, userDataRoot);
};
