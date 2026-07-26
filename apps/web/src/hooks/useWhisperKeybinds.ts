import { useEffect } from "react";
import type { WhisperList, WhisperTarget } from "@wavvon/ui";

interface Params {
  voiceChannelId: string | null;
  whisperLists: WhisperList[];
  isWhispering: boolean;
  startWhisper: (targets: WhisperTarget[]) => void;
  stopWhisper: () => void;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

// Per-list whisper keybinds (voice.md whisper follow-up): browser-only, so
// like push-to-talk this only fires while the app is focused — no global
// hotkey support outside the desktop app. Active only while in a voice
// channel and only for lists that actually have a keybind set.
export function useWhisperKeybinds({ voiceChannelId, whisperLists, isWhispering, startWhisper, stopWhisper }: Params) {
  useEffect(() => {
    if (!voiceChannelId) return;
    const bound = whisperLists.filter((l) => l.keybind);
    if (bound.length === 0) return;

    const down = (e: KeyboardEvent) => {
      if (e.repeat || isTyping(e.target)) return;
      const list = bound.find((l) => l.keybind === e.code);
      if (!list) return;
      e.preventDefault();
      if ((list.keybindMode ?? "hold") === "toggle") {
        if (isWhispering) stopWhisper();
        else startWhisper(list.targets);
      } else {
        startWhisper(list.targets);
      }
    };
    const up = (e: KeyboardEvent) => {
      const list = bound.find((l) => l.keybind === e.code);
      if (!list || (list.keybindMode ?? "hold") !== "hold") return;
      stopWhisper();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [voiceChannelId, whisperLists, isWhispering, startWhisper, stopWhisper]);
}
