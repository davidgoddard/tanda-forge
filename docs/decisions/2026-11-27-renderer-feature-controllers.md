# 2026-11-27 — Renderer feature controllers

- **Status:** Accepted
- **Topics:** renderer, modularity, agent-workflow; no functional requirement
- **Context:** `renderer.ts` remains expensive to navigate and combines feature UI
  state with application composition and safety-critical playback. Existing
  controller extractions demonstrated a safe incremental boundary.
- **Decision:** Continue extracting cohesive, independently testable feature
  controllers with explicit reader/action dependencies. Keep playback, live edit
  locks and persistent state ownership in the renderer until dedicated interfaces
  and regression coverage justify moving them. The cortina picker is the current
  example: it owns modal state, rendering and event wiring while the renderer owns
  cortina planning and playback.
- **Rationale / alternatives:** Incremental controllers reduce search and change
  scope without an application-wide rewrite or a large untyped shared context.
  Arbitrary line-based splitting and premature extraction of audio/playback state
  were rejected because they increase coupling and live-performance risk.
- **References:** [Code map](../code-map.md),
  [architecture](../../design/07-electron-architecture-and-structure.md),
  [cortina picker controller](../../app/src/renderer/controllers/cortina-picker-controller.ts),
  [cortina picker tests](../../tests/cortina-picker.test.ts).
- **Supersedes:** None.
