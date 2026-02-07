# Tanda Player Lite

Tanda Player Lite is a desktop tool for tango DJs who want to build tandas, plan a playlist, and run a set with cortinas, timing guidance, and headphone preview. It is designed for DJs who curate tandas and need predictable timing without giving up hands-on control.

## Download and Install (Releases)

### 1) Download the right build

Go to the GitHub **Releases** page and download the file that matches your system:

- **macOS Intel**: `...-mac-x64.dmg` or `...-mac-x64.zip`
- **macOS Apple Silicon**: `...-mac-arm64.dmg` or `...-mac-arm64.zip`
- **Windows**: `...-windows.exe` (or zip if provided)
- **Linux**: `...-linux.AppImage` or `...-linux.deb`

### 2) macOS Gatekeeper (unsigned app)

Because the app is not signed, macOS will block the first launch:

1. Open the `.dmg` or `.zip` and move **Tanda Player Lite.app** to Applications.
2. Right‑click the app → **Open** → **Open** again.
3. Alternatively: **System Settings → Privacy & Security → Open Anyway**.

Once opened once, it should launch normally.

## ffmpeg / ffprobe Setup

The app uses `ffmpeg` and `ffprobe` for analysis and waveform generation. Provide them in one of these ways:

### Option A: Local binaries (recommended for packaged builds)

Place binaries in:
- `app/resources/ffmpeg/darwin/ffmpeg`
- `app/resources/ffmpeg/darwin/ffprobe`
- `app/resources/ffmpeg/win32/ffmpeg.exe`
- `app/resources/ffmpeg/win32/ffprobe.exe`
- `app/resources/ffmpeg/linux/ffmpeg`
- `app/resources/ffmpeg/linux/ffprobe`

You can use:
```
scripts/fetch-ffmpeg.sh [macos|windows|linux|all]
```

### Option B: System PATH

If `ffmpeg` and `ffprobe` are already installed and available in `PATH`, the app will fall back to those.

## In‑App Configuration

### 1) Library Roots
Settings → **Library**
1. Add **Music** folders.
2. Add **Cortina** folders (optional).
3. Scan music and cortinas.

### 2) Audio Outputs
Settings → **System**
1. Choose **Main Output** and **Headphones Output**.
2. Headphones output enables cueing.

### 3) Language, Styles, and Defaults
Settings → **System**
- Set **Language**.
- Manage **Styles** (tango/waltz/milonga, etc.).
- Adjust **Trim padding**, **Search settings**, and **Default tanda size**.

### 4) Playlist Timing and Cortinas
Settings → **Playlist**
- Set gaps between tracks, before tanda, and before cortina.
- Select cortina set and duration.
- Configure tanda sequence rules if you use them.

## Import Legacy Data

If you point your music/cortina folders at a legacy Tanda Player drive that contains:

- `config.js`
- `tandas.dat`
- `library.dat`

the app will offer an **Import** prompt. If you confirm, it will:
- Recreate tandas from `tandas.dat`.
- Use metadata from `library.dat` in preference to fresh analysis (when present).

## How the App is Structured

The main screen is split into three columns:

- **Search (left)**: find tracks or tandas, filter by style, and send to clipboard/playlist.
- **Clipboard (center)**: temporary collections and staging.
- **Playlist (right)**: your running order with cortinas and predicted timing.

There is also a **Tanda Designer** tab for building or editing tandas.

### Typical Workflow

1. Search for tracks/tandas.
2. Add items to the clipboard.
3. Build tandas in the Tanda Designer.
4. Send tandas or tracks into the playlist.
5. In live mode, start the playlist or click a tanda to jump in.

## Detailed Usage Highlights

- **Tanda sizes**: can be filtered in search and clipboard.
- **Playlist timing**: predicted start times are based on track durations + gaps + cortina duration + cortina fade.
- **Cortina preview**: headphone icon lets you cue.
- **Legacy import**: keeps your curated metadata.
- **Trim padding**: extend start/end trims if track tails are being cut too early.

## Building Locally (for Developers)

```
npm install
npm run build
npm start
```

To package:
```
npm run package
```

Artifacts appear in `dist/` (do not commit).

## Repository Hygiene

Do not commit large generated files or binaries:
- `node_modules/`
- `dist/`
- `tmp/`
- `app/resources/ffmpeg/*` binaries
