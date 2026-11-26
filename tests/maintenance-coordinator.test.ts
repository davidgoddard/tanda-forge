import { describe, expect, it, vi } from "vitest";
import { MaintenanceCoordinator } from "../app/src/main/library/maintenance-coordinator";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

describe("maintenance coordination", () => {
  it("drains earlier mutations, holds later writes, and keeps independent requests responsive", async () => {
    const gate = new MaintenanceCoordinator();
    const earlier = deferred();
    const worker = deferred();
    const writer = gate.request("tracks:update", () => earlier.promise);
    const operation = vi.fn(() => worker.promise);
    const maintenance = gate.request("legacy:import", () => gate.exclusive(operation));
    const later = vi.fn();
    const queued = gate.request("tracks:update", later);
    expect(gate.busy).toBe(true);
    expect(operation).not.toHaveBeenCalled();
    for (const channel of ["display:update", "audio:renderPlayableTrack", "bpm:status", "tracks:getByIds"]) {
      expect(await gate.request(channel, () => "available")).toBe("available");
    }
    earlier.resolve();
    await writer;
    await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce());
    expect(later).not.toHaveBeenCalled();
    worker.resolve();
    await Promise.all([maintenance, queued]);
    expect(later).toHaveBeenCalledOnce();
    expect(gate.busy).toBe(false);
  });

  it("releases queued requests after failure and can run maintenance again", async () => {
    const gate = new MaintenanceCoordinator();
    const failed = gate.request("legacy:import", () => gate.exclusive(async () => { throw new Error("failed"); }));
    const next = gate.request("library:removeRoot", () => gate.exclusive(async () => "removed"));
    await expect(failed).rejects.toThrow("failed");
    await expect(next).resolves.toBe("removed");
    expect(gate.busy).toBe(false);
  });

  it("does not wait for unrelated slow audio requests or deadlock on a synchronous handler error", async () => {
    const gate = new MaintenanceCoordinator();
    const audio = deferred();
    const rendering = gate.request("audio:renderPlayableTrack", () => audio.promise);
    await expect(gate.request("tracks:update", () => { throw new Error("bad input"); })).rejects.toThrow("bad input");
    await expect(gate.request("legacy:import", () => gate.exclusive(async () => "done"))).resolves.toBe("done");
    audio.resolve();
    await rendering;
  });
});
