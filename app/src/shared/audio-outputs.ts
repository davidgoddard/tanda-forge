export type AudioOutputDevice = {
  deviceId: string;
  groupId: string;
  label: string;
};

const normalizeLabel = (label: string) =>
  label
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const dedupeKeyForDevice = (device: AudioOutputDevice) => {
  const label = normalizeLabel(device.label);
  if (device.groupId && label) {
    return `group+label:${device.groupId}:${label}`;
  }
  if (label) {
    return `label:${label}`;
  }
  if (device.groupId) {
    return `group:${device.groupId}`;
  }
  return `id:${device.deviceId}`;
};

const choosePreferredDuplicate = (
  current: AudioOutputDevice,
  candidate: AudioOutputDevice,
) => {
  const currentIsDefault = current.deviceId === "default";
  const candidateIsDefault = candidate.deviceId === "default";
  if (currentIsDefault && !candidateIsDefault) {
    return candidate;
  }
  if (!currentIsDefault && candidateIsDefault) {
    return current;
  }
  const currentLabelLen = current.label.trim().length;
  const candidateLabelLen = candidate.label.trim().length;
  if (candidateLabelLen > currentLabelLen) {
    return candidate;
  }
  return current;
};

export const dedupeAudioOutputs = (
  outputs: AudioOutputDevice[],
): AudioOutputDevice[] => {
  const byDeviceId = new Map<string, AudioOutputDevice>();
  for (const output of outputs) {
    if (!output.deviceId) {
      continue;
    }
    if (!byDeviceId.has(output.deviceId)) {
      byDeviceId.set(output.deviceId, output);
    }
  }
  const byKey = new Map<string, AudioOutputDevice>();
  for (const output of byDeviceId.values()) {
    const key = dedupeKeyForDevice(output);
    const existing = byKey.get(key);
    byKey.set(
      key,
      existing ? choosePreferredDuplicate(existing, output) : output,
    );
  }
  return [...byKey.values()];
};

export const resolveStoredOutputDevice = (
  storedId: string | null,
  storedLabel: string | null,
  storedGroup: string | null,
  outputs: AudioOutputDevice[],
): string | null => {
  if (storedId === "default") {
    return "default";
  }
  if (storedId) {
    const byId = outputs.find((device) => device.deviceId === storedId);
    if (byId) {
      return byId.deviceId;
    }
  }
  if (storedLabel && storedGroup) {
    const byExactMeta = outputs.find(
      (device) =>
        device.groupId === storedGroup &&
        normalizeLabel(device.label) === normalizeLabel(storedLabel),
    );
    if (byExactMeta) {
      return byExactMeta.deviceId;
    }
  }
  if (storedGroup) {
    const byGroup = outputs.find((device) => device.groupId === storedGroup);
    if (byGroup) {
      return byGroup.deviceId;
    }
  }
  if (storedLabel) {
    const byLabel = outputs.find(
      (device) =>
        normalizeLabel(device.label) === normalizeLabel(storedLabel),
    );
    if (byLabel) {
      return byLabel.deviceId;
    }
  }
  return null;
};

export const chooseAvailableOutputDeviceId = (
  outputs: AudioOutputDevice[],
  candidates: Array<string | null | undefined>,
): string | null => {
  for (const candidate of candidates) {
    if (!candidate || candidate === "default") {
      continue;
    }
    const match = outputs.find((device) => device.deviceId === candidate);
    if (match) {
      return match.deviceId;
    }
  }
  return null;
};

export const getOutputCandidateIds = (
  outputs: AudioOutputDevice[],
  target: AudioOutputDevice,
): string[] => {
  const targetLabel = normalizeLabel(target.label);
  const matches = outputs
    .filter((device) => {
      if (!device.deviceId) {
        return false;
      }
      if (device.groupId && target.groupId) {
        return (
          device.groupId === target.groupId &&
          normalizeLabel(device.label) === targetLabel
        );
      }
      return normalizeLabel(device.label) === targetLabel;
    })
    .map((device) => device.deviceId);
  const unique = Array.from(new Set(matches));
  if (!unique.includes(target.deviceId)) {
    unique.unshift(target.deviceId);
  } else {
    unique.splice(unique.indexOf(target.deviceId), 1);
    unique.unshift(target.deviceId);
  }
  return unique;
};
