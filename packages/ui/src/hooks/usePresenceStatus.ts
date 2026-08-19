import { useRef, useState } from "react";

export type PresenceStatus = "online" | "away" | "dnd" | "invisible";

export interface PresenceStatusDeps {
  // Raw JSON string from wherever the app persists presence (scoped
  // localStorage on web, plain localStorage on desktop). May throw.
  loadRaw: () => string | null;
  persist: (p: { status: PresenceStatus }) => void;
  // Push the status to every connected hub session (fire-and-forget; the
  // app owns the transport and its error handling).
  broadcast: (status: PresenceStatus) => void;
  // Optimistic self-row update in the member roster: the hubs' member_status
  // broadcasts will confirm. Invisible shows the user offline (to everyone,
  // incl. their own roster view); the footer picker still reflects it.
  applyToRoster: (status: PresenceStatus) => void;
}

// Own presence — shared across every hub this account is on, not per-hub;
// the client is the source of truth and broadcasts it to every session,
// re-applying on (re)connect. Distinct from hub mute (notify modes).
// Includes the "clear after" TTL: while connected, reverts to Online when
// it fires (presence is online-only anyway, so disconnecting also resets it).
export function usePresenceStatus({ loadRaw, persist, broadcast, applyToRoster }: PresenceStatusDeps) {
  const [myPresence, setMyPresence] = useState<{ status: PresenceStatus }>(() => {
    try {
      const raw = loadRaw();
      if (raw) {
        const s = (JSON.parse(raw) as { status?: string }).status;
        if (s === "away" || s === "dnd" || s === "invisible") return { status: s };
      }
    } catch { /* storage unavailable or corrupt */ }
    return { status: "online" };
  });
  // Mirrored for frozen WS handlers (reconnect re-push, notification gating).
  const myPresenceRef = useRef(myPresence);
  myPresenceRef.current = myPresence;
  const presenceTtlRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSetStatus(status: PresenceStatus, ttlMinutes: number | null) {
    if (presenceTtlRef.current) {
      clearTimeout(presenceTtlRef.current);
      presenceTtlRef.current = null;
    }
    const apply = (s: PresenceStatus) => {
      setMyPresence({ status: s });
      try { persist({ status: s }); } catch { /* storage unavailable */ }
      broadcast(s);
      applyToRoster(s);
    };
    apply(status);
    if (status !== "online" && ttlMinutes) {
      presenceTtlRef.current = setTimeout(() => {
        presenceTtlRef.current = null;
        apply("online");
      }, ttlMinutes * 60_000);
    }
  }

  return { myPresence, myPresenceRef, handleSetStatus };
}
