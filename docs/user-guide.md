# Tanda Player Lite User Guide

This guide introduces the layout, explains initial setup, and walks through searching, collecting, and building tandas and playlists.

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

The playlist is configured in the "config" page by clicking the "Settings" button in the top right and then clicking on the playlist tab.  The main things
to set are the size and style of each tanda in the sequence required - typically this seems to be some variation of 3 or 4 tracks per tanda in the sequence of 
some tangos, then a break such as a Waltz followed by more tangos and a milonga and then the sequence repeats.  This sequence is set using the sequence of numbers
and letters; 3t or 4T etc.  So a simple playlist might be "4T 4T 3W 4T 4T 3M".  When adding tandas to the playlist the application will check the target position's size
and style and warn if the user is about to drop a mis-matching tanda into it.

The playlist can be pre-built prior to the event or built one tanda at a time as the evening progresses.  Currently the system only supports one playlist
and re-opening the application will re-open the playlist ready to go.

Cortinas are optional and if used, the DJ can set up sets of tracks such as Salsa, Swing, Blues or whatever and then choose which set to use for the playlist.
Once chosen, each new tanda is automatically allocated a track from that set.  Individual cortinas can be changed for any track from any set and the DJ can listen
on headphones to help choose.

To build tandas, the DJ can pick ready made tandas from one of the built-in collections in the clipboard or start building a tanda, either straight into the playlist
or using a tanda designer tab in the right hand column.  

In the top right the DJ can click the display board button and a pop-out window will appear which shows the current playing track information and tanda information.  This can
be dragged to another window to show on a connected TV or Projector.  Background images for this can be configured using the background images folder set in the library tab.
If no images are set up then a simple set of coloured dots will come and go on the screen in the background instead.  Images work better.

In the top right there is a graph button which opens a view that shows the diversity in the collection as a whole. It shows the tanda counts for each artist and style and how many tracks are available and whether more tandas could be made from this to increase the diversity.  There are also years covered by the collection and the tempo/bpm coverage by style.  Less useful but might help understand that a wider set of years should be turned into tandas for example.  From the tables it is possible to click a search button for an artist and it will immediately open the search results with that orchestra/artist ready to start making more tandas.

### Music Styles

The system is given a number of single letter styles such as **T** or **W** or **M**.  Each one has a name such as "Tango". Then zero or more sub-styles can be added such as "Alternative", "Contemporary", "Traditional".  The system allows tandas that match any of the sub-styles or the
main style name as valid for a playlist position marked with the single letter such as "T".

The style names are shown as search filter buttons and all matching tracks and tandas are then shown in the search results and the clipboard.

Right Clicking (or press and hold) a style pill button will show the sub-styles if available allowing specific searches for "alternative" tracks and tandas.
Long-pressing a style pill (about 1 second) opens the same sub-style menu.


### Modes

The system uses modes of operation to make the application easy to use or safe.

- **Live** is for DJing on the night.  The only music that will play is what's next in the playlist.
- **Preparation** is for exploring your collection whilst building tandas or playlists.  Clicking on a song plays it immediately.
- **Edit** similar to "Preparation" mode but the editor window stays open allowing the DJ to click a song and quickly adjust the data or see the album it's from etc.

### Controls

In live mode, to start playing, the DJ can click the small "play" button at the top or click on any song in the playlist.  If the song clicked on happens to be the first
of the tanda, and if cortinas are in use, the system will play the cortina just before this tanda first otherwise it will simply play the track.

The stop button will cause a fade out and stop of the playlist.  Pressing play again will resume the playlist.

Whilst a cortina plays, in the now playing area the system provides two buttons; stop and play.  "Stop" will cause a fade out and then playing of the first song in the next
tanda.  "Play" will remove the auto-fade-out from the track and allow it to play in its entirity.  If having clicked "Play" the DJ wishes to then stop anyway clicking the 
"Stop" will fade out and then continue in the playlist.

Each track has a headphone icon shown next to the elipsis menu button if headphone output has been configured.  The system will try to ensure headphone output is not the live
output when setting up but some systems can present the same output under different names such as "Default" and "Main speakers" and the app has no way to spot this so it is 
still possible to set both to the same output but hopefully the DJ knows they have done this and manage the use of headphones appropriately!

The compression slider when available will mix the reduced "dynamic range" version of the song with the normal track allowing some or all of the compression to be used.  Under 
normal use the DJ should set this to 0%.

When the DJ is playing the last tanda of the evening they can click on the "This is the last tanda" check-box and this will ensure that the music stops after this tanda has played
completely and, if using cortinas, the final cortina has played.  The display board's final cortina will have the text "That's all folks" instead of the "Cortina" wording.  The
track information in the display board will show "Last Tanda".

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

### Collections

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

### Now Playing

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

## Initial Setup

### 1) Choose Library Root Folders

You need at least one music folder, and optionally a cortina folder.

1. Open **Settings** (gear icon).
2. In **System**, click **Add Music Folder** and choose a folder.
3. (Optional) Click **Add Cortina Folder** and choose a folder.
4. Import legacy Tanda Player tandas and track data (titles, artists, tempo etc.) - See below
5. Click **Scan Music** (and **Scan Cortinas** if needed).


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
2. Use this if song tails feel too short i.e. gets cut-off at the start or end.

![System settings - trim padding](images/user-guide/04b-settings-trim-padding.png)

### 5) Configure Playlist Defaults (Optional)

1. In **Playlist**, set your default tanda size and start time.
2. Choose a **Cortina Set** and **Duration** if you use cortinas.

![Playlist settings](images/user-guide/05-settings-playlist.png)

### 6) Manage Styles (Optional)

Use **Styles** in **Settings -> Library** to add or remove style labels used for filtering and sequence rules.

- You can define aliases in the style input using `;` or `/`.
- Example: `Waltz;Vals;Valse`.
- The first value (`Waltz`) is the canonical style pill.
- Other values are aliases used to map imported/scanned genres back to the canonical style.
- Click an existing style row to load it into the input for editing.

![Style manager](images/user-guide/06-settings-styles.png)

## Importing legacy data

If key files from an old Tanda Player are available in the location the user identifies as the music and cortina source, the system will provide a button to allow importing the legacy data so that the DJ does not have to re-create all their tandas and fix up track data.

Before importing the user should set up the mapping of the legacy style names to the style names the new app should use for all filtering and playlist construction.  This is done in the settings page under system.  Once done, go back to the library tab and import the legacy data.

In **Library -> Style Families**, click **Show legacy styles** to view distinct style values found in `library.dat`, how often they appear, and whether they currently map to an existing canonical style.  This helps configure aliases before import.
For each legacy style row:

- choose an existing canonical style in the dropdown to map this legacy value as an alias, or
- fill **Code / Base style / Alias** and click **Add as new style** to create and map that legacy value immediately.

Although the old legacy data does include some information to help normalise the sound levels and trim tracks, the compression and trimming is slightly different and so it is recommended to use the **scan** buttons and leave the system to read the files. 

Further to this, if **compression** (dynamic range reduction) is to be enabled, the system will generate compressed files on the fly when you play a track but this can mean a sudden CPU load on the PC and perhaps a few seconds delay.  It is recommended to click **Precompute compressed cache** button once all else is done and it will ensure all files are immediately available as compressed versions.  This takes a very long time to complete.

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

- The slider value is your preferred blend amount.
- If playback starts before the compressed companion file is ready, the slider
  is temporarily disabled and displayed as `0%`.
- When the compressed companion becomes available, the slider is enabled again
  and returns to your stored value automatically.
- If compression is disabled in Settings, no compressed companion files are built.

## Diagnostics (If Something Seems Off)

Check **Settings → Diagnostics** for:

- Audio tool locations (ffmpeg/ffprobe)
- Waveform paths and test button

![Diagnostics panel](images/user-guide/17-diagnostics.png)
