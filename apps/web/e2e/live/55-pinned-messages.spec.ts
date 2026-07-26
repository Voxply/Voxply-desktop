import { test, expect } from "@playwright/test";
import { expectInHub } from "./helpers/live";

// P55 — pin a message, open the pins modal (shared PinnedMessagesModal),
// see the pin rendered from the hub's real wire shape, unpin from the modal.
// Guards the 2026-07-26 union pass: web's old modal read a flat shape the
// hub never sent, so any real pin crashed it.

test("pin a message, view it in the pins modal, unpin from the modal", async ({ page }) => {
  await page.goto("/");
  await expectInHub(page);

  const composer = page.getByPlaceholder(/^Message #/).first();
  await expect(composer).toBeVisible({ timeout: 10000 });

  const body = `pin-me ${Date.now()}`;
  await composer.fill(body);
  await composer.press("Enter");
  const row = page.getByText(body).first();
  await expect(row).toBeVisible({ timeout: 10000 });

  // Pin via the hover action on the message row (owner is admin).
  await row.hover();
  await page.getByRole("button", { name: "Pin message" }).first().click();

  // Open the pins modal from the channel header.
  await page.getByTitle("Pinned messages").click();
  const modal = page.getByRole("dialog", { name: /Pinned messages/ });
  await expect(modal).toBeVisible();
  await expect(modal.getByText(body)).toBeVisible({ timeout: 10000 });
  await expect(modal.getByText(/Pinned by/)).toBeVisible();

  // Unpin from the modal (admin-only button — the desktop feature the
  // union pass brought to web).
  await modal.getByRole("button", { name: "Unpin" }).click();
  await expect(modal.getByText("No pinned messages.")).toBeVisible({ timeout: 10000 });

  await modal.getByRole("button", { name: "Close" }).click();
  await expect(modal).not.toBeVisible();
});
