import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SubkeyCert } from "@shared/types";
import { setSession, setActiveHubId, resetHubSessions } from "../session";
import { ensureHomeHubDesignation } from "../commands/identity";

const HUB_URL = "https://hub.example";
const HUB_ID = "hub-pub-key";
const SEED = "11".repeat(32);

beforeEach(() => {
  resetHubSessions();
  setSession(HUB_ID, {
    hub_id: HUB_ID,
    hub_url: HUB_URL,
    hub_pubkey: HUB_ID,
    hub_name: "Hub",
    hub_icon: null,
    token: "active-token",
    ws: null,
  });
  setActiveHubId(HUB_ID);
});

describe("ensureHomeHubDesignation", () => {
  it("publishes this hub as slot 0 when the account has no designation", async () => {
    const posted: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") return new Response("Not found", { status: 404 });
      posted.push(JSON.parse(init?.body as string));
      expect(url).toContain("/designation");
      return new Response("{}", { status: 200 });
    }));

    await ensureHomeHubDesignation({ seed_hex: SEED }, `${HUB_URL}/`);

    expect(posted).toHaveLength(1);
    const list = posted[0] as { hubs: string[]; sequence: number; signature: string };
    // Trailing slash stripped: the designation is compared as a string by
    // every consumer, so two spellings of one hub are two hubs.
    expect(list.hubs).toEqual([HUB_URL]);
    expect(list.sequence).toBe(1);
    expect(list.signature).toMatch(/^[0-9a-f]{128}$/);
  });

  it("leaves an existing designation alone, including one the user emptied", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ master_pubkey: "m", hubs: [], issued_at: 1, sequence: 7, signature: "00" }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await ensureHomeHubDesignation({ seed_hex: SEED }, HUB_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a paired device — a subkey cannot sign a HomeHubList", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await ensureHomeHubDesignation({ seed_hex: SEED, subkey_cert: {} as SubkeyCert }, HUB_URL);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
