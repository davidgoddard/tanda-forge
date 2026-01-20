import { app } from "electron";
import path from "path";
import { spawn } from "child_process";

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

export const parseLoudnessJson = (payload: string) => {
  const start = payload.indexOf("{");
  const end = payload.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return {
      loudnessDb: undefined,
      gainDb: undefined,
      error: "No loudness JSON",
    };
  }
  try {
    const json = JSON.parse(payload.slice(start, end + 1)) as {
      input_i?: string;
      target_i?: string;
    };
    const inputI = json.input_i ? Number.parseFloat(json.input_i) : undefined;
    const targetI = json.target_i ? Number.parseFloat(json.target_i) : -16;
    if (inputI === undefined || !Number.isFinite(inputI)) {
      return {
        loudnessDb: undefined,
        gainDb: undefined,
        error: "Invalid loudness",
      };
    }
    return {
      loudnessDb: inputI,
      gainDb: targetI - inputI,
      error: undefined,
    };
  } catch (error) {
    return {
      loudnessDb: undefined,
      gainDb: undefined,
      error: error instanceof Error ? error.message : "Loudness parse failed",
    };
  }
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
  return { binary: candidate, fallback: "ffmpeg" };
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
  return { binary: candidate, fallback: "ffprobe" };
};

const parseTags = (payload: string): TagResult => {
  try {
    const data = JSON.parse(payload) as {
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

  try {
    const { stderr } = await runCommand(binary, args);
    return parseOutput(stderr);
  } catch {
    const { stderr } = await runCommand(fallback, args);
    return parseOutput(stderr);
  }
};

const readLoudness = async (filePath: string) => {
  const { binary, fallback } = resolveFfmpeg();
  const args = [
    "-i",
    filePath,
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
    "-f",
    "null",
    "-",
  ];

  try {
    const { stderr } = await runCommand(binary, args);
    return parseLoudnessJson(stderr);
  } catch {
    const { stderr } = await runCommand(fallback, args);
    return parseLoudnessJson(stderr);
  }
};

export const analyzeTrack = async (filePath: string): Promise<TrackAnalysis> => {
  try {
    const durationMs = await readDurationMs(filePath);
    const { silenceStarts, silenceEnds } = await readSilenceBounds(filePath);
    const loudness = await readLoudness(filePath);

    let startOffsetMs = 0;
    if (silenceStarts[0] === 0 && silenceEnds.length > 0) {
      startOffsetMs = Math.round(silenceEnds[0] * 1000);
    }

    let endTrimMs = 0;
    if (durationMs > 0 && silenceStarts.length > 0) {
      const lastSilenceStart = silenceStarts[silenceStarts.length - 1];
      if (lastSilenceStart > 0) {
        const trim = durationMs - Math.round(lastSilenceStart * 1000);
        endTrimMs = Math.max(0, trim);
      }
    }

    return {
      durationMs,
      startOffsetMs,
      endTrimMs,
      loudnessDb: loudness.loudnessDb,
      gainDb: loudness.gainDb,
      error: loudness.error,
    };
  } catch (error) {
    return {
      durationMs: 0,
      startOffsetMs: 0,
      endTrimMs: 0,
      error: error instanceof Error ? error.message : "Analysis failed",
    };
  }
};
