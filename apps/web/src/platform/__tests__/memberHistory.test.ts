import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setSession, setActiveHubId, resetHubSessions } from "../session";
import { fetchMemberHistory } from "../commands/moderation";

// The read side of `soft-flag`: a hub we subscribe to banned this person, this
// hub let them in, and the moderator deciding what to do gets to know. Without
// a client asking, the policy is selectable and means nothing — which is the
// state it sat in since federated ban lists shipped.

const HUB_URL = "https://hub.example";
const HUB_ID = "hub-pub-key";

beforeEach(() => {
  resetHubSessions();
  setSession(HUB_ID, {
    hub_id: HUB_ID,
    hub_url: HUB_URL,
    hub_pubkey: HUB_ID,
    hub_name: "Hub",
    hub_icon: null,
    token: "tok",
    ws: null,
  });
  setActiveHubId(HUB_ID);
});

afterEach(() => vi.restoreAllMocks());

function respond(body: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

describe("fetchMemberHistory", () => {
  it("asks the hub about that member and unwraps the entries", async () => {
    const fetchMock = respond({
      entries: [
        {
          source_hub_pubkey: "peer",
          policy: "soft-flag",
          reason: "raiding",
          added_at: 1,
        },
      ],
    });

    const entries = await fetchMemberHistory("abc123");

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${HUB_URL}/moderation/history/abc123`,
    );
    expect(entries).toHaveLength(1);
    // The reason is the point — a bare flag tells a moderator nothing.
    expect(entries[0].reason).toBe("raiding");
    // And the policy, or an advisory entry and a blocking one look identical.
    expect(entries[0].policy).toBe("soft-flag");
  });

  it("percent-encodes the pubkey rather than pasting it into the path", async () => {
    const fetchMock = respond({ entries: [] });
    await fetchMemberHistory("a/b?c");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${HUB_URL}/moderation/history/a%2Fb%3Fc`,
    );
  });

  // A clean record is the common case and must not read as a failure.
  it("returns an empty list for a member nobody has flagged", async () => {
    respond({ entries: [] });
    expect(await fetchMemberHistory("abc123")).toEqual([]);
  });

  // An older hub answers without the field; the menu should show nothing
  // rather than throw while a moderator is trying to open it.
  it("tolerates a response with no entries field", async () => {
    respond({});
    expect(await fetchMemberHistory("abc123")).toEqual([]);
  });
});
