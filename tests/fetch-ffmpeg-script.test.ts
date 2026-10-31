import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("FFmpeg fetch script", () => {
  const script = fs.readFileSync(
    path.join(process.cwd(), "scripts", "fetch-ffmpeg.sh"),
    "utf8",
  );
  const releaseWorkflow = fs.readFileSync(
    path.join(process.cwd(), ".github", "workflows", "release.yml"),
    "utf8",
  );

  it("creates every extraction directory before using it", () => {
    const macMkdir = script.indexOf('mkdir -p "$TMP_DIR/ffmpeg-macos-source"');
    const macExtract = script.indexOf(
      'tar -xJf "$TMP_DIR/$MACOS_FFMPEG_SOURCE_ARCHIVE" -C "$TMP_DIR/ffmpeg-macos-source"',
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

  it("builds the official macOS source with the PNG dependency required for waveforms", () => {
    expect(script).toContain("https://ffmpeg.org/releases/${MACOS_FFMPEG_SOURCE_ARCHIVE}");
    expect(script).toContain("--enable-zlib");
    expect(script).toContain("--disable-x86asm");
    expect(script).toContain('MACOS_DEPLOYMENT_TARGET="11.0"');
    expect(script).toContain("-mmacosx-version-min=$MACOS_DEPLOYMENT_TARGET");
    expect(script).not.toContain("evermeet.cx");
    expect(script).not.toMatch(/^\s+--enable-nonfree/m);
  });

  it("retries TLS and other transient transport failures with bounded timeouts", () => {
    expect(script).toContain("--retry 8 --retry-all-errors --retry-delay 5 --retry-max-time 600");
    expect(script).toContain("--connect-timeout 30 --max-time 900");
    expect(releaseWorkflow).toContain("for attempt in 1 2 3; do");
    expect(releaseWorkflow).toContain("FFmpeg staging failed after 3 attempts.");
  });

  it("uses supported native runners for both macOS architectures", () => {
    expect(releaseWorkflow).toContain("- os: macos-15-intel\n            target: mac-x64");
    expect(releaseWorkflow).toContain("- os: macos-15\n            target: mac-arm64");
    expect(releaseWorkflow).not.toContain("- os: macos-14");
  });

  it("pins and verifies the archived Windows package", () => {
    expect(script).toContain('WINDOWS_FFMPEG_ARCHIVE="ffmpeg-${WINDOWS_FFMPEG_VERSION}-essentials_build.zip"');
    expect(script).toContain('verify_sha256 "$TMP_DIR/ffmpeg-win.zip" "$WINDOWS_FFMPEG_SHA256"');
    expect(script).toContain("https://www.gyan.dev/ffmpeg/builds/packages/${WINDOWS_FFMPEG_ARCHIVE}");
    expect(script).not.toContain("ffmpeg-release-essentials.zip");
  });
});

// Run the real shell script in an isolated project with a controlled downloader.
// This verifies failures stop before extraction/staging rather than only matching source text.
import os from "os";
import { spawnSync } from "child_process";
import { createHash } from "crypto";

const runFetch = (mode: "http-error" | "invalid-archive" | "valid" | "bad-checksum") => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-fetch-test-"));
  try {
    const scripts = path.join(root, "scripts");
    const bin = path.join(root, "bin");
    fs.mkdirSync(scripts);
    fs.mkdirSync(bin);
    const fixtureDir = path.join(root, "fixture", "ffmpeg-9.0.2");
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, "configure"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
    const archive = path.join(root, "fixture.tar.xz");
    const tar = spawnSync("tar", ["-cJf", archive, "ffmpeg-9.0.2"], { cwd: path.join(root, "fixture") });
    if (tar.status !== 0) throw new Error(`Could not create tar fixture: ${tar.stderr}`);
    const fixtureChecksum = createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
    const sourceScript = fs.readFileSync(path.join(process.cwd(), "scripts/fetch-ffmpeg.sh"), "utf8")
      .replace(/MACOS_FFMPEG_SOURCE_SHA256="[a-f0-9]+"/, `MACOS_FFMPEG_SOURCE_SHA256="${mode === "bad-checksum" ? "0".repeat(64) : fixtureChecksum}"`);
    fs.writeFileSync(path.join(scripts, "fetch-ffmpeg.sh"), sourceScript);
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
if [ "$TEST_FETCH_MODE" = "invalid-archive" ]; then
  printf '%s' 'not a tar archive' > "$output"
else
  cp "$TEST_FETCH_ROOT/fixture.tar.xz" "$output"
fi
`, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, "make"), `#!/usr/bin/env bash
set -eu
printf '%s\n' '#!/usr/bin/env bash' 'case "$1" in -filters) echo "loudnorm silencedetect showwavespic" ;; -encoders) echo "png pcm_s16le" ;; -L) echo "GNU Lesser General Public License" ;; esac' > ffmpeg
printf '%s\n' '#!/usr/bin/env bash' 'exit 0' > ffprobe
chmod +x ffmpeg ffprobe
`, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, "uname"), "#!/usr/bin/env bash\necho x86_64\n", { mode: 0o755 });
    fs.writeFileSync(path.join(bin, "file"), "#!/usr/bin/env bash\necho 'Mach-O 64-bit executable x86_64'\n", { mode: 0o755 });
    const result = spawnSync("bash", [path.join(scripts, "fetch-ffmpeg.sh"), "macos", "x64"], {
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
    expect(result.calls).toContain("--retry 8 --retry-all-errors --retry-delay 5");
    expect(result.calls).not.toContain("getrelease/");
    expect(result.temporaryDirectories).toEqual([]);
  });

  it("rejects a successful HTTP response that is not the pinned archive", () => {
    const result = runFetch("invalid-archive");
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("FFmpeg checksum mismatch");
    expect(result.staged).toBeNull();
    expect(result.temporaryDirectories).toEqual([]);
  });

  it("rejects a macOS archive whose checksum does not match", () => {
    const result = runFetch("bad-checksum");
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("FFmpeg checksum mismatch");
    expect(result.staged).toBeNull();
  });

  it("stages a valid pinned macOS archive and cleans its temporary workspace", () => {
    const result = runFetch("valid");
    expect(result.status).toBe(0);
    expect(result.staged).toContain("loudnorm silencedetect showwavespic");
    expect(result.calls).toContain("https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz");
    expect(result.calls).not.toContain("evermeet.cx");
    expect(result.temporaryDirectories).toEqual([]);
  });
});

const runPinnedLinuxFetch = (validChecksum: boolean) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-linux-fetch-test-"));
  try {
    const scripts = path.join(root, "scripts");
    const bin = path.join(root, "bin");
    const fixture = path.join(root, "fixture", "ffmpeg-test-linux64-gpl", "bin");
    fs.mkdirSync(scripts);
    fs.mkdirSync(bin);
    fs.mkdirSync(fixture, { recursive: true });
    fs.writeFileSync(path.join(fixture, "ffmpeg"), "linux ffmpeg");
    fs.writeFileSync(path.join(fixture, "ffprobe"), "linux ffprobe");
    const archive = path.join(root, "fixture.tar.xz");
    const tar = spawnSync("tar", ["-cJf", archive, "ffmpeg-test-linux64-gpl"], {
      cwd: path.join(root, "fixture"),
    });
    if (tar.status !== 0) throw new Error(`Could not create tar fixture: ${tar.stderr}`);
    const fixtureChecksum = createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
    const script = fs.readFileSync(path.join(process.cwd(), "scripts/fetch-ffmpeg.sh"), "utf8")
      .replace(/LINUX_FFMPEG_SHA256="[a-f0-9]+"/, `LINUX_FFMPEG_SHA256="${validChecksum ? fixtureChecksum : "0".repeat(64)}"`);
    fs.writeFileSync(path.join(scripts, "fetch-ffmpeg.sh"), script);
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
cp "$TEST_FETCH_ROOT/fixture.tar.xz" "$output"
`, { mode: 0o755 });
    const result = spawnSync("bash", [path.join(scripts, "fetch-ffmpeg.sh"), "linux"], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, TMPDIR: root, TEST_FETCH_ROOT: root },
    });
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      calls: fs.readFileSync(path.join(root, "calls"), "utf8"),
      ffmpeg: fs.existsSync(path.join(root, "app/resources/ffmpeg/linux/ffmpeg"))
        ? fs.readFileSync(path.join(root, "app/resources/ffmpeg/linux/ffmpeg"), "utf8") : null,
      ffprobe: fs.existsSync(path.join(root, "app/resources/ffmpeg/linux/ffprobe"))
        ? fs.readFileSync(path.join(root, "app/resources/ffmpeg/linux/ffprobe"), "utf8") : null,
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

describe.skipIf(process.platform === "win32")("Pinned Linux FFmpeg download", () => {
  it("verifies and stages both tools from the immutable release asset", () => {
    const result = runPinnedLinuxFetch(true);
    expect(result.status).toBe(0);
    expect(result.calls).toContain("releases/download/autobuild-2026-09-30-13-08/");
    expect(result.calls).not.toContain("/latest/");
    expect(result.ffmpeg).toBe("linux ffmpeg");
    expect(result.ffprobe).toBe("linux ffprobe");
  });

  it("rejects an archive whose checksum does not match", () => {
    const result = runPinnedLinuxFetch(false);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("FFmpeg checksum mismatch");
    expect(result.ffmpeg).toBeNull();
    expect(result.ffprobe).toBeNull();
  });
});
