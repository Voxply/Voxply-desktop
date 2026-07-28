import { useState } from "react";

// Per-channel first-notifying message ID. Set when a message first causes a
// pin (unread dot) to appear; cleared when the user reaches the bottom of
// the channel. Drives the "Jump to first notification" affordance.
export function useFirstNotify() {
  const [firstNotifyId, setFirstNotifyId] = useState<
    Record<string, Record<string, string>>
  >({});

  function setFirstNotify(hubId: string, channelId: string, messageId: string) {
    setFirstNotifyId((prev) => {
      const hubMap = prev[hubId] ?? {};
      if (hubMap[channelId]) return prev; // already tracking one; keep the earliest
      return { ...prev, [hubId]: { ...hubMap, [channelId]: messageId } };
    });
  }

  function clearFirstNotify(hubId: string, channelId: string) {
    setFirstNotifyId((prev) => {
      const hubMap = prev[hubId];
      if (!hubMap?.[channelId]) return prev;
      const { [channelId]: _, ...rest } = hubMap;
      return { ...prev, [hubId]: rest };
    });
  }

  function clearHubFirstNotify(hubId: string) {
    setFirstNotifyId((prev) => {
      if (!prev[hubId] || Object.keys(prev[hubId]).length === 0) return prev;
      return { ...prev, [hubId]: {} };
    });
  }

  return { firstNotifyId, setFirstNotify, clearFirstNotify, clearHubFirstNotify };
}
