# Search and Similarity

This document defines how search, sorting, navigation, and similarity work in
Tanda Player 2. Search is a primary interaction model and must remain fast,
fault-tolerant, and consistent across devices.

Search must support:
- Tracks and tandas as first-class results
- Very large libraries (tens of thousands of tracks)
- User-defined metadata fields
- Context-specific actions (e.g. build tanda vs live DJ)
- Predictable ordering and navigation

---

## NFR-020 — UTF-8 and Filename Integrity

The system must correctly handle UTF-8 throughout the pipeline:

- USB mount configuration must preserve:
  - UTF-8 characters in filenames
  - Long filenames
- The backend must treat file paths and metadata as UTF-8 end-to-end.
- The UI must render UTF-8 characters without loss or replacement.

This includes:
- Track titles, artist/orchestra, notes, and any user-entered fields
- File paths displayed in diagnostics

No lossy fallback encodings are permitted.

---

## FR-090 — Search Scope and Types

### FR-090.1 Search Targets
Search must support:
- Track search
- Tanda search

UI presentation:
- Results are presented in separate tabs (or equivalent grouping) for Tracks and Tandas.

### FR-090.2 Field Coverage
Search applies to all searchable fields including:
- Standard fields (title, artist/orchestra, year, BPM, etc.)
- User-defined text fields (e.g. Notes, Sound, Tags, Comments)
- Aliases and nicknames (see FR-094)

Numeric fields (e.g. BPM, year) may be searchable both:
- as text (simple)
- and as ranges (advanced feature; define later)

---

## FR-091 — Fuzzy, Fault-Tolerant Search

### FR-091.1 Matching
Search must tolerate:
- Partial terms
- Word order differences
- Minor spelling errors

The search algorithm must produce a relevance score and rank results by score.

### FR-091.2 Accent Handling (Diacritics)
Search must support a configurable accent/diacritic strategy:

Default behavior:
- Accent-insensitive matching is enabled (e.g. accents ignored).
- Display remains accent-correct (no normalization of stored text).

Rationale:
- Many users type without accents on mobile keyboards.
- DJs need recall more than orthographic precision.

Optional behavior:
- Accent-sensitive matching can be enabled in configuration for users who prefer it.

---

## FR-092 — Tokenization and Ignored Phrases

The system must support token rules to improve search quality and ordering.

### FR-092.1 Ignored Phrase List
A configurable ignore list may remove non-informative suffixes/prefixes from
matching and/or ordering.

Example:
- “X and his orchestra” may ignore “and his orchestra” for ordering and scoring,
  so that results cluster naturally under the canonical artist name.

### FR-092.2 Nicknames and Common Name Variants
A small alias list must support known nicknames or leader-name variants,
so that searches for nicknames match the canonical orchestra/artist.

This alias list is separate from the general alias system in FR-094 and may be
hand-curated.

---

## FR-093 — Ranking and Ordering

### FR-093.1 Relevance Rank
Default ordering is by search score (descending).

### FR-093.2 Stable Secondary Ordering
When scores tie or are close, ordering must be stable and predictable using a
consistent secondary key order, for example:
1. canonical artist/orchestra
2. title
3. year (if present)
4. file path (as a last resort for determinism)

Ignored phrases (FR-092.1) must not distort ordering.

### FR-093.3 Column Sorting (UI)
Track results are shown in a grid/table with sortable columns.

Column sort toggles in three states:
1. Ascending
2. Descending
3. None (revert to default ordering)

Sorting must define a stable total order suitable for cursor-based paging.

Sorting must apply to the entire result set, not only visible rows.

---

## FR-094 — Alias Metadata Source

The system must support a metadata file or dataset of aliases for artist/orchestra
names.

Requirements:
- Canonical name ↔ alias mapping
- Multiple aliases per canonical name
- Aliases included in search matching and ranking
- Canonical name displayed in UI by default (configurable)

This improves:
- spelling tolerance
- variant naming across different sources/files
- consistent clustering in results

---

## FR-095 — Language Expectations

The system is not required to perform cross-language semantic translation
(e.g. searching English words should not automatically match Spanish words).

However:
- The system must not prevent users from entering multilingual notes.
- Search operates over the literal tokens and aliases available offline.

Future enhancements (optional):
- Local (on-device) language models may be added later for semantic expansion,
  but must be explicitly enabled and must not require internet connectivity.

---

## FR-096 — Large Result Sets, Incremental Loading, and Smooth Scrolling

Search must support very large libraries and large result sets.

Requirements:
- Results must be retrievable incrementally (paged, cursor-based, or streamed).
- The UI must render results using virtualization (windowing) to keep the DOM small.
- Scrolling must remain smooth on phones, tablets, and desktops.

The UI must not require loading all rows into memory at once.

### FR-096.1 Bidirectional Scrolling
The UI must allow users to scroll forward and backward through the result set,
regardless of how results are loaded.

Example:
- A user may jump to “Z” and then scroll upward back through “Y”, “X”, … to “A”
  without confusing discontinuities.

This implies the backend must support fetching results both:
- after a given position
- before a given position
(using a stable ordering key).

---

## FR-097 — Quick Navigation Index and Jumping

Track search results must provide a quick navigation index aligned to the
current sort column.

### FR-097.1 Index Coverage
The quick navigation index must represent the entire result set, not only the
currently loaded/visible window. It must be obtainable from the server even if
the client only has a small subset of rows loaded.

### FR-097.2 Ordering of Index Keys
The index key ordering must be:
- Numbers first (0–9)
- Then letters (A–Z)
- Then any remaining characters (implementation-defined, but stable)

### FR-097.3 Jump Behavior
Clicking an index key jumps to the first result row whose normalized sort key
begins with that prefix.

After jumping:
- The UI must allow normal scrolling in both directions across adjacent prefixes.
- The UI must be able to load preceding/following pages as the user scrolls.

### FR-097.4 Index Updates
The index must update whenever:
- the query changes
- the sort column changes
- the sort direction changes
- filters change

The index must remain consistent with the server’s authoritative ordering.

---

## FR-098 — Context-Specific Row Actions (Menus)

Search results are used in multiple contexts. Rows may expose a context menu
with actions appropriate to the calling page.

Example actions:
- “More like this”
- “More by this artist/orchestra”
- “More with this title”
- “Add to current tanda” (build-tanda context)
- “Add tanda to playlist” (playlist-building context)
- “Replace at boundary” (cortina selection context)

Rules:
- Actions must be consistent in naming and placement.
- Actions must not appear in Performance Mode if they can disrupt playback
  (UI-001, UI-002).

---

## FR-099 — Click Behavior by Mode and Context

Click/tap behavior must obey mode safety:

Preparation Mode:
- Clicking a track row may start preview playback (UI-010).
- Clicking a tanda row does not start live playback.

Performance Mode:
- Clicking rows must never start playback.
- Only dedicated playback controls may start/stop playlist playback (UI-013).

---

## FR-100 — Similarity Search

### FR-100.1 Similarity Inputs
Similarity may use:
- Standard metadata fields (artist/orchestra, year, BPM, etc.)
- User-defined musical properties (manual vectors)
- Future derived vectors (ML-based), without changing the UI abstraction (UI-030)

### FR-100.2 Similarity Queries
The system must support:
- “Find more like this track”
- “Find more like this tanda”
- “Find compatible tracks for building a tanda of size N”

### FR-100.3 Year as a First-Class Similarity Dimension
Year must be supported as a similarity dimension and may be weighted heavily
if configured.

This must be:
- configurable
- visible in configuration
- reflected in similarity ranking behavior

---

## FR-101 — Result Annotation in Playlist Context

When viewing search results in the context of a current playlist, results must
show additional information to help avoid repetition and unintended bias.

Must support indicators such as:
- Track already used in this playlist
- Track used in recent playlists (optional scope)
- Artist/orchestra density warnings (nudge, not enforcement)

These indicators must be informational and must not block selection unless
explicit rules are enabled.

---

## UI Component References

Search and similarity rely on these reusable UI components:

- UI-010 Track Row Component
- UI-011 Tanda Summary Component
- UI-030 Similarity Visualization Component
- UI-013 Playback Control Component
- UI-080 Scratch Pad Component (when search feeds editing workflows)

---

## Notes on Implementation Strategy (Non-binding)

This document specifies behaviors, not technologies.
Implementation may use:
- n-gram / token-based scoring
- indexed full-text search
- hybrid approaches

However:
- Results must remain deterministic and stable under the same inputs.
- The system must not depend on the public internet or cloud services.
- All core features must work on a local network (Pi hotspot + connected clients).