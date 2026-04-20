import { useEffect, useRef } from "react";

export type SingleBinding = {
  type: "single";
  key: string;
  handler: (ev: KeyboardEvent) => void;
};

export type SequenceBinding = {
  type: "sequence";
  keys: [string, string];
  handler: (ev: KeyboardEvent) => void;
};

export type Binding = SingleBinding | SequenceBinding;

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA"]);
const SEQUENCE_TIMEOUT_MS = 1000;

function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (INPUT_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return target.closest("[data-ignore-hotkeys]") !== null;
}

export function useHotkeys(bindings: Binding[]): void {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    let sequenceFirstKey: string | null = null;
    let sequenceTimer: ReturnType<typeof setTimeout> | null = null;

    function resetSequence() {
      if (sequenceTimer) {
        clearTimeout(sequenceTimer);
        sequenceTimer = null;
      }
      sequenceFirstKey = null;
    }

    function onKeyDown(ev: KeyboardEvent) {
      if (isTypingContext(ev.target)) {
        resetSequence();
        return;
      }

      // Single-key bindings take precedence.
      for (const binding of bindingsRef.current) {
        if (binding.type === "single" && ev.key === binding.key) {
          binding.handler(ev);
          return;
        }
      }

      // Sequence bindings.
      for (const binding of bindingsRef.current) {
        if (binding.type !== "sequence") continue;
        const [first, second] = binding.keys;

        if (sequenceFirstKey === first && ev.key === second) {
          resetSequence();
          binding.handler(ev);
          return;
        }

        if (ev.key === first && sequenceFirstKey === null) {
          sequenceFirstKey = first;
          sequenceTimer = setTimeout(resetSequence, SEQUENCE_TIMEOUT_MS);
          return;
        }
      }
    }

    function onFocusIn(ev: FocusEvent) {
      if (isTypingContext(ev.target)) {
        resetSequence();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      resetSequence();
    };
  }, []);
}
