export const CALIBRATION_INTERVAL_MS = 5000;

export const createCalibrationClickWav = () => {
  const sampleRate = 44100;
  const durationSeconds = 0.07;
  const sampleCount = Math.round(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 2, true);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const envelope = Math.sin(Math.PI * Math.min(1, time / durationSeconds));
    const sample = Math.sin(2 * Math.PI * 880 * time) * envelope * 0.45;
    view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
};

export const createCalibrationPulseLoop = (
  pulse: () => void,
  intervalMs = CALIBRATION_INTERVAL_MS,
) => {
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    start() {
      if (timer !== null) {
        return;
      }
      pulse();
      timer = setInterval(pulse, intervalMs);
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
    isRunning: () => timer !== null,
  };
};
