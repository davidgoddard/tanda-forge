# Resilience and Persistence

This document defines the guarantees, failure modes, and persistence strategy
for Tanda Player 2. These rules exist to ensure that DJ work is never lost and
that the system behaves predictably under imperfect real-world conditions.

This document defines *what must be true*, not *how it is implemented*.

---

## NFR-001 — Non-Destructive Operation

- The system must never modify original audio files.
- All derived data (analysis, metadata, playlists, tandas) is stored separately.
- Loss or corruption of derived data must not damage the original music library.

---

## NFR-002 — Power Loss Tolerance

- The system must tolerate unexpected power loss at any time.
- On restart, the system must:
  - Not lose committed DJ work
  - Detect incomplete or inconsistent state
  - Recover automatically where possible

Silent corruption is unacceptable.

---

## NFR-003 — USB as Primary State Store

### Rationale
Tanda Player operates in environments where:
- Internet access may not exist
- Devices may be shared
- DJs may physically swap libraries
- Backups are done by cloning USB media

Therefore:

- All *authoritative state* resides on the USB device.
- The Raspberry Pi is treated as a disposable compute node.
- Removing the USB removes the identity of the system.

Authoritative state includes:
- Track metadata and analysis
- Tandas
- Playlists
- Configuration
- Rolling backups and recovery logs

---

## FR-080 — USB Health Checks

Before entering normal operation, the system must:

- Verify that the USB device is mounted read/write
- Detect filesystem errors or read-only mounts
- Verify required directory structure exists
- Verify that required state files are readable

If checks fail:
- The system must not start live playback
- The UI must enter **Recovery / Maintenance Mode**
- Clear, actionable instructions must be presented

---

## FR-081 — Rolling State Snapshots (Round-Robin Backups)

### Purpose
Protect against:
- Dirty unmounts
- Partial writes
- Accidental corruption
- User error

### Requirements
- On each successful boot, the system creates a snapshot of all critical state.
- Snapshots are stored on the USB device.
- A fixed number of snapshot folders is maintained (e.g. `backup1` … `backupN`).
- Old snapshots are overwritten in round-robin fashion.

Snapshots must include:
- Metadata databases
- Tanda definitions
- Playlist definitions
- Configuration files

Snapshots must exclude:
- Audio files
- Large derived artifacts that can be regenerated

---

## FR-082 — Explicit Recovery Workflow

The system must support **manual recovery by a non-technical DJ**.

This implies:
- Snapshot folders are human-readable and clearly named
- A recovery log is written explaining:
  - What failed
  - Which snapshot was last known good
- Restoring a snapshot must require only file copying

No specialist tools should be required.

---

## FR-083 — Atomic State Updates

- State updates must be atomic at the logical level.
- Partial updates must not leave the system inconsistent.
- On restart, the system must be able to detect:
  - Interrupted writes
  - Incomplete migrations
  - Incompatible versions

If detection fails, the system must fall back to the last known good snapshot.

---

## FR-084 — Migration Safety

- Any change to persistent data structures must be versioned.
- Migrations must be explicit and reversible where possible.
- Failed migrations must not destroy existing state.

Migration behavior must be:
- Logged
- Recoverable via snapshots
- Testable

---

## FR-085 — Separation of Transient and Persistent State

The system must clearly distinguish:

### Persistent State
- Library metadata
- Analysis results
- Tandas
- Playlists
- Configuration

### Transient State
- Playback progress
- UI selections
- Client-specific display state
- Real-time timing calculations

Transient state:
- Must never be required for recovery
- May be recomputed on restart

---

## FR-086 — Startup Modes

The system must support explicit startup modes:

- **Normal Mode**
  - USB healthy
  - State valid
  - Full functionality enabled

- **Maintenance / Recovery Mode**
  - USB unhealthy or state inconsistent
  - Playback disabled
  - UI restricted to diagnostics and recovery

Mode selection must be automatic and visible.

---

## FR-087 — Logging and Diagnostics

- Logs must be written to the USB device.
- Logs must survive reboot.
- Logs must be human-readable.
- Logs must include:
  - Startup checks
  - Recovery decisions
  - Snapshot creation
  - Migration attempts

Logs are part of the recovery story, not developer-only artifacts.

---

## FR-088 — System Integration Strategy

- The application must be startable as a system service.
- Startup ordering must ensure:
  - USB is available before the app starts
  - Health checks run before playback services

Whether implemented via systemd or scripts is an implementation detail,
but the behavior must be equivalent.

---

## Design Principle Summary

The system must assume:
- Power will be lost
- USB will be unplugged incorrectly
- DJs will experiment
- Recovery will sometimes be manual

The system must reward these realities with predictability, clarity, and safety.
