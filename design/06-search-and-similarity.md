# Search and Similarity

Requirement identifiers: All requirement bullets in this document are
identified as `FR-<section>.R<n>` or `NFR-<section>.R<n>` in order under each
section. Sub-bullets use `.<letter>` suffixes.

This document defines how search, sorting, navigation, and similarity work in
Tanda Player Lite. Search is a primary interaction model and must remain fast,
fault-tolerant, and consistent across devices.

## FR-089 — Search Fundamentals

- FR-089.R1: Tracks and tandas are first-class results.
- FR-089.R2: Search must support very large libraries (tens of thousands of tracks).
- FR-089.R3: Search must include user-defined metadata fields.
- FR-089.R4: Search must support context-specific actions (e.g. build tanda vs live DJ).
- FR-089.R5: Search must provide predictable ordering and navigation.

---

## NFR-020 — UTF-8 and Filename Integrity

The system must correctly handle UTF-8 throughout the pipeline:

- NFR-020.R1: USB mount configuration must preserve:
  - NFR-020.R1.a: UTF-8 characters in filenames.
  - NFR-020.R1.b: Long filenames.
- NFR-020.R2: The backend must treat file paths and metadata as UTF-8 end-to-end.
- NFR-020.R3: The UI must render UTF-8 characters without loss or replacement.

This includes:
- NFR-020.R4: Track titles, artist/orchestra, notes, and any user-entered fields.
- NFR-020.R5: File paths displayed in diagnostics.

NFR-020.R6: No lossy fallback encodings are permitted.

NFR-020.R7: UI language selection must not limit storage or display of multilingual text.
NFR-020.R8: All UI labels are sourced from a language map; user data and tags are not
translated.

---

## FR-090 — Search Scope and Types

### FR-090.1 Search Targets
Search must support:
- FR-090.1.R1: Track search.
- FR-090.1.R2: Tanda search.

UI presentation:
- FR-090.1.R3: Results are presented in separate tabs (or equivalent grouping) for Tracks and Tandas.

Current implementation note: Track search is paged with bidirectional loading,
and tanda search returns full matching rows without pagination.

### FR-090.2 Field Coverage
Search applies to all searchable fields including:
- FR-090.2.R1: Standard fields (title, artist/orchestra, singer, year, BPM, notes, etc.).
- FR-090.2.R2: User-defined text fields (e.g. Notes, Sound, Tags, Comments).
- FR-090.2.R3: Aliases and nicknames (see FR-094).

Tanda search applies to:
- FR-090.2.R4: Tanda name.
- FR-090.2.R5: Style(s).
- FR-090.2.R6: Rating.
- FR-090.2.R7: Instrumental flag.
- FR-090.2.R8: Any track metadata for tracks within the tanda.

Current implementation note: Tanda search matches name, styles, and track metadata
via SQL `LIKE`. Rating/instrumental filtering is not yet implemented.

Numeric fields (e.g. BPM, year) may be searchable both:
- FR-090.2.R9: As text (simple).
- FR-090.2.R10: As ranges (advanced feature; define later).
- FR-090.2.R11: Invoking "Search similar" from a track should set style via the
  style-pill filter (not as query text) and include artist/summary, singer, year,
  BPM, and notes in the query text (excluding title and album).

---

## FR-091 — Fuzzy, Fault-Tolerant Search

### FR-091.1 Matching
Search must tolerate:
- FR-091.1.R1: Partial terms.
- FR-091.1.R2: Word order differences.
- FR-091.1.R3: Minor spelling errors.

FR-091.1.R4: The search algorithm must produce a relevance score and rank results by score.

FR-091.1.R5: The fuzzy matcher uses normalized trigram (3-gram) overlap across all
textual fields (title, artist, singer, album, genre, notes).
FR-091.1.R6: A configurable minimum score determines which matches are returned.
FR-091.1.R7: When trigram scores are close, apply a token-level edit-distance bonus
to prefer the closest word match (e.g., `francico` → `Francisco`).

### FR-091.4 Implicit Query Parsing and Profiles

- FR-091.4.R1: The single query box must be token-aware and parse implicit intents
  without requiring field prefixes.
- FR-091.4.R2: Four-digit numeric tokens in a configured year range are treated
  as year intent.
- FR-091.4.R3: Two- or three-digit numeric tokens that are not valid years are
  treated as tempo intent.
- FR-091.4.R4: Style tokens (`Tango`, `Milonga`, `Vals`/`Waltz`) are treated as
  style intent.
- FR-091.4.R5: Remaining tokens are treated as text intent.
- FR-091.4.R6: If year/tempo/style intent exists, use a similarity ranking
  profile; otherwise use a lookup ranking profile.
- FR-091.4.R7: Only requested intent dimensions are weighted; weights are
  renormalized per-query.
- FR-091.4.R8: Year and tempo intent use proximity scoring curves and configurable
  missing-metadata fallback scores.
- FR-091.4.R9: Style chip selection remains a hard filter gate; style text tokens
  in the query influence ranking even when no style chip is set.
- FR-091.4.R10: Quoted phrases in the query are treated as explicit phrase intent
  and boost lookup ranking for matching title/artist text.
- FR-091.4.R11: Very short text-only queries with two tokens default to
  similarity profile to better support orchestra-led tanda building.
- FR-091.4.R12: Score ties in relevance ordering are broken with deterministic
  component ordering: artist score, style score, tempo proximity, year proximity,
  then title score.

## FR-092 — Similarity Search Shortcuts

Quick-search actions should launch related-track searches from existing content.

- FR-092.R1: Track rows provide an S action that fills the search box with a related query.
- FR-092.R2: Tanda rows provide an S action that fills the search box based on its tracks.
- FR-092.R3: Similarity queries should favor artist and title signals over generic metadata.
- FR-092.R4: Similarity actions always target the track search tab (not tanda search).

### FR-091.2 Numeric Search
- FR-091.2.R1: A numeric-only query with 4 digits is treated as a year search.
- FR-091.2.R2: A numeric-only query with fewer than 4 digits is treated as a BPM search.
- FR-091.2.R3: BPM search matches within a configurable ± range (default 5 BPM).
- FR-091.2.R4: BPM matches within range are treated as full matches regardless of
  the global min-score threshold.
- FR-091.2.R5: Numeric matches are scored and ranked like text matches for year queries.

### FR-091.3 Accent Handling (Diacritics)
Search must support a configurable accent/diacritic strategy:

Default behavior:
- FR-091.3.R1: Accent-insensitive matching is enabled (e.g. accents ignored).
- FR-091.3.R2: Display remains accent-correct (no normalization of stored text).

Rationale:
- FR-091.3.R3: Many users type without accents on mobile keyboards.
- FR-091.3.R4: DJs need recall more than orthographic precision.

Optional behavior:
- FR-091.3.R5: Accent-sensitive matching can be enabled in configuration for users who prefer it.

---

## FR-095 — Tokenization and Ignored Phrases

The system must support token rules to improve search quality and ordering.

### FR-095.1 Ignored Phrase List
A configurable ignore list may remove non-informative suffixes/prefixes from
matching and/or ordering.

Example:
- FR-095.1.R1: “X and his orchestra” may ignore “and his orchestra” for ordering and scoring,
  so that results cluster naturally under the canonical artist name.

### FR-095.2 Nicknames and Common Name Variants
A small alias list must support known nicknames or leader-name variants,
so that searches for nicknames match the canonical orchestra/artist.

This alias list is separate from the general alias system in FR-094 and may be
hand-curated.

---

## FR-093 — Ranking and Ordering

### FR-093.1 Relevance Rank
FR-093.1.R1: Default ordering is by search score (descending).
FR-093.1.R2: When the search query is empty, default ordering is by title (ascending).
FR-093.1.R3: Changing the search query resets sorting to relevance unless the user
  explicitly selects a column sort.

### FR-093.2 Stable Secondary Ordering
When scores tie or are close, ordering must be stable and predictable using a
consistent secondary key order, for example:
1. canonical artist/orchestra
2. title
3. year (if present)
4. file path (as a last resort for determinism)

FR-093.2.R1: Ignored phrases (FR-095.1) must not distort ordering.
FR-093.2.R2: Jump index is available only when ordering is by a column (not by relevance).

### FR-093.3 Column Sorting (UI)
Track results are shown in a grid/table with sortable columns.

Column sort toggles in three states:
1. Ascending
2. Descending
3. None (revert to default ordering)

FR-093.3.R1: Sorting must define a stable total order suitable for cursor-based paging.

FR-093.3.R2: Sorting must apply to the entire result set, not only visible rows.

Current implementation note: Artist sorts use `artist_summary` as the primary key
and `artist` as secondary to avoid noisy orchestra suffixes.

---

## FR-094 — Alias Metadata Source

The system must support a metadata file or dataset of aliases for artist/orchestra
names.

Requirements:
- FR-094.R1: Canonical name ↔ alias mapping.
- FR-094.R2: Multiple aliases per canonical name.
- FR-094.R3: Aliases included in search matching and ranking.
- FR-094.R4: Canonical name displayed in UI by default (configurable).

This improves spelling tolerance, variant naming across different sources/files,
and consistent clustering in results.

---

## FR-095 — Language Expectations

The system is not required to perform cross-language semantic translation
(e.g. searching English words should not automatically match Spanish words).

However:
- FR-095.R1: The system must not prevent users from entering multilingual notes.
- FR-095.R2: Search operates over the literal tokens and aliases available offline.

Future enhancements (optional):
- FR-095.R3: Local (on-device) language models may be added later for semantic expansion,
  but must be explicitly enabled and must not require internet connectivity.

---

## FR-096 — Large Result Sets, Incremental Loading, and Smooth Scrolling

Search must support very large libraries and large result sets.

Requirements:
- FR-096.R1: Results must be retrievable incrementally (paged, cursor-based, or streamed).
- FR-096.R2: The UI must render results using virtualization (windowing) to keep the DOM small.
- FR-096.R3: Scrolling must remain smooth on phones, tablets, and desktops.
  The renderer must lazily render rows and never mount the full list at once.
- FR-096.R4: Incremental loading must work in both directions when jumping.

FR-096.R5: The UI must not require loading all rows into memory at once.

Current implementation note (planned): Bidirectional paging with lazy loading is
implemented. DOM windowing/virtualization is still planned and not yet implemented.

### FR-096.1 Bidirectional Scrolling
The UI must allow users to scroll forward and backward through the result set,
regardless of how results are loaded.

Example:
- FR-096.1.R1: A user may jump to “Z” and then scroll upward back through “Y”, “X”, … to “A”
  without confusing discontinuities.

This implies the backend must support fetching results both:
- FR-096.1.R2: after a given position.
- FR-096.1.R3: before a given position.
(using a stable ordering key).

---

## FR-097 — Quick Navigation Index and Jumping

Track search results must provide a quick navigation index aligned to the
current sort column.

### FR-097.1 Index Coverage
FR-097.1.R1: The quick navigation index must represent the entire result set, not only the
currently loaded/visible window. It must be obtainable from the local data
service (main process) even if the UI only has a small subset of rows loaded.

### FR-097.2 Ordering of Index Keys
The index key ordering must be:
- FR-097.2.R1: Numbers first (0–9).
- FR-097.2.R2: Then letters (A–Z).
- FR-097.2.R3: Then any remaining characters (implementation-defined, but stable).

### FR-097.3 Jump Behavior
FR-097.3.R1: Clicking an index key jumps to the first result row whose normalized sort key
begins with that prefix.

FR-097.3.R2: The index is rendered as a horizontal bar above the result list.

After jumping:
- FR-097.3.R3: The UI must allow normal scrolling in both directions across adjacent prefixes.
- FR-097.3.R4: The UI must be able to load preceding/following pages as the user scrolls.

### FR-097.4 Index Updates
The index must update whenever:
- FR-097.4.R1: the query changes.
- FR-097.4.R2: the sort column changes.
- FR-097.4.R3: the sort direction changes.
- FR-097.4.R4: filters change.

FR-097.4.R5: The index must remain consistent with the data service’s authoritative ordering.

---

## FR-098 — Context-Specific Row Actions (Menus)

Search results are used in multiple contexts. Rows may expose a context menu
with actions appropriate to the calling page.

Example actions:
- FR-098.R1: “More like this”.
- FR-098.R2: “More by this artist/orchestra”.
- FR-098.R3: “More with this title”.
- FR-098.R4: “Add to current tanda” (build-tanda context).
- FR-098.R5: “Add tanda to playlist” (playlist-building context).
- FR-098.R6: “Replace at boundary” (cortina selection context).

Rules:
- FR-098.R7: Actions must be consistent in naming and placement.
- FR-098.R8: Actions must not appear in Performance Mode if they can disrupt playback
  (UI-001, UI-002).

FR-098.R9: When a tanda is actively selected in the Tanda Designer, search results and the
clipboard are immediately filtered by the tanda's style(s) to prevent mismatches.

---

## FR-099 — Click Behavior by Mode and Context

Click/tap behavior must obey mode safety:

Preparation Mode:
- FR-099.R1: Clicking a track row may start preview playback (UI-010).
- FR-099.R2: Clicking a tanda row does not start live playback.

Performance Mode:
- FR-099.R3: Clicking rows must never start playback.
- FR-099.R4: Only dedicated playback controls may start/stop playlist playback (UI-013).

---

## FR-100 — Similarity Search

### FR-100.1 Similarity Inputs
Similarity may use:
- FR-100.1.R1: Standard metadata fields (artist/orchestra, singer, year, BPM, etc.).
- FR-100.1.R2: User-defined musical properties (manual vectors).
- FR-100.1.R3: Future derived vectors (ML-based), without changing the UI abstraction (UI-030).

### FR-100.2 Similarity Queries
The system must support:
- FR-100.2.R1: “Find more like this track”.
- FR-100.2.R2: “Find more like this tanda”.
- FR-100.2.R3: “Find compatible tracks for building a tanda of size N”.

### FR-100.3 Year as a First-Class Similarity Dimension
Year must be supported as a similarity dimension and may be weighted heavily
if configured.

This must be:
- FR-100.3.R1: configurable.
- FR-100.3.R2: visible in configuration.
- FR-100.3.R3: reflected in similarity ranking behavior.

---

## FR-101 — Result Annotation in Playlist Context

When viewing search results in the context of a current playlist, results must
show additional information to help avoid repetition and unintended bias.

Must support indicators such as:
- FR-101.R1: Track already used in this playlist.
- FR-101.R2: Track used in recent playlists (optional scope).
- FR-101.R3: Artist/orchestra density warnings (nudge, not enforcement).

FR-101.R4: These indicators must be informational and must not block selection unless
explicit rules are enabled.

---

## UI Component References

Search and similarity rely on these reusable UI components: UI-010 Track Row
Component, UI-011 Tanda Row Component, UI-030 Similarity Visualization Component,
UI-013 Playback Control Component, and UI-080 Scratch Pad Component (when search
feeds editing workflows).

---

## Notes on Implementation Strategy (Non-binding)

This document specifies behaviors, not technologies.
Implementation may use n-gram / token-based scoring, indexed full-text search,
or hybrid approaches.

However:
- FR-102.R1: Results must remain deterministic and stable under the same inputs.
- FR-102.R2: The system must not depend on the public internet or cloud services.
- FR-102.R3: All core features must work on a local network (Pi hotspot + connected clients).
