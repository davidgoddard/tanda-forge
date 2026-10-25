#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FFMPEG_DIR="$ROOT_DIR/app/resources/ffmpeg"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tanda-ffmpeg.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

MACOS_FFMPEG_VERSION="9.0.2"
MACOS_DEPLOYMENT_TARGET="11.0"
MACOS_FFMPEG_SOURCE_ARCHIVE="ffmpeg-${MACOS_FFMPEG_VERSION}.tar.xz"
MACOS_FFMPEG_SOURCE_SHA256="8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e"
LINUX_FFMPEG_TAG="autobuild-2026-09-30-13-08"
LINUX_FFMPEG_ARCHIVE="ffmpeg-n9.0.2-17-g2a571b6068-linux64-gpl-9.0.tar.xz"
LINUX_FFMPEG_SHA256="68ee646831adaae2495618346f3bba94ff207ff83bbd34d643e7004730d66269"

mkdir -p "$FFMPEG_DIR/darwin" "$FFMPEG_DIR/win32" "$FFMPEG_DIR/linux" "$TMP_DIR"

download() {
  local destination="$1"
  local url="$2"
  if ! curl --fail --show-error --location \
    --retry 8 --retry-all-errors --retry-delay 5 --retry-max-time 600 \
    --connect-timeout 30 --max-time 900 --output "$destination" "$url"; then
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
  local requested_arch="${1:-$(uname -m)}"
  local expected_machine
  case "$requested_arch" in
    x64|x86_64|amd64) expected_machine="x86_64" ;;
    arm64|aarch64) expected_machine="arm64" ;;
    *)
      echo "Unsupported macOS architecture: $requested_arch" >&2
      return 1
      ;;
  esac
  local host_machine
  host_machine=$(uname -m)
  if [[ "$host_machine" != "$expected_machine" ]]; then
    echo "macOS FFmpeg build architecture mismatch: requested $expected_machine on $host_machine" >&2
    return 1
  fi
  mkdir -p "$TMP_DIR/ffmpeg-macos-source"
  download "$TMP_DIR/$MACOS_FFMPEG_SOURCE_ARCHIVE" \
    "https://ffmpeg.org/releases/${MACOS_FFMPEG_SOURCE_ARCHIVE}"
  verify_sha256 "$TMP_DIR/$MACOS_FFMPEG_SOURCE_ARCHIVE" "$MACOS_FFMPEG_SOURCE_SHA256"
  tar -xJf "$TMP_DIR/$MACOS_FFMPEG_SOURCE_ARCHIVE" -C "$TMP_DIR/ffmpeg-macos-source"
  local source_dir="$TMP_DIR/ffmpeg-macos-source/ffmpeg-${MACOS_FFMPEG_VERSION}"
  if [[ ! -x "$source_dir/configure" ]]; then
    echo "Official FFmpeg source archive does not contain its configure script" >&2
    return 1
  fi
  (
    cd "$source_dir"
    MACOSX_DEPLOYMENT_TARGET="$MACOS_DEPLOYMENT_TARGET" ./configure \
      --disable-autodetect \
      --disable-debug \
      --disable-doc \
      --disable-ffplay \
      --disable-network \
      --disable-shared \
      --disable-x86asm \
      --enable-static \
      --enable-zlib \
      --extra-cflags="-mmacosx-version-min=$MACOS_DEPLOYMENT_TARGET" \
      --extra-ldflags="-mmacosx-version-min=$MACOS_DEPLOYMENT_TARGET"
    local build_jobs=2
    if command -v sysctl >/dev/null 2>&1; then
      build_jobs=$(sysctl -n hw.ncpu 2>/dev/null || echo 2)
    fi
    make -j "$build_jobs" ffmpeg ffprobe
  )
  if [[ ! -x "$source_dir/ffmpeg" || ! -x "$source_dir/ffprobe" ]]; then
    echo "macOS FFmpeg source build did not produce both ffmpeg and ffprobe" >&2
    return 1
  fi
  cp "$source_dir/ffmpeg" "$FFMPEG_DIR/darwin/ffmpeg"
  cp "$source_dir/ffprobe" "$FFMPEG_DIR/darwin/ffprobe"
  chmod +x "$FFMPEG_DIR/darwin/ffmpeg" "$FFMPEG_DIR/darwin/ffprobe"
  local binary_info
  binary_info=$(file "$FFMPEG_DIR/darwin/ffmpeg" "$FFMPEG_DIR/darwin/ffprobe")
  if [[ "$binary_info" != *"$expected_machine"* ]]; then
    echo "Built macOS FFmpeg tools do not match requested architecture $expected_machine" >&2
    return 1
  fi
  local filters encoders license version_info
  filters=$("$FFMPEG_DIR/darwin/ffmpeg" -filters 2>/dev/null)
  encoders=$("$FFMPEG_DIR/darwin/ffmpeg" -encoders 2>/dev/null)
  license=$("$FFMPEG_DIR/darwin/ffmpeg" -L 2>&1)
  version_info=$("$FFMPEG_DIR/darwin/ffmpeg" -version 2>&1)
  for required_filter in loudnorm silencedetect showwavespic; do
    if [[ "$filters" != *"$required_filter"* ]]; then
      echo "Built macOS FFmpeg is missing required filter: $required_filter" >&2
      return 1
    fi
  done
  for required_encoder in png pcm_s16le; do
    if [[ "$encoders" != *"$required_encoder"* ]]; then
      echo "Built macOS FFmpeg is missing required encoder: $required_encoder" >&2
      return 1
    fi
  done
  if [[ "$license" != *"GNU Lesser General Public"* || "$version_info" == *"--enable-nonfree"* ]]; then
    echo "Built macOS FFmpeg does not report the expected redistributable LGPL license" >&2
    return 1
  fi
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
    fetch_macos "${2:-}"
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
