import { hubFetch } from "../http";

export interface ChannelBan {
  channel_id: string;
  pubkey: string;
  banned_by: string;
  reason: string | null;
  banned_at: number;
}

// Per-channel bans (requires BAN_MEMBERS). The only channel-ban API — a
// duplicate family under /moderation/channels/{id}/bans was folded in on the
// hub (2026-08-08); this path used to drop `reason` on write.
export async function listChannelBans(channelId: string): Promise<ChannelBan[]> {
  const r = await hubFetch(`/channels/${channelId}/bans`);
  return r.json() as Promise<ChannelBan[]>;
}

export async function banFromChannel(
  channelId: string,
  pubkey: string,
  reason?: string | null,
): Promise<void> {
  await hubFetch(`/channels/${channelId}/bans`, {
    method: "POST",
    body: JSON.stringify({ pubkey, reason: reason ?? null }),
  });
}

export async function unbanFromChannel(channelId: string, pubkey: string): Promise<void> {
  await hubFetch(`/channels/${channelId}/bans/${pubkey}`, { method: "DELETE" });
}
