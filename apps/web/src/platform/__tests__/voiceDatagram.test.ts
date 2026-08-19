import { describe, it, expect } from "vitest";
import { voicePacketSeal } from "@wavvon/core";
import { parseDownlinkDatagram, peekSealedKeyId, ReplayGuard } from "../voiceDatagram";

function u16be(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff];
}

describe("parseDownlinkDatagram", () => {
  it("parses sender_id/packet_type/sealed from a normal (0x00) frame", () => {
    const sealed = new Uint8Array([9, 9, 9]);
    const data = new Uint8Array([...u16be(42), 0x00, ...sealed]);
    expect(parseDownlinkDatagram(data)).toEqual({ senderId: 42, packetType: 0x00, sealed });
  });

  it("parses a whisper (0x01) frame the same way", () => {
    const data = new Uint8Array([...u16be(7), 0x01, 1, 2]);
    expect(parseDownlinkDatagram(data)?.packetType).toBe(0x01);
  });

  it("drops an unrecognized packet_type", () => {
    const data = new Uint8Array([0, 1, 0x02, 1, 2]);
    expect(parseDownlinkDatagram(data)).toBeNull();
  });

  it("drops a datagram too short to hold the routing prefix", () => {
    expect(parseDownlinkDatagram(new Uint8Array([0, 1]))).toBeNull();
  });
});

describe("peekSealedKeyId", () => {
  it("reads the cleartext key_id without decrypting", () => {
    const key = new Uint8Array(32).fill(1);
    const salt = new Uint8Array(4).fill(2);
    const sealed = voicePacketSeal(key, salt, 7, 0n, 1000, new Uint8Array([1, 2, 3]));
    expect(peekSealedKeyId(sealed)).toBe(7);
  });

  it("throws on a packet too short to hold a key_id", () => {
    expect(() => peekSealedKeyId(new Uint8Array([1, 2, 3]))).toThrow();
  });
});

describe("ReplayGuard", () => {
  it("accepts the first packet under a (sender_id, key_id) pair", () => {
    const guard = new ReplayGuard();
    expect(guard.accept(1, 1, 0n)).toBe(true);
  });

  it("rejects a ctr at or below the watermark", () => {
    const guard = new ReplayGuard();
    guard.accept(1, 1, 5n);
    expect(guard.accept(1, 1, 5n)).toBe(false);
    expect(guard.accept(1, 1, 3n)).toBe(false);
  });

  it("accepts a strictly increasing ctr and advances the watermark", () => {
    const guard = new ReplayGuard();
    guard.accept(1, 1, 5n);
    expect(guard.accept(1, 1, 6n)).toBe(true);
    expect(guard.accept(1, 1, 6n)).toBe(false);
  });

  it("tracks watermarks independently per (sender_id, key_id)", () => {
    const guard = new ReplayGuard();
    guard.accept(1, 1, 10n);
    expect(guard.accept(2, 1, 1n)).toBe(true);
    expect(guard.accept(1, 2, 1n)).toBe(true);
  });
});
