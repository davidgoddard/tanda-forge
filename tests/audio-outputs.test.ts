import { describe, expect, it } from "vitest";
import {
  chooseAvailableOutputDeviceId,
  dedupeAudioOutputs,
  getOutputCandidateIds,
  resolveRequestedOutputDeviceId,
  resolveStoredOutputDevice,
  type AudioOutputDevice,
} from "../app/src/shared/audio-outputs";

describe("audio output helpers", () => {
  it("deduplicates repeated AirPlay entries by group+label", () => {
    const outputs: AudioOutputDevice[] = [
      {
        deviceId: "airplay-1",
        groupId: "grp-airplay",
        label: "Lounge Airplay (AirPlay)",
      },
      {
        deviceId: "airplay-2",
        groupId: "grp-airplay",
        label: "Lounge Airplay (AirPlay)",
      },
      {
        deviceId: "built-in-speaker",
        groupId: "grp-speaker",
        label: "MacBook Air Speakers (Built-in)",
      },
      {
        deviceId: "built-in-headphones",
        groupId: "grp-headphones",
        label: "External Headphones (Built-in)",
      },
    ];

    const deduped = dedupeAudioOutputs(outputs);
    expect(deduped).toHaveLength(3);
    expect(
      deduped.filter((device) => device.label.includes("Lounge Airplay")).length,
    ).toBe(1);
  });

  it("keeps same-label devices when group differs", () => {
    const outputs: AudioOutputDevice[] = [
      { deviceId: "dock-1", groupId: "grp-a", label: "USB Audio Device" },
      { deviceId: "dock-2", groupId: "grp-b", label: "USB Audio Device" },
    ];

    const deduped = dedupeAudioOutputs(outputs);
    expect(deduped).toHaveLength(2);
  });

  it("resolves stored device by exact group+label before loose matching", () => {
    const outputs: AudioOutputDevice[] = [
      { deviceId: "route-a", groupId: "grp-a", label: "Lounge Airplay (AirPlay)" },
      { deviceId: "route-b", groupId: "grp-b", label: "Lounge Airplay (AirPlay)" },
    ];

    const resolved = resolveStoredOutputDevice(
      null,
      "Lounge Airplay (AirPlay)",
      "grp-b",
      outputs,
    );
    expect(resolved).toBe("route-b");
  });

  it("chooses first available candidate device id", () => {
    const outputs: AudioOutputDevice[] = [
      { deviceId: "speaker-a", groupId: "grp-a", label: "Speakers A" },
      { deviceId: "speaker-b", groupId: "grp-b", label: "Speakers B" },
    ];
    const resolved = chooseAvailableOutputDeviceId(outputs, [
      "missing",
      "default",
      "speaker-b",
      "speaker-a",
    ]);
    expect(resolved).toBe("speaker-b");
  });

  it("returns grouped route candidates with target first", () => {
    const outputs: AudioOutputDevice[] = [
      { deviceId: "a", groupId: "grp-air", label: "Lounge Airplay (AirPlay)" },
      { deviceId: "b", groupId: "grp-air", label: "Lounge Airplay (AirPlay)" },
      { deviceId: "c", groupId: "grp-other", label: "Internal Speakers" },
    ];
    const target = outputs[1];
    const candidates = getOutputCandidateIds(outputs, target);
    expect(candidates).toEqual(["b", "a"]);
  });

  it("keeps an explicit unavailable output request instead of falling back to default", () => {
    const outputs: AudioOutputDevice[] = [
      { deviceId: "speaker-a", groupId: "grp-a", label: "Speakers A" },
      { deviceId: "speaker-b", groupId: "grp-b", label: "Speakers B" },
    ];

    const resolved = resolveRequestedOutputDeviceId(outputs, {
      selectedId: "default",
      storedId: "missing-device",
      storedLabel: "Club Mixer",
      storedGroup: "grp-club",
    });

    expect(resolved).toBe("missing-device");
  });

  it("resolves a stored output by metadata before treating it as unavailable", () => {
    const outputs: AudioOutputDevice[] = [
      { deviceId: "route-a", groupId: "grp-a", label: "Club Mixer" },
      { deviceId: "route-b", groupId: "grp-b", label: "Headphones" },
    ];

    const resolved = resolveRequestedOutputDeviceId(outputs, {
      storedId: "stale-id",
      storedLabel: "Club Mixer",
      storedGroup: "grp-a",
    });

    expect(resolved).toBe("route-a");
  });
});
