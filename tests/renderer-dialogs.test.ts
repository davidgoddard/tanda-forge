import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfirmationDialog } from "../app/src/renderer/modules/confirmation-dialog";
import { createChoiceDialogs } from "../app/src/renderer/modules/choice-dialogs";

import { createClearDialogs } from "../app/src/renderer/modules/clear-dialogs";

class Element extends EventTarget {
  constructor(readonly tag = "div") { super(); }
  dataset: Record<string, string> = {};
  value = "";
  type = "";
  set innerHTML(value: string) { if (value === "") this.children = []; }
  querySelectorAll(selector: string): Element[] {
    const [head, ...tail] = selector.split(" ");
    const matches = (element: Element) => {
      const base = head.split("[")[0];
      const attribute = head.match(/\[(data-option|type)="([^"]+)"\]/);
      return (base.startsWith(".") ? element.className.split(" ").includes(base.slice(1)) : element.tag === base)
        && (!attribute || (attribute[1] === "type" ? element.type : element.dataset.option) === attribute[2]);
    };
    return this.children.flatMap(child => [
      ...(matches(child) ? tail.length ? child.querySelectorAll(tail.join(" ")) : [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
  children: Element[] = [];
  className = "";
  textContent = "";
  checked = false;
  disabled = false;
  removed = false;
  classList = {
    add: (name: string) => { this.className += ` ${name}`; },
    remove: (name: string) => { this.className = this.className.split(" ").filter(x => x !== name).join(" "); },
    toggle: (name: string, on: boolean) => on ? this.classList.add(name) : this.classList.remove(name),
  };
  append(...elements: Element[]) { this.children.push(...elements); }
  appendChild(element: Element) { this.append(element); }
  remove() { this.removed = true; }
  click() { this.dispatchEvent(new Event("click")); }
}

let body: Element;
let elements: Element[];
const find = (text: string) => elements.find(element => element.textContent === text)!;
beforeEach(() => {
  body = new Element();
  elements = [];
  vi.stubGlobal("document", { body, createElement: (tag: string) => {
    const element = new Element(tag); elements.push(element); return element;
  } });
});
afterEach(() => vi.unstubAllGlobals());

describe("extracted renderer dialogs", () => {
  it("protects an outstanding confirmation and reuses its dialog after cancellation", async () => {
    let language = "en";
    const { showConfirmModal } = createConfirmationDialog(key => `${language}:${key}`);
    const pending = showConfirmModal("first");
    expect(await showConfirmModal("second")).toBe(false);
    expect(find("first")).toBeDefined();
    find("en:cancel").click();
    expect(await pending).toBe(false);
    language = "es";
    const next = showConfirmModal("next", "Proceed", { title: " Title " });
    expect(find("es:cancel")).toBeDefined();
    expect(find("Title")).toBeDefined();
    find("Proceed").click();
    expect(await next).toBe(true);
    expect(body.children).toHaveLength(1);
  });

  it("cancels a confirmation when its backdrop is clicked", async () => {
    const pending = createConfirmationDialog(key => key).showConfirmModal("message");
    body.children[0].click();
    expect(await pending).toBe(false);
  });

  it("keeps unsaved tanda removal separate from deleting a saved tanda", async () => {
    const dialogs = createChoiceDialogs(key => key);
    const unsaved = dialogs.showPlaylistTandaDeleteModal(false);
    const actions = body.children[0].children[0].children[2];
    expect(actions.children.map(x => x.textContent)).toEqual(["cancel", "playlistTandaRemoveOnly"]);
    find("playlistTandaRemoveOnly").click();
    expect(await unsaved).toBe("remove");
    expect(body.children[0].removed).toBe(true);
  });

  it("returns the clipboard choice without performing any mutation itself", async () => {
    const pending = createChoiceDialogs(key => key).showPlaylistTandaRemoveModal();
    find("playlistTandaRemoveToClipboard").click();
    expect(await pending).toBe("clipboard");
    expect(body.children[0].removed).toBe(true);
  });

  it("uses the supplied current roots and prevents an empty relocation selection", async () => {
    const pending = createChoiceDialogs(key => key).showRootRelocationOptionsModal("copy", "/destination", [{ kind: "music" }]);
    const options = body.children[0].children[0].children[2];
    const inputs = options.children.map(row => row.children[0]);
    expect(inputs.map(input => [input.checked, input.disabled])).toEqual([[true, false], [false, true], [false, true]]);
    inputs[0].checked = false;
    elements.find(x => x.className === "confirm-ok")!.click();
    expect(body.children[0].removed).toBe(false);
    inputs[0].checked = true;
    elements.find(x => x.className === "confirm-ok")!.click();
    expect(await pending).toEqual(["music"]);
  });
});

describe("clear dialogs", () => {
  it("returns only writable selections and refreshes collection inputs on reopening", async () => {
    const { showClipboardClearModal } = createClearDialogs(key => key);
    const collections = [{ id: "smart", name: "Smart" }, { id: "user", name: "User" }];
    const readonly = (id: string) => id === "smart";
    const first = showClipboardClearModal(collections, "user", readonly);
    expect(await showClipboardClearModal([], null, readonly)).toBeNull();
    expect(body.querySelectorAll('.clipboard-clear-list input').map(x => x.value)).toEqual(["user"]);
    body.querySelector('.clipboard-clear-remove-empty')!.checked = true;
    find("clipboardClearConfirm").click();
    expect(await first).toEqual({ selectedIds: ["user"], removeEmpty: true });
    const second = showClipboardClearModal([{ id: "new", name: "New" }], "new", readonly);
    find("clipboardClearConfirm").click();
    expect(await second).toEqual({ selectedIds: ["new"], removeEmpty: false });
    expect(body.children).toHaveLength(1);
  });

  it.each(["clear", "autofill", "generate"])("returns the playlist %s choice", async choice => {
    const { showPlaylistClearModal } = createClearDialogs(key => key);
    const pending = showPlaylistClearModal();
    expect(await showPlaylistClearModal()).toBeNull();
    body.querySelector(`.confirm-ok[data-option="${choice}"]`)!.click();
    expect(await pending).toBe(choice);
  });
});
