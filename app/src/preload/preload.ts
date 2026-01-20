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
};

contextBridge.exposeInMainWorld("tanda", api);
