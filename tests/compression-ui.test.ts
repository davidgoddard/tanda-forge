import { describe, expect, it } from "vitest";
import { resolveCompressionSliderUiState } from "../app/src/shared/compression-ui";

describe("compression slider ui state", () => {
  it("shows 0 and disables while waiting for compressed companion on active track", () => {
    expect(
      resolveCompressionSliderUiState({
        enabled: true,
        storedDepthPercent: 75,
        isMainActive: true,
        hasMainTrack: true,
        compressedReady: false,
        prepLock: false,
      }),
    ).toEqual({
      displayedDepthPercent: 0,
      disabled: true,
    });
  });

  it("restores stored value when compressed companion is ready", () => {
    expect(
      resolveCompressionSliderUiState({
        enabled: true,
        storedDepthPercent: 75,
        isMainActive: true,
        hasMainTrack: true,
        compressedReady: true,
        prepLock: false,
      }),
    ).toEqual({
      displayedDepthPercent: 75,
      disabled: false,
    });
  });

  it("keeps stored value editable when not actively playing a main track", () => {
    expect(
      resolveCompressionSliderUiState({
        enabled: true,
        storedDepthPercent: 60,
        isMainActive: false,
        hasMainTrack: false,
        compressedReady: false,
        prepLock: false,
      }),
    ).toEqual({
      displayedDepthPercent: 60,
      disabled: false,
    });
  });
});
