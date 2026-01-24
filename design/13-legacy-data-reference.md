# Legacy Data Reference (Sizing and Types)

## Purpose

These notes summarize observed structures from the legacy data files. They are
used for sizing, types, and migration assumptions. They do not imply a strict
requirement to preserve every field.

Files:
- `design/legacy/library.dat`
- `design/legacy/tandas.dat`
- `design/legacy/playlists.dat`
- `design/legacy/cortinas.dat`
- `design/legacy/config.js`
- `design/legacy/similar.js`

## Library Entries (`library.dat`)

Top-level structure: object keyed by relative file path.

Each entry includes:
- `track`: parsed tags and file metadata
  - `filename`, `artist`, `title`, `album`
  - `album_artist` (optional)
  - `date` (original release date; string or year)
  - `genre`, `composer`, `grouping`, `comment` (optional)
  - `duration` (seconds, float)
  - `creation_time` (timestamp)
  - `os_date_created` (timestamp string)
  - `date_added` (timestamp string)
- `analysis`: derived values
  - `duration` (seconds, float)
  - `silence` (seconds, float)
  - `start` (seconds, float)
  - `gain` (float)
  - `meanGain` (float)
  - `embeddedImage` (bool)
  - `estimated` (bool), `checked` (bool)
  - `error` (string or null)
- `classifiers`: user-defined properties (see `config.js`)
- `artists`: array of normalized artist strings
- `sortArtist`, `sortTitle` (uppercase)
- `hideFromTandaPlayer`, `hideFromAutoDJ` (bool)
- `libraryIdx` (number)
- `tandas`, `titleTandas` (counts)
- `id` (legacy numeric ID)
- `classified`, `newlyClassified` (bool)
- `lastPlayed` (timestamp)

## Cortinas (`cortinas.dat`)

Structure mirrors `library.dat` but limited to cortina tracks. Fields align
with `track` and `analysis`, plus `libraryIdx` and `missing`.

## Tandas (`tandas.dat`)

Array of tanda objects:
- `id` (number or "N/A" for auto)
- `label`, `description`
- `style` (string)
- `instrumental` (bool)
- `tracks` (array of file paths)
- `invalid` (bool)
- Optional:
  - `duration` (seconds, float)
  - `firstTrack` (index)
  - `cortina` (array of `{ track, duration, filter }`)
  - `lastPlayed` (timestamp)
  - `playCount` (number)
  - `rating` (number)

## Playlists (`playlists.dat`)

Array of playlist objects:
- `name`, `pattern`, `createdDate`, `lastSaved`
- `autoPlay`, `autoSave`, `savedAsRules` (bool)
- Timing:
  - `trackSpacing` (seconds)
  - `preCortinaSpacing` (seconds)
  - `postCortinaSpacing` (seconds)
  - `start` / `endTime` (seconds from midnight)
  - `autoDJCortinaDuration` (seconds)
- `useCortina` (string, e.g. "Boogie", "None")
- `tandas` (array; sometimes full embedded tanda objects)
- `rules` (object)
  - `requiredDurationHours`, `artistRepeatHours`, `tandaRepeatDays`
  - `avoidPlaylists` (array)
  - `pattern`, `sameArtist`, `sensitivity`
  - `useSongsInTandas`, `rule`

## Config (`config.js`)

Global settings including:
- Volumes and fades: `initialVolume`, `masterVolume`, `cortinaVolume`,
  `volumeFadeRate`, `trimFadeRate`, `stopFadeRate`
- EQ: `masterEQ.gain` and `masterEQ.settings` (10-band)
- Auto DJ defaults: `autoDJhours`, `autoDJsameArtist`, `autoDJCortinaDuration`
- UI display options: show/hide track info, artwork placement
- Classifier definitions: list of properties with types
  - `slider` (1..N), `list`, `multichoice`, `tickbox`, `text`
  - Each includes `defaultValue` and labels for UI

## Implications for New Model

- Durations are stored as floats in seconds; new model should store milliseconds
  for precision, with conversion at ingest.
- Auto-generated tandas are mixed with saved tandas; new model should allow a
  `source` or `is_generated` flag.
- Classifiers are configurable; new model should store classifier definitions
  separately from per-track values.
- Legacy import must preserve tandas and playlists and map track references to
  the new library roots where possible.
- Legacy artist normalization logic in `similar.js` informs the
  `artist_summary` field used for sorting and tanda summaries.
