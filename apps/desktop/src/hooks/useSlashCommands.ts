import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BotAdminInfo, BotDetailInfo } from "../types";

export interface SlashCommandEntry {
  command: string;
  description: string;
  bot_name: string;
}

// Slash command autocomplete entries — populated after hub load.
export function useSlashCommands() {
  const [slashCommands, setSlashCommands] = useState<SlashCommandEntry[]>([]);

  async function loadSlashCommands(hubUrl: string) {
    try {
      const bots = await invoke<BotAdminInfo[]>("admin_list_bots", { hubUrl });
      const entries: SlashCommandEntry[] = [];
      for (const bot of bots) {
        try {
          const detail = await invoke<BotDetailInfo>("admin_get_bot_detail", { hubUrl, pubkey: bot.public_key });
          for (const cmd of detail.commands) {
            entries.push({ command: cmd.command, description: cmd.description, bot_name: bot.display_name });
          }
        } catch {
          // skip bots whose detail fails to load
        }
      }
      setSlashCommands(entries);
    } catch {
      setSlashCommands([]);
    }
  }

  function clearSlashCommands() {
    setSlashCommands([]);
  }

  return { slashCommands, loadSlashCommands, clearSlashCommands };
}
