import { test, expect } from "@playwright/test";
import { expectInHub } from "./helpers/live";

// P17 — mic level meter in Settings → Voice (client-only; getUserMedia +
// AnalyserNode). Fake audio won't move the bar, so assert the meter renders
// and the test toggles.

test("mic test meter renders and toggles", async ({ page }) => {
  await page.goto("/");
  await expectInHub(page);

  await page.locator(".btn-icon-gear").click();
  await page.getByRole("button", { name: "Voice", exact: true }).click();

  await expect(page.getByText("Microphone test")).toBeVisible();
  const meter = page.getByRole("meter", { name: "Microphone level" });
  await expect(meter).toBeVisible();

  // "Test microphone" until the voice tab was localized (clients 5e90ac8):
  // the label is now settings.voice.mic_test.start.
  await page.getByRole("button", { name: "Start mic test" }).click();
  await expect(page.getByRole("button", { name: "Stop test" })).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Stop test" }).click();
  await expect(page.getByRole("button", { name: "Start mic test" })).toBeVisible();
});
