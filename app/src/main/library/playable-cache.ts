import { createHash } from "crypto";
import fs from "fs";
import path from "path";

export const PLAYABLE_RENDER_PIPELINE_VERSION = 1;

export const buildPlayableCacheKey = (filePath: string, stat: fs.Stats) => {
  const fingerprint = JSON.stringify({
    pipelineVersion: PLAYABLE_RENDER_PIPELINE_VERSION,
    filePath,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
  });
  return createHash("sha1").update(fingerprint).digest("hex");
};

export const buildPlayableCachePath = (
  cacheDir: string,
  filePath: string,
  stat: fs.Stats,
) => path.join(cacheDir, `${buildPlayableCacheKey(filePath, stat)}.wav`);
