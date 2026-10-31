import { describe, expect, it, vi } from "vitest";
import { toggleDetailMenu } from "../app/src/renderer/modules/row-menu";

describe("row detail menu", () => {
  it("opens one detail menu after closing peers, then toggles it closed", () => {
    const classes = new Set<string>();
    const line = {
      classList: {
        contains: (value: string) => classes.has(value),
        add: (value: string) => classes.add(value),
        remove: (value: string) => classes.delete(value),
      },
    } as unknown as HTMLElement;
    const button = {
      closest: () => line,
    } as unknown as HTMLElement;
    const closePeers = vi.fn();

    expect(toggleDetailMenu(button, closePeers)).toBe(true);
    expect(closePeers).toHaveBeenCalledOnce();
    expect(classes.has("detail-menu-open")).toBe(true);
    expect(toggleDetailMenu(button, closePeers)).toBe(false);
    expect(classes.has("detail-menu-open")).toBe(false);
  });
});
