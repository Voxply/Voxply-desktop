import { hubFetch } from "../http";
import { activeHubCapabilities } from "../session";
import type { User } from "@wavvon/ui";

/** The hub's `USERS_MAX_LIMIT`. Asking for more is clamped server-side. */
const PAGE_SIZE = 500;

// ponytail: bounded at 20k members so a server that stopped advancing the
// cursor can't spin here forever. The keyset uses a strict `>` so it cannot
// legitimately repeat a row; raise this if a hub ever gets that big.
const MAX_PAGES = 40;

/**
 * The full member roster.
 *
 * `GET /users` is paginated (keyset cursor on the previous page's last
 * `public_key`), and everything on the client that reads it — the member
 * sidebar, message-author name resolution, the admin Users table — wants
 * every member, not a page. So this walks pages until a short one comes
 * back. Truncating at the page size and saying nothing is precisely the bug
 * the endpoint's pagination was added to fix (member lists used to stop at
 * the hub's hardcoded 50); it would be a poor trade to reintroduce it at a
 * higher number.
 */
export async function fetchAllUsers(): Promise<User[]> {
  // Version skew, handled the decided way — by capability, not by version
  // (decisions.md). A hub that predates keyset pagination ignores both `limit`
  // and `cursor` and answers with the whole unbounded roster, so one plain
  // request there is not a truncation, it is the complete list; walking pages
  // against it would re-fetch that same response MAX_PAGES times and hand back
  // 40 copies of every member.
  //
  // Only take that branch when the hub has actually *told* us, which is why
  // this reads the capability list rather than asking hubSupports. A hub saved
  // by a build older than capability advertising reports "unknown", and
  // guessing "old" about a modern hub would send an unparameterised /users and
  // silently keep its first 200 members — the exact truncation pagination was
  // added to fix. Unknown pages instead: correct against a new hub, and the
  // stall guard below covers it against an old one until refreshHubInfo lands.
  const caps = activeHubCapabilities();
  if (caps && !caps.includes("list.cursor")) {
    return (await (await hubFetch("/users")).json()) as User[];
  }

  const all: User[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);
    const rows = (await (await hubFetch(`/users?${params}`)).json()) as User[];
    const next = rows[rows.length - 1]?.public_key;

    // Stall guard: the keyset uses a strict `>`, so a hub honouring the cursor
    // can never hand back a page ending on the key we just sent. One that does
    // is ignoring the cursor entirely, and every further page would be this
    // same one again.
    if (next !== undefined && next === cursor) {
      console.warn("fetchAllUsers: hub is not advancing the cursor — stopping");
      return all;
    }

    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
    cursor = next;
    if (!cursor) return all;
  }

  console.warn(`fetchAllUsers: stopped at ${MAX_PAGES} pages (${all.length} members)`);
  return all;
}
