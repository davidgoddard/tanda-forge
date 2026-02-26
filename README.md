# Tanda Player Lite

This project is a collaboration between David Goddard who came up with the design and detailed requirements and ChatGPT's Codex which wrote 100% of the code, tests and documentation.

Tanda Player Lite is a cut down version of the Tanda Player app that ran on a Raspberry Pi.

It is now a desktop app for tango DJs who want to build and save tandas and use various tools to help locate tandas when DJing and making it simple to build and modify the playlist whole tandas at a time or track by track if required.

Unlike the original Tanda Player, music similarity is now assessed soley on user entered data such as artist, year, singers, beats per minute and notes.  The original used user perception of sounds to find similar sounding songs and used multi-coloured tags representing the individual properties    for tracks allowing the similarity of tracks to be visually verified.  There are many features of the old app that are not relevant to the new one and this app now focusses just on the Live DJing aspect.

![Main screen layout](images/user-guide/01-main-layout.png)

![Display screen layout](images/user-guide/02-display-board.png)

This app:

- Is multi-lingual, set your choice of language and everything in the app. other than the song data is translated
- Requires FFMPEG to already be installed
- Supports dual outputs: main/live speakers and headphones
- normalises sound levels
- trims silences off both ends of a song
- auto fade cortinas or override and let them play in full
- allows importing of legacy tanda player's tandas and track data
- highlights songs and tandas already in the playlist and locates them to show you
- allows filtering of the playlist to quickly view tandas by a specific artist for example
- provides real-time graphs of artist use, years and tempos covered.
- provides built-in collections such as `New` tandas and songs to help find new creations easily and allows user-defined collections manually maintained such as `Favourites` or `Last Tandas` etc.
- optionally provides a display for use on separate monitor or projector for the dancers.
- uses one of three modes: Live, preparation and edit; Edit keeps the editor open meaning just click a track and update the details, Live means once music is playing you cannot accidentally play another song or prematurely stop the current one etc.  Preparation mode is for preparation of tandas, playlists and playing around - no limitations; click on a track - it will play!
- Inform the system and dancers "this tandas is the last tanda" with a single tick-box; when it finishes you the final cortina, a farewell message and no more music regardless of where in the playlist you were.
- gives approximate timings for each tanda allowing in advance to know which is likely to be the last tanda.
- allows many different sets of cortinas to be setup and the entire set within the playlist can be swapped at any time and individual specific choices can be made at any time
- If left idle, the Playlist will scroll to show the currently playing tanda and open the current tanda and show its tracks closing all other tandas to show just their summary.
- Uses simple pop-out menus for all operations meaning swapping songs or tandas etc. is done by mouse clicks and not drag/drop; clunky but safer!

## Download and Install (Releases)

### 1) Download the right build

Go to the GitHub **Releases** page and download the file that matches your system:

- **macOS Intel**: `...-mac-x64.dmg` or `...-mac-x64.zip`
- **macOS Apple Silicon**: `...-mac-arm64.dmg` or `...-mac-arm64.zip`
- **Windows**: `...-win-x64.exe`
- **Linux**: `...-linux-x64.AppImage` or `...-linux-x64.deb`

If you download the wrong macOS build, macOS will say the app is not supported.  
You can confirm the architecture in Finder (**Get Info**) where it will show
**Application (Intel)** or **Application (Apple silicon)**.

### 2) macOS Gatekeeper (unsigned app)

Because the app is not signed, macOS will block the first launch:

1. Open the `.dmg` or `.zip` and move **Tanda Player Lite.app** to Applications.
2. Right‑click the app → **Open** → **Open** again.
3. If blocked: **System Settings → Privacy & Security** → scroll to the warning and click **Open Anyway**.
4. Confirm the prompt. After the first launch, it should open normally.

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
3. Add **Background images** folders (optional).
4. Import legacy tandas etc. (optional and if key legacy files are found where the music files are stored)
5. Scan music and cortinas.

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

Display of content in each section is linked to user operations, i.e. marking a Waltz tanda ready to be replaced sets the style of each column to Waltz so that all data shown is a potential replacement. 

Track data can be edited via a pop-up editor and fields from this can be used to drive searches directly.

A graph page is available to view the spread of artists, years and tempos within the current playlist allowing the DJ to easily see artists being over-played and the collections in the clipboard such as 'Available' show as yet un-used artists encouraging diversity.

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
