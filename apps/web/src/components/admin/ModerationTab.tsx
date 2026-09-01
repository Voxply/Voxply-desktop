import { ContentReportsSection } from "./ContentReportsSection";
import { useTranslation } from "react-i18next";
import { AutomodWebhookSection } from "./AutomodWebhookSection";
import { FederatedBanlistSection } from "./FederatedBanlistSection";

export function ModerationTab() {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{t("channel.settings.tab_moderation")}</h1>
      <ContentReportsSection />
      <AutomodWebhookSection />
      <FederatedBanlistSection />
    </section>
  );
}
