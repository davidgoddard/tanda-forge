import { describe, expect, it, vi } from "vitest";
import { createLightingNotifier, createLightingPlaybackNotifier, LIGHTING_ENDPOINT, LIGHTING_PLAYBACK_ENDPOINT } from "../app/src/shared/lighting-notifier";

describe("createLightingNotifier", () => {
  it("posts up and down states while suppressing duplicates", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const notify = createLightingNotifier(send);

    notify(true);
    notify(true);
    notify(false);
    await Promise.resolve();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, LIGHTING_ENDPOINT, expect.objectContaining({
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ up: true }),
    }));
    expect(send).toHaveBeenNthCalledWith(2, LIGHTING_ENDPOINT, expect.objectContaining({
      body: JSON.stringify({ up: false }),
    }));
  });

  it("does not surface an unavailable lighting app", async () => {
    const send = vi.fn().mockRejectedValue(new Error("offline"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const notify = createLightingNotifier(send);

    expect(() => notify(true)).not.toThrow();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});

describe("createLightingPlaybackNotifier", () => {
  it("announces only the explicitly attached main audio with session identity and positions", async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValue(undefined);
    const listeners = new Map<string, EventListener>();
    const audio = { currentTime: 12.5, duration: 180, paused: false, ended: false, playbackRate: 1,
      addEventListener: vi.fn((name: string, listener: EventListener) => listeners.set(name, listener)),
      removeEventListener: vi.fn() } as unknown as HTMLAudioElement;
    const notifier = createLightingPlaybackNotifier(send);
    notifier.start(audio, "/music/tango.mp3", "tango");
    await Promise.resolve();
    expect(send).toHaveBeenCalledWith(LIGHTING_PLAYBACK_ENDPOINT, expect.objectContaining({ method: "POST" }));
    const first = JSON.parse(send.mock.calls[0][1].body);
    expect(first).toMatchObject({ schemaVersion: 1, event: "playback", sequence: 0, state: "playing",
      kind: "tango", path: "/music/tango.mp3", positionSeconds: 12.5 });
    audio.currentTime = 44; listeners.get("seeking")?.(new Event("seeking"));
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    expect(JSON.parse(send.mock.calls[1][1].body)).toMatchObject({ sequence: 1, positionSeconds: 44 });
    notifier.stop(); vi.useRealTimers();
  });

  it("keeps only one in-flight request and the latest queued snapshot", async () => {
    vi.useFakeTimers();
    let finishFirst: (() => void) | undefined;
    const send = vi.fn()
      .mockImplementationOnce(() => new Promise<void>(resolve => { finishFirst = resolve; }))
      .mockResolvedValue(undefined);
    const listeners = new Map<string, EventListener>();
    const audio = { currentTime: 1, duration: 100, paused: false, ended: false, playbackRate: 1,
      addEventListener: vi.fn((name: string, listener: EventListener) => listeners.set(name, listener)),
      removeEventListener: vi.fn() } as unknown as HTMLAudioElement;
    const notifier = createLightingPlaybackNotifier(send);
    notifier.start(audio, "/music/tango.mp3");
    audio.currentTime = 2; listeners.get("seeking")?.(new Event("seeking"));
    audio.currentTime = 3; listeners.get("seeked")?.(new Event("seeked"));
    expect(send).toHaveBeenCalledTimes(1);
    finishFirst?.();
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(send.mock.calls[1][1].body).positionSeconds).toBe(3);
    notifier.stop();
    vi.useRealTimers();
  });
});
