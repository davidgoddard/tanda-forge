import { expect, it } from "vitest";
import {
  getAudioLevel,
  sampleRuntimeRms,
  setAudioLevel,
} from "../app/src/renderer/modules/web-audio-runtime";

it("clamps direct media volume while preserving the requested level per element", () => {
  const main = { volume: 0.5 } as HTMLAudioElement;
  const cue = { volume: 0.25 } as HTMLAudioElement;

  setAudioLevel(main, 1.4);
  expect(main.volume).toBe(1);
  expect(getAudioLevel(main)).toBe(1.4);
  expect(getAudioLevel(cue)).toBe(0.25);
  expect(sampleRuntimeRms(main)).toBe(0);

  setAudioLevel(main, -1);
  expect(main.volume).toBe(0);
  expect(getAudioLevel(main)).toBe(0);
});
