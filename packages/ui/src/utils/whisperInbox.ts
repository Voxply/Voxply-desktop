// Pure state helpers behind WhisperInbox. Shared because both apps keep the
// same inbox log; only the transport that feeds it differs (web: the hub
// WebSocket, desktop: the `voice-whisper-receiving` Tauri event).

/** One row of the whisper inbox log. The log only knows senders by pubkey —
 *  `WhisperInboxEntry.name` is resolved by the caller (App has the member /
 *  participant list) at render time. */
export interface InboundWhisperEntry {
  pubkey: string;
  startedAt: number;
  live: boolean;
}

/** Reducer for the inbox log: a "started" event either reopens the existing
 *  live entry for that sender (no duplicate rows while someone whispers
 *  continuously) or appends a new one; a "stopped" event just flips the
 *  matching live entry to ended — entries otherwise persist until the caller
 *  dismisses them. */
export function applyWhisperLogEvent(
  log: InboundWhisperEntry[],
  pubkey: string,
  isWhisper: boolean,
  now: number = Date.now(),
): InboundWhisperEntry[] {
  if (isWhisper) {
    if (log.some((e) => e.pubkey === pubkey && e.live)) return log;
    return [...log, { pubkey, startedAt: now, live: true }];
  }
  let done = false;
  return log.map((e) => {
    if (!done && e.pubkey === pubkey && e.live) {
      done = true;
      return { ...e, live: false };
    }
    return e;
  });
}

/** Who a whisper-reply keypress should target: the currently-live inbound
 *  whisperer if there is one, otherwise the most recent entry still in the
 *  inbox (reply works after the whisper ended — that's the inbox's point).
 *  Null when nobody has whispered us (the reply key is then a no-op). */
export function pickReplyPubkey(log: InboundWhisperEntry[]): string | null {
  const live = [...log].reverse().find((e) => e.live);
  if (live) return live.pubkey;
  const latest = log.reduce<InboundWhisperEntry | null>(
    (best, e) => (!best || e.startedAt > best.startedAt ? e : best),
    null,
  );
  return latest?.pubkey ?? null;
}
