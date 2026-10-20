export type LightingFetch = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<unknown>;

export const LIGHTING_ENDPOINT = "http://127.0.0.1:8080/api/lights";
export const LIGHTING_PLAYBACK_ENDPOINT = "http://127.0.0.1:8080/api/playback";

export const createLightingNotifier = (
  send: LightingFetch,
  endpoint = LIGHTING_ENDPOINT,
) => {
  let lastRequested: boolean | null = null;

  return (up: boolean) => {
    if (lastRequested === up) return;
    lastRequested = up;
    void send(endpoint, {
      method: "POST",
      // A simple request avoids Chromium's localhost/private-network preflight.
      // The Lighting API parses the body as JSON regardless of this media type.
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ up }),
    }).catch(error => {
      // Lighting is optional. Playback must never depend on it being available.
      console.warn("Could not notify the Lighting controller:", error);
    });
  };
};

type PlaybackAudio = Pick<HTMLAudioElement, "currentTime" | "duration" | "paused" | "ended" | "playbackRate"> & {
  addEventListener: HTMLAudioElement["addEventListener"];
  removeEventListener: HTMLAudioElement["removeEventListener"];
};

export const createLightingPlaybackNotifier = (
  send: LightingFetch,
  endpoint = LIGHTING_PLAYBACK_ENDPOINT,
  timers: Pick<typeof globalThis, "setInterval" | "clearInterval"> = globalThis,
) => {
  let active: { audio: PlaybackAudio; path: string; kind: "tango" | "cortina"; sessionId: string; sequence: number; timer: ReturnType<typeof setInterval>; listeners: Array<[string, EventListener]> } | null = null;
  let pending: { method: string; headers: Record<string, string>; body: string } | null = null;
  let sending = false;
  let lastWarningAt = -Infinity;

  const pump = () => {
    if (sending || !pending) return;
    const request = pending;
    pending = null;
    sending = true;
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 500);
    void send(endpoint, { ...request, signal: controller.signal })
      .catch(error => {
        const now = Date.now();
        if (now - lastWarningAt >= 10_000) {
          lastWarningAt = now;
          console.warn("Could not notify Lighting of playback:", error);
        }
      })
      .finally(() => {
        globalThis.clearTimeout(timeout);
        sending = false;
        pump();
      });
  };

  const enqueue = (request: { method: string; headers: Record<string, string>; body: string }) => {
    // At most one request is active and one latest snapshot is retained.
    pending = request;
    pump();
  };

  const publish = (state?: "playing" | "paused" | "stopped" | "ended") => {
    if (!active) return;
    const item = active;
    const transport = state ?? (item.audio.ended ? "ended" : item.audio.paused ? "paused" : "playing");
    const duration = Number.isFinite(item.audio.duration) ? Math.max(0, item.audio.duration) : 0;
    const position = Number.isFinite(item.audio.currentTime) ? Math.max(0, item.audio.currentTime) : 0;
    enqueue({
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ schemaVersion: 1, event: "playback", sessionId: item.sessionId,
        sequence: item.sequence++, kind: item.kind, state: transport, path: item.path,
        positionSeconds: position, durationSeconds: duration, playbackRate: Math.max(0, item.audio.playbackRate || 1),
        sentAtUnixMs: Date.now() }),
    });
  };

  const detach = (finalState?: "stopped" | "ended") => {
    if (!active) return;
    if (finalState) publish(finalState);
    timers.clearInterval(active.timer);
    for (const [name, listener] of active.listeners) active.audio.removeEventListener(name, listener);
    active = null;
  };

  return {
    start(audio: PlaybackAudio, path: string, kind: "tango" | "cortina" = "tango") {
      if (active?.audio === audio) { publish(); return; }
      detach("stopped");
      const listeners: Array<[string, EventListener]> = [];
      active = { audio, path, kind, sessionId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        sequence: 0, timer: 0 as unknown as ReturnType<typeof setInterval>, listeners };
      for (const name of ["play", "pause", "seeking", "seeked", "ratechange", "ended"]) {
        const listener = () => { if (active?.audio !== audio) return; publish(name === "ended" ? "ended" : undefined); if (name === "ended") detach(); };
        audio.addEventListener(name, listener); listeners.push([name, listener]);
      }
      active.timer = timers.setInterval(() => publish(), 750);
      publish();
    },
    stop: () => detach("stopped"),
    publish,
  };
};
