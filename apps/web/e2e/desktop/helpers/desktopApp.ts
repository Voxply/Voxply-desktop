import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";

// Driving the real desktop app.
//
// The desktop client is a Tauri shell around a WebView2, and WebView2 is
// Chromium: given `--remote-debugging-port` it speaks CDP, which is all
// Playwright needs. `connectOverCDP` then hands back the app's own page — the
// real IPC, the real Rust commands, the real file-backed account store — where
// a browser context would only exercise the web client.
//
// This exists because the flows that only fail across two *different* clients
// have no other harness. A DM between web and desktop, and pairing between
// them, are both pinned by cross-language vector tests and neither had ever
// been driven end to end; a wrong DH scalar on a paired device fails silently
// rather than loudly, which is why the July 2026 DM bugs survived every suite.

const DEFAULT_PORT = Number(process.env.WAVVON_DESKTOP_CDP_PORT ?? 9333);
const DESKTOP_DIR = join(process.cwd(), "..", "desktop");

export interface DesktopApp {
  /** The app's own WebView2 page. */
  page: Page;
  /** Where this run's `~/.wavvon` lives, so a spec can inspect or wipe it. */
  home: string;
  close(): Promise<void>;
}

/**
 * Start `tauri dev` and attach Playwright to its WebView2.
 *
 * `WAVVON_DESKTOP_HOME` points the account store at a throwaway directory:
 * the app is the developer's real install otherwise, and a spec that onboards
 * an identity would land it in their account list. `accounts.rs` reads that
 * variable for exactly this.
 */
export async function launchDesktopApp(opts?: {
  port?: number;
  hubUrl?: string;
  timeoutMs?: number;
}): Promise<DesktopApp> {
  const port = opts?.port ?? DEFAULT_PORT;
  const timeoutMs = opts?.timeoutMs ?? 300_000;
  const home = mkdtempSync(join(tmpdir(), "wavvon-desktop-e2e-"));

  const child: ChildProcess = spawn("npm", ["run", "dev"], {
    cwd: DESKTOP_DIR,
    shell: true,
    stdio: "pipe",
    env: {
      ...process.env,
      WAVVON_DESKTOP_HOME: home,
      // The one hook that makes the webview debuggable. It has to be set
      // before the window is created, so it belongs on the process, not on a
      // later IPC call.
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
      ...(opts?.hubUrl ? { VITE_DEFAULT_HUB_URL: opts.hubUrl } : {}),
    },
  });

  let log = "";
  child.stdout?.on("data", (d) => { log += String(d); });
  child.stderr?.on("data", (d) => { log += String(d); });

  const kill = () => {
    if (child.pid === undefined) return;
    // tauri dev spawns cargo, which spawns the app: killing the shell alone
    // leaves the window (and the debug port) behind for the next run.
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], { stdio: "ignore" });
    } catch {
      child.kill("SIGKILL");
    }
  };

  const browser = await waitForCdp(port, timeoutMs, () => log, child).catch((e) => {
    kill();
    rmSync(home, { recursive: true, force: true });
    throw e;
  });

  const page = await appPage(browser, timeoutMs).catch(async (e) => {
    await browser.close().catch(() => {});
    kill();
    rmSync(home, { recursive: true, force: true });
    throw e;
  });

  return {
    page,
    home,
    async close() {
      await browser.close().catch(() => {});
      kill();
      rmSync(home, { recursive: true, force: true });
    },
  };
}

/**
 * Poll the debug port until it answers.
 *
 * The wait is long by default because the first run compiles the Rust shell.
 * The child's output is folded into the failure so a build error reads as a
 * build error rather than as a timeout.
 */
async function waitForCdp(
  port: number,
  timeoutMs: number,
  log: () => string,
  child: ChildProcess,
): Promise<Browser> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`tauri dev exited with ${child.exitCode}:\n${log().slice(-4000)}`);
    }
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(
    `desktop app never opened a CDP port on ${port} within ${timeoutMs}ms.\n` +
      `Last connect error: ${String(lastError)}\n${log().slice(-4000)}`,
  );
}

/**
 * The app's page among the webview's targets.
 *
 * A WebView2 exposes more than the document — service workers and about:blank
 * targets show up too — so this takes the first page serving an http(s) URL
 * and waits for one to exist, since the target list is populated a moment
 * after the port opens.
 */
async function appPage(browser: Browser, timeoutMs: number): Promise<Page> {
  const deadline = Date.now() + Math.min(timeoutMs, 60_000);
  while (Date.now() < deadline) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        if (/^https?:/.test(page.url())) return page;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("connected to the webview but it never showed an http page");
}
