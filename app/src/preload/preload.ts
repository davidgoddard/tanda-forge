import { contextBridge, ipcRenderer } from "electron";
import type { AppApi } from "../shared/types";

const api: AppApi = {
  ping: async () => "pong",
  getAppVersion: async () => ipcRenderer.invoke("app:getVersion"),
  pickRoot: async (kind) => ipcRenderer.invoke("library:pickRoot", kind),
  pickDataLocation: async () => ipcRenderer.invoke("data:pickLocation"),
  getDataLocation: async () => ipcRenderer.invoke("data:getLocation"),
  setDataLocation: async (path) => ipcRenderer.invoke("data:setLocation", path),
  addRoot: async (kind, rootPath) =>
    ipcRenderer.invoke("library:addRoot", kind, rootPath),
  listRoots: async () => ipcRenderer.invoke("library:listRoots"),
  getRootRemovalPreview: async (rootId) =>
    ipcRenderer.invoke("library:getRootRemovalPreview", rootId),
  removeRoot: async (rootId) => ipcRenderer.invoke("library:removeRoot", rootId),
  detectLegacy: async (path) => ipcRenderer.invoke("legacy:detect", path),
  importLegacy: async (rootPath) => ipcRenderer.invoke("legacy:import", rootPath),
  listLegacyStyles: async (rootPath) =>
    ipcRenderer.invoke("legacy:listStyles", rootPath),
  scanAll: async () => ipcRenderer.invoke("library:scanAll"),
  scanKind: async (kind) => ipcRenderer.invoke("library:scanKind", kind),
  refreshStoredMetadata: async () => ipcRenderer.invoke("library:refreshStoredMetadata"),
  runStartupFlow: async (params) => ipcRenderer.invoke("library:runStartupFlow", params),
  listTracks: async () => ipcRenderer.invoke("library:listTracks"),
  onScanProgress: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => {
      handler(progress as never);
    };
    ipcRenderer.on("library:scanProgress", listener);
    return () => {
      ipcRenderer.removeListener("library:scanProgress", listener);
    };
  },
  onStartupFlowProgress: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => {
      handler(progress as never);
    };
    ipcRenderer.on("library:startupFlowProgress", listener);
    return () => {
      ipcRenderer.removeListener("library:startupFlowProgress", listener);
    };
  },
  resetDatabase: async () => ipcRenderer.invoke("app:resetDatabase"),
  clearCachedFiles: async () => ipcRenderer.invoke("app:clearCachedFiles"),
  exportSystemData: async () => ipcRenderer.invoke("app:exportSystemData"),
  getSystemBackupStatus: async () => ipcRenderer.invoke("app:getSystemBackupStatus"),
  onSystemBackupStatus: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, status: unknown) => {
      handler(status as never);
    };
    ipcRenderer.on("app:systemBackupStatus", listener);
    return () => {
      ipcRenderer.removeListener("app:systemBackupStatus", listener);
    };
  },
  importSystemData: async () => ipcRenderer.invoke("app:importSystemData"),
  exportTandasData: async () => ipcRenderer.invoke("app:exportTandasData"),
  exportPlaylistData: async (manifest) => ipcRenderer.invoke("app:exportPlaylistData", manifest),
  importPlaylistData: async () => ipcRenderer.invoke("app:importPlaylistData"),
  listTrackPage: async (params) => ipcRenderer.invoke("tracks:listPage", params),
  jumpToPrefix: async (params) =>
    ipcRenderer.invoke("tracks:jumpToPrefix", params),
  getJumpIndex: async (params) =>
    ipcRenderer.invoke("tracks:getJumpIndex", params),
  searchTracks: async (params) => ipcRenderer.invoke("tracks:search", params),
  searchTrackCount: async (params) =>
    ipcRenderer.invoke("tracks:searchCount", params),
  getTracksByIds: async (ids) => ipcRenderer.invoke("tracks:getByIds", ids),
  listRecentTracks: async (limit) =>
    ipcRenderer.invoke("tracks:listRecent", limit),
  listRecentTandas: async (limit) =>
    ipcRenderer.invoke("tandas:listRecent", limit),
  searchJumpIndex: async (params) =>
    ipcRenderer.invoke("tracks:searchJumpIndex", params),
  searchJumpToPrefix: async (params) =>
    ipcRenderer.invoke("tracks:searchJumpToPrefix", params),
  getTrackStyles: async () => ipcRenderer.invoke("tracks:getStyles"),
  updateTrack: async (payload) => ipcRenderer.invoke("tracks:update", payload),
  getWaveform: async (trackId) => ipcRenderer.invoke("tracks:getWaveform", trackId),
  generateWaveform: async (trackId) =>
    ipcRenderer.invoke("tracks:generateWaveform", trackId),
  getCompressedTrackPath: async (params) =>
    ipcRenderer.invoke("audio:getCompressedTrackPath", params),
  renderCompressedTrack: async (params) =>
    ipcRenderer.invoke("audio:renderCompressedTrack", params),
  renderPlayableTrack: async (params) =>
    ipcRenderer.invoke("audio:renderPlayableTrack", params),
  precomputeCompressedTracks: async (params) =>
    ipcRenderer.invoke("audio:precomputeCompressedTracks", params),
  onPrecomputeCompressedProgress: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => {
      handler(progress as never);
    };
    ipcRenderer.on("audio:precomputeProgress", listener);
    return () => {
      ipcRenderer.removeListener("audio:precomputeProgress", listener);
    };
  },
  getSearchDiversityStats: async () =>
    ipcRenderer.invoke("stats:getSearchDiversity"),
  getDiagnosticsPaths: async () =>
    ipcRenderer.invoke("diagnostics:getPaths"),
  pickFfmpegToolsDir: async () =>
    ipcRenderer.invoke("diagnostics:pickFfmpegToolsDir"),
  getFfmpegToolsDir: async () =>
    ipcRenderer.invoke("diagnostics:getFfmpegToolsDir"),
  setFfmpegToolsDir: async (dirPath) =>
    ipcRenderer.invoke("diagnostics:setFfmpegToolsDir", dirPath),
  verifyCachedFiles: async () =>
    ipcRenderer.invoke("diagnostics:verifyCaches"),
  getDiagnosticsLogs: async (params) =>
    ipcRenderer.invoke("diagnostics:getLogs", params),
  clearDiagnosticsLogs: async () =>
    ipcRenderer.invoke("diagnostics:clearLogs"),
  getDiagnosticsDataReadiness: async () =>
    ipcRenderer.invoke("diagnostics:getDataReadiness"),
  logPlaybackDiagnostic: async (params) =>
    ipcRenderer.invoke("app:logPlaybackDiagnostic", params),
  listStyles: async () => ipcRenderer.invoke("styles:list"),
  listStyleDefinitions: async () => ipcRenderer.invoke("styles:listDefinitions"),
  addStyle: async (name) => ipcRenderer.invoke("styles:add", name),
  removeStyle: async (name) => ipcRenderer.invoke("styles:remove", name),
  replaceDefaultStyles: async (payload) =>
    ipcRenderer.invoke("styles:replaceDefaults", payload),
  listTandas: async () => ipcRenderer.invoke("tandas:list"),
  getTandasByIds: async (ids) => ipcRenderer.invoke("tandas:getByIds", ids),
  saveTanda: async (payload) => ipcRenderer.invoke("tandas:save", payload),
  deleteTanda: async (id) => ipcRenderer.invoke("tandas:delete", id),
  searchTandas: async (params) => ipcRenderer.invoke("tandas:search", params),
  listCortinaSets: async () => ipcRenderer.invoke("cortinas:listSets"),
  listCortinas: async (setName) =>
    ipcRenderer.invoke("cortinas:listTracks", setName),
  searchCortinas: async (params) =>
    ipcRenderer.invoke("cortinas:searchTracks", params),
  listBackgroundImages: async (group) => ipcRenderer.invoke("backgrounds:list", group),
  openDisplay: async () => ipcRenderer.invoke("display:open"),
  getDisplayStatus: async () => ipcRenderer.invoke("display:status"),
  updateDisplay: async (payload) => ipcRenderer.invoke("display:update", payload),
  onDisplayUpdate: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      handler(payload as never);
    };
    ipcRenderer.on("display:update", listener);
    return () => {
      ipcRenderer.removeListener("display:update", listener);
    };
  },
  closeApp: async () => ipcRenderer.invoke("app:close"),
  respondToCloseRequest: async (allowed) =>
    ipcRenderer.invoke("app:close-response", allowed),
  onAppCloseRequest: (handler) => {
    const listener = () => {
      handler();
    };
    ipcRenderer.on("app:request-close", listener);
    return () => {
      ipcRenderer.removeListener("app:request-close", listener);
    };
  },
  logClientError: async (params) =>
    ipcRenderer.invoke("app:logClientError", params),
  toggleFullscreen: async () => ipcRenderer.invoke("app:toggleFullscreen"),
  seedE2eData: async (payload) => ipcRenderer.invoke("e2e:seedData", payload),
  setE2eDialogResponses: async (payload) =>
    ipcRenderer.invoke("e2e:setDialogResponses", payload),
  getE2eScanSummaries: async () => ipcRenderer.invoke("e2e:getScanSummaries"),
};

contextBridge.exposeInMainWorld("tanda", api);
