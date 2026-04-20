import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHotkeys, type Binding } from "@/lib/use-hotkeys";

function dispatchKey(key: string, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true });
  target.dispatchEvent(event);
}

describe("useHotkeys", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires a single-key binding", () => {
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ type: "single", key: "/", handler }] as Binding[]),
    );
    dispatchKey("/");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("fires a sequence binding when both keys arrive within 1s", () => {
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ type: "sequence", keys: ["g", "d"], handler }] as Binding[]),
    );
    dispatchKey("g");
    dispatchKey("d");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("resets the sequence after the 1s timeout expires", () => {
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ type: "sequence", keys: ["g", "d"], handler }] as Binding[]),
    );
    dispatchKey("g");
    vi.advanceTimersByTime(1100);
    dispatchKey("d");
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores single-key events when focus is inside a text input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ type: "single", key: "/", handler }] as Binding[]),
    );
    dispatchKey("/", input);
    expect(handler).not.toHaveBeenCalled();
  });

  it("resets the sequence when focus moves into a text input", () => {
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ type: "sequence", keys: ["g", "d"], handler }] as Binding[]),
    );
    dispatchKey("g");
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    dispatchKey("d");
    expect(handler).not.toHaveBeenCalled();
  });

  it("respects a [data-ignore-hotkeys] opt-out on the target", () => {
    const div = document.createElement("div");
    div.setAttribute("data-ignore-hotkeys", "true");
    div.tabIndex = 0;
    document.body.appendChild(div);
    div.focus();
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ type: "single", key: "/", handler }] as Binding[]),
    );
    dispatchKey("/", div);
    expect(handler).not.toHaveBeenCalled();
  });

  it("removes listeners on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useHotkeys([{ type: "single", key: "/", handler }] as Binding[]),
    );
    unmount();
    dispatchKey("/");
    expect(handler).not.toHaveBeenCalled();
  });
});
