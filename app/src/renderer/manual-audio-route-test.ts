import {
  findOutputDeviceByLabelFragment,
  summarizeManualDeviceInventory,
} from "../shared/manual-audio-route-test.js";

type ManualApi = {
  pickAudioFile: () => Promise<string | null>;
};

declare global {
  interface Window {
    manualAudioRouteTest?: ManualApi;
  }
}

type AudioOutputDevice = {
  deviceId: string;
  label: string;
  groupId: string;
};

const outputSelect = document.getElementById("output-select") as HTMLSelectElement | null;
const filePathInput = document.getElementById("file-path") as HTMLInputElement | null;
const selectedSinkEl = document.getElementById("selected-sink");
const currentFileEl = document.getElementById("current-file");
const statusTextEl = document.getElementById("status-text");
const timeTextEl = document.getElementById("time-text");
const snapshotEl = document.getElementById("device-snapshot");
const logEl = document.getElementById("event-log");

const audio = new Audio();
audio.preload = "auto";

let outputs: AudioOutputDevice[] = [];

const log = (message: string, data?: unknown) => {
  const line = data === undefined ? message : `${message} ${JSON.stringify(data)}`;
  const stamp = new Date().toISOString();
  if (logEl) {
    logEl.textContent = `${stamp} ${line}\n${logEl.textContent}`;
  }
};

const setStatus = (message: string) => {
  if (statusTextEl) {
    statusTextEl.textContent = message;
  }
};

const updateSnapshot = () => {
  if (snapshotEl) {
    snapshotEl.textContent = JSON.stringify(
      {
        selectedValue: outputSelect?.value ?? null,
        outputs,
        sinkId: (audio as HTMLAudioElement & { sinkId?: string }).sinkId ?? null,
      },
      null,
      2,
    );
  }
};

const renderOutputs = () => {
  if (!outputSelect) {
    return;
  }
  const previous = outputSelect.value;
  outputSelect.innerHTML = "";
  if (outputs.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No audio outputs detected";
    outputSelect.appendChild(option);
    outputSelect.disabled = true;
  } else {
    outputSelect.disabled = false;
    outputs.forEach((output) => {
      const option = document.createElement("option");
      option.value = output.deviceId;
      option.textContent = output.label || output.deviceId;
      outputSelect.appendChild(option);
    });
  }
  if (outputs.some((output) => output.deviceId === previous)) {
    outputSelect.value = previous;
  }
  if (!outputSelect.value && outputs[0]) {
    outputSelect.value = outputs[0].deviceId;
  }
  const current = outputs.find((output) => output.deviceId === outputSelect.value);
  if (selectedSinkEl) {
    selectedSinkEl.textContent = current?.label ?? outputSelect.value ?? "-";
  }
  updateSnapshot();
};

const refreshOutputs = async () => {
  let devices = await navigator.mediaDevices.enumerateDevices();
  if (devices.every((device) => device.kind !== "audiooutput" || !device.label)) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch (error) {
      log("getUserMedia failed while unlocking labels", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const rawDevices = devices.map((device) => ({
    kind: device.kind,
    deviceId: device.deviceId,
    label: device.label,
    groupId: device.groupId,
  }));
  const summary = summarizeManualDeviceInventory(rawDevices);
  outputs = summary.audioOutputs.map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
      groupId: device.groupId,
    }));
  renderOutputs();
  setStatus(
    summary.audioOutputCount > 0
      ? `Detected ${summary.audioOutputCount} audio output(s)`
      : "No audio outputs detected by enumerateDevices()",
  );
  log("enumerated raw devices", rawDevices);
  log("enumerated outputs", outputs);
};

const applySelectedSink = async () => {
  const deviceId = outputSelect?.value ?? "";
  if (!deviceId) {
    setStatus("No output selected");
    return;
  }
  const setSinkId = (audio as HTMLAudioElement & {
    setSinkId?: (sinkId: string) => Promise<void>;
    sinkId?: string;
  }).setSinkId;
  if (!setSinkId) {
    setStatus("setSinkId unsupported");
    log("setSinkId unsupported");
    return;
  }
  try {
    await setSinkId.call(audio, deviceId);
    const selected = outputs.find((output) => output.deviceId === deviceId);
    if (selectedSinkEl) {
      selectedSinkEl.textContent = selected?.label ?? deviceId;
    }
    setStatus(`Applied sink: ${selected?.label ?? deviceId}`);
    log("setSinkId succeeded", {
      requestedDeviceId: deviceId,
      sinkId: (audio as HTMLAudioElement & { sinkId?: string }).sinkId ?? null,
      selected,
    });
  } catch (error) {
    setStatus(
      `setSinkId failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    log("setSinkId failed", {
      requestedDeviceId: deviceId,
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "unknown",
    });
  }
  updateSnapshot();
};

const selectDragonFly = () => {
  if (!outputSelect) {
    return;
  }
  const match = findOutputDeviceByLabelFragment(outputs, "dragonfly");
  if (!match) {
    setStatus("DragonFly not found in current output list");
    log("DragonFly not found", outputs);
    return;
  }
  outputSelect.value = match.deviceId;
  if (selectedSinkEl) {
    selectedSinkEl.textContent = match.label;
  }
  setStatus(`Selected ${match.label}`);
  updateSnapshot();
};

const playFile = async () => {
  const filePath = filePathInput?.value.trim() ?? "";
  if (!filePath) {
    setStatus("Choose an audio file first");
    return;
  }
  await applySelectedSink();
  audio.src = `file://${encodeURI(filePath)}`;
  if (currentFileEl) {
    currentFileEl.textContent = filePath;
  }
  try {
    await audio.play();
    setStatus("Playback started");
    log("playback started", {
      filePath,
      sinkId: (audio as HTMLAudioElement & { sinkId?: string }).sinkId ?? null,
      currentTime: audio.currentTime,
    });
  } catch (error) {
    setStatus(`Playback failed: ${error instanceof Error ? error.message : String(error)}`);
    log("playback failed", {
      filePath,
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "unknown",
    });
  }
};

const stopFile = () => {
  audio.pause();
  audio.currentTime = 0;
  setStatus("Playback stopped");
  log("playback stopped");
};

audio.addEventListener("timeupdate", () => {
  if (timeTextEl) {
    timeTextEl.textContent = `${audio.currentTime.toFixed(2)}s`;
  }
});

audio.addEventListener("ended", () => {
  setStatus("Playback ended");
  log("playback ended");
});

document.getElementById("request-access")?.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    setStatus("Audio access granted");
    log("audio access granted");
  } catch (error) {
    setStatus(`Audio access failed: ${error instanceof Error ? error.message : String(error)}`);
    log("audio access failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  await refreshOutputs();
});

document.getElementById("refresh-outputs")?.addEventListener("click", () => {
  void refreshOutputs();
});

document.getElementById("select-dragonfly")?.addEventListener("click", () => {
  selectDragonFly();
});

document.getElementById("browse-file")?.addEventListener("click", async () => {
  const selected = await window.manualAudioRouteTest?.pickAudioFile();
  if (!selected) {
    return;
  }
  if (filePathInput) {
    filePathInput.value = selected;
  }
  if (currentFileEl) {
    currentFileEl.textContent = selected;
  }
  setStatus("Audio file selected");
  log("audio file selected", { filePath: selected });
});

document.getElementById("apply-output")?.addEventListener("click", () => {
  void applySelectedSink();
});

document.getElementById("play-file")?.addEventListener("click", () => {
  void playFile();
});

document.getElementById("stop-file")?.addEventListener("click", () => {
  stopFile();
});

void refreshOutputs();
