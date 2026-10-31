export type IpcDomain =
  | "application"
  | "library"
  | "tracks"
  | "tandas"
  | "diagnostics"
  | "audioSimilarity"
  | "display"
  | "transfer";

type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => any;
type IpcMainLike = { handle: (channel: string, handler: IpcHandler) => void };

const transferChannels = new Set([
  "app:exportSystemData", "app:importSystemData", "app:getSystemBackupStatus",
  "app:exportTandasData", "app:exportPlaylistData", "app:importPlaylistData",
]);

export const resolveIpcDomain = (channel: string): IpcDomain => {
  if (transferChannels.has(channel) || channel.startsWith("data:")) return "transfer";
  if (channel.startsWith("audio-similarity:")) return "audioSimilarity";
  if (channel.startsWith("diagnostics:")) return "diagnostics";
  if (channel.startsWith("display:")) return "display";
  if (channel.startsWith("tandas:") || channel.startsWith("ratings:")) return "tandas";
  if (channel.startsWith("tracks:") || channel.startsWith("styles:") || channel.startsWith("cortinas:")) return "tracks";
  if (channel.startsWith("library:") || channel.startsWith("legacy:") || channel.startsWith("stats:")) return "library";
  return "application";
};

export const createDomainIpcRegistrar = (ipcMain: IpcMainLike) => {
  const channels = new Map<IpcDomain, Set<string>>();
  return {
    handle: (channel: string, handler: IpcHandler) => {
      const domain = resolveIpcDomain(channel);
      const registered = channels.get(domain) ?? new Set<string>();
      if (registered.has(channel)) throw new Error(`Duplicate IPC handler: ${channel}`);
      registered.add(channel);
      channels.set(domain, registered);
      ipcMain.handle(channel, handler);
    },
    channelsFor: (domain: IpcDomain) => [...(channels.get(domain) ?? [])],
  };
};
import type { IpcMainInvokeEvent } from "electron";

