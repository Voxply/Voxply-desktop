// Canonical vectors from server/crates/identity/tests/wire_vectors.rs — pin
// this file's encoders to the exact bytes the Rust identity crate produces.
import { describe, it, expect } from "vitest";
import { bytesToHex, hexToBytes } from "../hex";
import { dhKeypairFromSeed } from "./crypto";
import { voiceKeyWrap, voiceKeyUnwrap, voicePacketSeal, voicePacketOpen } from "./voice";

function seed(fillFrom: number): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, i) => (fillFrom + i) & 0xff);
}

const SENDER_SEED = seed(0x61);
const RECIPIENT_SEED = seed(0x81);
const SENDER_KEY = seed(0xc1);
const CHANNEL_ID = "chan-vector-1";
const NONCE_SALT = hexToBytes("aabbccdd");
const KEY_ID = 99;
const WRAP_NONCE = hexToBytes("0102030405060708090a0b0c");

const EXPECTED_WRAP_CIPHERTEXT =
  "98c781916feb2ea99f7dbf23f15fd58bb9ab8613ec348ebe8c93814ee695a11de59ce0341e00d354b9ff665b5ab38d27a0ab526c71cf495e";

const EXPECTED_PACKET_CTR0 =
  "000000630000000000000000000003e832dbc83526f73e83a90b59aaab331078f359b00fcfab1fa0e6c514ea2034da79b2";
const EXPECTED_PACKET_CTR7 =
  "0000006300000000000000070000138823adf6d5a771baa49d8de5ed1c99e5d5f12e9fffa9ba4fb471ca80882171360024";

describe("voiceKeyWrap / voiceKeyUnwrap", () => {
  it("matches the fixed wrap vector", () => {
    const recipientPub = dhKeypairFromSeed(bytesToHex(RECIPIENT_SEED)).dhPub;

    const { ciphertext, nonce } = voiceKeyWrap(
      SENDER_SEED,
      recipientPub,
      CHANNEL_ID,
      SENDER_KEY,
      NONCE_SALT,
      KEY_ID,
      WRAP_NONCE,
    );

    expect(bytesToHex(nonce)).toBe(bytesToHex(WRAP_NONCE));
    expect(bytesToHex(ciphertext)).toBe(EXPECTED_WRAP_CIPHERTEXT);
  });

  it("unwraps the fixed vector back to sender_key/nonce_salt/key_id", () => {
    const senderPub = dhKeypairFromSeed(bytesToHex(SENDER_SEED)).dhPub;

    const { senderKey, nonceSalt, keyId } = voiceKeyUnwrap(
      RECIPIENT_SEED,
      senderPub,
      CHANNEL_ID,
      hexToBytes(EXPECTED_WRAP_CIPHERTEXT),
      WRAP_NONCE,
    );

    expect(bytesToHex(senderKey)).toBe(bytesToHex(SENDER_KEY));
    expect(bytesToHex(nonceSalt)).toBe(bytesToHex(NONCE_SALT));
    expect(keyId).toBe(KEY_ID);
  });

  it("round-trips with a random wrap nonce", () => {
    const recipientPub = dhKeypairFromSeed(bytesToHex(RECIPIENT_SEED)).dhPub;
    const senderPub = dhKeypairFromSeed(bytesToHex(SENDER_SEED)).dhPub;

    const { ciphertext, nonce } = voiceKeyWrap(
      SENDER_SEED,
      recipientPub,
      "chan-round-trip",
      SENDER_KEY,
      NONCE_SALT,
      7,
    );

    const unwrapped = voiceKeyUnwrap(RECIPIENT_SEED, senderPub, "chan-round-trip", ciphertext, nonce);
    expect(bytesToHex(unwrapped.senderKey)).toBe(bytesToHex(SENDER_KEY));
    expect(bytesToHex(unwrapped.nonceSalt)).toBe(bytesToHex(NONCE_SALT));
    expect(unwrapped.keyId).toBe(7);
  });

  it("rejects unwrap under the wrong channel id", () => {
    const recipientPub = dhKeypairFromSeed(bytesToHex(RECIPIENT_SEED)).dhPub;
    const senderPub = dhKeypairFromSeed(bytesToHex(SENDER_SEED)).dhPub;

    const { ciphertext, nonce } = voiceKeyWrap(SENDER_SEED, recipientPub, "chan-a", SENDER_KEY, NONCE_SALT, 1);

    expect(() => voiceKeyUnwrap(RECIPIENT_SEED, senderPub, "chan-b", ciphertext, nonce)).toThrow();
  });
});

describe("voicePacketSeal / voicePacketOpen", () => {
  const opus = new TextEncoder().encode("opus-frame-vector");

  it("matches the fixed vector at ctr=0", () => {
    const packet = voicePacketSeal(SENDER_KEY, NONCE_SALT, KEY_ID, 0n, 1000, opus);
    expect(bytesToHex(packet)).toBe(EXPECTED_PACKET_CTR0);
  });

  it("matches the fixed vector at ctr=7", () => {
    const packet = voicePacketSeal(SENDER_KEY, NONCE_SALT, KEY_ID, 7n, 5000, opus);
    expect(bytesToHex(packet)).toBe(EXPECTED_PACKET_CTR7);
  });

  it("throws when the header is tampered with", () => {
    const packet = voicePacketSeal(SENDER_KEY, NONCE_SALT, KEY_ID, 0n, 1000, opus);
    packet[0] ^= 0xff;
    expect(() => voicePacketOpen(SENDER_KEY, NONCE_SALT, packet)).toThrow();
  });

  it("rejects packets shorter than header + tag", () => {
    expect(() => voicePacketOpen(SENDER_KEY, NONCE_SALT, new Uint8Array(31))).toThrow();
  });

  it("round-trips ctr/ts/keyId/opus", () => {
    const packet = voicePacketSeal(SENDER_KEY, NONCE_SALT, 3, 42n, 9000, opus);
    const opened = voicePacketOpen(SENDER_KEY, NONCE_SALT, packet);
    expect(opened.keyId).toBe(3);
    expect(opened.ctr).toBe(42n);
    expect(opened.ts).toBe(9000);
    expect(bytesToHex(opened.opus)).toBe(bytesToHex(opus));
  });
});
