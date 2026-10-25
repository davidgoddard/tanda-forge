# Release packaging

## Requirements

- **REL-PKG-001:** Each packaged desktop build must include compatible `ffmpeg`
  and `ffprobe` executables for its target platform.
- **REL-PKG-002:** Linux FFmpeg staging must download an immutable, retained
  BtbN GitHub release asset rather than a moving `latest` URL.
- **REL-PKG-003:** A failed or malformed download must stop packaging before an
  incomplete tool is staged. Transient TLS, connection, and HTTP failures must
  receive bounded retries before a release job is abandoned.
- **REL-PKG-004:** Linux FFmpeg staging must verify the archive against its
  pinned SHA-256 digest before extraction.
- **REL-PKG-005:** Release preparation must verify that every pinned FFmpeg
  asset remains available under its documented retention policy, matches its
  upstream-published digest, contains compatible tools, and passes packaging
  tests and the full application build.
- **REL-PKG-006:** macOS packaging must not depend on a third-party prebuilt
  binary host. Each Intel and Apple-Silicon release job must download the
  versioned official FFmpeg source archive, verify its pinned SHA-256 digest,
  and compile native `ffmpeg` and `ffprobe` executables without non-redistributable
  configuration flags. The build must pin its macOS deployment target rather
  than inheriting the newer CI runner's minimum OS version, and must not depend
  on optional assembler tooling that is absent from a supported release runner.
- **REL-PKG-007:** The native macOS build must retain the audio analysis,
  waveform PNG, and playable WAV capabilities required by Tanda Forge,
  including `loudnorm`, `silencedetect`, `showwavespic`, PNG encoding, common
  music decoders, and PCM WAV encoding.

## Current implementation

`scripts/fetch-ffmpeg.sh` downloads tools into an isolated temporary directory,
validates or extracts the provider archive, and stages only `ffmpeg` and
`ffprobe` in `app/resources/ffmpeg/<platform>`. The Linux asset is pinned to the
retained BtbN month-end release `autobuild-2026-09-30-13-08`; its archive name
and SHA-256 digest are fixed in the script. Archive discovery is based on the
contained binaries rather than a mutable directory name.

Downloads retry all curl transport-error classes (including TLS and connection
resets) with bounded backoff and timeouts. Release CI also retries the complete,
isolated staging operation up to three times; checksum and archive validation
run afresh on every attempt and continue to stop packaging on invalid content.

For macOS, the script downloads the official, versioned FFmpeg 9.0.2 source
archive from `ffmpeg.org`, verifies the pinned SHA-256 digest, and builds
`ffmpeg` and `ffprobe` natively on the release runner. The workflow passes the
matrix architecture explicitly so the Intel job produces x86_64 tools and the
Apple-Silicon job produces arm64 tools. Autodetected optional dependencies,
network support, and non-redistributable build flags are excluded; zlib remains
enabled because Tanda Forge requires FFmpeg's PNG encoder for waveform images.
The deployment target is pinned to macOS 11.0 for both architectures. x86
assembly is disabled so the Intel build does not depend on the runner providing
a compatible NASM installation; the post-build capability checks still enforce
all functionality required by the application.

The mandatory agent checklist for maintaining and releasing these pins is in
`AGENTS.md`.
