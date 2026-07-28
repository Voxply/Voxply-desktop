import { useState, useEffect, useRef, useCallback } from "react";
import type { RefObject } from "react";
import { activeSession, getMyChannelPermissions, fetchSoundboardAudioBytes, markSoundboardPlayed, HubApiError } from "@platform";
import type { MyChannelPermissions } from "@platform";
import { playVoiceTone } from "@wavvon/core";
import type { Channel, VoiceParticipant, MeInfo, SoundboardClip } from "@shared/types";
import { getScoped, setScoped } from "../utils/accountScope";
import { loadPttConfig } from "@components/settings/PushToTalkSection";
import { VoiceWsSession, type AudioProfileConfig } from "../platform/voice";
import type { VoiceZone, VoiceZoneAttenuation } from "../platform/voice";

// The voice audio profile is persisted by SettingsPage under this key; read
// it here so the saved profile is actually applied to the live session.
function loadVoiceAudioProfile(): AudioProfileConfig | undefined {
  try {
    const raw = localStorage.getItem("wavvon.audio_profile");
    if (raw) return JSON.parse(raw) as AudioProfileConfig;
  } catch { /* fall back to session defaults */ }
  return undefined;
}

// Voice join/leave sound cues, gated by a preference (default on). Per
// account — it's a notification-style preference, like the mention ping.
function voiceSoundsOn(): boolean {
  try { return getScoped("wavvon.voiceSounds") !== "0"; } catch { return true; }
}

// Filled in by App once useVideo/useWhisper/useVoiceMoveUx have run, so this
// hook can dispose the camera session, stop an in-progress whisper, and clear
// the voice-move name hint without owning any of those states itself. Read
// through a ref (updated every render) so handleVoiceJoin/handleVoiceLeave —
// called from the frozen WS handler registry via onVoiceMovePush — always see
// the current implementations.
export interface VoiceExtDeps {
  createVideoSession: (channelId: string) => void;
  disposeVideo: () => void;
  stopVideoSessionOnly: () => void;
  stopWhisperIfActive: () => void;
  clearVoiceChannelNameHint: () => void;
}

export interface UseVoiceParams {
  publicKey: string | null;
  publicKeyRef: RefObject<string | null>;
  meInfoRef: RefObject<MeInfo | null>;
  showHubError: (msg: string) => void;
  // The hubFetch("/channels") -> setChannels resync used when a spawner join
  // lands in a sibling room not yet in the local channel list.
  refetchChannels: () => void;
  extRef: RefObject<VoiceExtDeps>;
}

// Voice session lifecycle (join/leave/mute/deafen), the roster + zone WS
// handlers, push-to-talk, per-user gain, and the soundboard trigger. Camera
// video and whisper are separate hooks/app state, wired in via `extRef` —
// see the CRITICAL correctness constraint on handleVoiceJoin below.
export function useVoice({ publicKey, publicKeyRef, meInfoRef, showHubError, refetchChannels, extRef }: UseVoiceParams) {
  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null);
  const [selfMuted, setSelfMuted] = useState(false);
  const [selfDeafened, setSelfDeafened] = useState(false);
  const voiceSessionRef = useRef<VoiceWsSession | null>(null);
  const [voiceGains, setVoiceGains] = useState<Record<string, number>>(() => {
    try { return JSON.parse(getScoped("wavvon.voice_gains") || "{}") as Record<string, number>; }
    catch { return {}; }
  });
  const [voicePartByChannel, setVoicePartByChannel] = useState<Record<string, VoiceParticipant[]>>({});
  const [voiceActiveUsers, setVoiceActiveUsers] = useState<Set<string>>(new Set());
  const [soundboardPlayingClipId, setSoundboardPlayingClipId] = useState<string | null>(null);
  const [pttConfig, setPttConfig] = useState(loadPttConfig);

  // handleVoiceJoin's "already there" guard is called both from JSX (fresh
  // voiceChannelId) and from the frozen onVoiceMove WS handler (via
  // onVoiceMovePush) — the ref keeps that guard correct from either call site.
  const voiceChannelIdRef = useRef<string | null>(null);
  useEffect(() => { voiceChannelIdRef.current = voiceChannelId; }, [voiceChannelId]);

  // Per-instance teardown on unmount (key-remounted account switch etc.);
  // module-level WS sessions are reset separately by AccountRoot.
  useEffect(() => {
    return () => {
      voiceSessionRef.current?.stop();
    };
  }, []);

  // Reload PTT config when the settings screen changes it.
  useEffect(() => {
    const reload = () => setPttConfig(loadPttConfig());
    window.addEventListener("wavvon:ptt", reload);
    return () => window.removeEventListener("wavvon:ptt", reload);
  }, []);

  // Push-to-talk: only active when enabled AND in voice. Start muted; the
  // bound key unmutes while held. When disabled, this effect does nothing,
  // so non-PTT users are entirely unaffected.
  useEffect(() => {
    if (!pttConfig.enabled || !voiceChannelId) return;
    setSelfMuted(true);
    voiceSessionRef.current?.setMuted(true);
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== pttConfig.key || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      setSelfMuted(false);
      voiceSessionRef.current?.setMuted(false);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== pttConfig.key) return;
      setSelfMuted(true);
      voiceSessionRef.current?.setMuted(true);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [pttConfig.enabled, pttConfig.key, voiceChannelId]);

  // Sound cue when someone else joins/leaves the voice channel you're in.
  // Counts OTHERS only, so it never double-fires with the self join/leave tone.
  const prevVoiceOthersRef = useRef(0);
  useEffect(() => {
    if (!voiceChannelId) { prevVoiceOthersRef.current = 0; return; }
    const others = (voicePartByChannel[voiceChannelId] ?? []).filter((p) => p.public_key !== publicKey).length;
    const prev = prevVoiceOthersRef.current;
    if (voiceSoundsOn() && others !== prev) {
      try { playVoiceTone(others > prev ? "up" : "down"); } catch { /* audio not ready */ }
    }
    prevVoiceOthersRef.current = others;
  }, [voicePartByChannel, voiceChannelId, publicKey]);

  // Channel-scoped effective permissions for the joined voice channel, from
  // GET /channels/:id/my-permissions (self-service, no manage_roles needed).
  // Null while unjoined, loading, or on fetch failure — callers fall back to
  // the hub-wide role baseline then; the server check stays authoritative.
  const [myVoicePerms, setMyVoicePerms] = useState<MyChannelPermissions | null>(null);
  useEffect(() => {
    if (!voiceChannelId) { setMyVoicePerms(null); return; }
    let cancelled = false;
    getMyChannelPermissions(voiceChannelId)
      .then((p) => { if (!cancelled) setMyVoicePerms(p); })
      .catch(() => { if (!cancelled) setMyVoicePerms(null); });
    return () => { cancelled = true; };
  }, [voiceChannelId]);

  // Accepts a bare channel id too — a voice_move push's destination (events.md
  // §7.1) may not be in the local channel list (voice-only presence), so the
  // mover's target can't always be resolved to a full Channel object.
  //
  // CRITICAL: called both from JSX and from the frozen onVoiceMove WS handler
  // (stableHandlers memo, via onVoiceMovePush) — must read only refs, stable
  // setters, extRef.current (updated every render, read at call time), and
  // module-level functions. Never read non-ref state/props here.
  async function handleVoiceJoin(targetChannelId: string) {
    if (voiceChannelIdRef.current === targetChannelId) return;
    // Switching channels: tear down the current session FIRST. Without this,
    // repeated joins stack independent VoiceWsSessions (joining several rooms
    // at once) and only the last is tracked, so leaving leaves the earlier
    // ones connected as stale roster entries that block temp-channel cleanup.
    // stop() sets closed=true before closing the socket, so the old session's
    // onClose does not fire and cannot clobber the new session's state.
    if (voiceSessionRef.current) {
      extRef.current.stopVideoSessionOnly();
      voiceSessionRef.current.stop();
      voiceSessionRef.current = null;
      try { activeSession().ws?.unwatchVoice(); } catch {}
    }
    try {
      const sess = activeSession();
      const session = new VoiceWsSession(sess.hub_url, sess.token, targetChannelId, {
        // `channelId` is where the join actually landed — for a spawner
        // channel the hub creates a personal sibling room and the join
        // lands there instead, never in the spawner itself.
        onReady: (_senderId, _participants, channelId) => {
          setVoiceChannelId(channelId);
          if (voiceSoundsOn()) { try { playVoiceTone("up"); } catch { /* audio not ready */ } }
          setSelfMuted(false);
          setSelfDeafened(false);
          const me = meInfoRef.current;
          if (me) {
            setVoicePartByChannel((prev) => {
              const existing = prev[channelId] ?? [];
              if (existing.some((p) => p.public_key === me.public_key)) return prev;
              return { ...prev, [channelId]: [...existing, { public_key: me.public_key, display_name: me.display_name }] };
            });
          }
          try { activeSession().ws?.watchVoice(channelId); } catch {}
          // Spin up the video session now (camera off) so it catches the
          // hub's video_participants roster pushed at voice-join.
          extRef.current.createVideoSession(channelId);
          if (channelId !== targetChannelId) {
            refetchChannels();
          }
        },
        onClose: () => {
          voiceSessionRef.current = null;
          extRef.current.disposeVideo();
          setVoiceChannelId(null);
          extRef.current.clearVoiceChannelNameHint();
          setSelfMuted(false);
          setSelfDeafened(false);
          try { activeSession().ws?.unwatchVoice(); } catch {}
        },
      }, loadVoiceAudioProfile());
      await session.start();
      voiceSessionRef.current = session;
    } catch (e) {
      showHubError("Voice: " + String(e));
    }
  }

  function handleVoiceLeave() {
    if (voiceChannelId && voiceSoundsOn()) { try { playVoiceTone("down"); } catch { /* audio not ready */ } }
    const channelId = voiceChannelId;
    // Camera + whisper are scoped to the voice session — tear them down too.
    extRef.current.disposeVideo();
    extRef.current.stopWhisperIfActive();
    voiceSessionRef.current?.stop();
    voiceSessionRef.current = null;
    setVoiceChannelId(null);
    extRef.current.clearVoiceChannelNameHint();
    setSelfMuted(false);
    setSelfDeafened(false);
    try { activeSession().ws?.unwatchVoice(); } catch {}
    const me = meInfoRef.current;
    if (me && channelId) {
      setVoicePartByChannel((prev) => {
        const existing = prev[channelId];
        if (!existing) return prev;
        const next = existing.filter((p) => p.public_key !== me.public_key);
        if (next.length === 0) {
          const { [channelId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [channelId]: next };
      });
    }
  }

  function handleToggleMute() {
    const next = !selfMuted;
    setSelfMuted(next);
    voiceSessionRef.current?.setMuted(next);
  }

  function handleToggleDeafen() {
    const next = !selfDeafened;
    setSelfDeafened(next);
    if (next) setSelfMuted(true);
    voiceSessionRef.current?.setDeafened(next);
  }

  const handleSetVoiceGain = useCallback((pk: string, gainPct: number) => {
    setVoiceGains((prev) => {
      const next = { ...prev, [pk]: gainPct };
      try { setScoped("wavvon.voice_gains", JSON.stringify(next)); } catch {}
      return next;
    });
    voiceSessionRef.current?.setSenderGain(pk, gainPct);
  }, []);

  // Triggers a soundboard clip (soundboard.md §1): decode it via the same
  // browser Opus decoder used for playback, mix it into the outgoing voice
  // stream ahead of Opus encoding, then POST the attribution event. The
  // session itself is the "one clip at a time" enforcement (playClip
  // refuses while one is already queued); soundboardPlayingClipId only
  // drives the popover's disabled state.
  async function handleTriggerSoundboardClip(clip: SoundboardClip) {
    const session = voiceSessionRef.current;
    if (!session || !voiceChannelId) return;
    if (session.getPlayingClipId()) return;
    try {
      const bytes = await fetchSoundboardAudioBytes(clip.id);
      const pcm = await session.decodeClipPcm(bytes);
      if (!session.playClip(clip.id, pcm)) return;
      setSoundboardPlayingClipId(clip.id);
      const durationMs = (pcm.length / 48000) * 1000;
      setTimeout(() => {
        setSoundboardPlayingClipId((cur) => (cur === clip.id ? null : cur));
      }, durationMs + 200);
      await markSoundboardPlayed(clip.id, voiceChannelId);
    } catch (e) {
      showHubError(e instanceof HubApiError ? e.message : String(e));
    }
  }

  // WS arms — plugged into App's handler registry after its own hub-id filter.
  function onVoiceState(raw: unknown) {
    const m = raw as { type?: string; channel_id?: string; participants?: VoiceParticipant[]; participant?: VoiceParticipant; public_key?: string; speaking?: boolean };
    if (!m.channel_id) return;
    const channelId = m.channel_id;

    if (m.type === "voice_roster_update" && m.participants) {
      const rosterParticipants = m.participants as unknown as Array<{ sender_id: number; public_key: string }>;
      voiceSessionRef.current?.handleRosterUpdate(rosterParticipants);
    }

    if (m.type === "voice_participant_left") {
      if (!m.public_key) return;
      const leftKey = m.public_key;
      setVoicePartByChannel((prev) => {
        const existing = prev[channelId];
        if (!existing) return prev;
        const next = existing.filter((p) => p.public_key !== leftKey);
        if (next.length === 0) {
          const { [channelId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [channelId]: next };
      });
      setVoiceActiveUsers((prev) => {
        if (!prev.has(leftKey)) return prev;
        const next = new Set(prev);
        next.delete(leftKey);
        return next;
      });
    } else if (m.type === "voice_participant_joined") {
      if (!m.participant) return;
      const joined = m.participant;
      setVoicePartByChannel((prev) => {
        const existing = prev[channelId] ?? [];
        if (existing.some((p) => p.public_key === joined.public_key)) return prev;
        return { ...prev, [channelId]: [...existing, joined] };
      });
    } else if (m.type === "voice_participant_speaking") {
      if (!m.public_key) return;
      const speakerKey = m.public_key;
      const isSpeaking = m.speaking ?? true;
      setVoiceActiveUsers((prev) => {
        const hasSpeaker = prev.has(speakerKey);
        if (isSpeaking === hasSpeaker) return prev;
        const next = new Set(prev);
        if (isSpeaking) next.add(speakerKey); else next.delete(speakerKey);
        return next;
      });
    } else if (m.participants) {
      setVoicePartByChannel((prev) => ({ ...prev, [channelId]: m.participants! }));
    }
  }

  function onVoiceZoneState(raw: unknown) {
    const m = raw as { channel_id?: string; zones?: VoiceZone[] };
    if (!m.channel_id || !m.zones) return;
    voiceSessionRef.current?.handleZoneState(m.channel_id, m.zones);
  }

  function onVoiceZoneCreated(raw: unknown) {
    const m = raw as { zone_id?: string; name?: string; coordinate_system?: string; attenuation?: VoiceZoneAttenuation };
    if (!m.zone_id || !m.name || !m.coordinate_system || !m.attenuation) return;
    voiceSessionRef.current?.handleZoneCreated({
      zone_id: m.zone_id,
      name: m.name,
      coordinate_system: m.coordinate_system,
      attenuation: m.attenuation,
    });
  }

  function onVoiceZoneDestroyed(raw: unknown) {
    const m = raw as { zone_id?: string };
    if (!m.zone_id) return;
    voiceSessionRef.current?.handleZoneDestroyed(m.zone_id);
  }

  function onVoicePositionUpdated(raw: unknown) {
    const m = raw as { zone_id?: string; public_key?: string; position?: number[] };
    if (!m.zone_id || !m.public_key || !m.position) return;
    voiceSessionRef.current?.handlePositionUpdated(m.zone_id, m.public_key, m.position);
  }

  return {
    voiceChannelId,
    selfMuted,
    selfDeafened,
    voiceSessionRef,
    voiceGains,
    handleSetVoiceGain,
    voicePartByChannel,
    setVoicePartByChannel,
    voiceActiveUsers,
    myVoicePerms,
    soundboardPlayingClipId,
    handleVoiceJoin,
    handleVoiceLeave,
    handleToggleMute,
    handleToggleDeafen,
    handleTriggerSoundboardClip,
    onVoiceState,
    onVoiceZoneState,
    onVoiceZoneCreated,
    onVoiceZoneDestroyed,
    onVoicePositionUpdated,
  };
}
