import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("manualAudioRouteTest", {
  pickAudioFile: async () =>
    ipcRenderer.invoke("manual-audio-route-test:pick-audio-file") as Promise<string | null>,
});
