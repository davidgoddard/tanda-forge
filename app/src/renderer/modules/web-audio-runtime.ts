const audioLevels = new WeakMap<HTMLAudioElement, number>();

export type AudioDspRuntime = {
  source: MediaElementAudioSourceNode;
  inputGain: GainNode;
  dryGain: GainNode;
  liftGain: GainNode;
  limiter: DynamicsCompressorNode;
  wetGain: GainNode;
  mixGain: GainNode;
  analyser: AnalyserNode;
  outputAnalyser: AnalyserNode;
  isRunning: boolean;
  currentLiftDb: number;
  detectorDb: number;
  peakDb: number;
  levelerMeanDb: number;
  lastUpdateMs: number;
  updateRafId: number | null;
};

let sharedAudioContext: AudioContext | null = null;
const audioDspRuntimes = new WeakMap<HTMLAudioElement, AudioDspRuntime>();

const levelMatchSampleBuffer = new Float32Array(1024);

const configureRuntimePassThrough = (runtime: AudioDspRuntime) => {
  const now = runtime.inputGain.context.currentTime;
  runtime.dryGain.gain.cancelScheduledValues(now);
  runtime.wetGain.gain.cancelScheduledValues(now);
  runtime.dryGain.gain.setValueAtTime(1, now);
  runtime.wetGain.gain.setValueAtTime(0, now);
};

export const sampleRuntimeRms = (audio: HTMLAudioElement) => {
  const runtime = audioDspRuntimes.get(audio);
  if (!runtime) {
    return 0;
  }
  runtime.outputAnalyser.getFloatTimeDomainData(levelMatchSampleBuffer);
  let sum = 0;
  for (let i = 0; i < levelMatchSampleBuffer.length; i += 1) {
    const sample = levelMatchSampleBuffer[i] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / levelMatchSampleBuffer.length);
};

const getSharedAudioContext = () => {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
};

export const ensureSharedAudioContextRunning = async () => {
  const context = getSharedAudioContext();
  if (context.state === "running") {
    return true;
  }
  try {
    await context.resume();
  } catch {
    return false;
  }
  const nextState = context.state as AudioContextState;
  return nextState === "running";
};

export const ensureAudioDspRuntime = (audio: HTMLAudioElement) => {
  const existing = audioDspRuntimes.get(audio);
  if (existing) {
    return existing;
  }
  const context = getSharedAudioContext();
  const source = context.createMediaElementSource(audio);
  const inputGain = context.createGain();
  const dryGain = context.createGain();
  const liftGain = context.createGain();
  const limiter = context.createDynamicsCompressor();
  const wetGain = context.createGain();
  const mixGain = context.createGain();
  const analyser = context.createAnalyser();
  const outputAnalyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.05;
  outputAnalyser.fftSize = 1024;
  outputAnalyser.smoothingTimeConstant = 0.08;

  source.connect(inputGain);
  inputGain.connect(dryGain);
  inputGain.connect(liftGain);
  inputGain.connect(analyser);
  liftGain.connect(limiter);
  limiter.connect(wetGain);
  dryGain.connect(mixGain);
  wetGain.connect(mixGain);
  mixGain.connect(outputAnalyser);
  mixGain.connect(context.destination);

  const runtime: AudioDspRuntime = {
    source,
    inputGain,
    dryGain,
    liftGain,
    limiter,
    wetGain,
    mixGain,
    analyser,
    outputAnalyser,
    isRunning: true,
    currentLiftDb: 0,
    detectorDb: -120,
    peakDb: -120,
    levelerMeanDb: -120,
    lastUpdateMs: performance.now(),
    updateRafId: null,
  };
  // Main/wet playback now uses offline-rendered compression, so runtime should
  // remain transparent and only provide gain + analyser plumbing.
  configureRuntimePassThrough(runtime);
  audio.volume = Math.min(1, Math.max(0, audio.volume || 1));
  runtime.updateRafId = null;
  runtime.isRunning = false;
  audioDspRuntimes.set(audio, runtime);
  return runtime;
};

export const releaseAudioDspRuntime = async (audio: HTMLAudioElement) => {
  const runtime = audioDspRuntimes.get(audio);
  if (!runtime) {
    return;
  }
  runtime.isRunning = false;
  if (runtime.updateRafId !== null) {
    window.cancelAnimationFrame(runtime.updateRafId);
    runtime.updateRafId = null;
  }
  runtime.source.disconnect();
  runtime.inputGain.disconnect();
  runtime.dryGain.disconnect();
  runtime.liftGain.disconnect();
  runtime.limiter.disconnect();
  runtime.wetGain.disconnect();
  runtime.mixGain.disconnect();
  runtime.analyser.disconnect();
  runtime.outputAnalyser.disconnect();
  audioDspRuntimes.delete(audio);
  const level = audioLevels.get(audio);
  audio.volume = Math.min(1, Math.max(0, level ?? audio.volume ?? 1));
};

export const setAudioLevel = (audio: HTMLAudioElement, level: number) => {
  const safe = Math.max(0, level);
  audioLevels.set(audio, safe);
  const runtime = audioDspRuntimes.get(audio);
  if (runtime) {
    // When routed through WebAudio runtime, keep media element at unity and
    // apply program level only once via runtime input gain.
    runtime.inputGain.gain.setValueAtTime(safe, runtime.inputGain.context.currentTime);
    audio.volume = 1;
    return;
  }
  audio.volume = Math.min(1, safe);
};

export const getAudioLevel = (audio: HTMLAudioElement) => {
  const stored = audioLevels.get(audio);
  if (typeof stored === "number" && Number.isFinite(stored)) {
    return Math.max(0, stored);
  }
  return Math.max(0, audio.volume || 0);
};

export const resumeAudioContextForElement = async (audio: HTMLAudioElement) => {
  const runtime = audioDspRuntimes.get(audio);
  if (!runtime) {
    return;
  }
  await ensureSharedAudioContextRunning();
  setAudioLevel(audio, getAudioLevel(audio));
};
