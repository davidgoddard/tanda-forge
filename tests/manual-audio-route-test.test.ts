import { describe, expect, it } from "vitest";
import {
  findOutputDeviceByLabelFragment,
  summarizeManualDeviceInventory,
} from "../app/src/shared/manual-audio-route-test";

describe("manual audio route test helpers", () => {
  it("finds the DragonFly output by label fragment", () => {
    const output = findOutputDeviceByLabelFragment(
      [
        {
          deviceId: "one",
          label: "Internal Speakers (Built-in)",
          groupId: "g1",
        },
        {
          deviceId: "two",
          label: "AudioQuest DragonFly (21b4:0081)",
          groupId: "g2",
        },
      ],
      "dragonfly",
    );

    expect(output?.deviceId).toBe("two");
  });

  it("returns null when no output matches the requested fragment", () => {
    const output = findOutputDeviceByLabelFragment(
      [{ deviceId: "one", label: "Internal Speakers", groupId: "g1" }],
      "dragonfly",
    );

    expect(output).toBeNull();
  });

  it("summarizes raw device inventory into audio outputs", () => {
    const summary = summarizeManualDeviceInventory([
      { kind: "audioinput", deviceId: "mic", label: "Mic", groupId: "g0" },
      {
        kind: "audiooutput",
        deviceId: "dragonfly",
        label: "AudioQuest DragonFly",
        groupId: "g1",
      },
    ]);

    expect(summary.totalDevices).toBe(2);
    expect(summary.audioOutputCount).toBe(1);
    expect(summary.audioOutputs).toEqual([
      {
        deviceId: "dragonfly",
        label: "AudioQuest DragonFly",
        groupId: "g1",
      },
    ]);
  });
});
