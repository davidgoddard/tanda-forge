import { createHash } from "crypto";
import fs from "fs";
import path from "path";

export const COMPRESSED_RENDER_PIPELINE_VERSION = 5;

export type CompressedCacheParams = {
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

export const buildCompressedCacheKey = (
  filePath: string,
  stat: fs.Stats,
  params: CompressedCacheParams,
) => {
  const fingerprint = JSON.stringify({
    pipelineVersion: COMPRESSED_RENDER_PIPELINE_VERSION,
    filePath,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    loudnessDb: params.loudnessDb ?? null,
    mode: params.mode,
    liftThresholdDb: params.liftThresholdDb,
    maxLiftDb: params.maxLiftDb,
    ratio: params.ratio,
    attackMs: params.attackMs,
    releaseMs: params.releaseMs,
    gateThresholdDb: params.gateThresholdDb,
    limiterCeilingDb: params.limiterCeilingDb,
    limiterReleaseMs: params.limiterReleaseMs,
  });
  return createHash("sha1").update(fingerprint).digest("hex");
};

export const buildCompressedCachePath = (
  cacheDir: string,
  filePath: string,
  stat: fs.Stats,
  params: CompressedCacheParams,
) => path.join(cacheDir, `${buildCompressedCacheKey(filePath, stat, params)}.wav`);
