import { useEffect, useState } from "react";
import { activeSession, allSessions } from "@platform";
import type { WhisperTarget, WhisperList } from "@wavvon/ui";
import { loadWhisperLists, saveWhisperLists } from "../utils/whisperLists";
import { loadWhisperOptout, saveWhisperOptout } from "../utils/whisperOptout";

interface UseWhisperParams {
  activeHubId: string | null;
  voiceChannelId: string | null;
}

// The hook only knows senders by pubkey — WhisperInbox's `name` is resolved
// by the caller (App.tsx has the member/participant list) at render time.
export interface InboundWhisperEntry {
  pubkey: string;
  startedAt: number;
  live: boolean;
}

/** Pure reducer for the whisper inbox log (WhisperInbox.tsx): a "started"
 *  event either reopens the existing live entry for that sender (no
 *  duplicate rows while someone whispers continuously) or appends a new
 *  one; a "stopped" event just flips the matching live entry to ended —
 *  entries otherwise persist until the caller dismisses them. */
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

// Web mirror of the desktop useWhisper hook (apps/desktop/src/hooks/useWhisper.ts):
// same state shape and named-list persistence, but whisper start/stop rides the
// existing WS session (platform/ws.ts) instead of a Tauri invoke/event pair.
export function useWhisper({ activeHubId, voiceChannelId }: UseWhisperParams) {
  const [isWhispering, setIsWhispering] = useState(false);
  const [whisperTargets, setWhisperTargets] = useState<WhisperTarget[]>([]);
  const [whisperLists, setWhisperLists] = useState<WhisperList[]>([]);
  const [inboundWhispers, setInboundWhispers] = useState<Set<string>>(new Set());
  const [inboundWhisperLog, setInboundWhisperLog] = useState<InboundWhisperEntry[]>([]);
  const [whisperOptout, setWhisperOptoutState] = useState<boolean>(loadWhisperOptout);

  useEffect(() => {
    setWhisperLists(activeHubId ? loadWhisperLists(activeHubId) : []);
  }, [activeHubId]);

  useEffect(() => {
    if (!voiceChannelId) {
      setInboundWhispers(new Set());
      setInboundWhisperLog([]);
      setIsWhispering(false);
      setWhisperTargets([]);
    }
  }, [voiceChannelId]);

  function receiveWhisperEvent(senderPubkey: string, isWhisper: boolean) {
    setInboundWhispers((prev) => {
      const next = new Set(prev);
      if (isWhisper) next.add(senderPubkey);
      else next.delete(senderPubkey);
      return next;
    });
    setInboundWhisperLog((prev) => applyWhisperLogEvent(prev, senderPubkey, isWhisper));
  }

  function dismissInbound(pubkey: string, startedAt: number) {
    setInboundWhisperLog((prev) => prev.filter((e) => !(e.pubkey === pubkey && e.startedAt === startedAt)));
  }

  function clearInbound() {
    setInboundWhisperLog([]);
  }

  function setWhisperOptout(enabled: boolean) {
    setWhisperOptoutState(enabled);
    saveWhisperOptout(enabled);
    for (const s of allSessions()) {
      try { s.ws?.setWhisperOptout(enabled); } catch { /* not connected */ }
    }
    if (enabled) {
      // The hub drops us from live target sets but doesn't push a
      // voice_whisper_stopped on re-resolution, so end live state locally.
      setInboundWhispers(new Set());
      setInboundWhisperLog((prev) => prev.map((e) => (e.live ? { ...e, live: false } : e)));
    }
  }

  function startWhisper(targets: WhisperTarget[]) {
    if (!voiceChannelId || targets.length === 0) return;
    setWhisperTargets(targets);
    setIsWhispering(true);
    try { activeSession().ws?.startWhisper(targets.map((t) => ({ type: t.type, id: t.id }))); } catch { /* not connected */ }
  }

  function stopWhisper() {
    setIsWhispering(false);
    setWhisperTargets([]);
    try { activeSession().ws?.stopWhisper(); } catch { /* not connected */ }
  }

  function toggleWhisper(targets: WhisperTarget[]) {
    if (isWhispering) stopWhisper();
    else startWhisper(targets);
  }

  function saveWhisperList(list: WhisperList) {
    if (!activeHubId) return;
    const updated = whisperLists.some((l) => l.id === list.id)
      ? whisperLists.map((l) => (l.id === list.id ? list : l))
      : [...whisperLists, list];
    setWhisperLists(updated);
    saveWhisperLists(activeHubId, updated);
  }

  function deleteWhisperList(id: string) {
    if (!activeHubId) return;
    const updated = whisperLists.filter((l) => l.id !== id);
    setWhisperLists(updated);
    saveWhisperLists(activeHubId, updated);
  }

  return {
    isWhispering, whisperTargets, whisperLists, inboundWhispers, inboundWhisperLog, whisperOptout,
    startWhisper, stopWhisper, toggleWhisper, saveWhisperList, deleteWhisperList,
    receiveWhisperEvent, dismissInbound, clearInbound, setWhisperOptout,
  };
}
