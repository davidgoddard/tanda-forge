# Resilience and Persistence

This document defines the guarantees, failure modes, and persistence strategy
for Tanda Player 2. These rules exist to ensure that DJ work is never lost and
that the system behaves predictably under imperfect real-world conditions.

This document defines *what must be true*, not *how it is implemented*.

Requirement identifiers: All requirement bullets in this document are
identified as `FR-<section>.R<n>` or `NFR-<section>.R<n>` in order under each
section. Sub-bullets use `.<letter>` suffixes.

---

## NFR-001 — Non-Destructive Operation

- NFR-001.R1: The system must never modify original audio files.
- NFR-001.R2: All derived data (analysis, metadata, playlists, tandas) is stored separately.
- NFR-001.R3: Loss or corruption of derived data must not damage the original music library.

---

## NFR-002 — Power Loss Tolerance

- NFR-002.R1: The system must tolerate unexpected power loss at any time.
- NFR-002.R2: On restart, the system must:
  - NFR-002.R2.a: Not lose committed DJ work.
  - NFR-002.R2.b: Detect incomplete or inconsistent state.
  - NFR-002.R2.c: Recover automatically where possible.

Silent corruption is unacceptable.

---

## NFR-003 — USB as Primary State Store

### Rationale
Tanda Player operates in environments where:
- NFR-003.R1: Internet access may not exist.
- NFR-003.R2: Devices may be shared.
- NFR-003.R3: DJs may physically swap libraries.
- NFR-003.R4: Backups are done by cloning USB media.

Therefore:

- NFR-003.R5: All *authoritative state* resides on the USB device.
- NFR-003.R6: The Raspberry Pi is treated as a disposable compute node.
- NFR-003.R7: Removing the USB removes the identity of the system.

Authoritative state includes:
- NFR-003.R8: Track metadata and analysis.
- NFR-003.R9: Tandas.
- NFR-003.R10: Playlists.
- NFR-003.R11: Configuration.
- NFR-003.R12: Rolling backups and recovery logs.

---

## FR-080 — USB Health Checks

Before entering normal operation, the system must:

- FR-080.R1: Verify that the USB device is mounted read/write.
- FR-080.R2: Detect filesystem errors or read-only mounts.
- FR-080.R3: Verify required directory structure exists.
- FR-080.R4: Verify that required state files are readable.

If checks fail:
- FR-080.R5: The system must not start live playback.
- FR-080.R6: The UI must enter **Recovery / Maintenance Mode**.
- FR-080.R7: Clear, actionable instructions must be presented.

---

## FR-081 — Rolling State Snapshots (Round-Robin Backups)

### Purpose
Protect against dirty unmounts, partial writes, accidental corruption, and user
error.

### Requirements
- FR-081.R1: On each successful boot, the system creates a snapshot of all critical state.
- FR-081.R2: Snapshots are stored on the USB device.
- FR-081.R3: A fixed number of snapshot folders is maintained (e.g. `backup1` … `backupN`).
- FR-081.R4: Old snapshots are overwritten in round-robin fashion.

Snapshots must include:
- FR-081.R5: Metadata databases.
- FR-081.R6: Tanda definitions.
- FR-081.R7: Playlist definitions.
- FR-081.R8: Configuration files.

Snapshots must exclude:
- FR-081.R9: Audio files.
- FR-081.R10: Large derived artifacts that can be regenerated.

---

## FR-082 — Explicit Recovery Workflow

The system must support **manual recovery by a non-technical DJ**.

This implies:
- FR-082.R1: Snapshot folders are human-readable and clearly named.
- FR-082.R2: A recovery log is written explaining:
  - FR-082.R2.a: What failed.
  - FR-082.R2.b: Which snapshot was last known good.
- FR-082.R3: Restoring a snapshot must require only file copying.

No specialist tools should be required.

---

## FR-083 — Atomic State Updates

- FR-083.R1: State updates must be atomic at the logical level.
- FR-083.R2: Partial updates must not leave the system inconsistent.
- FR-083.R3: On restart, the system must be able to detect:
  - FR-083.R3.a: Interrupted writes.
  - FR-083.R3.b: Incomplete migrations.
  - FR-083.R3.c: Incompatible versions.

FR-083.R4: If detection fails, the system must fall back to the last known good snapshot.

---

## FR-084 — Migration Safety

- FR-084.R1: Any change to persistent data structures must be versioned.
- FR-084.R2: Migrations must be explicit and reversible where possible.
- FR-084.R3: Failed migrations must not destroy existing state.

Migration behavior must be:
- FR-084.R4: Logged.
- FR-084.R5: Recoverable via snapshots.
- FR-084.R6: Testable.

---

## FR-085 — Separation of Transient and Persistent State

The system must clearly distinguish:

### Persistent State
- FR-085.R1: Library metadata.
- FR-085.R2: Analysis results.
- FR-085.R3: Tandas.
- FR-085.R4: Playlists.
- FR-085.R5: Configuration.

### Transient State
- FR-085.R6: Playback progress.
- FR-085.R7: UI selections.
- FR-085.R8: Client-specific display state.
- FR-085.R9: Real-time timing calculations.

Transient state:
- FR-085.R10: Must never be required for recovery.
- FR-085.R11: May be recomputed on restart.

---

## FR-086 — Startup Modes

The system must support explicit startup modes:

- FR-086.R1: **Normal Mode**
  - FR-086.R1.a: USB healthy.
  - FR-086.R1.b: State valid.
  - FR-086.R1.c: Full functionality enabled.

- FR-086.R2: **Maintenance / Recovery Mode**
  - FR-086.R2.a: USB unhealthy or state inconsistent.
  - FR-086.R2.b: Playback disabled.
  - FR-086.R2.c: UI restricted to diagnostics and recovery.

FR-086.R3: Mode selection must be automatic and visible.

---

## FR-087 — Logging and Diagnostics

- FR-087.R1: Logs must be written to the USB device.
- FR-087.R2: Logs must survive reboot.
- FR-087.R3: Logs must be human-readable.
- FR-087.R4: Logs must include:
  - FR-087.R4.a: Startup checks.
  - FR-087.R4.b: Recovery decisions.
  - FR-087.R4.c: Snapshot creation.
  - FR-087.R4.d: Migration attempts.

FR-087.R5: Logs are part of the recovery story, not developer-only artifacts.

---

## NFR-021 — Renderer Security

- NFR-021.R1: The renderer must use a restrictive Content Security Policy (CSP).
- NFR-021.R2: CSP must disallow `unsafe-eval` and inline scripts.

---

## NFR-022 — Client Error Reporting

- NFR-022.R1: Renderer errors and unhandled promise rejections must be surfaced to the user.
- NFR-022.R2: Errors must be logged locally for diagnostics.

---

## FR-088 — System Integration Strategy

- FR-088.R1: The application must be startable as a system service.
- FR-088.R2: Startup ordering must ensure:
  - FR-088.R2.a: USB is available before the app starts.
  - FR-088.R2.b: Health checks run before playback services.

Whether implemented via systemd or scripts is an implementation detail,
but the behavior must be equivalent.

---

## Design Principle Summary

NFR-023.R1: The system must assume power will be lost.
NFR-023.R2: The system must assume USB will be unplugged incorrectly.
NFR-023.R3: The system must assume DJs will experiment.
NFR-023.R4: The system must assume recovery will sometimes be manual.

The system must reward these realities with predictability, clarity, and safety.
