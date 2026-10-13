Place platform-specific ffmpeg/ffprobe binaries here during packaging.

Run `scripts/fetch-ffmpeg.sh <macos|windows|linux>` from the project to stage the tools. macOS uses direct versioned Evermeet ZIP downloads pinned to 9.0.2; its former `getrelease` API now returns HTTP 410. Update `MACOS_FFMPEG_VERSION` in the script when upgrading both macOS tools. Downloads fail on HTTP errors, retry transient failures, and validate ZIPs before extraction. Binaries remain ignored by Git.
