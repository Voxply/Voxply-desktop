import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { WhisperTarget, WhisperList, InboundWhisperEntry } from "@wavvon/ui";
import { applyWhisperLogEvent } from "@wavvon/ui";
import { loadWhisperOptout, saveWhisperOptout, refreshWhisperOptout } from "../utils/whisperOptout";

export type { WhisperTarget, WhisperList };

interface UseWhisperParams {
  activeHubId: string | null;
  voiceChannelId: string | null;
}

export function useWhisper({ activeHubId, voiceChannelId }: UseWhisperParams) {
  const [isWhispering, setIsWhispering] = useState(false);
  const [whisperTargets, setWhisperTargets] = useState<WhisperTarget[]>([]);
  const [whisperLists, setWhisperLists] = useState<WhisperList[]>([]);
  const [inboundWhispers, setInboundWhispers] = useState<Set<string>>(new Set());
  const [inboundWhisperLog, setInboundWhisperLog] = useState<InboundWhisperEntry[]>([]);
  const [whisperOptout, setWhisperOptoutState] = useState<boolean>(loadWhisperOptout);

  // The stored choice lives on disk, so the initial synchronous read is a
  // default that gets corrected once the account dir has been read.
  useEffect(() => {
    refreshWhisperOptout().then(setWhisperOptoutState);
  }, []);

  useEffect(() => {
    if (!activeHubId) { setWhisperLists([]); return; }
    invoke<WhisperList[]>("load_whisper_lists", { hubId: activeHubId })
      .then(setWhisperLists).catch(() => setWhisperLists([]));
  }, [activeHubId]);

  useEffect(() => {
    if (!activeHubId) return;
    const unsubs: Array<() => void> = [];
    listen<{ hub_id: string; sender_pubkey: string; is_whisper: boolean }>(
      "voice-whisper-receiving", (e) => {
        if (e.payload.hub_id !== activeHubId) return;
        setInboundWhispers(prev => {
          const next = new Set(prev);
          if (e.payload.is_whisper) next.add(e.payload.sender_pubkey);
          else next.delete(e.payload.sender_pubkey);
          return next;
        });
        setInboundWhisperLog(prev =>
          applyWhisperLogEvent(prev, e.payload.sender_pubkey, e.payload.is_whisper));
      }
    ).then(u => unsubs.push(u));
    return () => unsubs.forEach(u => u());
  }, [activeHubId]);

  useEffect(() => {
    if (!voiceChannelId) {
      setInboundWhispers(new Set());
      setInboundWhisperLog([]);
    }
  }, [voiceChannelId]);

  function dismissInbound(pubkey: string, startedAt: number) {
    setInboundWhisperLog(prev => prev.filter(e => !(e.pubkey === pubkey && e.startedAt === startedAt)));
  }

  function clearInbound() {
    setInboundWhisperLog([]);
  }

  /** Hub-enforced receive opt-out. The hub holds this per *connection*, so
   *  it is re-sent on every (re)connect — see the `hub-ws-status` handler in
   *  useWsHandlers, which mirrors what it already does for presence. */
  function setWhisperOptout(enabled: boolean) {
    setWhisperOptoutState(enabled);
    saveWhisperOptout(enabled);
    if (activeHubId) {
      invoke("send_hub_ws_raw_to", {
        hubId: activeHubId,
        payload: JSON.stringify({ type: "voice_whisper_optout", enabled }),
      }).catch(() => { /* session raced away */ });
    }
    if (enabled) {
      // The hub drops us from live target sets but doesn't push a
      // voice_whisper_stopped on re-resolution, so end live state locally.
      setInboundWhispers(new Set());
      setInboundWhisperLog(prev => prev.map(e => (e.live ? { ...e, live: false } : e)));
    }
  }

  async function startWhisper(targets: WhisperTarget[]) {
    if (!voiceChannelId || targets.length === 0) return;
    setWhisperTargets(targets);
    setIsWhispering(true);
    await invoke("start_whisper", {
      targets: targets.map(t => ({ type: t.type, id: t.id }))
    }).catch(console.error);
  }

  async function stopWhisper() {
    setIsWhispering(false);
    setWhisperTargets([]);
    await invoke("stop_whisper").catch(console.error);
  }

  async function toggleWhisper(targets: WhisperTarget[]) {
    if (isWhispering) await stopWhisper();
    else await startWhisper(targets);
  }

  async function saveWhisperList(list: WhisperList) {
    if (!activeHubId) return;
    const updated = whisperLists.some(l => l.id === list.id)
      ? whisperLists.map(l => l.id === list.id ? list : l)
      : [...whisperLists, list];
    setWhisperLists(updated);
    await invoke("save_whisper_lists", { hubId: activeHubId, lists: updated }).catch(console.error);
  }

  async function deleteWhisperList(id: string) {
    if (!activeHubId) return;
    const updated = whisperLists.filter(l => l.id !== id);
    setWhisperLists(updated);
    await invoke("save_whisper_lists", { hubId: activeHubId, lists: updated }).catch(console.error);
  }

  return {
    isWhispering, whisperTargets, whisperLists, inboundWhispers, inboundWhisperLog, whisperOptout,
    startWhisper, stopWhisper, toggleWhisper, saveWhisperList, deleteWhisperList,
    dismissInbound, clearInbound, setWhisperOptout,
  };
}
