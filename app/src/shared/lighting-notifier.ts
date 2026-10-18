export type LightingFetch = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<unknown>;

export const LIGHTING_ENDPOINT = "http://127.0.0.1:8080/api/lights";

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
