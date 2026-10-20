# Release packaging

## Requirements

- **REL-PKG-001:** Each packaged desktop build must include compatible `ffmpeg`
  and `ffprobe` executables for its target platform.
- **REL-PKG-002:** Linux FFmpeg staging must not depend on a single download
  provider. It must try the GitHub-hosted BtbN release first and fall back to
  the John Van Sickle static build when the primary source is unavailable.
- **REL-PKG-003:** A failed or malformed download must stop packaging before an
  incomplete tool is staged.

## Current implementation

`scripts/fetch-ffmpeg.sh` downloads tools into an isolated temporary directory,
validates or extracts the provider archive, and stages only `ffmpeg` and
`ffprobe` in `app/resources/ffmpeg/<platform>`. Linux archive discovery is based
on the contained binaries so both supported providers' directory layouts work.
