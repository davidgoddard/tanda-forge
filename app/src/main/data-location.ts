import { app } from "electron";
import fs from "fs";
import path from "path";

type DataLocationConfig = {
  dataRoot?: string;
};

const CONFIG_FILE = "tanda-player-config.json";
const LEGACY_APP_NAME = "Tanda Player 2";
let cachedDataRoot: string | null = null;

const getConfigPath = () =>
  path.join(app.getPath("userData"), CONFIG_FILE);

const readConfigAt = (configPath: string): DataLocationConfig => {
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as DataLocationConfig;
  } catch {
    return {};
  }
};

const readConfig = (): DataLocationConfig => readConfigAt(getConfigPath());

const writeConfig = (config: DataLocationConfig) => {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
  } catch {}
};

const getDefaultDataRoot = () => app.getPath("userData");

const resolveForcedDataRoot = () => {
  const forced = process.env.TANDA_DATA_ROOT?.trim();
  if (!forced) {
    return null;
  }
  return path.resolve(forced);
};

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

export const resolveLegacyDataRoot = (appDataPath: string) => {
  const legacyUserData = path.join(appDataPath, LEGACY_APP_NAME);
  const legacyConfigPath = path.join(legacyUserData, CONFIG_FILE);
  const legacyConfig = readConfigAt(legacyConfigPath);
  if (legacyConfig.dataRoot && fs.existsSync(legacyConfig.dataRoot)) {
    return legacyConfig.dataRoot;
  }
  const legacyDbPath = path.join(legacyUserData, "tanda-player.db");
  if (fs.existsSync(legacyDbPath)) {
    return legacyUserData;
  }
  return null;
};

export const getDataRoot = () => {
  const forced = resolveForcedDataRoot();
  if (forced) {
    cachedDataRoot = forced;
    fs.mkdirSync(cachedDataRoot, { recursive: true });
    return cachedDataRoot;
  }
  if (cachedDataRoot) {
    return cachedDataRoot;
  }
  const stored = resolveStoredDataRoot();
  if (stored) {
    cachedDataRoot = stored;
  } else {
    const legacyRoot = resolveLegacyDataRoot(app.getPath("appData"));
    if (legacyRoot) {
      cachedDataRoot = legacyRoot;
      writeConfig({ dataRoot: legacyRoot });
    } else {
      cachedDataRoot = getDefaultDataRoot();
    }
  }
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
    compressedCacheDir: path.join(root, "compressed-audio-cache"),
    logDir: root,
  };
};
