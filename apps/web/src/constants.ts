// Shared constants for the Wavvon desktop client.
//
// Pure values with no React or runtime dependencies. Anything that
// needs hooks or a render context belongs in a component file.
//
// EMOJI_CATALOG and QUICK_REACTIONS moved to @wavvon/ui (packages/ui/src/emojiCatalog.ts)
// so both apps share one catalog.

// No client-side attachment cap on web: nothing read this constant, and the
// hub is authoritative now that the limit is operator-configurable — its 413
// names the configured size. A hardcoded copy here would go stale the moment
// an operator changed it.

export const RECENT_EMOJI_KEY = "wavvon.recentEmojis";
export const RECENT_EMOJI_MAX = 8;

// Curated row shown above the Activities textarea in edit mode (wishlist:
// "Game icons in Activities", lazy v1) — not a full emoji picker, just quick
// inserts for the common case.
export const GAME_ACTIVITY_EMOJI: string[] = ["🎮", "🕹️", "⚔️", "🏹", "🏎️", "⚽", "🏀", "♟️", "🧩", "🎲", "🎯", "🃏"];

export const MIC_METER_MAX = 0.2;

// Set to a hub URL to enable the "Try a demo hub" button on the welcome
// screen. null means the button is hidden — don't ship a dead button.
export const DEMO_HUB_URL: string | null = null;

// The public hub directory (discovery-v2.md). null means every surface that
// needs it — browse public hubs, the hub-creation wizard link, the skins
// gallery, the directory listing form in hub admin — is not rendered at all.
// Same rule as DEMO_HUB_URL above: don't ship a dead button.
//
// It was three different hardcoded hostnames across five files
// (discovery.wavvon.io, discovery.wavvon.app, hub-directory.wavvon.io), none
// of which resolves. That is what "the features that don't work because we
// don't have discovery yet" actually was.
// Build target. The hub build is what a hub serves from its own origin: one
// hub and its interconnections, no list — no switcher, no add-hub, no
// create-hub, no directory, no home-hub editor (decisions.md, "Two web
// clients: one per hub, one per user"). Set by `vite build --mode hub` via
// .env.hub; anything else is the user build.
//
// Compared against a literal so the bundler folds it: the dropped screens
// leave the bundle, they are not merely hidden. Never turn this into a
// runtime value — a `false` that is only known at runtime ships every screen
// it was meant to remove.
export const MULTI_HUB: boolean = import.meta.env.VITE_BUILD_TARGET !== "hub";

/** The directory itself. Gated below rather than read directly, so switching
 *  it on cannot accidentally light up a directory in the hub build. */
const DIRECTORY_URL: string | null = null;

export const DISCOVERY_URL: string | null = MULTI_HUB ? DIRECTORY_URL : null;

/** The wizard's hub-creation page, or null when there is no directory. */
export const DISCOVERY_NEW_HUB_URL: string | null =
  DISCOVERY_URL === null ? null : `${DISCOVERY_URL}/new`;

// The offline self-host one-liner (hub-creation-wizard.md §4). Interactive:
// asks name/preset/domain-or-LAN/TLS, emits compose + env, starts the hub,
// and prints the one-time owner invite link + QR.
export const HUB_SETUP_COMMAND = "wavvon-hub setup";

export const ALL_PERMISSIONS: { id: string; label: string }[] = [
  { id: "admin", label: "Administrator (grants everything)" },
  { id: "manage_channels", label: "Manage channels" },
  { id: "manage_roles", label: "Manage roles" },
  { id: "manage_messages", label: "Manage messages" },
  { id: "kick_members", label: "Kick members" },
  { id: "ban_members", label: "Ban members" },
  { id: "mute_members", label: "Mute members" },
  { id: "timeout_members", label: "Timeout members" },
  { id: "manage_hub_icons", label: "Manage hub icon library (upload / rename / delete)" },
  { id: "manage_channel_icons", label: "Set icons and colors on channels" },
  { id: "manage_bots", label: "Manage bots (create / delete / rotate token)" },
  { id: "read_messages", label: "Read messages" },
  { id: "send_messages", label: "Send messages" },
  { id: "manage_soundboard", label: "Manage soundboard (upload / delete clips)" },
  { id: "move_members", label: "Move members between voice channels" },
];

// Small preset palette for role/role-category color pickers. Free hex input
// is offered alongside these for anything more specific.
export const ROLE_ACCENT_COLORS: string[] = [
  "#e74c3c",
  "#e67e22",
  "#f39c12",
  "#27ae60",
  "#16a085",
  "#2980b9",
  "#8e44ad",
  "#e91e63",
  "#7f8c8d",
];

export const EXPIRY_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: "Never", seconds: null },
  { label: "30 minutes", seconds: 30 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "6 hours", seconds: 6 * 60 * 60 },
  { label: "1 day", seconds: 24 * 60 * 60 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
];

export const THEMES: {
  id: "calm" | "classic" | "linear" | "light";
  name: string;
  tagline: string;
  swatches: [string, string, string];
}[] = [
  {
    id: "calm",
    name: "Calm",
    tagline: "Warm dark, dusty teal. Soft on the eyes — fits everyone.",
    swatches: ["#1c1a1f", "#2c2a31", "#88b8a8"],
  },
  {
    id: "classic",
    name: "Classic",
    tagline: "Deep navy + violet purple. Familiar and tech-forward.",
    swatches: ["#1a1a2e", "#1e2a47", "#7c3aed"],
  },
  {
    id: "linear",
    name: "Linear",
    tagline: "Near-black with a sharp violet-blue accent. Minimal.",
    swatches: ["#0c0d11", "#1a1c22", "#6571f0"],
  },
  {
    id: "light",
    name: "Light",
    tagline: "Off-white with a dusty teal accent. Reads well in daylight.",
    swatches: ["#fafaf7", "#f5f4ef", "#4a8d7a"],
  },
];
