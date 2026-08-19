import { useEffect, useRef, useState } from "react";
import type { ScreenShareViewerRef } from "@wavvon/ui";
import { activeSession } from "@platform";
import { WebScreenShareSession } from "../platform/screenShare";
import type { ActiveStream, HubStreamInfo } from "../types";

interface UseScreenShareParams {
  activeHubIdRef: React.MutableRefObject<string | null>;
  showHubError: (msg: string) => void;
}

// Outbound screen share (chunk transport) + the cross-channel hub-streams
// discovery list. One hook because both feed the same viewer state:
// `stream_subscribed` (hub streams) pushes into `activeScreenShares` so the
// shared ScreenShareViewer renders subscribed cross-channel streams too.
export function useScreenShare({ activeHubIdRef, showHubError }: UseScreenShareParams) {
  const screenShareViewerRef = useRef<ScreenShareViewerRef | null>(null);
  const [activeScreenShares, setActiveScreenShares] = useState<ActiveStream[]>([]);
  const screenShareSessionRef = useRef<WebScreenShareSession | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareKbps, setShareKbps] = useState(0);
  const [shareLocalStream, setShareLocalStream] = useState<MediaStream | null>(null);
  const [hubStreams, setHubStreams] = useState<HubStreamInfo[]>([]);
  const [showHubStreams, setShowHubStreams] = useState(false);
  const subscribedStreamIds = useRef<Set<string>>(new Set());

  // Per-instance teardown on unmount (key-remounted account switch etc.);
  // module-level WS sessions are reset separately by AccountRoot.
  useEffect(() => {
    return () => {
      screenShareSessionRef.current?.stop();
    };
  }, []);

  async function handleStartShare(channelId: string) {
    if (sharing) return;
    const ws = activeSession().ws;
    if (!ws) { showHubError("Not connected"); return; }
    const session = new WebScreenShareSession(ws, channelId, {
      onBitrate: (kbps) => setShareKbps(kbps),
      onEnded: () => {
        screenShareSessionRef.current = null;
        setSharing(false);
        setShareKbps(0);
        setShareLocalStream(null);
      },
      onError: (msg) => showHubError("Screen share: " + msg),
    });
    try {
      await session.start();
      screenShareSessionRef.current = session;
      setSharing(true);
      setShareLocalStream(session.getStream());
    } catch (e) {
      // getDisplayMedia rejects when the user cancels the picker — not an error.
      const msg = e instanceof Error ? e.message : String(e);
      if (!/denied|cancel|aborted|not allowed/i.test(msg)) showHubError("Screen share: " + msg);
    }
  }

  function handleStopShare() {
    screenShareSessionRef.current?.stop();
    screenShareSessionRef.current = null;
    setSharing(false);
    setShareKbps(0);
    setShareLocalStream(null);
  }

  function handleOpenHubStreams() {
    try { activeSession().ws?.requestStreamList(); } catch {}
    setShowHubStreams(true);
  }
  function handleWatchStream(channelId: string, streamId: string) {
    try { activeSession().ws?.subscribeStream(channelId, streamId); } catch {}
  }
  function handleStopWatchStream(channelId: string, streamId: string) {
    try { activeSession().ws?.unsubscribeStream(channelId, streamId); } catch {}
    subscribedStreamIds.current.delete(streamId);
    setActiveScreenShares((prev) => prev.filter((s) => s.stream_id !== streamId));
    screenShareViewerRef.current?.stopStream(streamId);
  }

  // WS arm — plugged into App's handler registry.
  function onScreenShare(raw: unknown) {
    const m = raw as Record<string, unknown>;
    if (m._hub_id !== activeHubIdRef.current) return;
    if (m.type === "screen_share_started") {
      const ev = m as unknown as ActiveStream & { channel_id: string; _hub_id: string };
      setActiveScreenShares((prev) => {
        if (prev.some((s) => s.stream_id === ev.stream_id)) return prev;
        return [...prev, { stream_id: ev.stream_id, sharer_pubkey: ev.sharer_pubkey, kind: ev.kind, mime: ev.mime, has_audio: ev.has_audio }];
      });
      // Keep the cross-channel discovery list live.
      setHubStreams((prev) => prev.some((s) => s.stream_id === ev.stream_id) ? prev : [...prev, {
        channel_id: ev.channel_id, stream_id: ev.stream_id, sharer_pubkey: ev.sharer_pubkey, kind: ev.kind, mime: ev.mime, has_audio: ev.has_audio,
      }]);
    } else if (m.type === "screen_share_stopped") {
      const streamId = m.stream_id as string;
      setActiveScreenShares((prev) => prev.filter((s) => s.stream_id !== streamId));
      setHubStreams((prev) => prev.filter((s) => s.stream_id !== streamId));
      screenShareViewerRef.current?.stopStream(streamId);
    } else if (m.type === "hub_streams") {
      setHubStreams((m.streams as HubStreamInfo[]) ?? []);
    } else if (m.type === "stream_subscribed") {
      // A cross-channel stream we asked to watch — register it so the
      // viewer builds a MediaSource for its incoming chunks.
      const streamId = m.stream_id as string;
      subscribedStreamIds.current.add(streamId);
      setActiveScreenShares((prev) => prev.some((s) => s.stream_id === streamId) ? prev : [...prev, {
        stream_id: streamId,
        sharer_pubkey: m.sharer_pubkey as string,
        kind: (m.kind as "screen" | "webcam") ?? "screen",
        mime: m.mime as string,
        has_audio: !!m.has_audio,
      }]);
    } else if (m.type === "stream_subscription_ended") {
      const streamId = m.stream_id as string;
      subscribedStreamIds.current.delete(streamId);
      setActiveScreenShares((prev) => prev.filter((s) => s.stream_id !== streamId));
      screenShareViewerRef.current?.stopStream(streamId);
    }
  }

  function onScreenShareChunk(streamId: string, isInit: boolean, data: ArrayBuffer) {
    screenShareViewerRef.current?.appendChunk(streamId, isInit, data);
  }

  return {
    screenShareViewerRef,
    activeScreenShares,
    sharing,
    shareKbps,
    shareLocalStream,
    hubStreams,
    showHubStreams,
    setShowHubStreams,
    subscribedStreamIds,
    handleStartShare,
    handleStopShare,
    handleOpenHubStreams,
    handleWatchStream,
    handleStopWatchStream,
    onScreenShare,
    onScreenShareChunk,
  };
}
