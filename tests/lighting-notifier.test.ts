import { describe, expect, it, vi } from "vitest";
import { createLightingNotifier, LIGHTING_ENDPOINT } from "../app/src/shared/lighting-notifier";

describe("createLightingNotifier", () => {
  it("posts up and down states while suppressing duplicates", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const notify = createLightingNotifier(send);

    notify(true);
    notify(true);
    notify(false);
    await Promise.resolve();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, LIGHTING_ENDPOINT, expect.objectContaining({
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ up: true }),
    }));
    expect(send).toHaveBeenNthCalledWith(2, LIGHTING_ENDPOINT, expect.objectContaining({
      body: JSON.stringify({ up: false }),
    }));
  });

  it("does not surface an unavailable lighting app", async () => {
    const send = vi.fn().mockRejectedValue(new Error("offline"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const notify = createLightingNotifier(send);

    expect(() => notify(true)).not.toThrow();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});
