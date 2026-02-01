import { contextBridge, ipcRenderer } from "electron";
import type { AppApi } from "../shared/types";

const api: AppApi = {
  ping: async () => "pong",
  pickRoot: async (kind) => ipcRenderer.invoke("library:pickRoot", kind),
  pickDataLocation: async () => ipcRenderer.invoke("data:pickLocation"),
  getDataLocation: async () => ipcRenderer.invoke("data:getLocation"),
  setDataLocation: async (path) => ipcRenderer.invoke("data:setLocation", path),
  addRoot: async (kind, rootPath) =>
    ipcRenderer.invoke("library:addRoot", kind, rootPath),
  listRoots: async () => ipcRenderer.invoke("library:listRoots"),
  detectLegacy: async (path) => ipcRenderer.invoke("legacy:detect", path),
  importLegacy: async (rootPath) => ipcRenderer.invoke("legacy:import", rootPath),
  scanAll: async () => ipcRenderer.invoke("library:scanAll"),
  scanKind: async (kind) => ipcRenderer.invoke("library:scanKind", kind),
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
  resetDatabase: async () => ipcRenderer.invoke("app:resetDatabase"),
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
  searchJumpIndex: async (params) =>
    ipcRenderer.invoke("tracks:searchJumpIndex", params),
  searchJumpToPrefix: async (params) =>
    ipcRenderer.invoke("tracks:searchJumpToPrefix", params),
  getTrackStyles: async () => ipcRenderer.invoke("tracks:getStyles"),
  updateTrack: async (payload) => ipcRenderer.invoke("tracks:update", payload),
  getWaveform: async (trackId) => ipcRenderer.invoke("tracks:getWaveform", trackId),
  generateWaveform: async (trackId) =>
    ipcRenderer.invoke("tracks:generateWaveform", trackId),
  getDiagnosticsPaths: async () =>
    ipcRenderer.invoke("diagnostics:getPaths"),
  listStyles: async () => ipcRenderer.invoke("styles:list"),
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
};

contextBridge.exposeInMainWorld("tanda", api);
