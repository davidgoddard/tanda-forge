import { describe, expect, it } from "vitest";
import { runBoundedAudioSimilarityJobs } from "../app/src/main/audio-similarity/service";

describe("audio similarity analysis service", () => {
  it("bounds concurrency and continues after individual track failures", async () => {
    let active = 0;
    let maximumActive = 0;
    const settled: Array<{ item: number; failed: boolean }> = [];
    await runBoundedAudioSimilarityJobs(
      [1, 2, 3, 4, 5],
      2,
      new AbortController().signal,
      async (item) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise<void>((resolve) => setTimeout(resolve, 2));
        active -= 1;
        if (item === 3) throw new Error("unreadable track");
      },
      (item, error) => settled.push({ item, failed: Boolean(error) }),
    );

    expect(maximumActive).toBe(2);
    expect(settled).toHaveLength(5);
    expect(settled.find((entry) => entry.item === 3)).toEqual({ item: 3, failed: true });
    expect(settled.filter((entry) => !entry.failed)).toHaveLength(4);
  });

  it("stops scheduling work after cancellation", async () => {
    const controller = new AbortController();
    const started: number[] = [];
    const settled: number[] = [];

    await expect(runBoundedAudioSimilarityJobs(
      [1, 2, 3],
      1,
      controller.signal,
      async (item) => {
        started.push(item);
        controller.abort();
      },
      (item) => settled.push(item),
    )).rejects.toThrow("cancelled");
    expect(started).toEqual([1]);
    expect(settled).toEqual([1]);
  });
});
