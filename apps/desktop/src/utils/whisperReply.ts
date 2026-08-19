import type { WhisperReplyBind } from "@wavvon/ui";

const WHISPER_REPLY_KEY = "wavvon.whisper_reply";

// Device-level, like `drafts.ts` and desktop's other input preferences (the
// PTT key lives in the device-global voice settings): a keybind belongs to
// the keyboard in front of you, not to the account signed in. Web scopes its
// copy per account only because the browser has no device-global store.
export function loadWhisperReplyBind(): WhisperReplyBind {
  try {
    const raw = localStorage.getItem(WHISPER_REPLY_KEY);
    if (raw) return JSON.parse(raw) as WhisperReplyBind;
  } catch { /* fall through */ }
  return { mode: "hold" };
}

export function saveWhisperReplyBind(bind: WhisperReplyBind): void {
  try { localStorage.setItem(WHISPER_REPLY_KEY, JSON.stringify(bind)); } catch { /* ignore */ }
}
