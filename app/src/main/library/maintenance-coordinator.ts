// Only audited reads and operations independent of the database may bypass a
// maintenance writer. Unknown/new channels remain serialized by default.
const independentChannels = new Set([
  "app:getVersion", "app:getReleaseUpdateInfo", "app:openReleasePage",
  "app:toggleFullscreen", "app:getSystemBackupStatus",
  "app:logClientError", "app:logPlaybackDiagnostic",
  "display:open", "display:status", "display:update",
  "audio:getCompressedTrackPath", "audio:renderCompressedTrack", "audio:renderPlayableTrack",
  "bpm:status", "bpm:track", "bpm:permit", "style:status", "style:track",
  "library:listRoots", "tracks:getByIds", "tracks:getWaveform",
  "data:getLocation", "diagnostics:getPaths", "diagnostics:getLogs",
  "diagnostics:getFfmpegToolsDir",
]);

export class MaintenanceCoordinator {
  private pending: Promise<unknown> | null = null;
  private active = new Set<Promise<unknown>>();

  get busy() { return this.pending !== null; }

  async request<T>(channel: string, handler: () => T | Promise<T>): Promise<T> {
    if (independentChannels.has(channel)) return handler();
    while (this.pending) await this.pending.catch(() => {});
    // Invoke before registering: an exclusive handler must not await itself.
    const request = Promise.resolve(handler());
    this.active.add(request);
    try { return await request; }
    finally { this.active.delete(request); }
  }

  exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.pending) throw new Error("Library maintenance already running");
    const earlier = [...this.active];
    const pending = (async () => {
      await Promise.allSettled(earlier);
      return operation();
    })();
    this.pending = pending;
    void pending.finally(() => {
      if (this.pending === pending) this.pending = null;
    }).catch(() => {});
    return pending;
  }
}
