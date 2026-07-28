import { useRef, useState } from "react";
import { decideVoiceMove } from "../utils/voiceMove";

export interface VoiceMoveMenuState {
  pubkey: string;
  displayName: string;
  position: { x: number; y: number };
  currentChannelId: string;
}

export interface VoiceMoveUxDeps {
  // Joins (or switches to) a voice channel. Read through a ref internally,
  // so a stale-captured onVoiceMovePush (frozen WS handler registries) still
  // calls the current implementation.
  joinVoice: (channelId: string) => void | Promise<void>;
}

// Receiver + mover UX around voice_move pushes (events.md §7.1/§7.2):
// the "Move to channel…" context menu state, the consent prompt, the
// "you were moved" toast with rejoin, and the channel-name hint that
// overrides the sidebar's local-channel-list lookup for the voice HUD
// label (the move target may not be in the local channel list, §7.4).
// Sending the move itself is platform transport and stays in the app.
export function useVoiceMoveUx({ joinVoice }: VoiceMoveUxDeps) {
  const joinVoiceRef = useRef(joinVoice);
  joinVoiceRef.current = joinVoice;

  const [voiceMoveMenu, setVoiceMoveMenu] = useState<VoiceMoveMenuState | null>(null);
  const [voiceChannelNameHint, setVoiceChannelNameHint] = useState<string | null>(null);
  const [voiceMovePrompt, setVoiceMovePrompt] = useState<{
    targetChannelId: string;
    targetChannelName: string;
  } | null>(null);
  const [voiceMoveToast, setVoiceMoveToast] = useState<{
    channelName: string;
    sourceChannelId: string | null;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showVoiceMoveToast(channelName: string, sourceChannelId: string | null) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setVoiceMoveToast({ channelName, sourceChannelId });
    toastTimerRef.current = setTimeout(() => setVoiceMoveToast(null), 8000);
  }

  function dismissVoiceMoveToast() {
    setVoiceMoveToast(null);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }

  function handleRejoinPreviousVoiceChannel() {
    const sourceChannelId = voiceMoveToast?.sourceChannelId;
    dismissVoiceMoveToast();
    if (!sourceChannelId) return;
    // The source is a channel we were just in — no name hint needed, the
    // local channel list already knows it.
    void joinVoiceRef.current(sourceChannelId);
  }

  function handleAcceptVoiceMove() {
    if (!voiceMovePrompt) return;
    const { targetChannelId, targetChannelName } = voiceMovePrompt;
    setVoiceMovePrompt(null);
    setVoiceChannelNameHint(targetChannelName);
    void joinVoiceRef.current(targetChannelId);
  }

  // Decline is a server no-op (events.md §7.2) — closing the prompt is the
  // entire client side of it, nothing to send.
  function handleDeclineVoiceMove() {
    setVoiceMovePrompt(null);
  }

  // Plug into the app's WS handler registry, after any hub-id filtering.
  function onVoiceMovePush(raw: unknown) {
    const decision = decideVoiceMove(raw as Parameters<typeof decideVoiceMove>[0]);
    if (decision.kind === "ignore") return;
    if (decision.kind === "auto") {
      setVoiceChannelNameHint(decision.targetChannelName);
      void joinVoiceRef.current(decision.targetChannelId);
      showVoiceMoveToast(decision.targetChannelName, decision.sourceChannelId);
    } else {
      setVoiceMovePrompt({
        targetChannelId: decision.targetChannelId,
        targetChannelName: decision.targetChannelName,
      });
    }
  }

  return {
    voiceMoveMenu,
    setVoiceMoveMenu,
    voiceChannelNameHint,
    setVoiceChannelNameHint,
    voiceMovePrompt,
    voiceMoveToast,
    dismissVoiceMoveToast,
    handleRejoinPreviousVoiceChannel,
    handleAcceptVoiceMove,
    handleDeclineVoiceMove,
    onVoiceMovePush,
  };
}
