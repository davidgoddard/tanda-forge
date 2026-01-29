import { contextBridge, ipcRenderer } from "electron";
import type { AppApi } from "../shared/types";

const api: AppApi = {
  ping: async () => "pong",
  pickRoot: async (kind) => ipcRenderer.invoke("library:pickRoot", kind),
  addRoot: async (kind, rootPath) =>
    ipcRenderer.invoke("library:addRoot", kind, rootPath),
  listRoots: async () => ipcRenderer.invoke("library:listRoots"),
  scanAll: async () => ipcRenderer.invoke("library:scanAll"),
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
  closeApp: async () => ipcRenderer.invoke("app:close"),
  logClientError: async (params) =>
    ipcRenderer.invoke("app:logClientError", params),
};

contextBridge.exposeInMainWorld("tanda", api);
