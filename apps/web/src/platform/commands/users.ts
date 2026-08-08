import { hubFetch } from "../http";
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
  const all: User[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);
    const rows = (await (await hubFetch(`/users?${params}`)).json()) as User[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
    cursor = rows[rows.length - 1]?.public_key;
    if (!cursor) return all;
  }

  console.warn(`fetchAllUsers: stopped at ${MAX_PAGES} pages (${all.length} members)`);
  return all;
}

/** Server-side member search (`q` matches display name or public key). One
 *  page — a search narrow enough to be useful will not fill it. */
export async function searchUsers(q: string): Promise<User[]> {
  const params = new URLSearchParams({ q, limit: String(PAGE_SIZE) });
  const r = await hubFetch(`/users?${params}`);
  return r.json() as Promise<User[]>;
}
