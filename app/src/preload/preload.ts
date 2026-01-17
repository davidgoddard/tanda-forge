import { contextBridge } from "electron";
import type { AppApi } from "../shared/types";

const api: AppApi = {
  ping: async () => "pong",
};

contextBridge.exposeInMainWorld("tanda", api);
