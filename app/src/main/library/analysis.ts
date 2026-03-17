import { app } from "electron";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

type BinarySource = "bundled" | "override" | "path";

export type TrackAnalysis = {
  durationMs: number;
  startOffsetMs: number;
  endTrimMs: number;
  meanGainDb?: number;
  loudnessDb?: number;
  gainDb?: number;
  error?: string;
};

export type TagResult = {
  tags: Record<string, string>;
  error?: string;
};

const extractJsonPayload = (payload: string) => {
  const trimmed = payload.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return null;
};

export const parseLoudnessJson = (payload: string) => {
  const blocks = payload.match(/\{[\s\S]*?\}/g) ?? [];
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const candidate = blocks[i];
    try {
      const json = JSON.parse(candidate) as {
        input_i?: string;
        target_i?: string;
      };
      const inputI = json.input_i ? Number.parseFloat(json.input_i) : undefined;
      const targetI = json.target_i ? Number.parseFloat(json.target_i) : -16;
      if (inputI === undefined || !Number.isFinite(inputI)) {
        continue;
      }
      return {
        loudnessDb: inputI,
        gainDb: targetI - inputI,
        error: undefined,
      };
    } catch {
      continue;
    }
  }
  return {
    loudnessDb: undefined,
    gainDb: undefined,
    error: undefined,
  };
};

type LoudnormPassOneStats = {
  inputI: number;
  inputTp: number;
  inputLra: number;
  inputThresh: number;
  targetOffset: number;
};

const parseLoudnormPassOneJson = (payload: string): LoudnormPassOneStats | null => {
  const blocks = payload.match(/\{[\s\S]*?\}/g) ?? [];
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const candidate = blocks[i];
    try {
      const json = JSON.parse(candidate) as {
        input_i?: string;
        input_tp?: string;
        input_lra?: string;
        input_thresh?: string;
        target_offset?: string;
      };
      const inputI = Number.parseFloat(json.input_i ?? "");
      const inputTp = Number.parseFloat(json.input_tp ?? "");
      const inputLra = Number.parseFloat(json.input_lra ?? "");
      const inputThresh = Number.parseFloat(json.input_thresh ?? "");
      const targetOffset = Number.parseFloat(json.target_offset ?? "");
      if (
        !Number.isFinite(inputI) ||
        !Number.isFinite(inputTp) ||
        !Number.isFinite(inputLra) ||
        !Number.isFinite(inputThresh) ||
        !Number.isFinite(targetOffset)
      ) {
        continue;
      }
      return {
        inputI,
        inputTp,
        inputLra,
        inputThresh,
        targetOffset,
      };
    } catch {
      continue;
    }
  }
  return null;
};

const normalizeJsonParseError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return null;
  }
  const message = error.message.toLowerCase();
  if (
    message.includes("expected property name") ||
    message.includes("unexpected token") ||
    message.includes("json")
  ) {
    return "No loudness JSON";
  }
  return null;
};

const runCommand = (command: string, args: string[]) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `Command failed: ${command}`));
      }
    });
  });

const runCommandAllowFailure = (command: string, args: string[]) =>
  new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? -1 });
    });
  });

let customFfmpegToolsDir: string | null = null;

export const setCustomFfmpegToolsDir = (dirPath: string | null) => {
  const trimmed = dirPath?.trim() ?? "";
  customFfmpegToolsDir = trimmed ? path.resolve(trimmed) : null;
};

export const getCustomFfmpegToolsDir = () => customFfmpegToolsDir;

const resolveBinary = (
  candidate: string,
  fallbackName: string,
  overrideCandidate?: string | null,
) => {
  if (overrideCandidate && fs.existsSync(overrideCandidate)) {
    return { binary: overrideCandidate, source: "override" as const };
  }
  if (fs.existsSync(candidate)) {
    return { binary: candidate, source: "bundled" as const };
  }
  const platform = process.platform;
  const commonPaths =
    platform === "win32"
      ? []
      : [
          "/opt/homebrew/bin",
          "/usr/local/bin",
          "/usr/bin",
        ];
  for (const base of commonPaths) {
    const alt = path.join(base, fallbackName);
    if (fs.existsSync(alt)) {
      return { binary: alt, source: "path" as const };
    }
  }
  return { binary: fallbackName, source: "path" as const };
};

const resolveFfmpeg = () => {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg")
    : path.join(app.getAppPath(), "app", "resources", "ffmpeg");
  const platform = process.platform;
  const binary =
    platform === "win32"
      ? "ffmpeg.exe"
      : platform === "darwin"
        ? "ffmpeg"
        : "ffmpeg";
  const candidate = path.join(base, platform, binary);
  const overrideCandidate = customFfmpegToolsDir
    ? path.join(customFfmpegToolsDir, binary)
    : null;
  const resolved = resolveBinary(candidate, binary, overrideCandidate);
  return { binary: resolved.binary, source: resolved.source, fallback: "ffmpeg" };
};

const resolveFfprobe = () => {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg")
    : path.join(app.getAppPath(), "app", "resources", "ffmpeg");
  const platform = process.platform;
  const binary =
    platform === "win32"
      ? "ffprobe.exe"
      : platform === "darwin"
        ? "ffprobe"
        : "ffprobe";
  const candidate = path.join(base, platform, binary);
  const overrideCandidate = customFfmpegToolsDir
    ? path.join(customFfmpegToolsDir, binary)
    : null;
  const resolved = resolveBinary(candidate, binary, overrideCandidate);
  return { binary: resolved.binary, source: resolved.source, fallback: "ffprobe" };
};

export const getResolvedFfmpegPath = () => resolveFfmpeg().binary;

export const getResolvedFfprobePath = () => resolveFfprobe().binary;

export const getResolvedFfmpegInfo = () => {
  const resolved = resolveFfmpeg();
  return { path: resolved.binary, source: resolved.source as BinarySource };
};

export const getResolvedFfprobeInfo = () => {
  const resolved = resolveFfprobe();
  return { path: resolved.binary, source: resolved.source as BinarySource };
};

const sanitizeFfmpegError = (stderr: string) => {
  const lower = stderr.toLowerCase();
  if (!lower) {
    return undefined;
  }
  if (
    lower.includes("no such file") ||
    lower.includes("permission denied") ||
    lower.includes("invalid data") ||
    lower.includes("could not find codec parameters") ||
    lower.includes("error while decoding") ||
    lower.includes("error opening output")
  ) {
    const line = stderr.split("\n").find((entry) => entry.trim().length > 0);
    return line?.trim();
  }
  return undefined;
};

const parseTags = (payload: string): TagResult => {
  try {
    const jsonPayload = extractJsonPayload(payload) ?? payload;
    const data = JSON.parse(jsonPayload) as {
      format?: { tags?: Record<string, unknown> };
    };
    const rawTags = data.format?.tags ?? {};
    const tags: Record<string, string> = {};
    Object.entries(rawTags).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }
      const normalizedKey = key.toLowerCase();
      const normalizedValue =
        typeof value === "string" ? value : String(value);
      tags[normalizedKey] = normalizedValue;
    });
    return { tags };
  } catch (error) {
    return {
      tags: {},
      error: error instanceof Error ? error.message : "Tag parse failed",
    };
  }
};

export const readTags = async (filePath: string): Promise<TagResult> => {
  const { binary, fallback } = resolveFfprobe();
  const args = [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_entries",
    "format_tags",
    filePath,
  ];

  try {
    const { stdout } = await runCommand(binary, args);
    return parseTags(stdout);
  } catch (error) {
    try {
      const { stdout } = await runCommand(fallback, args);
      return parseTags(stdout);
    } catch (innerError) {
      return {
        tags: {},
        error:
          innerError instanceof Error
            ? innerError.message
            : "Tag read failed",
      };
    }
  }
};

export const renderWaveformPng = async (
  filePath: string,
  outputPath: string,
) => {
  const tempOutputPath = `${outputPath}.${process.pid}.tmp`;
  const { binary, fallback } = resolveFfmpeg();
  const args = [
    "-v",
    "error",
    "-y",
    "-i",
    filePath,
    "-filter_complex",
    "showwavespic=s=1200x240:colors=white",
    "-frames:v",
    "1",
    "-f",
    "image2",
    "-c:v",
    "png",
    tempOutputPath,
  ];
  const legacyArgs = [
    "-v",
    "error",
    "-y",
    "-i",
    filePath,
    "-filter_complex",
    "[0:a:0]showwavespic=s=1200x240:colors=white[v]",
    "-map",
    "[v]",
    "-an",
    "-f",
    "image2",
    "-c:v",
    "png",
    "-frames:v",
    "1",
    tempOutputPath,
  ];

  try {
    fs.rmSync(tempOutputPath, { force: true });
  } catch {
    // Ignore stale temp cleanup failures before render.
  }

  try {
    await runCommand(binary, args);
    fs.renameSync(tempOutputPath, outputPath);
  } catch {
    try {
      await runCommand(fallback, args);
      fs.renameSync(tempOutputPath, outputPath);
    } catch {
      try {
        await runCommand(binary, legacyArgs);
        fs.renameSync(tempOutputPath, outputPath);
      } catch {
        try {
          await runCommand(fallback, legacyArgs);
          fs.renameSync(tempOutputPath, outputPath);
        } finally {
          try {
            fs.rmSync(tempOutputPath, { force: true });
          } catch {
            // Ignore best-effort temp cleanup failures.
          }
        }
      }
    }
  }
};

export const hasUsableWaveformPng = (outputPath: string) => {
  try {
    const stat = fs.statSync(outputPath);
    return stat.isFile() && stat.size > 100;
  } catch {
    return false;
  }
};

type OfflineCompressionRequest = {
  loudnessDb?: number | null;
  depthPercent: number;
  mode: "upward" | "track-leveler";
  liftThresholdDb: number;
  maxLiftDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  gateThresholdDb: number;
  limiterCeilingDb: number;
  limiterReleaseMs: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const dbToLinear = (db: number) => Math.pow(10, db / 20);

const quoteShellArg = (value: string) => {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
};

export const buildCommandLine = (command: string, args: string[]) =>
  [command, ...args].map(quoteShellArg).join(" ");

const buildCompressionFilter = (request: OfflineCompressionRequest) => {
  // Fixed, strongly audible profile tuned for clear quiet-part lift.
  // Single compressor path: no runtime mode switching or per-parameter tuning.
  return [
    "dynaudnorm=f=120:g=25:m=100:s=8:p=1:n=0",
    "acompressor=threshold=-32dB:ratio=4:attack=5:release=250:makeup=8",
    "alimiter=limit=0.8913:level=disabled:attack=1:release=150",
  ].join(",");
};

export const buildCompressedRenderTempPath = (outputPath: string) =>
  `${outputPath}.${process.pid}.tmp.wav`;

export const hasUsableCompressedRender = (outputPath: string) => {
  try {
    const stat = fs.statSync(outputPath);
    return stat.isFile() && stat.size > 44;
  } catch {
    return false;
  }
};

export const renderCompressedAudio = async (
  filePath: string,
  outputPath: string,
  request: OfflineCompressionRequest,
) => {
  const { binary, fallback } = resolveFfmpeg();
  const compressionFilter = buildCompressionFilter(request);
  const passOneArgs = [
    "-v",
    "info",
    "-nostats",
    "-i",
    filePath,
    "-vn",
    "-sn",
    "-dn",
    "-af",
    `${compressionFilter},loudnorm=I=-16:TP=-1:LRA=11:print_format=json`,
    "-f",
    "null",
    "-",
  ];
  let loudnormStats: LoudnormPassOneStats | null = null;
  const passOnePrimary = await runCommandAllowFailure(binary, passOneArgs).catch(() => null);
  if (passOnePrimary) {
    loudnormStats = parseLoudnormPassOneJson(passOnePrimary.stderr);
  }
  if (!loudnormStats) {
    const passOneFallback = await runCommandAllowFailure(fallback, passOneArgs).catch(() => null);
    if (passOneFallback) {
      loudnormStats = parseLoudnormPassOneJson(passOneFallback.stderr);
    }
  }
  const loudnormFilter = loudnormStats
    ? [
        "loudnorm=I=-16:TP=-1:LRA=11",
        `measured_I=${loudnormStats.inputI.toFixed(2)}`,
        `measured_TP=${loudnormStats.inputTp.toFixed(2)}`,
        `measured_LRA=${loudnormStats.inputLra.toFixed(2)}`,
        `measured_thresh=${loudnormStats.inputThresh.toFixed(2)}`,
        `offset=${loudnormStats.targetOffset.toFixed(2)}`,
        "linear=true",
        "print_format=summary",
      ].join(":")
    : "loudnorm=I=-16:TP=-1:LRA=11";
  const finalFilter = `${compressionFilter},${loudnormFilter}`;
  const renderArgs = [
    "-v",
    "error",
    "-y",
    "-i",
    filePath,
    "-vn",
    "-sn",
    "-dn",
    "-af",
    finalFilter,
    "-ar",
    "48000",
    "-ac",
    "2",
    "-c:a",
    "pcm_s16le",
    "-f",
    "wav",
    buildCompressedRenderTempPath(outputPath),
  ];
  const primaryCommandLine = buildCommandLine(binary, renderArgs);
  const fallbackCommandLine = buildCommandLine(fallback, renderArgs);
  const tempOutputPath = renderArgs[renderArgs.length - 1];
  if (typeof tempOutputPath !== "string") {
    throw new Error("Compressed render output path missing");
  }
  try {
    fs.rmSync(tempOutputPath, { force: true });
  } catch {
    // Ignore stale temp cleanup failures before render.
  }
  try {
    await runCommand(binary, renderArgs);
    fs.renameSync(tempOutputPath, outputPath);
    return;
  } catch (primaryError) {
    try {
      await runCommand(fallback, renderArgs);
      fs.renameSync(tempOutputPath, outputPath);
    } catch (fallbackError) {
      const primaryMessage =
        primaryError instanceof Error ? primaryError.message.trim() : "Primary render failed";
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message.trim() : "Fallback render failed";
      throw new Error(
        [
          fallbackMessage,
          `Primary command: ${primaryCommandLine}`,
          `Fallback command: ${fallbackCommandLine}`,
          primaryMessage && primaryMessage !== fallbackMessage
            ? `Primary error: ${primaryMessage}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } finally {
      try {
        fs.rmSync(tempOutputPath, { force: true });
      } catch {
        // Ignore best-effort temp cleanup failures.
      }
    }
  }
};

const readDurationMs = async (filePath: string) => {
  const { binary, fallback } = resolveFfprobe();
  const args = [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ];

  try {
    const { stdout } = await runCommand(binary, args);
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) ? Math.round(duration * 1000) : 0;
  } catch {
    const { stdout } = await runCommand(fallback, args);
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) ? Math.round(duration * 1000) : 0;
  }
};

const readSilenceBounds = async (filePath: string) => {
  const { binary, fallback } = resolveFfmpeg();
  const args = [
    "-i",
    filePath,
    "-map",
    "0:a:0",
    "-vn",
    "-sn",
    "-dn",
    "-af",
    "silencedetect=noise=-35dB:d=0.2",
    "-f",
    "null",
    "-",
  ];

  const parseOutput = (output: string) => {
    const silenceStarts: number[] = [];
    const silenceEnds: number[] = [];

    output.split("\n").forEach((line) => {
      const startMatch = line.match(/silence_start:\s*([0-9.]+)/);
      if (startMatch) {
        silenceStarts.push(Number.parseFloat(startMatch[1]));
      }
      const endMatch = line.match(/silence_end:\s*([0-9.]+)/);
      if (endMatch) {
        silenceEnds.push(Number.parseFloat(endMatch[1]));
      }
    });

    return { silenceStarts, silenceEnds };
  };

  const primary = await runCommandAllowFailure(binary, args);
  const primaryParsed = parseOutput(primary.stderr);
  if (primary.code === 0 || primaryParsed.silenceStarts.length > 0 || primaryParsed.silenceEnds.length > 0) {
    return {
      ...primaryParsed,
      error: primary.code === 0 ? undefined : sanitizeFfmpegError(primary.stderr),
    };
  }
  const secondary = await runCommandAllowFailure(fallback, args);
  return {
    ...parseOutput(secondary.stderr),
    error: secondary.code === 0 ? undefined : sanitizeFfmpegError(secondary.stderr),
  };
};

const readLoudness = async (filePath: string) => {
  const { binary, fallback } = resolveFfmpeg();
  const args = [
    "-v",
    "info",
    "-nostats",
    "-i",
    filePath,
    "-map",
    "0:a:0",
    "-vn",
    "-sn",
    "-dn",
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
    "-f",
    "null",
    "-",
  ];

  try {
    const primary = await runCommandAllowFailure(binary, args);
    const primaryParsed = parseLoudnessJson(primary.stderr);
    if (primary.code === 0 || primaryParsed.loudnessDb !== undefined) {
      return {
        ...primaryParsed,
        error:
          primary.code === 0
            ? primaryParsed.error
            : sanitizeFfmpegError(primary.stderr),
      };
    }
    const secondary = await runCommandAllowFailure(fallback, args);
    const secondaryParsed = parseLoudnessJson(secondary.stderr);
    return {
      ...secondaryParsed,
      error:
        secondary.code === 0
          ? secondaryParsed.error
          : sanitizeFfmpegError(secondary.stderr),
    };
  } catch (error) {
    const normalized = normalizeJsonParseError(error);
    return {
      loudnessDb: undefined,
      gainDb: undefined,
      error: normalized ?? (error instanceof Error ? error.message : "Loudness failed"),
    };
  }
};

export const analyzeTrack = async (filePath: string): Promise<TrackAnalysis> => {
  const [durationMs, silence, loudness] = await Promise.all([
    readDurationMs(filePath).catch(() => 0),
    readSilenceBounds(filePath).catch((error) => ({
      silenceStarts: [],
      silenceEnds: [],
      error: error instanceof Error ? error.message : "Silence analysis failed",
    })),
    readLoudness(filePath).catch((error) => {
      const normalized = normalizeJsonParseError(error);
      return {
        loudnessDb: undefined,
        gainDb: undefined,
        error: normalized ?? (error instanceof Error ? error.message : "Loudness failed"),
      };
    }),
  ]);
  const loudnessError =
    loudness.error && loudness.error === "No loudness JSON"
      ? undefined
      : loudness.error;

  let startOffsetMs = 0;
  if (silence.silenceStarts[0] === 0 && silence.silenceEnds.length > 0) {
    startOffsetMs = Math.round(silence.silenceEnds[0] * 1000);
  }

  let endTrimMs = 0;
  if (durationMs > 0 && silence.silenceStarts.length > 0) {
    const lastSilenceStart =
      silence.silenceStarts[silence.silenceStarts.length - 1];
    if (lastSilenceStart > 0) {
      const trim = durationMs - Math.round(lastSilenceStart * 1000);
      endTrimMs = Math.max(0, trim);
    }
  }

  const analysisError = silence.error ?? loudnessError;

  return {
    durationMs,
    startOffsetMs,
    endTrimMs,
    loudnessDb: loudness.loudnessDb,
    gainDb: loudness.gainDb,
    error: analysisError,
  };
};
