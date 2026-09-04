import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BotProfile } from "../types";

export interface SlashCommandEntry {
  command: string;
  description: string;
  bot_name: string;
}

// Slash command autocomplete entries — populated after hub load. The bot
// directory already carries each bot's commands, so this is one call.
export function useSlashCommands() {
  const [slashCommands, setSlashCommands] = useState<SlashCommandEntry[]>([]);

  async function loadSlashCommands(hubUrl: string) {
    try {
      const bots = await invoke<BotProfile[]>("list_bots", { hubUrl });
      setSlashCommands(
        bots.flatMap((bot) =>
          bot.commands.map((cmd) => ({
            command: cmd.name,
            description: cmd.description,
            bot_name: bot.name,
          }))
        )
      );
    } catch {
      setSlashCommands([]);
    }
  }

  function clearSlashCommands() {
    setSlashCommands([]);
  }

  return { slashCommands, loadSlashCommands, clearSlashCommands };
}
