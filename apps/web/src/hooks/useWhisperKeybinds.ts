import { useEffect } from "react";
import type { WhisperList, WhisperReplyBind, WhisperTarget } from "@wavvon/ui";

interface Params {
  voiceChannelId: string | null;
  whisperLists: WhisperList[];
  isWhispering: boolean;
  startWhisper: (targets: WhisperTarget[]) => void;
  stopWhisper: () => void;
  /** Dedicated reply key (distinct from any list bind): whispers back at
   *  `replyTarget` — the most recent inbound whisperer. No-op while null. */
  replyBind?: WhisperReplyBind;
  replyTarget?: WhisperTarget | null;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

// Per-list whisper keybinds (voice.md whisper follow-up): browser-only, so
// like push-to-talk this only fires while the app is focused — no global
// hotkey support outside the desktop app. Active only while in a voice
// channel and only for lists that actually have a keybind set.
export function useWhisperKeybinds({ voiceChannelId, whisperLists, isWhispering, startWhisper, stopWhisper, replyBind, replyTarget }: Params) {
  useEffect(() => {
    if (!voiceChannelId) return;
    const bound = whisperLists.filter((l) => l.keybind);
    const replyKey = replyBind?.key;
    if (bound.length === 0 && !replyKey) return;

    // Resolve what a key activates: a list's targets, or the reply target.
    const activation = (code: string): { targets: WhisperTarget[]; mode: "hold" | "toggle" } | null => {
      const list = bound.find((l) => l.keybind === code);
      if (list) return { targets: list.targets, mode: list.keybindMode ?? "hold" };
      if (code === replyKey && replyTarget) {
        return { targets: [replyTarget], mode: replyBind?.mode ?? "hold" };
      }
      return null;
    };

    const down = (e: KeyboardEvent) => {
      if (e.repeat || isTyping(e.target)) return;
      const act = activation(e.code);
      if (!act) return;
      e.preventDefault();
      if (act.mode === "toggle") {
        if (isWhispering) stopWhisper();
        else startWhisper(act.targets);
      } else {
        startWhisper(act.targets);
      }
    };
    const up = (e: KeyboardEvent) => {
      const act = activation(e.code);
      if (!act || act.mode !== "hold") return;
      stopWhisper();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [voiceChannelId, whisperLists, isWhispering, startWhisper, stopWhisper, replyBind, replyTarget]);
}
