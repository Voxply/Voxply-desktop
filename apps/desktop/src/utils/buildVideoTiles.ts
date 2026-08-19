import type { User } from "../types";

export interface VideoTile {
  pubkey: string;
  displayName: string;
  stream: MediaStream;
  speaking: boolean;
  pinned: boolean;
}

export function buildVideoTiles(
  remoteStreams: Map<string, MediaStream>,
  videoPubkeys: Set<string>,
  tileUsers: User[],
  tileSpeak: Set<string>,
  pinnedPubkey: string | null,
): VideoTile[] {
  const tiles: VideoTile[] = [];
  for (const [pk, stream] of remoteStreams) {
    if (!videoPubkeys.has(pk)) continue;
    const u = tileUsers.find((x) => x.public_key === pk);
    tiles.push({
      pubkey: pk,
      displayName: u?.display_name ?? pk.slice(0, 8),
      stream,
      speaking: tileSpeak.has(pk),
      pinned: pinnedPubkey === pk,
    });
  }
  tiles.sort(
    (a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      (b.speaking ? 1 : 0) - (a.speaking ? 1 : 0),
  );
  return tiles;
}
