# **Tanda Forge** User Guide

This guide introduces the layout, explains initial setup, and walks through searching, collecting, and building tandas and playlists.

## Screen font size (zoom)

The app supports normal browser-style zoom controls so you can change the on-screen font size and layout density:

- **macOS**:
  - Increase size: `Command` + `+`
  - Decrease size: `Command` + `-`
  - Reset to default: `Command` + `0`
- **Windows / Linux**:
  - Increase size: `Ctrl` + `+`
  - Decrease size: `Ctrl` + `-`
  - Reset to default: `Ctrl` + `0`

## Key Areas and Roles

The app is organized into three main columns plus a settings area:

- **Search (left column)**: Find tracks and tandas, filter by styles, and send results to a clipboard, an open tanda or a playlist.
- **Clipboard (middle column)**: A staging area with collections. Store tracks/tandas temporarily, build sets, and move items into the playlist.
- **Playlist (right column)**: Your running order. Add tandas/tracks, see predicted start times, and control playback.
- **Settings (top-right gear)**: Configure audio outputs, library folders, language, styles, playlists, and diagnostics.

![Main screen layout](../images/user-guide/01-main-layout.png)

## Overview

The application is in effect a single page application where the DJ can build and play a playlist.  A playlist in this context is a pre-defined
sequence of tandas optionally separated by cortinas.

<img src="../images/user-guide/03-main-buttons.png" width="200px">

The buttons are:
- Congiguration/Setup
- Full screen toggle
- Open/close display window
- Open diversity viewer
- Toggle themes
- Close app.

The playlist is configured in the "config" page by clicking the "Settings" button in the top right and then clicking on the playlist tab.  The main things
to set are the size and style of each tanda in the sequence required - typically this seems to be some variation of 3 or 4 tracks per tanda in the sequence of 
some tangos, then a break such as a Waltz followed by more tangos and a milonga and then the sequence repeats.  This sequence is set using the sequence of numbers
and letters; 3t or 4T etc.  So a simple playlist might be "4T 4T 3W 4T 4T 3M".  When adding tandas to the playlist the application will check the target position's size
and style and warn if the user is about to drop a mis-matching tanda into it.

The playlist timing values affect how one item leads into the next:
- Positive value: silence/pause before the next track or cortina starts.
- Zero: immediate handover with no added silence.
- Negative value: overlap/crossfade.  The next item starts before the current one ends, and the absolute value of the number is used as the overlap duration.  For example `-2` means about a two-second mix.

Once cortinas have been assigned to playlist slots, those slot choices are
saved with the playlist and restored the next time the app opens, whether they
came from auto-planning or from a manual replacement. If you later change the
selected cortina set in Playlist settings, those saved slot assignments are
cleared and the playlist reassigns cortinas from the newly selected set. If you
extend the playlist with more tandas, only the new cortina rows are filled from
the current set; already assigned cortina rows stay as they were.

<img src="../images/user-guide/04-tanda-sequence.png" width="200px">

The sequence also supports grouped alternatives with independent sizes, for example:
`3T 3T 3W 3T 3T (2C 3M)`.
This means that slot can accept either a 2-track Candombe tanda or a 3-track Milonga tanda.
The sequence field validates both syntax and style letters, so any unknown letter code is flagged until it matches a configured style-family code.

The playlist can be pre-built prior to the event or built one tanda at a time as the evening progresses.  Currently the system only supports one playlist
and re-opening the application will re-open the playlist ready to go.

Across the top are:
- Button to open the diversity viewer for this playlist
- Play button
- Stop button
- Contents filter - to help see all tandas by one orchestra for example
- Clear button - clear only or clear and auto-fill

Cortinas if used will be displayed between tandas and if clicked on will open the cortina picker to allow manual selection.

Tandas show their overall style letter and then the name of the tanda if specified followed by a summary of the artist composition, whether sung, the years of the tracks in the tanda, the range of tempos in the tanda and the duration of the tanda.

<img src="../images/user-guide/05-playlist.png" width="400px">

Cortinas are optional and if used, the DJ can set up sets of tracks such as Salsa, Swing, Blues or whatever and then choose which set to use for the playlist.
Once chosen, each new tanda is automatically allocated a track from that set.  Individual cortinas can be changed for any track from any set and the DJ can listen
on headphones to help choose.

To build tandas, the DJ can pick ready made tandas from one of the built-in collections in the clipboard or start building a tanda, either straight into the playlist or using a tanda designer tab in the right hand column.  

In the top right the DJ can click the display board button and a pop-out window will appear which shows the current playing track information and tanda information from the main output only. Headphone preview is never shown on the audience-facing display board. This can
be dragged to another window to show on a connected TV or Projector.  Background images for this can be configured using the background images folder set in the library tab.
If no images are set up then a simple set of coloured dots will come and go on the screen in the background instead.  Images work better.

In the top right there is a graph button which opens a view that shows the diversity in the collection as a whole. It shows the tanda counts for each artist and style and how many tracks are available and whether more tandas could be made from this to increase the diversity.  There are also years covered by the collection and the tempo/bpm coverage by style.  Less useful but might help understand that a wider set of years should be turned into tandas for example.  From the tables it is possible to click a search button for an artist and it will immediately open the search results with that orchestra/artist ready to start making more tandas.

### Music Styles

The system is given a number of single letter styles such as **T** or **W** or **M**.  Each one has a name such as "Tango". Then zero or more sub-styles can be added such as "Alternative", "Contemporary", "Traditional".  The system allows tandas that match any of the sub-styles or the
main style name as valid for a playlist position marked with the single letter such as "T".

<img src="../images/user-guide/06-styles.png" width="100%">

The style names are shown as search filter buttons and all matching tracks and tandas are then shown in the search results and the clipboard.

The **Tanda size** control in the Search column affects tanda results only. It
lets the DJ limit the tanda search to tandas of a specific size such as `3` or
`4`. Setting it to **Any** removes that size filter, so tandas of all lengths
can appear in the search results.

Right Clicking (or press and hold) a style pill button will show the sub-styles if available allowing specific searches for "alternative" tracks and tandas.
Long-pressing a style pill (about 1 second) opens the same sub-style menu.

<img src="../images/user-guide/07-search-styles.png" width="400px">

Note, that the sub-styles can be used not only for "Nuevo" or "Traditional" or "Contemporary" but could be "Stompy" and "Lyrical" and "Slow" or "Fast" or whatever might be useful.  The DJ just decides whether to use named collections to track say Lyrical tandas or whether to use styles and then use the search filters.  Whichever works for them.


### Modes

The system uses modes of operation to make the application easy to use or safe.

<img src="../images/user-guide/08-mode.png" width="200px">

- **Live** is for DJing on the night.  The only music that will play is what's next in the playlist.
- **Preparation** is for exploring your collection whilst building tandas or playlists.  Clicking on a song plays it immediately.
- **Edit** similar to "Preparation" mode but the editor window stays open allowing the DJ to click a song and quickly adjust the data or see the album it's from etc.

### Controls

See playlist image above.

In live mode, to start the playlist, the DJ can click the small "play" button at the top or click a tanda summary in the playlist.  If the chosen tanda starts with a
cortina, and if cortinas are in use, the system will play that cortina before the tanda begins.

If the DJ clicks an individual track in **Search** or **Clipboard** while
nothing is playing in **Live** mode, Tanda Forge asks for confirmation and
then plays that track as a one-off item only.  It does **not** continue
through the playlist afterwards.  This is intended for ad-hoc performance
songs or announcements.

If the DJ clicks an individual **playlist** track while nothing is playing in
**Live** mode, playlist playback starts from that track using the normal
playlist rules.  That means the track starts immediately unless it is the
first track of a tanda with a lead-in cortina, in which case the lead-in
cortina still plays first.

In **Preparation** mode, clicking any playlist track always starts that exact
track immediately, even if another playlist track is currently playing.  It
does **not** insert the lead-in cortina first when you do this.

The stop button will cause a fade out and stop of the playlist.  Pressing play again will resume the playlist.

Whilst a cortina plays, in the now playing area the system provides two buttons; stop and play.  "Stop" will cause a fade out and then playing of the first song in the next
tanda.  "Play" will remove the auto-fade-out from the track and allow it to play in its entirity.  If having clicked "Play" the DJ wishes to then stop anyway clicking the 
"Stop" will fade out and then continue in the playlist.

Each track has a headphone icon shown next to the elipsis menu button if headphone output has been configured.  The system will try to ensure headphone output is not the live
output when setting up but some systems can present the same output under different names such as "Default" and "Main speakers" and the app has no way to spot this so it is 
still possible to set both to the same output but hopefully the DJ knows they have done this and manage the use of headphones appropriately!

The compression slider when available will mix the reduced "dynamic range" version of the song with the normal track allowing some or all of the compression to be used.  Under 
normal use the DJ should set this to 0%.

<img src="../images/user-guide/09-now-playing.png" width="500px">

When the DJ is playing the last tanda of the evening they can click on the "This is the last tanda" check-box and this will ensure that the music stops after this tanda has played
completely and, if using cortinas, the final cortina has played.  Display behavior is:
- lead-in cortina before that tanda stays normal ("Cortina" + "This tanda: {style}");
- while tracks in that tanda are playing, bottom-right text changes to "This is the last tanda";
- the final cortina after that tanda shows only "That's all folks";
- after that final cortina ends and playback stops, the display remains on "That's all folks" until new playback/display state replaces it.

<img src="../images/user-guide/10-last-tanda.png" width="500px">

For live performances, there is a second playlist checkbox: "Stop after this tanda for a live performance".  This behaves differently from the "last tanda" option:
- the tanda plays normally;
- the following cortina plays normally;
- during that tanda and cortina, the display board shows no bottom-right tanda text;
- after the cortina finishes, the playlist pauses instead of ending;
- the DJ can then click confirmed one-off tracks from Search or Clipboard for the performance itself;
- when the DJ later presses Playlist **Play**, Tanda Forge replays that same cortina and then continues into the next tanda/item in the playlist.

That checkbox can be turned on before the tanda starts or while that tanda is
already playing. If it is enabled during the tanda, the stop still applies
after that tanda's following cortina.

Tip: create a named clipboard collection such as `Show`, `Performance`, or the
name of the act, and put the required performance tracks into it ahead of time.
Then, when the moment comes, the DJ can switch straight to that collection and
the required one-off tracks are immediately available.

### Menus

The application uses single-letter menus on tracks and tandas to make a safe way to work instead of dragging and possibly accidentally dropping causing live playback!

The general options are:
- **S**: Search for similar - fills the search column's search field with the artist, year, tempo, notes etc. from the current track or tanda and starts the search.
the Search results are scored and ranked.  However, the search results can be quickly navigated using the "Jump to" letters.  By default the letters apply to the title
but the DJ can choose the artist or year columns instead.
- **C**: Send to clipboard - sends the song to either the "General" collection if a built-in collection is in focus or to the currently open user collection.
- **P**: Send to playlist - tandas are sent to the marked target in the playlist or to the end of the playlist if no target.  Style mis-mmatch or size mis-match warnings are given 
but nothing is blocked.  Sending a track to the playlist will either create a new empty tanda and add the track as the first entry or append the current tanda until that
tanda has the playlist's preferred track count in which case it will start another tanda.  So the playlist can be built track by track if required or a mix of tandas and tracks.
- **T**: Send to the tanda designer - as for sending to the playlist except the target is in the tanda designer and has nothing to do with the playlist's contents.
- **E**: Edit - used for tracks this pops up a window showing all track data.  Next to each value is a "S" button for searching and each button sends the current fields text to the search
field in the search column.  Clicking more "S" buttons adds more text allowing the tempo and year and artist to be used for searching for example.
- **R**: Remove - removes the track or tanda from the named collection or playlist.  Removal of a tanda from a playlist causes an empty placeholder to be added to maintain the playlist sequence.
- **M**: Context action:
  - In playlist tandas/tracks: mark as target for replace/swap flows.
  - In clipboard tandas/tracks: move (or copy, from smart collections) to another collection.
- **X**: Swap - send the current tanda to the current target and bring that target's tanda to the current position.  Style and size warnings may be given but nothing is blocked.

In addition, the menu buttons - circles with the elipsis in it ("...") - can be coloured white which indicates either a full or partial overlap with the current playlist.  Clicking the button 
opens the menu as normal but also causes the playlist to scroll to the first instance of the track or tanda that overlaps.

Within Playlists:

<img src="../images/user-guide/13-menu-playlist-tanda.png" width="500px">

<img src="../images/user-guide/12-menu-playlist-track.png" width="500px">

Within Collections:

<img src="../images/user-guide/14-menu-collection-tanda.png" width="500px">


### Collections

<img src="../images/user-guide/11-collections.png" width="500px">

All collections can hold tracks and tandas.  The DJ can add any named collection in addition to the built-in ones and can view any combination of them at the same time. 
The music style such as Tango or Vals can be controlled through the "Search" column's style options and can be set to "Any" or any combination of styles.  The DJ can add
more styles into the configuration page and then classify songs or tandas using the new styles for use later.

The built-in collections are:

- **General**: A general purpose dumping ground for possible playlist tandas or tracks and where cleared out tandas from the playlist are sent.
- **New**: A collection of the last 100 tandas saved (edited or created) and the last 100 tracks added to the system
- **Top**: Each time a tanda or track is played all the way through it is counted and this collection shows the ones with the highest counts - i.e. your most commonly played
- **Lowest**: As for "Top" but of the lowest counts, i.e. the ones you seldom play - perhaps help the DJ to re-discover forgotten classics.
- **Available**: Working with the graph of the playlist's diversity, this collection contains tracks and tandas that are by artists and styles not yet included in the playlist.  I.e. if 
some "Di Sarli" Tango tandas are in the playlist, there will be no "Di Sarli" Tango tandas shown in the available list but his Waltzes and Milongas might be.  This helps offer quick options
that will increase the artist diversity within the playlist.

All are dynamic meaning they change their contents as the DJ works.

Ideas for named collections might be some tandas that you like to play at the end of an event, or crowd-pleasers etc.

All collections can be filtered by both the "search" style and any text such as song titles or artist names using the "filter" in the collections column.

All non built-in collections including **General** can be cleard with a single click of the **Clear** button.

Tandas and tracks can be moved from one collection to another and to General by default using the **M** menu option and if there are multiple possible targets, it will offer a picklist otherwise if there is only one writable (i.e. not build-in rule based collection) then it will not prompt and will just move.

### Working With Tandas

There are several ways a tanda can be created or filled:

- **Use an existing tanda from Search**: click **P** to send it to the playlist, **C** to send it to the active clipboard collection, or **T** to open it in the Tanda Designer for editing first.
- **Use an existing tanda from a clipboard collection**: click **P** to place it in the playlist, or **T** to open it in the Tanda Designer.
- **Build a tanda from individual tracks**:
  - from **Search**, use **P** on a track to add it into the playlist. The app will create or continue a tanda there as needed.
  - from **Search**, use **T** on a track to send it into the Tanda Designer.
  - from a **clipboard track**, use **P** to add it into the playlist or **T** to send it into the Tanda Designer.
  - from a **playlist tanda**, use the per-track send actions to move a track out to the clipboard or into another tanda slot.
- **Auto-fill can create tandas automatically** when rebuilding a playlist and no saved tanda fits the required slot.

Once a tanda is open in the **Tanda Designer** or the playlist-hosted tanda editor, it can be changed in several ways:

- click tracks to audition them in Preparation or Edit mode
- use the per-track menu to remove a track from the tanda
- use the track move buttons in the editor to re-order tracks inside the tanda
- send more tracks into the open tanda from Search or Clipboard
- change the tanda name and other tanda-level details
- click **Save** to keep the tanda

Deleting or removing a tanda depends on where you are looking at it:

- **Delete a saved tanda itself**: open it in the Tanda Designer with **T**, then click **Delete**. This removes the tanda record, so it disappears from collections and can no longer be used in playlists.
- **Remove a tanda from a clipboard collection only**: use **R** on the tanda in that collection. This removes it from that collection view, but does not delete the tanda from the library if it still exists elsewhere.
- **Remove a tanda from the playlist**: use **R** on the playlist tanda. The playlist keeps its sequence shape by leaving an empty placeholder slot.
- **Delete a tanda seen in a collection**: as a safe rule, use **T** to send it to the Tanda Designer and then use **Delete** there.

Re-ordering can happen in more than one place:

- **Inside a tanda**: use the move controls in the Tanda Designer or playlist-hosted tanda editor.
- **Between playlist positions**: use the playlist tanda move/swap controls to reposition tandas in the running order.
- **Between clipboard collections**: use **M** to move a tanda from one collection to another.

### Now Playing

![Now Playing](../images/user-guide/15-now-playing-waveform.png)

The bar across the top of the app shows the song now playing.  As well as the artist and title etc. it also shows the "waveform" of the song's loudness over time.  In modes other than 
"Live" clicking somewhere on that waveform will skip the playback to that position either forwards or backwards.  This is useful to quickly assess if there is singing in a song when 
classifying or simply to hear how a track ends.

Below the now playing text is a compression control.  "Compression" in this context is a dynamic-range compression in which the quieter parts of the track are made louder - almost as loud
as the loudest parts of the song.  This removes the dynamic effects the orchestra intended but is useful when there is a lot of chatter on the dance floor, perhaps at the start of a new
tanda or song as it makes the details otherwise lost stand out.  The DJ does not need to turn up the amplifier or mixer's volume control which might make the louder parts too loud and painful to hear.  This in turn allows those who wish to dance to hear the music's beat or details well enough to start dancing.  Once the chatter dies down
the DJ can return the dynamic range by reducing the compression level back to zero.

## Playlist

A playlist can be built up as required and then cleared using the **Clear** button.  This button will offer to just clear or to clear and re-fill.

### Clear and Auto-Fill

- Click **Clear** in the playlist header to open playlist clear options.
- Choose **Clear playlist** to empty the list without changing configuration.
- Choose **Clear and auto-fill** to rebuild the playlist from your saved tandas
  and sequence rules until projected playback reaches the configured end time.
- If no suitable tanda is available for a slot, the app builds an ad-hoc tanda
  from similar tracks (same style first, then progressively relaxed matching).
- Auto-fill never reuses a track title already present in the generated playlist.

If the tanda sequence configured uses a grouped option such as "3t 3t 3w 3t 3t (3m 3c 3f)" (where 'c' might be Candombe and 'f' might be Foxtrot) then a tanda matching any of those styles will be picked or built if required.

## Track Meta data

Any track data can be modified by using the **E** menu option which opens the editor or alternatively if doing many, set the mode to **Editor** which will keep the editor window open allowing single clicks on tracks to load the data for editing.

Each field can be modified and can also be used to add to a search for similar items using the **S** button next to each field - the current field value is appended to the search

<img src="../images/user-guide/16-editor.png" width="400px">

## Initial Setup

### 1) Choose Library Root Folders

You need at least one music folder, and optionally a cortina folder.

1. Open **Settings** (gear icon).
2. In **System**, click **Add Music Folder** and choose a folder.
3. (Optional) Click **Add Cortina Folder** and choose a folder.
4. Import legacy Tanda Player tandas and track data (titles, artists, tempo etc.) - See below
5. Click **Scan Music** (and **Scan Cortinas** if needed).


### 2) Select Audio Outputs

1. In **System**, choose **Main Output** and **Headphones Output**.
2. Headphone output enables previewing tracks without sending them to the main speakers.

### 3) Set Language

1. In **System**, choose **Language**.
2. UI labels, menu shortcuts, and tooltips update based on the selected language.

### 4) Playlist Timing

In **Settings -> Playlist**, the gap/timing controls work as follows:

1. **Gap between tracks** controls transitions inside a tanda.
2. **Gap before tanda** controls the handover from a cortina or prior item into the first track of the next tanda.
3. **Gap before cortina** controls the handover from the last track of a tanda into the cortina.

For all three controls:

- Positive values add silence.
- `0` means no added silence.
- Negative values create overlap/crossfade between the outgoing and incoming items.

### 4) Adjust Trim Padding (Optional)

1. In **System**, set **Trim padding (sec)** to extend auto-detected track trims.
2. Use this if song tails feel too short i.e. gets cut-off at the start or end.

### 5) Configure Playlist Defaults (Optional)

1. In **Playlist**, set your default tanda size and start time.
2. Choose a **Cortina Set** and **Duration** if you use cortinas.

### 6) Manage Styles (Optional)

Use **Styles** in **Settings -> Library** to add or remove style labels used for filtering and sequence rules.

- You can define aliases in the style input using `;` or `/`.
- Example: `Waltz;Vals;Valse`.
- The first value (`Waltz`) is the canonical style pill.
- Other values are aliases used to map imported/scanned genres back to the canonical style.
- Click an existing style row to load it into the input for editing.

## Importing legacy data

If key files from an old Tanda Player are available in the location the user identifies as the music and cortina source, the system will provide a button to allow importing the legacy data so that the DJ does not have to re-create all their tandas and fix up track data.

Before importing the user should set up the mapping of the legacy style names to the style names the new app should use for all filtering and playlist construction.  This is done in the settings page under system.  Once done, go back to the library tab and import the legacy data.

In **Library -> Style Families**, click **Show legacy styles** to view distinct classifier-derived styles from `library.dat` (`classifiers.style` plus optional `classifiers.sub-style`), how often they appear, and whether they currently map to an existing canonical style. Values with no classifier style are shown as `?`.
For each legacy style row:

- choose an existing canonical style in the dropdown to map this legacy value as an alias, or
- fill **Code / Base style / Alias** and click **Add as new style** to create and map that legacy value immediately.
- mappings are remembered per legacy root and automatically reused on future imports.

When importing legacy tandas, legacy names equal to `Auto Generated Tanda` or `Saved Auto-Generated Tanda` are intentionally cleared so the app can show its richer dynamic artist-summary label instead (including simple quote/dash/spacing variants of those labels).

Although the old legacy data does include some information to help normalise the sound levels and trim tracks, the compression and trimming is slightly different and so it is recommended to use the **scan** buttons and leave the system to read the files.

In **Settings -> Library**, the buttons are grouped by purpose:

- **Startup Flow** runs the recommended end-to-end setup in one action.
  - If legacy data is detected for the configured roots, it imports that first.
  - It then scans music and cortinas, generates missing waveform PNGs, and precomputes compressed companion files.
  - This is the recommended path after adding roots for the first time or after using **Erase Database**.
- **Library Scan** refreshes the database, analysis, and waveform PNG cache from the music and cortina folders.
- Re-running **Scan Music** or **Scan Cortinas** skips unchanged files, so adding new songs normally just means copying them into an existing root and scanning that root again.
- **Derived Caches** manages the expensive on-disk cache files.
- **Library Maintenance** contains database-only cleanup.
- **System Export / Import** backs up or restores the complete application data folder (database, caches, logs, and persisted settings).

If **compression** (dynamic range reduction) is enabled, the system can generate compressed files on demand when a track starts, but this may cause a short delay or CPU spike. Clicking **Precompute compressed cache** renders those compressed companions in advance. This takes a long time, but it is optional and only needed if compression will be used.

If you want to keep the cache files on disk but do not fully trust them, use **Verify cached files**. This checks waveform PNGs and compressed cache files, removes broken or incomplete entries, and leaves valid cached files in place. Use **Erase Cached Files** only if you want to remove those derived files entirely and force them to be rebuilt later.

**Erase Database** now removes only the database records. It does not remove waveform or compressed cache files. After using it, run **Startup Flow** to rebuild a complete working library from the configured roots.

In **Settings -> Diagnostics**, the app shows the actual `ffmpeg` and `ffprobe` paths it is using and whether each one came from the bundled app resources, a custom tools folder, or the system `PATH`.

- Normal behavior is to use the bundled binaries shipped with the app.
- If that is not possible on a particular machine, use **Choose FFmpeg tools folder** and select a folder containing `ffmpeg` and `ffprobe` (or `ffmpeg.exe` and `ffprobe.exe` on Windows).
- Resolution order is: bundled binaries, custom tools folder, then system `PATH`.
- You do not need to patch files directly into the installed app folder.

## Tips and Good Practices

- Use the clipboard as your “sandbox” for experimenting with tandas.
- Use styles to keep a consistent flow (e.g., Tango → Vals → Milonga).
- Preview cortinas with headphones so you don’t interrupt the room.
- Use the playlist start time to plan your evening and estimate timing.
- Set a playlist **expected end time** (Settings → Playlist) so auto-fill knows
  when to stop, including sessions that end after midnight.

## Compression Slider Behavior

If **Enable live compression control** is checked in Settings -> System, the
now-playing panel shows a **Compression** slider.

- The slider is for the current item only. Each new song or cortina starts with
  the mix back at `0%`.
- If playback starts before the compressed companion file is ready, the slider
  is temporarily disabled and displayed as `0%`.
- When the compressed companion becomes available, the slider is enabled again
  and can then be raised deliberately by the DJ.
- About 20 seconds before the effective end of the item, the app automatically
  returns the mix to `0%` so fade-outs are not corrected upward.
- If compression is disabled in Settings, no compressed companion files are built.

## Diagnostics (If Something Seems Off)

Check **Settings → Diagnostics** for:

- Audio tool locations (ffmpeg/ffprobe)
- Waveform paths and test button
