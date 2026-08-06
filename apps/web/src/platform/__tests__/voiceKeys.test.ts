import { describe, it, expect } from "vitest";
import { dhKeypairFromSeed, bytesToHex } from "@wavvon/core";
import { VoiceKeyManager } from "../voiceKeys";

function seed(fill: number): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, i) => (fill + i) & 0xff);
}

const CHANNEL_ID = "chan-test";
const A_SEED_HEX = bytesToHex(seed(0x10));
const B_SEED_HEX = bytesToHex(seed(0x20));
const A_DH_PUB_HEX = bytesToHex(dhKeypairFromSeed(A_SEED_HEX).dhPub);
const B_DH_PUB_HEX = bytesToHex(dhKeypairFromSeed(B_SEED_HEX).dhPub);

const DH_BY_PUBKEY: Record<string, string> = {
  "pk-a": A_DH_PUB_HEX,
  "pk-b": B_DH_PUB_HEX,
};

function fetchDhKey(pubkey: string): Promise<string | null> {
  return Promise.resolve(DH_BY_PUBKEY[pubkey] ?? null);
}

describe("VoiceKeyManager", () => {
  it("join: builds one offer bundle per resolvable recipient", async () => {
    const a = new VoiceKeyManager(CHANNEL_ID, A_SEED_HEX, fetchDhKey);
    const bundles = await a.buildOffer(["pk-b", "pk-unknown"]);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].recipient_pubkey).toBe("pk-b");
    expect(bundles[0].ciphertext_hex).toMatch(/^[0-9a-f]+$/);
    expect(bundles[0].nonce_hex).toMatch(/^[0-9a-f]+$/);
  });

  it("received: unwraps a peer's offer and stores it under their pubkey/key_id", async () => {
    const a = new VoiceKeyManager(CHANNEL_ID, A_SEED_HEX, fetchDhKey);
    const b = new VoiceKeyManager(CHANNEL_ID, B_SEED_HEX, fetchDhKey);

    const [bundle] = await b.buildOffer(["pk-a"]);
    await a.receiveKey("pk-b", bundle.ciphertext_hex, bundle.nonce_hex);

    const stored = a.lookupKey("pk-b", b.ownKey().keyId);
    expect(stored).not.toBeNull();
    expect(bytesToHex(stored!.key)).toBe(bytesToHex(b.ownKey().key));
    expect(bytesToHex(stored!.salt)).toBe(bytesToHex(b.ownKey().salt));
  });

  it("received: silently no-ops when the claimed sender's DH key can't be resolved", async () => {
    const a = new VoiceKeyManager(CHANNEL_ID, A_SEED_HEX, fetchDhKey);
    await expect(a.receiveKey("pk-ghost", "aa", "bb")).resolves.toBeUndefined();
    expect(a.lookupKey("pk-ghost", 1)).toBeNull();
  });

  it("participant-left: rotates to a fresh key_id/key/salt and re-offers to whoever remains", async () => {
    const a = new VoiceKeyManager(CHANNEL_ID, A_SEED_HEX, fetchDhKey);
    const before = a.ownKey();

    const bundles = await a.rotate(["pk-b"]);
    const after = a.ownKey();

    expect(after.keyId).toBe(before.keyId + 1);
    expect(bytesToHex(after.key)).not.toBe(bytesToHex(before.key));
    expect(after.ctr).toBe(0n);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].recipient_pubkey).toBe("pk-b");
  });

  it("lookupKey returns null for an unknown sender or key_id", () => {
    const a = new VoiceKeyManager(CHANNEL_ID, A_SEED_HEX, fetchDhKey);
    expect(a.lookupKey("pk-nobody", 1)).toBeNull();
  });

  it("paired device: wraps/unwraps with the canonical DH scalar, not its own seed", async () => {
    // Paired-device shape (multi-device.md "Mechanism A"): the device's own
    // signing seed is NOT the seed behind the DH key published under its
    // roster pubkey ("pk-a" resolves to A's canonical DH pub). The manager
    // is given the canonical scalar — what resolveDmSendAttribution returns.
    const DEVICE_SEED_HEX = bytesToHex(seed(0x30));
    const canonicalDhPriv = dhKeypairFromSeed(A_SEED_HEX).dhPriv;

    const paired = new VoiceKeyManager(CHANNEL_ID, DEVICE_SEED_HEX, fetchDhKey, canonicalDhPriv);
    const b = new VoiceKeyManager(CHANNEL_ID, B_SEED_HEX, fetchDhKey);

    // B wraps to A's published (canonical) DH key — the paired device must unwrap.
    const [toA] = await b.buildOffer(["pk-a"]);
    await paired.receiveKey("pk-b", toA.ciphertext_hex, toA.nonce_hex);
    expect(paired.lookupKey("pk-b", b.ownKey().keyId)).not.toBeNull();

    // The paired device wraps as the canonical identity — B, fetching
    // "pk-a"'s published DH key to unwrap voice_key_received, must succeed.
    const [toB] = await paired.buildOffer(["pk-b"]);
    await b.receiveKey("pk-a", toB.ciphertext_hex, toB.nonce_hex);
    expect(b.lookupKey("pk-a", paired.ownKey().keyId)).not.toBeNull();

    // The original bug: without the canonical scalar, the device-seed-derived
    // key silently fails to unwrap the very same bundle.
    const buggy = new VoiceKeyManager(CHANNEL_ID, DEVICE_SEED_HEX, fetchDhKey);
    await buggy.receiveKey("pk-b", toA.ciphertext_hex, toA.nonce_hex);
    expect(buggy.lookupKey("pk-b", b.ownKey().keyId)).toBeNull();
  });

  it("keeps only the last 2 key generations per sender", async () => {
    const a = new VoiceKeyManager(CHANNEL_ID, A_SEED_HEX, fetchDhKey);
    const b = new VoiceKeyManager(CHANNEL_ID, B_SEED_HEX, fetchDhKey);

    for (let i = 0; i < 3; i++) {
      const [bundle] = await b.buildOffer(["pk-a"]);
      await a.receiveKey("pk-b", bundle.ciphertext_hex, bundle.nonce_hex);
      await b.rotate(["pk-a"]);
    }

    expect(a.lookupKey("pk-b", 1)).toBeNull();
    expect(a.lookupKey("pk-b", 2)).not.toBeNull();
    expect(a.lookupKey("pk-b", 3)).not.toBeNull();
  });
});
