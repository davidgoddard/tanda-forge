import { describe, expect, it } from "vitest";
import {
  hasAppendedInstrumentalMarker,
  stripAppendedInstrumentalMarker,
} from "../app/src/shared/instrumental-marker-cleanup";

describe("instrumental marker cleanup", () => {
  it("detects appended instrumental markers in title and artist text", () => {
    expect(hasAppendedInstrumentalMarker("Bahia Blanca instrumental")).toBe(true);
    expect(hasAppendedInstrumentalMarker("Carlos Di Sarli - instrumental")).toBe(true);
    expect(hasAppendedInstrumentalMarker("Bahia Blanca (instrumental)")).toBe(true);
    expect(hasAppendedInstrumentalMarker("Carlos Di Sarli.Instrumental")).toBe(true);
    expect(hasAppendedInstrumentalMarker("Sube y Baja (Instrumental (Remasterizado))")).toBe(true);
    expect(hasAppendedInstrumentalMarker("Pa' Bailar (Instrumental) (short).mp3")).toBe(true);
    expect(hasAppendedInstrumentalMarker("Instrumental version")).toBe(false);
  });

  it("strips appended instrumental markers cleanly", () => {
    expect(stripAppendedInstrumentalMarker("Bahia Blanca instrumental")).toEqual({
      changed: true,
      value: "Bahia Blanca",
    });
    expect(stripAppendedInstrumentalMarker("Bahia Blanca - instrumental")).toEqual({
      changed: true,
      value: "Bahia Blanca",
    });
    expect(stripAppendedInstrumentalMarker("Bahia Blanca (instrumental)")).toEqual({
      changed: true,
      value: "Bahia Blanca",
    });
    expect(stripAppendedInstrumentalMarker("Carlos Di Sarli, instrumental")).toEqual({
      changed: true,
      value: "Carlos Di Sarli",
    });
    expect(stripAppendedInstrumentalMarker("Carlos Di Sarli.Instrumental")).toEqual({
      changed: true,
      value: "Carlos Di Sarli",
    });
    expect(stripAppendedInstrumentalMarker("Sube y Baja (Instrumental (Remasterizado))")).toEqual({
      changed: true,
      value: "Sube y Baja (Remasterizado)",
    });
    expect(stripAppendedInstrumentalMarker("Pa' Bailar (Instrumental) (short).mp3")).toEqual({
      changed: true,
      value: "Pa' Bailar (short).mp3",
    });
    expect(stripAppendedInstrumentalMarker("Instrumental version")).toEqual({
      changed: false,
      value: "Instrumental version",
    });
  });
});
