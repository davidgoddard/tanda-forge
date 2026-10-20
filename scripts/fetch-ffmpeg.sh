#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FFMPEG_DIR="$ROOT_DIR/app/resources/ffmpeg"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tanda-ffmpeg.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

# Direct, versioned URLs: Evermeet retired its getrelease download API.
MACOS_FFMPEG_VERSION="9.0.2"
LINUX_FFMPEG_TAG="autobuild-2026-09-30-13-08"
LINUX_FFMPEG_ARCHIVE="ffmpeg-n9.0.2-17-g2a571b6068-linux64-gpl-9.0.tar.xz"
LINUX_FFMPEG_SHA256="68ee646831adaae2495618346f3bba94ff207ff83bbd34d643e7004730d66269"

mkdir -p "$FFMPEG_DIR/darwin" "$FFMPEG_DIR/win32" "$FFMPEG_DIR/linux" "$TMP_DIR"

download() {
  local destination="$1"
  local url="$2"
  if ! curl --fail --show-error --location --retry 3 --retry-delay 2 \
    --connect-timeout 20 --max-time 300 --output "$destination" "$url"; then
    echo "FFmpeg download failed: $url. Packaging stopped; check the provider URL or retry a transient network failure." >&2
    return 1
  fi
}

validate_zip() {
  if ! unzip -tq "$1"; then
    echo "Invalid FFmpeg ZIP archive: $1. Packaging stopped before staging binaries." >&2
    return 1
  fi
}

verify_sha256() {
  local archive="$1"
  local expected="$2"
  local actual
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$archive" | awk '{print $1}')
  else
    actual=$(shasum -a 256 "$archive" | awk '{print $1}')
  fi
  if [[ "$actual" != "$expected" ]]; then
    echo "FFmpeg checksum mismatch for $archive. Packaging stopped before extraction." >&2
    return 1
  fi
}

fetch_macos() {
  mkdir -p "$TMP_DIR/ffmpeg" "$TMP_DIR/ffprobe"
  download "$TMP_DIR/ffmpeg.zip" "https://evermeet.cx/ffmpeg/ffmpeg-${MACOS_FFMPEG_VERSION}.zip"
  download "$TMP_DIR/ffprobe.zip" "https://evermeet.cx/ffmpeg/ffprobe-${MACOS_FFMPEG_VERSION}.zip"
  validate_zip "$TMP_DIR/ffmpeg.zip"
  validate_zip "$TMP_DIR/ffprobe.zip"
  unzip -o "$TMP_DIR/ffmpeg.zip" -d "$TMP_DIR/ffmpeg"
  unzip -o "$TMP_DIR/ffprobe.zip" -d "$TMP_DIR/ffprobe"
  mv "$TMP_DIR/ffmpeg/ffmpeg" "$FFMPEG_DIR/darwin/ffmpeg"
  mv "$TMP_DIR/ffprobe/ffprobe" "$FFMPEG_DIR/darwin/ffprobe"
  chmod +x "$FFMPEG_DIR/darwin/ffmpeg" "$FFMPEG_DIR/darwin/ffprobe"
}

fetch_windows() {
  mkdir -p "$TMP_DIR/ffmpeg-win"
  download "$TMP_DIR/ffmpeg-win.zip" https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
  validate_zip "$TMP_DIR/ffmpeg-win.zip"
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
  download "$TMP_DIR/ffmpeg-linux.tar.xz" \
    "https://github.com/BtbN/FFmpeg-Builds/releases/download/${LINUX_FFMPEG_TAG}/${LINUX_FFMPEG_ARCHIVE}"
  verify_sha256 "$TMP_DIR/ffmpeg-linux.tar.xz" "$LINUX_FFMPEG_SHA256"
  tar -xJf "$TMP_DIR/ffmpeg-linux.tar.xz" -C "$TMP_DIR/ffmpeg-linux"
  local bin_dir
  bin_dir=$(find "$TMP_DIR/ffmpeg-linux" -type f -name ffmpeg -exec dirname {} \; | head -n 1)
  if [[ -z "$bin_dir" ]]; then
    echo "Linux ffmpeg binary not found in downloaded archive" >&2
    exit 1
  fi
  if [[ ! -f "$bin_dir/ffprobe" ]]; then
    echo "Linux ffprobe binary not found beside ffmpeg" >&2
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
