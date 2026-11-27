# Decision history — navigation

Read `docs/handoff.md` for current state and the relevant requirements/design
for intended behaviour. Use history only when you need rationale, rejected
alternatives or the origin of a constraint. Historical statements are not proof
of current implementation or verification.

## Find only what you need

1. Search this index by topic or requirement identifier.
2. Read the linked decision file, or search the legacy archive with a narrow
   query and bounded context. Do not load the entire archive.
3. Follow source/design references only as needed. Check later decisions and
   current requirements before relying on an older statement.

Commands below run from the repository root:

```sh
# Search new records by requirement ID, topic or source filename.
rg -n 'FR-090|search' docs/dialogue.md docs/decisions
# Find matching historical passages with limited surrounding context.
rg -n -i -C 5 'audio.routing|output.device' docs/archive/dialogue-through-2026-11-26.md
# Expand only a relevant range after finding a match.
sed -n '7786,7798p' docs/archive/dialogue-through-2026-11-26.md
```

## Topic routes into legacy history

The [legacy archive](archive/dialogue-through-2026-11-26.md) preserves all 7,849
original lines, unchanged. Entries overlap and are not consistently chronological;
search by requirement ID or specific terminology before trying dates. These are
search hints, not summaries or declarations that historical decisions still apply.

| Topic | Useful archive search terms | Current design starting point |
| --- | --- | --- |
| Playback and output | `routing`, `headphone`, `normalization`, `compression`, `farewell` | [Playback](../design/03-audio-playback-and-timing-model.md), [audio pipeline](../design/10-audio-pipeline.md) |
| Playlists, tandas and cortinas | `cortina`, `refill`, `Find Tandas`, `T and P`, `tanda copy` | [Functional requirements](../design/02-functional-requirements.md) |
| Search and duplicate relationships | `FR-090`, `lexical`, `n-gram`, `similarity`, `recording` | [Search and similarity](../design/06-search-and-similarity.md) |
| Library, imports and root moves | `legacy`, `root`, `relocation`, `rescanning`, `ALAC` | [Storage](../design/08-storage-and-data-model.md), [legacy data](../design/13-legacy-data-reference.md) |
| Display and UI | `display-board`, `AV lag`, `fitting`, `contextual`, `localization` | [UI principles](../design/05-ui-principles-and-components.md) |
| Analysis and lighting | `BPM`, `style`, `analysis`, `Lighting` | [Functional requirements](../design/02-functional-requirements.md) |
| Packaging and FFmpeg | `FFmpeg`, `pin`, `release`, `assembler` | [Packaging](../design/11-packaging-and-bundled-tools.md) |
| Architecture and workflow | `architecture`, `checkpoint`, `verification`, `branch` | [Architecture](../design/07-electron-architecture-and-structure.md), [agent guidance](../AGENTS.md) |

## New decision index

Keep one row per decision; include topic tags and requirement IDs so this index
can be searched without opening each record. Status describes the decision,
not feature completion. When superseded, link the replacement in the old record.

| Date / record | Topics / requirement IDs | Status | Decision |
| --- | --- | --- | --- |
| [2026-11-27 — Renderer feature controllers](decisions/2026-11-27-renderer-feature-controllers.md) | renderer, modularity, agent-workflow; no functional requirement | Accepted | Extract cohesive feature controllers with explicit dependencies while retaining safety-critical state until its interfaces and coverage support extraction. |
| [2026-11-27 — Selective history retrieval](decisions/2026-11-27-selective-history-retrieval.md) | documentation, agent-workflow; no functional requirement | Accepted | Keep a short index, individual decisions and an unchanged legacy archive. |

## Recording future decisions

At release checkpoints or when explicitly requested, create
`docs/decisions/YYYY-MM-DD-descriptive-slug.md` for each significant decision
and add a row above. Use descriptive titles; never use “Latest update”. Keep
records concise and avoid copying requirements, implementation logs or test output.
Use the following fields; mark genuinely inapplicable fields as “None”.

- **Date and title**
- **Status:** Accepted / Proposed / Superseded (with replacement link)
- **Topics:** stable domain words; include affected requirement IDs
- **Context:** problem and constraints that required a decision
- **Decision:** agreed behaviour or approach
- **Rationale / alternatives:** why; rejected options only when useful
- **References:** relevant requirements, design, source or tests
- **Supersedes:** links to earlier records or legacy archive line ranges

Preserve prior rationale when decisions change. Do not retroactively classify
legacy entries as accepted or current without checking the authoritative documents.
