import type { BotAppLaunchEvent } from "../types";
import { useTranslation } from "react-i18next";

interface Props {
  event: BotAppLaunchEvent;
  onJoin: (botId: string, channelId: string) => void;
}

export function BotAppLaunchCard({ event, onJoin }: Props) {
  const { t } = useTranslation();
  return (
    <div className="embed-card bot-app-launch-card">
      <div className="embed-title">{event.title}</div>
      <div className="embed-description">{event.description}</div>
      <button
        className="btn-secondary"
        onClick={() => onJoin(event.bot_id, event.channel_id)}
      >
        {t("bot.app.join")}
      </button>
    </div>
  );
}
