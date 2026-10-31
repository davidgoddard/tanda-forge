import { describe, expect, it, vi } from "vitest";
import { createDomainIpcRegistrar, resolveIpcDomain } from "../app/src/main/ipc/domain-registrar";

describe("main-process IPC domain registration", () => {
  it.each([
    ["app:getVersion", "application"],
    ["library:listRoots", "library"],
    ["tracks:getByIds", "tracks"],
    ["tandas:getByIds", "tandas"],
    ["diagnostics:getPaths", "diagnostics"],
    ["audio-similarity:report", "audioSimilarity"],
    ["display:update", "display"],
    ["app:exportPlaylistData", "transfer"],
  ] as const)("assigns %s to %s", (channel, domain) => {
    expect(resolveIpcDomain(channel)).toBe(domain);
  });

  it("registers each channel once and exposes its domain inventory", () => {
    const handle = vi.fn();
    const registrar = createDomainIpcRegistrar({ handle });
    const handler = vi.fn();
    registrar.handle("tracks:getByIds", handler);
    expect(handle).toHaveBeenCalledWith("tracks:getByIds", handler);
    expect(registrar.channelsFor("tracks")).toEqual(["tracks:getByIds"]);
    expect(() => registrar.handle("tracks:getByIds", handler)).toThrow(/Duplicate/);
  });
});
