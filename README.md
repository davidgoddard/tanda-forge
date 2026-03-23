# Tanda Forge

<img src="images/user-guide/tandaforge_icon_1024.png" width="300px">

Tanda Forge is a purpose-built DJ tool for Argentine Tango—designed around tandas, real workflows, and live decision-making.

Fast when you need it. Safe when it matters. Flexible when the floor changes.

## Background

Tanda Forge is a desktop app for Argentine Tango DJs who want a fast, safe, and flexible tanda preparation and live playback app.

It evolved from the original Raspberry Pi Tanda Player and focuses on practical live DJ workflows: building tandas, managing playlists, cueing audio, and adapting quickly during a milonga.

This project is a collaboration between David Goddard (design and requirements) and ChatGPT Codex (implementation, tests, and documentation).

![Main screen layout](images/user-guide/01-main-layout.png)
![Display screen layout](images/user-guide/02-display-board.png)

---

## Free & Open Source

Tanda Forge is completely free and open source.

* No subscriptions, no lock-in
* Built by tango DJs, for tango DJs
* Open for contributions and community-driven improvement

---

## Download

Available for all major platforms:

* **macOS**
* **Windows**
* **Linux**

👉 [Pre-built binaries for Tanda Forge on GitHub](https://github.com/davidgoddard/tanda-forge/releases/)

## User Guide

See [User Guide](docs/user-guide.md)

---

## Built for Tango DJing

Most DJ software treats music as individual tracks. Tango doesn’t.

Tanda Forge is built around:

* Tandas as the core unit
* Flow across the whole night
* Real-time adaptation to the room

---

## Features

### 🎼 Build Tandas Quickly

Create, refine, and reuse tandas without friction.

* Build from tracks or existing tandas
* Edit and rebalance in seconds
* Keep musical consistency across your sets

---

### ⚡ Designed for Live DJing

No surprises when you're in front of a room.

* Instant playback and fast transitions
* Safe “Live Mode” to prevent mistakes
* Cue and prepare without interrupting flow
* Single-click pause after the current tanda for demos, announcements, or organiser interruptions, then single-click resume when ready
* Single-click mark the current tanda as the last tanda, so playback and display handling finish cleanly without trimming the playlist by hand

All movements of tandas and tracks is done through keyboard and menus, safer than drag/drop

---

### 🎧 Headphone Cueing & Dual Audio

Preview privately, play confidently.

* Separate headphone and main outputs
* Cue upcoming tracks before committing
* Stay in control during transitions

---

### 🎚 Consistent Sound, Automatically

Fix common audio issues before they reach the floor.

* Playback level normalization
* Automatic silence trimming
* Smooth, predictable transitions

---

### 🎶 Smart Cortina Control

Handle cortinas without breaking flow.

* Global or per-slot cortina settings
* Built-in auto-fade-out behaviour
* Manual override when needed to play entire track with option to fade out anyway later

---

### 🗂 Playlist & Set Building

Shape the night, not just the next tanda.

* Build full playlists from tandas
* Reorder and adapt during play
* Clear visual indicators of tanda style
* See **start times for every tanda** at a glance

---

### 📋 Clipboard & Collections Workflow

Work fast without committing too early.

* Use the clipboard to quickly gather candidate tracks or tandas
* Build and compare ideas in collections
* Integrated search for **similar tracks and tandas** to accelerate selection
* Move seamlessly from exploration → staging → playlist
* Ideal for real-time adaptation during a milonga

---

### 📊 Diversity Insights

Make better programming decisions across the whole night.

* View diversity reports for playlists and collections
* Understand balance across orchestras, singers, rhythms, and styles
* Avoid repetition and maintain musical variety

---

### 🎯 Style Guidance & Validation

Stay consistent with tango DJ best practices.

* Tanda sequence checks to catch mismatches
* Clear style indicators across the playlist
* Supports confident, coherent programming

---

### 🔍 Fast Search & Staging Workflow

Find, test, and assemble music quickly.

* Search tracks or existing tandas
* Stage ideas in clipboard collections
* Iterate before committing to the playlist

---

### 🧠 Multiple Working Modes

Optimised for each stage of DJing.

* **Preparation Mode** — fast auditioning and building
* **Live Mode** — safe, focused performance
* **Edit Mode** — efficient metadata updates

---

### 💃 Support the dancers

Show dancers who they are dancing too via a display screen or projector.

* **Who's playing now** — current track's artist and title
* **What's next** — show style of next tanda
* **Re-affirm when it's the cortina** — Cortina shows what's coming

Also shows when it is the last tanda and when there is no more - "That's all folks!"

---

## How It Works

A typical workflow:

1. Configure separate folders for:
   - music
   - cortinas
   - display board images
2. Run setup so Tanda Forge scans your music library, imports available metadata and prepares for playback
3. Review and enrich track metadata such as:
   - dates
   - notes
   - BPM
   - title, artist, singer, style, and other library fields
4. Use that metadata in different ways:
   - search directly by hand
   - use `find similar` from a track
   - move into tandas (new or old) directly from the metadata editor or drop into the playlist and let it handle tanda construction
5. Open a tanda in the designer to set the app's context to that tanda’s style and size, making it safer to edit and faster to see suitable alternatives
6. Use collections to keep longer-term working sets such as:
   - favourites
   - crowd-pleasers
   - possible last-tanda choices
   - other reusable shortlist ideas
7. Add tandas to the playlist, swap them about, cue them, and play live
8. Built in summaries:
   - tandas are shown as summaries of artists, years, tempo, Sung/instrumental and DJ added descriptions
   - expand to see the tracks within and send to the editor to change order, add or remove etc.
   - collapse expanded tandas to see more tandas on the screen at once to get a feel for the up-coming tracks and predicted time they will play
9. Use the display board:
   - grab some background images and configure their location
   - Open the display board view
   - Drag to a window, resize and share with the dancers
   - No manual management

Simple. Fast. Repeatable.

---

## Documentation

Full user guide:
https://github.com/davidgoddard/tanda-forge/blob/main/docs/user-guide.md

---

## Support & Feedback

If you run into a problem, want to request a feature, or have an idea to improve Tanda Forge, please use GitHub Issues.

* **Bug reports**: open an issue with clear steps, what you expected, and what happened instead
* **Feature requests**: open an issue describing the workflow problem you want to solve
* **General feedback**: open an issue and describe the use case or DJ context

This project does not currently maintain a separate private security reporting process. For normal project problems and feedback, GitHub Issues is the right place.

---

## Status

Active development. Built for real-world use, evolving with feedback.

---

## Get Started

```bash
git clone https://github.com/davidgoddard/tanda-forge.git
cd tanda-forge
```

Or download a release build for your platform (see above).

---

## Contributing

Ideas, feedback, and pull requests are welcome.
