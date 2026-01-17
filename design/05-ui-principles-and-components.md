# UI Principles and Components

This document defines the user interface principles and core UI components
for Tanda Player 2. Its purpose is to ensure consistency, safety, and clarity
across all screens and devices.

The UI is treated as a *control surface for a live musical instrument*,
not as a generic media application.

---

## UI-001 — Mode-Aware UI Design

The system operates in explicit modes (FR-060):

- Preparation Mode
- Performance Mode
- Maintenance / Recovery Mode (FR-086)

### Rules
- The current mode must always be visible.
- Mode changes must be explicit.
- UI affordances must change with mode.
- Unsafe actions must be impossible in Performance Mode, not merely discouraged.

---

## UI-002 — Safety Over Convenience

In Performance Mode:
- No action may immediately change playback unless triggered via dedicated controls.
- Clicking or tapping content (tracks, tandas) must not start playback.
- Destructive or disruptive actions must be disabled or gated.

In Preparation Mode:
- Speed and exploration are prioritized.
- Immediate preview playback is allowed.

---

## UI-003 — Consistent Visual Language

The UI must use a consistent visual grammar:

- Tracks always look like tracks
- Tandas always look like tandas
- Cortinas are visually distinct from tanda tracks
- Playback state is never ambiguous

Icons, colors, and layout must convey meaning before text.

---

## UI-004 — Language-Minimal Design

The UI should minimize reliance on written language.

- Icons are preferred over text where meaning is clear.
- Text is reserved for:
  - Song metadata
  - User-defined labels
  - Configuration descriptions
- Core workflows must remain usable regardless of UI language.

This supports international use and external documentation translation.

---

## UI-005 — Multi-Client Awareness

The UI may be open on multiple devices simultaneously.

Rules:
- Playback state is authoritative and shared.
- Visual progress indicators may be locally simulated.
- UI must tolerate brief desynchronization without confusion.

Read-only clients (e.g. display boards) must never present control affordances.

---

## UI-006 — Headless Operation

The system must not require any connected client in order to operate.

Rules:
- Playback must function with zero active UI clients.
- A saved playlist may be marked as "auto play".
- On startup, if an auto-play playlist is configured and the system is healthy,
  playback begins automatically.
- UI clients may connect or disconnect at any time without affecting playback.

The UI is a control and observation surface, not a prerequisite for operation.

---

## Core UI Components

The following components are mandatory and reusable across the system.

---

## UI-010 — Track Row Component

Represents a single track.

Must display:
- Track title
- Orchestra / artist
- Duration (effective musical duration)
- Headphone preview icon (FR-061)

Optional indicators:
- Year
- BPM
- Rating
- Similarity glyphs (see UI-030)

Behavior:
- In Preparation Mode: clicking plays preview.
- In Performance Mode: clicking selects only.

---

## UI-011 — Tanda Summary Component

Represents a tanda as a first-class object.

Must display:
- Tanda name or identifier
- Style
- Track count
- Track list (expandable)
- Derived attributes:
  - Instrumental / vocal
  - Single artist / mixed
  - Single year / mixed
  - BPM range
- Rating (1–5 stars)

Behavior:
- Can be dragged as a unit.
- Selection never plays audio directly in Performance Mode.

---

## UI-012 — Playlist Timeline Component

Represents the current playlist.

Must show:
- Ordered tandas
- Optional cortinas between tandas
- Current playback position
- Next upcoming items

Behavior:
- Reordering allowed subject to mode rules.
- Current and next items are visually emphasized.
- Timeline reflects authoritative playback state.

---

## UI-013 — Playback Control Component

Dedicated playback controls.

Must include:
- Start playlist
- Stop playlist
- Pause / resume (if supported)
- Volume control (authoritative)

Rules:
- Only this component may initiate playback in Performance Mode.
- Changes must be reflected across all connected clients.

---

## UI-020 — Cortina Selector Component

Allows selection or replacement of cortinas.

Features:
- Search across all cortina tracks
- Grouped by cortina folder
- Preview via headphone output
- Replace-at-boundary semantics

Must be usable up to the moment a cortina plays.

---

## UI-030 — Similarity Visualization Component

Provides visual indicators of musical similarity.

Description:
- Tracks may be associated with multiple musical properties.
- Each property is mapped to a color.
- Property value is represented via lightness or intensity.

Rendering:
- Each track shows a compact block or strip per property.
- Similar tracks appear visually similar.
- Outliers are immediately visible.

Rules:
- Visualization must not imply “wrongness”.
- Differences are informational, not errors.

Source of properties:
- Manual (initial implementation)
- Derived (future ML-based vectorization)

The visual abstraction must remain stable even if the data source changes.

---

## UI-040 — Waveform Preview Component

Optional component for track preview.

Features:
- Displays full-track waveform
- Indicates playback position
- Allows click-to-seek

Rules:
- Enabled only in Preparation Mode
- Disabled entirely in Performance Mode
- Uses derived waveform artifacts if available

---

## UI-050 — Configuration Panel

Centralized configuration UI.

Must allow adjustment of:
- Gain targets
- Fade durations
- Gap defaults
- UI visibility toggles

Rules:
- Configuration changes must be explicit.
- Risky changes should be labeled clearly.
- Changes affecting live playback must require confirmation.

---

## UI-060 — Display Board UI

Read-only UI for audience-facing displays.

Features:
- Current track / tanda
- Next upcoming item
- Optional background imagery

Rules:
- No control affordances
- Must work on low-power devices
- Must tolerate network interruptions gracefully

---

## UI-070 — Playlist Integrity Enforcement

The UI must actively prevent DJs from breaking their own defined playlist rules.

Rules:
- Drag-and-drop operations must respect playlist structure constraints.
- A tanda of one style must not be droppable into a position requiring another style.
- Invalid drop targets must be visibly indicated and rejected.
- Search-and-replace operations must respect the same constraints.

It must be difficult to accidentally construct an invalid playlist.

---

## UI-080 — Scratch Pad Component

The Scratch Pad is a temporary holding area for tracks and tandas during playlist editing.

Purpose:
- Reduce cognitive load during long-distance rearrangements.
- Support safe replacement workflows without breaking playlist integrity.

Behavior:
- Items may be dragged from the playlist or search results into the scratch pad.
- Dragging an item from the playlist to the scratch pad marks its original position.
- Dropping an item from the scratch pad into the playlist replaces the target item.
- The displaced item is automatically moved to the scratch pad.

Rules:
- The playlist must never be left with an invalid gap.
- Automatic replacement is preferred over leaving holes.
- If ambiguity exists, the system must choose the safest default behavior.

The scratch pad provides an indirect but safe equivalent of complex drag-and-drop.

---

## UI-081 — Scratch Pad Auto-Targeting

When a playlist item is moved to the scratch pad:
- Its original position is marked.
- If the DJ later drops another item from the scratch pad, the marked position
  is the default replacement target.
- This behavior mirrors a direct drag-and-drop without requiring continuous dragging.

This mechanism must be visible and predictable.

---

## UI Design Summary

The UI must:
- Prevent accidental failure
- Reward deliberate action
- Make musical structure visible
- Remain usable under pressure
- Stay consistent across screens and time

If a UI element behaves differently in different contexts,
it must look different.

