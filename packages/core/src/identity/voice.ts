import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { gcm } from "@noble/ciphers/aes";
import { x25519 } from "@noble/curves/ed25519";
import { bytesToHex } from "../hex";
import { dhKeypairFromSeed } from "./crypto";

// Voice-transport v2 E2E crypto primitives — byte-for-byte mirror of
// `server/crates/identity/src/voice.rs` (see docs/docs/voice-transport-v2.md).
//
// - Key wrap: static-static X25519 (sender's identity-derived DH key,
//   recipient's), same construction as the group-DM wrap_chain_key, distinct
//   HKDF info tag so the two constructions can't be confused.
// - Packet seal: cleartext 16-byte header (key_id, ctr, ts) doubles as
//   AES-256-GCM AAD; nonce = nonce_salt[4] || ctr_be[8].

const VOICE_KEY_INFO = new TextEncoder().encode("wavvon/voice-key/v1");
const WRAP_PLAINTEXT_LEN = 40;
const PACKET_HEADER_LEN = 16;

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function writeU32BE(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n, false);
  return buf;
}

function writeU64BE(n: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, n, false);
  return buf;
}

function readU32BE(b: Uint8Array, offset: number): number {
  return ((b[offset] << 24) | (b[offset + 1] << 16) | (b[offset + 2] << 8) | b[offset + 3]) >>> 0;
}

function readU64BE(b: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(b[offset + i]);
  return v;
}

function voiceWrapKey(sharedSecret: Uint8Array, channelId: string): Uint8Array {
  return hkdf(sha256, sharedSecret, new TextEncoder().encode(channelId), VOICE_KEY_INFO, 32);
}

// `senderDhPrivOverride`: same semantics as `initDrSession`'s
// `myStaticDhPrivOverride` in crypto.ts — a paired device passes its
// unwrapped canonical DH scalar (multi-device.md "Mechanism A") instead of
// deriving from its own seed, so the implicit sender X25519 key matches the
// one published under the roster pubkey peers fetch. Omitted = derive from
// the seed (today's behavior, vector-pinned).
export function voiceKeyWrap(
  senderEd25519Seed: Uint8Array,
  recipientX25519Pub: Uint8Array,
  channelId: string,
  senderKey: Uint8Array,
  nonceSalt: Uint8Array,
  keyId: number,
  nonce?: Uint8Array,
  senderDhPrivOverride?: Uint8Array,
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  const dhPriv = senderDhPrivOverride ?? dhKeypairFromSeed(bytesToHex(senderEd25519Seed)).dhPriv;
  const shared = x25519.scalarMult(dhPriv, recipientX25519Pub);
  const wrapKey = voiceWrapKey(shared, channelId);

  const plaintext = concat(senderKey, nonceSalt, writeU32BE(keyId));
  const n = nonce ?? crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = gcm(wrapKey, n).encrypt(plaintext);
  return { ciphertext, nonce: n };
}

// `recipientDhPrivOverride`: see `voiceKeyWrap` — the scalar behind the DH
// key published under OUR roster pubkey, which is what senders wrap to.
export function voiceKeyUnwrap(
  recipientEd25519Seed: Uint8Array,
  senderX25519Pub: Uint8Array,
  channelId: string,
  ciphertext: Uint8Array,
  wrapNonce: Uint8Array,
  recipientDhPrivOverride?: Uint8Array,
): { senderKey: Uint8Array; nonceSalt: Uint8Array; keyId: number } {
  const dhPriv =
    recipientDhPrivOverride ?? dhKeypairFromSeed(bytesToHex(recipientEd25519Seed)).dhPriv;
  const shared = x25519.scalarMult(dhPriv, senderX25519Pub);
  const wrapKey = voiceWrapKey(shared, channelId);

  const plaintext = gcm(wrapKey, wrapNonce).decrypt(ciphertext);
  if (plaintext.length !== WRAP_PLAINTEXT_LEN) {
    throw new Error(`wrapped voice key plaintext must be ${WRAP_PLAINTEXT_LEN} bytes, got ${plaintext.length}`);
  }
  return {
    senderKey: plaintext.slice(0, 32),
    nonceSalt: plaintext.slice(32, 36),
    keyId: readU32BE(plaintext, 36),
  };
}

export function voicePacketSeal(
  senderKey: Uint8Array,
  nonceSalt: Uint8Array,
  keyId: number,
  ctr: bigint,
  ts: number,
  opus: Uint8Array,
): Uint8Array {
  const header = concat(writeU32BE(keyId), writeU64BE(ctr), writeU32BE(ts));
  const nonce = concat(nonceSalt, writeU64BE(ctr));
  const ciphertext = gcm(senderKey, nonce, header).encrypt(opus);
  return concat(header, ciphertext);
}

export function voicePacketOpen(
  senderKey: Uint8Array,
  nonceSalt: Uint8Array,
  packet: Uint8Array,
): { keyId: number; ctr: bigint; ts: number; opus: Uint8Array } {
  const MIN_LEN = PACKET_HEADER_LEN + 16; // header + GCM tag
  if (packet.length < MIN_LEN) {
    throw new Error(`voice packet too short: ${packet.length} bytes, minimum ${MIN_LEN}`);
  }

  const header = packet.slice(0, PACKET_HEADER_LEN);
  const keyId = readU32BE(header, 0);
  const ctr = readU64BE(header, 4);
  const ts = readU32BE(header, 12);

  const nonce = concat(nonceSalt, header.slice(4, 12));
  const opus = gcm(senderKey, nonce, header).decrypt(packet.slice(PACKET_HEADER_LEN));
  return { keyId, ctr, ts, opus };
}
