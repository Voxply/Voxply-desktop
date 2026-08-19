import { invoke } from "@tauri-apps/api/core";

// Whisper receive opt-out, persisted per account by the Rust side
// (`whisper_optout.json` in the active account dir) rather than in
// localStorage, which desktop does not scope per account.
//
// `loadWhisperOptout` is synchronous to match the shape `useWhisper` wants
// for its initial state; the real value arrives from disk a tick later
// through `refreshWhisperOptout`.
let cached = false;

export function loadWhisperOptout(): boolean {
  return cached;
}

export async function refreshWhisperOptout(): Promise<boolean> {
  try {
    cached = await invoke<boolean>("load_whisper_optout");
  } catch {
    cached = false;
  }
  return cached;
}

export function saveWhisperOptout(enabled: boolean): void {
  cached = enabled;
  invoke("save_whisper_optout", { enabled }).catch(() => { /* best effort */ });
}
