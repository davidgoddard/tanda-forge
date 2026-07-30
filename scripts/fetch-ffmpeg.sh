#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FFMPEG_DIR="$ROOT_DIR/app/resources/ffmpeg"
TMP_DIR="${TMPDIR:-/tmp}/tanda-ffmpeg"

mkdir -p "$FFMPEG_DIR/darwin" "$FFMPEG_DIR/win32" "$FFMPEG_DIR/linux" "$TMP_DIR"

fetch_macos() {
  mkdir -p "$TMP_DIR/ffmpeg" "$TMP_DIR/ffprobe"
  curl -L -o "$TMP_DIR/ffmpeg.zip" https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip
  curl -L -o "$TMP_DIR/ffprobe.zip" https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip
  unzip -o "$TMP_DIR/ffmpeg.zip" -d "$TMP_DIR/ffmpeg"
  unzip -o "$TMP_DIR/ffprobe.zip" -d "$TMP_DIR/ffprobe"
  mv "$TMP_DIR/ffmpeg/ffmpeg" "$FFMPEG_DIR/darwin/ffmpeg"
  mv "$TMP_DIR/ffprobe/ffprobe" "$FFMPEG_DIR/darwin/ffprobe"
  chmod +x "$FFMPEG_DIR/darwin/ffmpeg" "$FFMPEG_DIR/darwin/ffprobe"
}

fetch_windows() {
  mkdir -p "$TMP_DIR/ffmpeg-win"
  curl -L -o "$TMP_DIR/ffmpeg-win.zip" https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
  unzip -o "$TMP_DIR/ffmpeg-win.zip" -d "$TMP_DIR/ffmpeg-win"
  local bin_dir
  bin_dir=$(find "$TMP_DIR/ffmpeg-win" -type d -name bin | head -n 1)
  if [[ -z "$bin_dir" ]]; then
    echo "Windows ffmpeg bin directory not found" >&2
    exit 1
  fi
  mv "$bin_dir/ffmpeg.exe" "$FFMPEG_DIR/win32/ffmpeg.exe"
  mv "$bin_dir/ffprobe.exe" "$FFMPEG_DIR/win32/ffprobe.exe"
}

fetch_linux() {
  mkdir -p "$TMP_DIR/ffmpeg-linux"
  curl -L -o "$TMP_DIR/ffmpeg-linux.tar.xz" https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
  tar -xJf "$TMP_DIR/ffmpeg-linux.tar.xz" -C "$TMP_DIR/ffmpeg-linux"
  local bin_dir
  bin_dir=$(find "$TMP_DIR/ffmpeg-linux" -type d -name "ffmpeg-*-amd64-static" | head -n 1)
  if [[ -z "$bin_dir" ]]; then
    echo "Linux ffmpeg directory not found" >&2
    exit 1
  fi
  mv "$bin_dir/ffmpeg" "$FFMPEG_DIR/linux/ffmpeg"
  mv "$bin_dir/ffprobe" "$FFMPEG_DIR/linux/ffprobe"
  chmod +x "$FFMPEG_DIR/linux/ffmpeg" "$FFMPEG_DIR/linux/ffprobe"
}

case "${1:-all}" in
  macos)
    fetch_macos
    ;;
  windows)
    fetch_windows
    ;;
  linux)
    fetch_linux
    ;;
  all)
    fetch_macos
    fetch_windows
    fetch_linux
    ;;
  *)
    echo "Usage: $0 [macos|windows|linux|all]" >&2
    exit 1
    ;;
 esac

 echo "FFmpeg binaries installed in $FFMPEG_DIR"
