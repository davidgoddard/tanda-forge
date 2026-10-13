import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("FFmpeg fetch script", () => {
  const script = fs.readFileSync(
    path.join(process.cwd(), "scripts", "fetch-ffmpeg.sh"),
    "utf8",
  );

  it("creates every extraction directory before using it", () => {
    const macMkdir = script.indexOf(
      'mkdir -p "$TMP_DIR/ffmpeg" "$TMP_DIR/ffprobe"',
    );
    const macExtract = script.indexOf(
      'unzip -o "$TMP_DIR/ffmpeg.zip" -d "$TMP_DIR/ffmpeg"',
    );
    const windowsMkdir = script.indexOf('mkdir -p "$TMP_DIR/ffmpeg-win"');
    const windowsExtract = script.indexOf(
      'unzip -o "$TMP_DIR/ffmpeg-win.zip" -d "$TMP_DIR/ffmpeg-win"',
    );
    const linuxMkdir = script.indexOf('mkdir -p "$TMP_DIR/ffmpeg-linux"');
    const linuxExtract = script.indexOf(
      'tar -xJf "$TMP_DIR/ffmpeg-linux.tar.xz" -C "$TMP_DIR/ffmpeg-linux"',
    );

    expect(macMkdir).toBeGreaterThan(-1);
    expect(macExtract).toBeGreaterThan(macMkdir);
    expect(windowsMkdir).toBeGreaterThan(-1);
    expect(windowsExtract).toBeGreaterThan(windowsMkdir);
    expect(linuxMkdir).toBeGreaterThan(-1);
    expect(linuxExtract).toBeGreaterThan(linuxMkdir);
  });
});

// Run the real shell script in an isolated project with a controlled downloader.
// This verifies failures stop before extraction/staging rather than only matching source text.
import os from "os";
import { spawnSync } from "child_process";

const runFetch = (mode: "http-error" | "invalid-zip" | "valid") => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-fetch-test-"));
  try {
    const scripts = path.join(root, "scripts");
    const bin = path.join(root, "bin");
    fs.mkdirSync(scripts);
    fs.mkdirSync(bin);
    fs.copyFileSync(path.join(process.cwd(), "scripts/fetch-ffmpeg.sh"), path.join(scripts, "fetch-ffmpeg.sh"));
    fs.writeFileSync(path.join(bin, "curl"), `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$TEST_FETCH_ROOT/calls"
output=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    *) shift ;;
  esac
done
if [ "$TEST_FETCH_MODE" = "http-error" ]; then
  echo 'curl: (22) HTTP 410' >&2
  exit 22
fi
if [ "$TEST_FETCH_MODE" = "invalid-zip" ]; then
  printf '%s' '{"status":"error","message":"API endpoint removed due to exorbitant abuse","code":410}' > "$output"
else
  cp "$TEST_FETCH_ROOT/fixture.zip" "$output"
fi
`, { mode: 0o755 });
    if (mode === "valid") {
      fs.writeFileSync(path.join(root, "ffmpeg"), "fixture ffmpeg");
      fs.writeFileSync(path.join(root, "ffprobe"), "fixture ffprobe");
      const zip = spawnSync("zip", ["-q", "fixture.zip", "ffmpeg", "ffprobe"], { cwd: root });
      if (zip.status !== 0) throw new Error(`Could not create ZIP fixture: ${zip.stderr}`);
    }
    const result = spawnSync("bash", [path.join(scripts, "fetch-ffmpeg.sh"), "macos"], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, TMPDIR: root, TEST_FETCH_ROOT: root, TEST_FETCH_MODE: mode },
    });
    const staged = path.join(root, "app/resources/ffmpeg/darwin/ffmpeg");
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      calls: fs.readFileSync(path.join(root, "calls"), "utf8"),
      staged: fs.existsSync(staged) ? fs.readFileSync(staged, "utf8") : null,
      temporaryDirectories: fs.readdirSync(root).filter((name) => name.startsWith("tanda-ffmpeg.")),
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

describe.skipIf(process.platform === "win32")("FFmpeg fetch execution", () => {
  it("reports HTTP failures without extracting or installing an error response", () => {
    const result = runFetch("http-error");
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("FFmpeg download failed:");
    expect(result.output).toContain("HTTP 410");
    expect(result.staged).toBeNull();
    expect(result.calls).toContain("--fail --show-error --location --retry 3");
    expect(result.calls).not.toContain("getrelease/");
    expect(result.temporaryDirectories).toEqual([]);
  });

  it("rejects a successful HTTP response containing JSON rather than a ZIP", () => {
    const result = runFetch("invalid-zip");
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Invalid FFmpeg ZIP archive:");
    expect(result.staged).toBeNull();
    expect(result.temporaryDirectories).toEqual([]);
  });

  it("stages valid direct-download archives and cleans its temporary workspace", () => {
    const result = runFetch("valid");
    expect(result.status).toBe(0);
    expect(result.staged).toBe("fixture ffmpeg");
    expect(result.calls).toContain("https://evermeet.cx/ffmpeg/ffmpeg-9.0.2.zip");
    expect(result.calls).toContain("https://evermeet.cx/ffmpeg/ffprobe-9.0.2.zip");
    expect(result.temporaryDirectories).toEqual([]);
  });
});
