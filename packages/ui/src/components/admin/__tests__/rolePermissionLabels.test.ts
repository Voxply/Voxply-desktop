import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS } from "../RolesSection";

// The permission labels are looked up as `hub.admin.roles.perm.${id}`, built
// from the id at render time. check-i18n compares catalog against catalog and
// find-hardcoded scans literals, so neither can see a template key with no
// entry behind it — the UI would just print the key.
const catalogs = join(dirname(fileURLToPath(import.meta.url)), "../../../../../i18n");

describe("permission labels", () => {
  for (const lang of ["en", "it", "es", "de"]) {
    it(`${lang} has a label for every permission`, () => {
      const cat = JSON.parse(readFileSync(join(catalogs, `${lang}.json`), "utf8")) as Record<string, string>;
      const missing = ALL_PERMISSIONS.filter((id) => !cat[`hub.admin.roles.perm.${id}`]);
      expect(missing).toEqual([]);
    });
  }
});
