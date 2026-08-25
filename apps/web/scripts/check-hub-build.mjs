// The hub build must not merely hide the multi-hub screens — it must not ship
// them (decisions.md, "Two web clients: one per hub, one per user").
//
// The failure this exists to catch: `MULTI_HUB` in src/constants.ts stops
// being a build-time literal — read from a config, a hook, a fetch, anything
// the bundler cannot fold. Every gate still evaluates false, so the UI looks
// exactly right, while every dropped screen is back in the bundle. Nothing
// visible breaks. This does.
//
// Each marker is checked BOTH ways: present in the user bundle, absent from
// the hub one. Without the present-check, renaming a string would leave this
// gate silently green forever.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Markers must be strings that exist ONLY in the dropped components' code.
// Not i18n keys: the catalogs are bundled whole in both builds, so every key
// is present either way and the check would fail on a bundle that is
// perfectly clean. (Cost an afternoon; hence this comment.) Class names and
// literal values work — the CSS lives in its own asset, and this reads only
// the JS.
const MARKERS = [
  "wavvon-hub setup", // HUB_SETUP_COMMAND — the self-host create-hub flow
  "add-hub-title", // AddHubModal
  "create-hub-title", // CreateHubSelfHost, reached only through CreateHubFork
];

function bundle(dir) {
  let names;
  try {
    names = readdirSync(join(dir, "assets"));
  } catch {
    console.error(`${dir}/assets missing — run \`npm run build\` and \`npm run build:hub\` first.`);
    process.exit(2);
  }
  const js = names.filter((n) => n.endsWith(".js"));
  if (js.length === 0) {
    console.error(`no JS emitted in ${dir}/assets`);
    process.exit(2);
  }
  return js.map((n) => readFileSync(join(dir, "assets", n), "utf8")).join("\n");
}

const user = bundle("dist");
const hub = bundle("dist-hub");

const failures = [];
for (const m of MARKERS) {
  if (!user.includes(m)) failures.push(`marker "${m}" is not in the user bundle — it no longer proves anything, pick another`);
  if (hub.includes(m)) failures.push(`marker "${m}" IS in the hub bundle — the multi-hub screens were not eliminated`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  process.exit(1);
}
console.log(`hub build clean: ${MARKERS.length} markers present in dist, absent from dist-hub.`);
