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
