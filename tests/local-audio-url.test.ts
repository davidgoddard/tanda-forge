import { describe, expect, it } from "vitest";
import { localAudioUrl } from "../app/src/renderer/modules/local-audio-url";

describe("local audition audio URLs", () => {
  it.each([
    ["/Music/Tango #1.wav", "file:///Music/Tango%20%231.wav"],
    ["C:\\Music\\Tango #1.wav", "file:///C:/Music/Tango%20%231.wav"],
    ["/Music/Café.wav", "file:///Music/Caf%C3%A9.wav"],
  ])("preserves the existing encoding for %s", (path, expected) => {
    expect(localAudioUrl(path)).toBe(expected);
  });
});
