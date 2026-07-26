import { getScoped, setScoped } from "./accountScope";

const WHISPER_OPTOUT_KEY = "wavvon.whisper_optout";

export function loadWhisperOptout(): boolean {
  return getScoped(WHISPER_OPTOUT_KEY) === "1";
}

export function saveWhisperOptout(enabled: boolean): void {
  setScoped(WHISPER_OPTOUT_KEY, enabled ? "1" : "0");
}
