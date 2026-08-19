import { test, expect } from "@playwright/test";
import { channelButton, createChannel, expectInHub, uniqueName } from "./helpers/live";

// P56 — edit a channel description from the header (was a dead no-op prop on
// web until 2026-07-26; desktop had the real handler).

test("admin adds and edits a channel description from the header", async ({ page }) => {
  await page.goto("/");
  await expectInHub(page);

  const name = uniqueName("desc");
  await createChannel(page, name);
  await channelButton(page, name).click();

  // Fresh channel: the header shows the admin "add description" affordance.
  await page.locator(".channel-description.editable").click();
  const modal = page.getByRole("dialog", { name: /Edit description/ });
  await expect(modal).toBeVisible();

  const desc = `topic ${Date.now()}`;
  await modal.getByRole("textbox").fill(desc);
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).not.toBeVisible();
  await expect(page.locator(".channel-description")).toHaveText(desc);

  // Edit the existing description by clicking it.
  await page.locator(".channel-description.editable").click();
  await modal.getByRole("textbox").fill(`${desc} v2`);
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".channel-description")).toHaveText(`${desc} v2`);
});
