import { app } from "electron";
import fs from "fs";
import path from "path";

type DataLocationConfig = {
  dataRoot?: string;
};

const CONFIG_FILE = "tanda-player-config.json";
let cachedDataRoot: string | null = null;

const getConfigPath = () =>
  path.join(app.getPath("userData"), CONFIG_FILE);

const readConfig = (): DataLocationConfig => {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    return JSON.parse(raw) as DataLocationConfig;
  } catch {
    return {};
  }
};

const writeConfig = (config: DataLocationConfig) => {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
  } catch {}
};

const getDefaultDataRoot = () => app.getPath("userData");

const resolveStoredDataRoot = () => {
  const config = readConfig();
  if (!config.dataRoot) {
    return null;
  }
  if (!fs.existsSync(config.dataRoot)) {
    return null;
  }
  return config.dataRoot;
};

export const getDataRoot = () => {
  if (cachedDataRoot) {
    return cachedDataRoot;
  }
  const stored = resolveStoredDataRoot();
  cachedDataRoot = stored ?? getDefaultDataRoot();
  fs.mkdirSync(cachedDataRoot, { recursive: true });
  return cachedDataRoot;
};

export const getDefaultDataPath = () => getDefaultDataRoot();

export const setDataRoot = (selectedPath: string | null) => {
  const defaultRoot = getDefaultDataRoot();
  if (!selectedPath) {
    cachedDataRoot = defaultRoot;
    writeConfig({});
    fs.mkdirSync(cachedDataRoot, { recursive: true });
    return cachedDataRoot;
  }
  let target = path.resolve(selectedPath);
  if (path.basename(target) !== "_tp_data") {
    target = path.join(target, "_tp_data");
  }
  fs.mkdirSync(target, { recursive: true });
  cachedDataRoot = target;
  writeConfig({ dataRoot: target });
  return target;
};

export const getDataPaths = () => {
  const root = getDataRoot();
  return {
    root,
    dbPath: path.join(root, "tanda-player.db"),
    waveformsDir: path.join(root, "waveforms"),
    logDir: root,
  };
};
