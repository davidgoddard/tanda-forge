Place platform-specific ffmpeg/ffprobe binaries here during packaging.

Run `scripts/fetch-ffmpeg.sh <macos|windows|linux>` from the project to stage the tools. macOS builds the official FFmpeg 9.0.2 source archive; Windows uses Gyan's archived 8.1.2 essentials ZIP; Linux uses a versioned BtbN 9.0.2 build. Every archive is pinned to its upstream SHA-256 digest. Downloads fail on HTTP errors, retry transient failures, and stop before extraction when checksum or archive validation fails. Binaries remain ignored by Git.
