import { describe, it, expect } from "vitest";
import { applyWhisperLogEvent, pickReplyPubkey } from "../whisperInbox";

describe("applyWhisperLogEvent", () => {
  it("appends a new live entry on whisper start", () => {
    const log = applyWhisperLogEvent([], "pk1", true, 1000);
    expect(log).toEqual([{ pubkey: "pk1", startedAt: 1000, live: true }]);
  });

  it("does not duplicate an already-live entry for the same sender", () => {
    const first = applyWhisperLogEvent([], "pk1", true, 1000);
    const second = applyWhisperLogEvent(first, "pk1", true, 2000);
    expect(second).toEqual(first);
  });

  it("marks the live entry ended on whisper stop, keeping startedAt", () => {
    const started = applyWhisperLogEvent([], "pk1", true, 1000);
    const stopped = applyWhisperLogEvent(started, "pk1", false, 5000);
    expect(stopped).toEqual([{ pubkey: "pk1", startedAt: 1000, live: false }]);
  });

  it("reopens a new entry once a prior one has ended", () => {
    const started = applyWhisperLogEvent([], "pk1", true, 1000);
    const stopped = applyWhisperLogEvent(started, "pk1", false, 2000);
    const restarted = applyWhisperLogEvent(stopped, "pk1", true, 3000);
    expect(restarted).toEqual([
      { pubkey: "pk1", startedAt: 1000, live: false },
      { pubkey: "pk1", startedAt: 3000, live: true },
    ]);
  });

  it("tracks multiple senders independently", () => {
    const a = applyWhisperLogEvent([], "pk1", true, 1000);
    const both = applyWhisperLogEvent(a, "pk2", true, 1500);
    expect(both).toEqual([
      { pubkey: "pk1", startedAt: 1000, live: true },
      { pubkey: "pk2", startedAt: 1500, live: true },
    ]);
  });
});

describe("pickReplyPubkey", () => {
  it("returns null on an empty log", () => {
    expect(pickReplyPubkey([])).toBeNull();
  });

  it("prefers the most recent LIVE whisperer over a newer ended one", () => {
    expect(pickReplyPubkey([
      { pubkey: "live-old", startedAt: 1000, live: true },
      { pubkey: "ended-new", startedAt: 5000, live: false },
    ])).toBe("live-old");
  });

  it("picks the most recently added live entry when several are live", () => {
    expect(pickReplyPubkey([
      { pubkey: "pk1", startedAt: 1000, live: true },
      { pubkey: "pk2", startedAt: 2000, live: true },
    ])).toBe("pk2");
  });

  it("falls back to the latest ended entry when none are live", () => {
    expect(pickReplyPubkey([
      { pubkey: "pk1", startedAt: 3000, live: false },
      { pubkey: "pk2", startedAt: 1000, live: false },
    ])).toBe("pk1");
  });
});
