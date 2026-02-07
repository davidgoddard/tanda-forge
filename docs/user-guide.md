# Tanda Player Lite User Guide

This guide introduces the layout, explains initial setup, and walks through searching, collecting, and building tandas and playlists.

## Key Areas and Roles

The app is organized into three main columns plus a settings area:

- **Search (left column)**: Find tracks and tandas, filter by styles, and send results to a clipboard or a playlist.
- **Clipboard (middle column)**: A staging area with collections. Store tracks/tandas temporarily, build sets, and move items into the playlist.
- **Playlist (right column)**: Your running order. Add tandas/tracks, see predicted start times (when cortinas are enabled), and control playback.
- **Settings (top-right gear)**: Configure audio outputs, library roots, language, styles, playlists, and diagnostics.

![Main screen layout](images/user-guide/01-main-layout.png)

## Initial Setup

### 1) Choose Library Roots

You need at least one music folder, and optionally a cortina folder.

1. Open **Settings** (gear icon).
2. In **System**, click **Add Music Folder** and choose a folder.
3. (Optional) Click **Add Cortina Folder** and choose a folder.
4. Click **Scan Music** (and **Scan Cortinas** if needed).

![System settings - library roots](images/user-guide/02-settings-library-roots.png)

### 2) Select Audio Outputs

1. In **System**, choose **Main Output** and **Headphones Output**.
2. Headphone output enables previewing tracks without sending them to the main speakers.

![System settings - audio outputs](images/user-guide/03-settings-audio-outputs.png)

### 3) Set Language

1. In **System**, choose **Language**.
2. UI labels, menu shortcuts, and tooltips update based on the selected language.

![System settings - language](images/user-guide/04-settings-language.png)

### 4) Adjust Trim Padding (Optional)

1. In **System**, set **Trim padding (sec)** to extend auto-detected track trims.
2. Use this if song tails feel too short.

![System settings - trim padding](images/user-guide/04b-settings-trim-padding.png)

### 5) Configure Playlist Defaults (Optional)

1. In **Playlist**, set your default tanda size and start time.
2. Choose a **Cortina Set** and **Duration** if you use cortinas.

![Playlist settings](images/user-guide/05-settings-playlist.png)

### 6) Manage Styles (Optional)

Use **Styles** in Settings to add or remove style labels used for filtering and sequence rules.

![Style manager](images/user-guide/06-settings-styles.png)

## Finding Songs and Tandas

### Search Basics

- Use the search bar for titles, artists, albums, or notes.
- Filter by **Styles** using the pill buttons.
- Switch between **Tracks** and **Tandas** tabs.

![Search panel - tracks](images/user-guide/07-search-tracks.png)

### Search Tips

- Typing a few letters is enough; results use fuzzy matching.
- Sorting headers let you reorder results (Title, Artist, Year, etc.).
- When sorting by relevance, the jump index is hidden because ranking is dynamic.

![Search panel - sort and filter](images/user-guide/08-search-sort-filter.png)

## Clipboards and Collections

The clipboard is a flexible staging area for sets and ideas.

### Adding to Clipboard

- From Search results, click the **C** action to add to the clipboard.
- Items appear in the **General** collection by default.

![Clipboard add action](images/user-guide/09-clipboard-add.png)

### Collections

- Create collections to group tandas or themes.
- Use the **Include** chips to show multiple collections at once.

![Clipboard collections](images/user-guide/10-clipboard-collections.png)

### Moving Between Clipboard and Playlist

There are three common ways:

1. **Click actions** (Add to Playlist).
2. **Drag and drop** into the playlist.
3. **Select in clipboard, click in playlist** to place into an empty slot.

When a move succeeds, the target row pulses to confirm it arrived.

![Clipboard to playlist move](images/user-guide/11-clipboard-to-playlist.png)

### Clipboard Filter

Use the **Filter** field at the top of the clipboard panel to narrow both tracks and tandas.
Filtering is immediate and exact (no fuzzy matching). Clear the field to restore all items.

![Clipboard filter](images/user-guide/11b-clipboard-filter.png)

## Building Tandas

### Tanda Designer

Use the **Tanda Designer** tab to assemble a tanda:

1. Add tracks from Search (action **T**) or from Clipboard.
2. Adjust the tanda name, rating, and styles.
3. The style badge and summary line update as the tanda evolves.

![Tanda Designer](images/user-guide/12-tanda-designer.png)

### Editing Tracks Within a Tanda

- Click a track in a tanda to edit metadata (title, artist, bpm, notes).
- Use headphones to preview without playing to the main output.

![Track editor](images/user-guide/13-track-editor.png)

## Building Playlists

### Add Tandas or Tracks

- Add a tanda from the clipboard using the **Add to Playlist** action.
- Add a track from search or clipboard to create an in-progress tanda in the playlist.
  The editor appears below the playlist so you can finish the tanda before collapsing it.

![Playlist with tandas](images/user-guide/14-playlist-tandas.png)

### In-Playlist Tanda Editing

When a track is sent to the playlist, an in-progress tanda editor appears below the
playlist list. Fill the remaining slots, then click **Done** to collapse it into
a normal playlist tanda. The editor stays pinned below the scrolling playlist list.

![In-playlist tanda editor](images/user-guide/14b-playlist-tanda-editor.png)

### Cortinas in the Playlist

If cortinas are enabled:

- Cortina rows appear between tandas with predicted start times.
- Each cortina row shows the planned track and a headphone button to preview.
- You can click a cortina row to choose a different cortina.
  If you click **Play all** during a cortina, the now-playing duration switches
  to the full track so you can see it is acknowledged.

![Playlist cortinas](images/user-guide/15-playlist-cortinas.png)

### Start, Resume, Stop

- **Start** begins playback at the top.
- **Resume** continues after a pause.
- **Stop** pauses playback and allows resuming later.

![Playlist controls](images/user-guide/16-playlist-controls.png)

## Tips and Good Practices

- Use the clipboard as your “sandbox” for experimenting with tandas.
- Use styles to keep a consistent flow (e.g., Tango → Vals → Milonga).
- Preview cortinas with headphones so you don’t interrupt the room.
- Use the playlist start time to plan your evening and estimate timing.

## Diagnostics (If Something Seems Off)

Check **Settings → Diagnostics** for:

- Audio tool locations (ffmpeg/ffprobe)
- Waveform paths and test button

![Diagnostics panel](images/user-guide/17-diagnostics.png)
