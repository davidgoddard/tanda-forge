# 2026-11-27 — Selective history retrieval

- **Status:** Accepted
- **Topics:** documentation, agent-workflow; no functional requirement
- **Context:** The user requested a structure that lets agents read less and
  retrieve only relevant decision history. The legacy dialogue had 7,849 lines,
  repeated generic headings and mixed chronological ordering.
- **Decision:** Use `docs/dialogue.md` as a short searchable index. Store future
  significant decisions in individual dated, descriptively named files with
  topics, requirement references and explicit supersession links. Preserve the
  complete previous dialogue unchanged in the archive.
- **Rationale / alternatives:** Topic search plus bounded excerpts makes the old
  history usable without reinterpreting every entry. Rewriting it into supposedly
  current decisions would risk losing context or promoting obsolete statements.
  Requirements/design remain authoritative for intent; code/tests establish
  implementation. History is consulted for rationale only.
- **References:** [History index](../dialogue.md),
  [legacy history](../archive/dialogue-through-2026-11-26.md),
  [agent guidance](../../AGENTS.md#dialogue-and-decision-history).
- **Supersedes:** The single-file append convention in agent guidance; no
  historical product or architecture decisions are superseded.
