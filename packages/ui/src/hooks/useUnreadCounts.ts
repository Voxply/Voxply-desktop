import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bumpChannelUnread,
  clearChannelUnread,
  clearHubChannelUnread,
  seedHubUnread,
  totalUnread,
  unreadCountsByHub,
  unreadDocumentTitle,
} from "../utils/unreadCounts";

export interface UnreadCountsDeps {
  // Read the persisted per-hub/per-channel map once at mount. Absent on a
  // client that keeps unread state in memory only.
  loadPersisted?: () => Promise<Record<string, Record<string, boolean>> | null>;
  // Write it back whenever it changes. Never called for the value that came
  // out of loadPersisted — restoring is not a change.
  persist?: (state: Record<string, Record<string, boolean>>) => void;
  // The unread total, whenever it changes. For chrome outside the page: the
  // desktop tray badge. The document title is handled here, since both
  // clients set the identical string.
  onTotalChange?: (total: number) => void;
}

export interface UnreadCounts {
  unreadByChannel: Record<string, Record<string, boolean>>;
  unreadByHub: Record<string, number>;
  unreadDms: Record<string, boolean>;
  setUnreadDms: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  bumpUnread: (hubId: string, channelId: string) => void;
  clearUnread: (hubId: string, channelId: string) => void;
  clearHubUnread: (hubId: string) => void;
  seedUnreadFromServer: (
    hubId: string,
    counts: { channel_id: string; unread_count: number }[],
  ) => void;
}

// Unread state for channels and DMs, plus the derived per-hub counts and the
// document title. Converged from the two app copies (client-parity.md): web
// owned unreadDms and seeding from the server, desktop owned persistence, the
// per-hub counts and the tray badge, and both set the same document title from
// their own App.tsx. Everything platform-bound travels in through deps.
export function useUnreadCounts({
  loadPersisted,
  persist,
  onTotalChange,
}: UnreadCountsDeps = {}): UnreadCounts {
  const [unreadByChannel, setUnreadByChannel] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [unreadDms, setUnreadDms] = useState<Record<string, boolean>>({});

  // Persisting from inside a state updater — which is what desktop did — runs
  // twice under StrictMode and writes during render. Doing it in an effect
  // needs this guard, or restoring the saved map immediately writes it back.
  const restored = useRef(!loadPersisted);
  useEffect(() => {
    if (!loadPersisted) return;
    let cancelled = false;
    void loadPersisted()
      .then((saved) => {
        if (cancelled) return;
        if (saved) setUnreadByChannel(saved);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) restored.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [loadPersisted]);

  useEffect(() => {
    if (!persist || !restored.current) return;
    persist(unreadByChannel);
  }, [persist, unreadByChannel]);

  const unreadByHub = useMemo(() => unreadCountsByHub(unreadByChannel), [unreadByChannel]);

  const total = useMemo(() => totalUnread(unreadByHub), [unreadByHub]);

  useEffect(() => {
    document.title = unreadDocumentTitle(total);
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  const bumpUnread = useCallback((hubId: string, channelId: string) => {
    setUnreadByChannel((prev) => bumpChannelUnread(prev, hubId, channelId));
  }, []);

  const clearUnread = useCallback((hubId: string, channelId: string) => {
    setUnreadByChannel((prev) => clearChannelUnread(prev, hubId, channelId));
  }, []);

  const clearHubUnread = useCallback((hubId: string) => {
    setUnreadByChannel((prev) => clearHubChannelUnread(prev, hubId));
  }, []);

  const seedUnreadFromServer = useCallback(
    (hubId: string, counts: { channel_id: string; unread_count: number }[]) => {
      setUnreadByChannel((prev) => seedHubUnread(prev, hubId, counts));
    },
    [],
  );

  return {
    unreadByChannel,
    unreadByHub,
    unreadDms,
    setUnreadDms,
    bumpUnread,
    clearUnread,
    clearHubUnread,
    seedUnreadFromServer,
  };
}
