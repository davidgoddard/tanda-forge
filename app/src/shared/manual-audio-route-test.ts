export type ManualAudioOutputDevice = {
  deviceId: string;
  label: string;
  groupId: string;
};

export type ManualDeviceInventoryItem = {
  kind: string;
  deviceId: string;
  label: string;
  groupId: string;
};

const normalize = (value: string) => value.trim().toLowerCase();

export const findOutputDeviceByLabelFragment = (
  outputs: ManualAudioOutputDevice[],
  fragment: string,
): ManualAudioOutputDevice | null => {
  const needle = normalize(fragment);
  if (!needle) {
    return null;
  }
  return (
    outputs.find((output) => normalize(output.label).includes(needle)) ?? null
  );
};

export const summarizeManualDeviceInventory = (
  devices: ManualDeviceInventoryItem[],
) => {
  const audioOutputs = devices
    .filter((device) => device.kind === "audiooutput")
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
      groupId: device.groupId,
    }));
  return {
    totalDevices: devices.length,
    audioOutputCount: audioOutputs.length,
    audioOutputs,
  };
};
