import type { WhisperReplyBind } from "@wavvon/ui";
import { getScoped, setScoped } from "./accountScope";

const WHISPER_REPLY_KEY = "wavvon.whisper_reply";

export function loadWhisperReplyBind(): WhisperReplyBind {
  try {
    const raw = getScoped(WHISPER_REPLY_KEY);
    if (raw) return JSON.parse(raw) as WhisperReplyBind;
  } catch { /* fall through */ }
  return { mode: "hold" };
}

export function saveWhisperReplyBind(bind: WhisperReplyBind): void {
  try { setScoped(WHISPER_REPLY_KEY, JSON.stringify(bind)); } catch { /* ignore */ }
}
