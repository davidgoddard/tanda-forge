# Audio Similarity and Recording Management Requirements

Status: **implementation in progress for v0.4.0, informed by a completed
standalone experiment.** The experiment itself is not shipped in the repository;
its proven algorithm and measured results are retained here as design evidence.

## Purpose

Help a DJ identify duplicate recordings, alternate transfers, and performances
of the same composition without relying on titles or artist metadata. The
feature must help the DJ improve library quality and avoid repeating a song in
a playlist while preserving deliberate curatorial choices.

The system must distinguish these concepts:

- **Exact file duplicate:** source files with the same cryptographic content
  hash.
- **Same-recording candidate:** files that appear to contain the same recorded
  performance, possibly with different formats, encodings, gain, metadata, or
  mastering.
- **Same-composition candidate:** different performances that appear to be the
  same musical work, potentially played by different orchestras or under
  different titles.
- **Confirmed relationship:** a candidate relationship accepted by the DJ.
- **Rejected relationship:** a candidate relationship explicitly rejected by
  the DJ and not repeatedly proposed by an unchanged algorithm.

Similarity scores are evidence, not identity. A displayed score rounded to
`1.000` must not be described as an exact duplicate unless the relevant source
file hashes also match.

## Current experimental baseline

The implemented experiment:

1. reads active music tracks from the configured Tanda Forge database in
   read-only mode;
2. applies each track's stored start and end silence trims;
3. decodes audio through FFmpeg to 8 kHz mono signed PCM;
4. reduces every recording to a normalised 128-bin RMS envelope;
5. extracts a 48-by-12 chroma sequence from windowed FFT frames;
6. derives chroma-transition features to reduce false matches between unrelated
   recordings with a similar overall tonal character;
7. creates a compact, dominant-key-normalised vector for candidate indexing;
8. uses deterministic 64-bit random-hyperplane hash bands and a broad duration
   ratio to shortlist pairs;
9. compares envelope shape, the best of 12 chroma rotations, harmonic
   transitions, and the compact vector; and
10. joins above-threshold relationships into candidate groups.

The fixed number of time bins provides useful tolerance for constant speed
differences. Chroma rotation provides key tolerance. The implementation does
not yet use dynamic-time-warping, so local tempo changes, edits, or rearranged
sections remain harder cases.

The first full development-library run processed 2,259 tracks without failures
in 3.1 minutes using two FFmpeg workers. Indexed grouping examined 975,633
candidate pairs in 16.7 seconds and returned 34 relationships in 26 groups. The
DJ listened to and accepted every returned relationship. This is encouraging
evidence for that library, not a general accuracy guarantee.

## Functional requirements

### Analysis lifecycle and report access

- **ASR-001 — Library entry point:** Settings → Library shall provide a clearly
  labelled action that opens a full-page Audio Similarity report.
- **ASR-001A — Post-setup placement:** The report entry point shall appear in a
  dedicated maintenance panel immediately after **Re-parse Stored Metadata**,
  outside the initial folder and resumable setup workflow.
- **ASR-002 — Empty state:** When no completed result exists, the report shall
  explain what analysis does, that it uses local audio, and offer **Generate
  report**.
- **ASR-003 — Regeneration:** A completed report shall offer **Regenerate
  report** with a confirmation explaining whether existing DJ confirmations,
  rejections, and visibility choices will be preserved.
- **ASR-004 — Stale-result state:** The report shall identify results made stale
  by new, changed, removed, or restored tracks or by an analysis-algorithm
  version change.
- **ASR-005 — Incremental analysis:** Normal maintenance shall analyse only new,
  changed, failed, or algorithm-version-stale tracks and then update affected
  relationships. A deliberate full rebuild shall remain available.
- **ASR-006 — Background execution:** Analysis shall be cancellable/resumable,
  display progress and an estimated remaining time when credible, and yield
  resources to live playback.
- **ASR-007 — Failure visibility:** Per-track failures shall not discard
  successful work. The report shall list failures, their knock-on effects, and
  retry actions.
- **ASR-008 — Report summary:** The page shall show analysis date/version,
  tracks considered, tracks failed, candidate relationships, confirmed and
  rejected relationships, unresolved groups, and stale state.
- **ASR-009 — Report filtering:** The DJ shall be able to search by track
  metadata and filter by confidence, relationship type, review state, style,
  hidden status, and whether tracks are used by tandas or playlists.
- **ASR-010 — Auditioning:** Tracks within a candidate group shall be playable
  from the report. Starting one audition shall stop or pause the previous
  audition, and playback shall respect the track's effective trims and normal
  Tanda Forge preview routing.

### Candidate groups and DJ decisions

- **ASR-011 — Revocable approval:** The DJ shall be able to withdraw a previous
  same-recording or same-composition confirmation. Withdrawal shall immediately
  remove the affected equivalence from duplicate indicators, playlist warnings,
  and auto-fill exclusions without changing existing tandas, playlists,
  metadata, files, preferred-version choices, or visibility choices.
- **ASR-012 — Unlink scope and preview:** For a confirmed group larger than two,
  the withdrawal UI shall distinguish unlinking one relationship from
  dissolving the whole confirmed group. Before applying the change it shall
  preview the tracks affected and disclose whether another remaining confirmed
  path would still keep any pair equivalent. The action shall be reversible or
  explicitly confirmable.
- **ASR-013 — Candidate state after withdrawal:** Withdrawing confirmation shall
  return the audio match to an unconfirmed candidate state by default. A
  separate rejection action shall suppress the unchanged candidate according to
  `ASR-023` and `ASR-024`.
- **ASR-014 — Shared group audition position:** Opening a candidate group for
  review shall initialise one shared audition position at `0`, meaning the start
  of each member's effective silence-trimmed audio.
- **ASR-015 — Seek updates group position:** If the DJ seeks or clicks to a new
  position while auditioning one member, that position shall become the shared
  starting position for every track subsequently played in that group.
- **ASR-016 — Duration-normalised mapping:** The shared position shall be stored
  as a proportion from `0` to `1` of the current track's effective trimmed
  duration. Starting another member shall map that proportion to its own
  effective trimmed duration. For example, seeking to 40% of one version starts
  the next version at approximately 40%, even when their absolute durations
  differ.
- **ASR-017 — Audition-position scope:** The shared position shall belong to the
  active group-review session. Opening a different group or reopening the report
  shall default that group's position to zero unless a later explicit
  requirement introduces saved comparison bookmarks.
- **ASR-018 — Start alignment, not synchronisation:** Group auditioning shall
  align the starting area of subsequently played tracks but shall not attempt to
  keep different recordings continuously time-synchronised. The UI shall make
  the shared percentage visible and allow the DJ to reset it to the start.
- **ASR-019 — Flat group model:** Each suspected set of similar tracks shall be
  presented as one flat group. The UI shall not create nested recording groups,
  composition subgroups, or groups within groups. Pair-level relationship type,
  confidence, and evidence may appear in details without changing membership or
  introducing a hierarchy.
- **ASR-020 — Relationship presentation:** Every group shall show why its
  members were grouped, including confidence and whether evidence indicates
  exact-file, same-recording, or same-composition similarity.
- **ASR-021 — Unrounded detail:** The detailed view shall retain sufficient
  score precision for diagnosis even when the normal UI shows a rounded value.
- **ASR-022 — Confirm/reject:** The DJ shall be able to confirm or reject a
  whole relationship and, for groups larger than two, select which members
  genuinely belong together. Marking one or more members as mismatched shall
  detach those members while preserving confirmation among the retained
  members. The review shall preview the resulting flat group or groups before
  applying the decision.
- **ASR-023 — Decision persistence:** Confirmations, rejections, manual splits,
  and manual merges shall survive application restart, incremental analysis,
  backup/restore, and algorithm upgrades unless the DJ explicitly resets them.
- **ASR-024 — Explain changed evidence:** If regenerated evidence conflicts
  with a stored DJ decision, the app shall preserve the decision and flag it for
  review rather than silently reversing it.
- **ASR-025 — No destructive automatic cleanup:** Detection shall never delete
  an audio file, track, tanda, playlist item, or metadata automatically.
- **ASR-026 — Approval activates equivalence:** Confirming a same-recording or
  same-composition relationship shall immediately make that relationship active
  for duplicate/overlap detection. The DJ shall not need to copy metadata,
  choose a preferred version, hide a version, or replace any existing use.
- **ASR-027 — Symmetric linked-track lookup:** If track A is confirmed as linked
  to track B, every duplicate check for A shall find uses of B and every check
  for B shall find uses of A.
- **ASR-028 — Group-wide duplicate semantics:** When the DJ confirms a group as
  one recording or composition, any member shall represent that confirmed group
  for duplicate checking. A tanda or playlist containing any member shall count
  as containing the confirmed recording/composition once.
- **ASR-029 — Explain linked indicators:** A duplicate icon or warning caused by
  a linked version shall identify the actual existing track, its containing
  tanda/playlist where relevant, and the confirmed relationship that caused the
  match. It shall not misleadingly imply that the same track ID was reused.

When a group is corrected, each retained confirmed set of two or more tracks
becomes one flat group. A detached singleton is no longer treated as equivalent
to the retained group. Rejected member-to-group relationships are persisted
under `ASR-023`; they are not silently recreated by unchanged analysis. If the
DJ later revisits the decision, the same review UI shall allow the member to be
accepted into a group again after preview and confirmation.

### Metadata comparison and transfer

- **ASR-030 — Side-by-side metadata:** A group shall compare title, artist,
  artist summary, singer, album, year, BPM, style, notes, instrumental state,
  duration, trims, loudness/gain, source path, and file type for every member.
- **ASR-031 — Difference emphasis:** Equal values shall be visually de-emphasised
  and differing or missing values highlighted without implying which value is
  correct.
- **ASR-032 — Field-level transfer:** The DJ shall be able to copy selected
  editable metadata fields from one track to one or more other members without
  replacing audio or track identity.
- **ASR-033 — Transfer preview:** Before applying metadata, the app shall show
  source, destination, fields changing, old values, and new values.
- **ASR-034 — Protected technical fields:** File identity, analysis results,
  paths, duration, trims, loudness, and other source-derived fields shall not be
  overwritten through ordinary metadata transfer unless a dedicated workflow
  explicitly supports that field.
- **ASR-035 — Undoability:** Metadata transfers shall be undoable within the
  session or otherwise require an explicit confirmation that describes how to
  recover the prior values.
- **ASR-036 — Track-column comparison table:** Metadata comparison shall use a
  wide table with attribute names in a fixed left column and one subsequent
  column per matched track/file. Track headers shall remain identifiable while
  scrolling horizontally.
- **ASR-037 — Replicate-cell action:** Selecting an editable value in the table
  shall offer to replicate that value to all other tracks in the group. The
  confirmation shall name the attribute, source track/value, destination
  tracks, and every value that will change; the DJ may cancel without mutation.
- **ASR-037A — Immediate comparison refresh:** After a metadata copy succeeds,
  the open comparison table shall be rebuilt from the persisted report so every
  changed value and equal/different highlight is immediately accurate.
- **ASR-038 — Track provenance in headers:** Each track column/header shall show
  title and artist plus enough provenance to distinguish files: album when
  available and the source path through visible secondary text, expansion, or a
  tooltip/details action.
- **ASR-039 — Initial report design:** The first integrated report shall retain
  the demonstrated static report's visual structure: searchable confidence-
  ranked group cards, one-at-a-time audition controls, confidence/count badges,
  and expandable comparison detail, extended with review and metadata actions.
  It shall open as a full-page in-app working view from Settings → Library, not
  as a modal, and provide a clear action to return to Library Settings.
- **ASR-039A — On-demand group detail:** The initial group card shall remain a
  compact summary. Metadata comparison and affected-tanda contents shall be
  created only when requested and shown in closable overlays, so a large report
  does not render every detail table and tanda up front.
- **ASR-039B — Matched-member selection:** Each candidate member shall use a
  clearly labelled checkbox indicating whether it will be included when the DJ
  confirms the same recording or composition. A partial confirmation shall
  retain the excluded members as unmatched, and reopening the report shall
  restore checked state from the persisted confirmed group.
- **ASR-039C — Persistent group disclosure:** Every candidate heading shall
  provide collapse/expand control, track or matched-member count, and confirmed
  state. Collapsed group IDs shall persist across report and application reopen.
- **ASR-039D — Group distinction:** Adjacent candidate groups shall use strong,
  accessible border/header colour variation in addition to card spacing, while
  confirmation shall be shown with a textual **Confirmed Match** tag.

### Recording quality and use in tandas

- **ASR-040 — Usage discovery:** Each track and group shall show every tanda,
  saved playlist, current playlist position, and other persisted reference that
  uses it.
- **ASR-040A — Affected-tanda overlay:** The compact group shall show the number
  of distinct affected tandas. Opening it shall show each tanda once, its full
  track context with matched versions visually highlighted, preview controls,
  and an explicit radio list of available group recordings for each matched
  position. The current recording shall be checked and visually highlighted;
  selecting another shall confirm and persist that replacement. The overlay
  header shall remain fixed and its content shall scroll within a viewport-
  bounded body when many tandas are present; the window shall not grow without
  bound.
- **ASR-041 — Per-use replacement:** The DJ shall be able to replace one group
  member with another in a selected tanda without forcing replacement in every
  other tanda or playlist.
- **ASR-042 — Bulk replacement is explicit:** A separate bulk action may replace
  a version across selected references, but it shall preview every affected
  tanda/playlist and require confirmation.
- **ASR-043 — Tanda-context audition:** Before replacing a tanda track, the DJ
  shall be able to audition the candidate alongside the tanda's neighbouring
  tracks using the normal effective trims, gain handling, and preview output.
- **ASR-044 — Contextual comparison:** The replacement UI shall show properties
  that may affect tanda cohesion, including orchestra/artist, period/year,
  singer/instrumental state, BPM, style, loudness/gain, duration, album/path,
  and file type. These are contextual facts, not a quality ranking.
- **ASR-045 — No automatic quality assumption:** Format, bitrate, sample rate,
  file size, or newer mastering shall not by itself declare one version better.
  The DJ remains responsible for judging whether a clean/bright or historical/
  scratchy recording fits the tanda.
- **ASR-046 — Referential safety:** Replacement shall preserve tanda position
  and validity where possible, recompute dependent duration/readiness state,
  and clearly report any playlist or tanda consequence.
- **ASR-047 — Audition isolation:** Auditioning during review shall not alter the
  current live-playback position, mark tracks as played, or change playlist
  timing/state.

The replacement UI is scoped to each matching tanda position. It identifies the
current recording and lets the DJ select a confirmed alternative after
listening to the complete context.

### Search visibility and library curation

- **ASR-050 — Hide system-wide:** The DJ shall be able to hide an
  unwanted version system-wide without deleting the file or silently rewriting
  tandas/playlists that already reference it.
- **ASR-051 — Reversible visibility:** Hidden versions shall remain discoverable
  from the similarity report and an explicit hidden-tracks view and shall be
  restorable.
- **ASR-052 — System-wide exclusion:** A hidden track shall be excluded from all
  ordinary library/search results, clipboard/collection suggestions, tanda-
  construction candidates, recommendations, playlist-add choices, and manual or
  automatic playlist generation. This is one global state, not separate hide
  scopes.
- **ASR-053 — Preferred version:** A confirmed group may have a DJ-selected
  preferred version used as the default suggestion, without automatically
  replacing existing references.
- **ASR-054 — Missing preferred version:** If a preferred file becomes
  unavailable, the app shall retain the relationship and offer available group
  members rather than silently choosing a substitute.
- **ASR-055 — Existing-reference integrity:** Hiding shall not silently delete
  the track from existing tandas or saved/current playlists. The hide
  confirmation shall identify those uses; tandas containing the hidden track
  shall not be offered for new playlist selection until the DJ replaces,
  restores, or explicitly allows that hidden use.
- **ASR-056 — Hidden-track management:** Hidden tracks and affected existing
  references shall remain accessible only through explicit management/review
  views so the DJ can restore, replace, or deliberately retain them.
- **ASR-057 — No inferred quality:** The application shall not score, label, or
  recommend one matched track as higher quality merely from container, codec,
  bitrate, sample rate, file size, age, noise, or mastering measurements. The DJ
  decides by listening in context.
- **ASR-058 — Informational file-type lozenge:** Each track in the report,
  comparison table, and replacement workflow shall show a small, neutral file-
  type lozenge such as `MP3`, `FLAC`, or `WAV`. Its styling shall not imply a
  quality hierarchy.
- **ASR-059 — No hidden-track leakage:** Generic counts, random selection,
  auto-fill fallback, empty-result relaxation, and similar secondary paths
  shall apply the same global hidden exclusion and shall not reintroduce a track
  because preferred candidates are exhausted.

### Playlist protection and generation

- **ASR-060 — Playlist relationship index:** Duplicate checks shall use
  confirmed same-recording and same-composition relationships in addition to
  exact track IDs and titles.
- **ASR-061 — Non-blocking manual addition:** Duplicate or related-song overlap
  shall never block, prompt, or require confirmation when the DJ manually adds a
  track or tanda to the playlist. Manual insertion expresses intent and shall
  complete normally.
- **ASR-062 — Post-add visual overlap:** Once present, every overlapping track
  or tanda shall show the existing full/partial duplicate icon according to
  exact track IDs and confirmed relationship groups. The icon and tooltip shall
  explain the actual matching versions and locations.
- **ASR-063 — Tanda-level indication:** Candidate tandas shall distinguish a
  whole-tanda duplicate from partial overlap and identify every related song
  causing the overlap.
- **ASR-064 — Current-playlist review:** The playlist shall support a review that
  reports related recordings/compositions already present even when their
  titles and orchestras differ.
- **ASR-065 — Auto-fill exclusion:** Automatic playlist generation shall not add
  a track whose confirmed same-composition group is already represented in the
  generated playlist, unless an explicit rule permits intentional repetition.
- **ASR-066 — Candidate uncertainty:** Unconfirmed high-confidence candidates
  may produce a passive visual indication after manual addition, but shall not
  produce an add-time prompt. Only confirmed relationships or a deliberately
  configured confidence policy shall act as hard auto-fill exclusions.
- **ASR-067 — Rejection respected:** Relationships rejected by the DJ shall not
  trigger playlist duplicate warnings or auto-fill exclusions unless materially
  changed evidence is explicitly flagged for review.
- **ASR-068 — Override auditability:** A deliberate duplicate override shall be
  visible through the continuing duplicate icons so the DJ can distinguish and
  inspect the overlap without being interrupted while adding it.
- **ASR-069 — Universal duplicate indicators:** Existing duplicate indicators
  on search results, library/clipboard tracks, tandas, and playlist rows shall
  resolve confirmed relationship groups. For example, if searched track A is
  confirmed equivalent to track B already used by a tanda or playlist, A and
  its containing candidate tanda shall show the appropriate duplicate/partial-
  overlap state based on B. Activating a tanda duplicate indicator shall expand
  the destination playlist tanda and temporarily highlight both the tanda and
  every track responsible for the overlap, including confirmed equivalents.
- **ASR-069A — Press-and-hold duplicate focus:** Pressing and holding a duplicate
  icon shall, after a deliberate hold threshold, persistently filter the
  playlist to every tanda or standalone track containing at least one selected
  song/relationship-group match. Matches from one candidate tanda may therefore
  retain several different playlist tandas. Applying the focus shall expand the
  first matching tanda as needed and scroll its exact matching track into view.
  Releasing the pointer or key shall retain the focused view until the DJ uses
  the localized **Show all** action or dismisses it with Escape.
- **ASR-069B — Focus interaction safety:** A short click shall retain the
  existing duplicate-icon behaviour. Press-and-hold shall preserve playlist
  order and state, shall not start playback or drag/reorder an item, and shall
  have an equivalent keyboard-accessible interaction. Pointer cancellation or
  focus loss before the hold threshold shall cancel the pending interaction
  without unexpectedly changing an already active focused view. The focused-
  view status and **Show all** control shall occupy their own interactive layout
  row above the playlist and shall not pass input through to playlist items.

### Persistence, security, and compatibility

- **ASR-070 — Versioned analysis:** Persisted comparable features and scores
  shall include algorithm and parameter versions so incompatible results can be
  invalidated deterministically.
- **ASR-071 — Local processing:** Audio feature extraction and matching shall
  operate locally and shall not upload audio or fingerprints without a separate,
  explicit future requirement and consent flow.
- **ASR-072 — Backup lifecycle:** Features, relationships, DJ decisions,
  preferred/hidden choices, and review state shall participate in system export,
  import, reset, relocation, and integrity verification.
- **ASR-073 — Track lifecycle:** Removal, deletion, restoration, root removal,
  rescanning, and path changes shall update similarity state without leaving
  misleading active relationships.
- **ASR-074 — Resource bounds:** Background analysis shall use host-controlled
  concurrency and memory limits and shall not compromise live playback.
- **ASR-075 — Worker isolation:** Analysis failures or native-tool crashes shall
  not crash the renderer, main process, or playback engine.
- **ASR-076 — Internationalisation:** All integrated visible text shall come from
  the application language maps.
- **ASR-077 — Accessibility:** Reports, comparison controls, warnings, audition
  controls, and replacement workflows shall be keyboard-operable and expose
  meaningful accessible names and state.

### Release-completion workflows

- **ASR-078 — Exact located-track feedback:** Navigating from a duplicate search
  result shall expand and scroll to the containing playlist tanda and briefly
  outline the actual stored track with visible space between the outline and
  the row content. Confirmed equivalent IDs shall be resolved
  without relying on title or artist text, and reduced-motion preferences shall
  be respected. Tanda-level duplicate navigation shall canonicalize candidate
  and playlist track IDs through confirmed relationship groups for both full
  and partial overlap before locating the target row.
- **ASR-079 — Single similarity audition state:** Similarity report playback
  controls shall share one active preview state. Starting, ending, failing, or
  leaving playback shall restore every inactive control to Play.
- **ASR-080 — Familiar affected-tanda presentation:** Affected tandas shall use
  the normal ordered tanda-track visual language without unrelated edit menus,
  and shall expose a play control for every constituent track.
- **ASR-081 — In-context recording comparison:** Each affected use shall show
  compact artist/title/album summaries for confirmed alternatives, identify and
  highlight the current recording, and safely persist an available alternative
  into the same position with immediate refresh and failure feedback.
- **ASR-082 — Choice before tanda insertion:** Adding a track from Search or a
  Clipboard collection shall offer all available, non-hidden members of its
  confirmed group for audition and selection before mutation. Cancellation
  shall make no change; suspected candidates shall not be offered.

### Relationship and assignment refinement

- **ASR-083 — Compact detail actions:** Metadata and affected-tanda controls
  shall be compact, content-width controls on one line when space permits.
- **ASR-084 — Metadata difference summary:** Each group shall name differences
  in artist, title, singer, BPM, notes, and year without requiring the metadata
  table to be opened.
- **ASR-085 — Relationship hierarchy:** The review model shall distinguish
  byte-identical files, the same captured performance in a different transfer
  or quality, a different performance by the same orchestra, and the same
  composition performed by another orchestra.
- **ASR-086 — Assignment choice:** Tracks the DJ explicitly confirms as
  identical and interchangeable shall have one DJ-elected master version. The
  app may silently resolve that identical group to its master. Alternate
  recordings, remasters, cleaned transfers, different performances, and
  same-composition alternatives not confirmed as identical shall remain an
  explicit choice so that tanda sound character is preserved.
- **ASR-087 — Optional activation:** A library that has never generated a
  similarity report, or has no confirmed relationships, shall retain normal
  search, tanda, playlist, auto-fill, and playback behavior without warnings,
  substitutions, prompts, or errors from the similarity feature.
- **ASR-088 — Visual shared audition:** Each candidate track shall show its
  cached waveform beneath its identity/path. Clicking or keyboard-adjusting a
  waveform shall set the group-wide relative audition position, update the
  percentage and every group playhead, seek an active comparison preview, and
  start subsequent previews at the corresponding relative point. Missing
  waveforms shall fail visibly without blocking review.
- **ASR-089 — Collapsed title summary:** The group heading shall list the
  distinct candidate titles alongside its matched/total count. Titles shall be
  deduplicated case-insensitively and remain visible while the group is
  collapsed.
- **ASR-090 — Required-master prompt:** If the DJ confirms identical versions
  without first electing a master, the action shall open an explanatory master
  chooser over the report. Apply shall remain disabled until one of the
  included tracks is selected; selection shall then continue into the normal
  confirmation rather than failing silently.
- **ASR-091 — Assignment picker conventions:** The confirmed-alternative picker
  shall present one row per track with a selection radio, the standard headphone
  audition control using normal headphone routing/state, and track details.
  It shall not show per-row Play or Use buttons. Cancel and Apply shall appear
  together in the footer, with Apply resolving the selected radio choice.
- **ASR-092 — Canonical candidate edges:** Analysis shall normalize every
  candidate pair into canonical track-ID order at the persistence boundary,
  including the rejection lookup, so arbitrary database row order cannot fail
  the report with a pair-order CHECK constraint error.
- **ASR-093 — Hidden-track placement:** The reversible hidden-track management
  section shall appear after all visible candidate and confirmed-group content.
- **ASR-094 — Audition stops main output:** Starting any similarity audition,
  including report, affected-tanda, and confirmed-alternative picker playback,
  shall first stop active main-output playback using the configured stop fade.
- **ASR-095 — Compact rejection action:** An unreviewed candidate edge shall
  use the localized short label **No match** without repeating track titles.
  Confirmation may retain the two track identities.
- **ASR-096 — Full metadata editing:** Every track column in metadata comparison
  shall provide a localized Edit action that opens the normal track editor.
  The comparison overlay shall remain mounted behind the editor, and a
  successful save shall refresh that overlay from the updated report.
- **ASR-097 — Localized, theme-compatible overlays:** Every integrated
  similarity label shall exist in all seven supported language maps with
  compatible interpolation parameters. Similarity overlays shall derive text,
  panel, accent, selection, border, and focus colours from the active app theme.
- **ASR-098 — Relaxed comparison spacing:** Metadata and affected-tanda
  overlays shall provide clear vertical and horizontal separation around
  headings, choices, playback controls, track rows, and footer actions.
- **ASR-099 — Outstanding-first report:** The report shall show candidate
  groups with pending relationships in a clearly counted **To review** section.
  Confirmed groups and candidate groups whose relationships have all been
  rejected shall move into a separately counted, localized disclosure panel
  that is closed by default. Partially reviewed groups with any pending edge
  shall remain in **To review**, and hidden-track management shall remain last.

## Validation requirements

- **ASV-001 — Labelled corpus:** Thresholds and candidate indexing shall be
  evaluated against a representative labelled corpus containing exact copies,
  transcoded copies, remasters, speed/key changes, historical transfers,
  different-orchestra performances, same-orchestra different songs, and known
  non-matches.
- **ASV-002 — Recall measurement:** Indexed results shall be compared with
  exhaustive comparison on a manageable labelled subset to quantify candidates
  lost during shortlisting.
- **ASV-003 — False-positive review:** Validation shall specifically include
  stylistically homogeneous albums/orchestras and common tango forms.
- **ASV-004 — Workflow tests:** Automated tests shall cover report generation,
  decisions, metadata transfer, hiding/restoring, per-tanda replacement,
  playlist warnings, override handling, and auto-fill exclusion.
- **ASV-005 — Performance evidence:** Release readiness shall include measured
  extraction, incremental-update, report-query, and playlist-check timings on a
  realistically sized library and supported low-spec hardware.
- **ASV-006 — Playback safety:** Tests shall prove that analysis does not
  interrupt live playback, and that explicit similarity audition controls stop
  main-output playback before starting their preview without advancing or
  otherwise mutating playlist position.

## Product principle

The feature supplies evidence and safe bulk tools, while the DJ retains control
over metadata, preferred recordings, tanda character, and intentional playlist
choices. Suspected matches remain simple, flat groups even when individual
pairs have different evidence or relationship classifications.

Approval alone is nevertheless an operational decision: once the DJ confirms a
relationship, its linked tracks participate in duplicate indicators and
playlist protection even if the DJ performs no cleanup or curation action.
That operational decision remains reversible; withdrawing it removes those
linked-track effects while leaving the DJ's existing library arrangements
untouched.
