import type { Channel } from "../types";
import { Lightbox } from "./Lightbox";
import { EditDescriptionModal } from "@wavvon/ui";
import { ChannelAppearanceModal } from "./ChannelAppearanceModal";
import { BannerEditModal } from "./BannerEditModal";

// Small self-contained modal zoo: none of these four need more than a
// channel + a couple of value/callback props, so they group into one
// app-local component instead of four separate JSX blocks in App.tsx.
export function AppModals({
  lightbox,
  onCloseLightbox,
  editDescriptionChannel,
  editDescriptionValue,
  onDescriptionChange,
  onSaveDescription,
  onCloseEditDescription,
  appearanceChannel,
  onSaveAppearance,
  onCloseAppearance,
  bannerEditChannel,
  onSaveBanner,
  onCloseBanner,
}: {
  lightbox: { src: string; alt: string } | null;
  onCloseLightbox: () => void;
  editDescriptionChannel: Channel | null;
  editDescriptionValue: string;
  onDescriptionChange: (v: string) => void;
  onSaveDescription: () => void;
  onCloseEditDescription: () => void;
  appearanceChannel: Channel | null;
  onSaveAppearance: (channel: Channel, icon: string | null, color: string | null, customIconSvg: string | null) => void;
  onCloseAppearance: () => void;
  bannerEditChannel: Channel | null;
  onSaveBanner: (channelId: string, bannerUrl: string) => void;
  onCloseBanner: () => void;
}) {
  return (
    <>
      {editDescriptionChannel && (
        <EditDescriptionModal
          channel={editDescriptionChannel}
          description={editDescriptionValue}
          onDescriptionChange={onDescriptionChange}
          onSave={onSaveDescription}
          onClose={onCloseEditDescription}
        />
      )}

      {appearanceChannel && (
        <ChannelAppearanceModal
          channel={appearanceChannel}
          onSave={(icon, color, customIconSvg) => onSaveAppearance(appearanceChannel, icon, color, customIconSvg)}
          onClose={onCloseAppearance}
        />
      )}

      {bannerEditChannel && (
        <BannerEditModal
          channel={bannerEditChannel}
          onSave={onSaveBanner}
          onClose={onCloseBanner}
        />
      )}

      {lightbox && (
        <Lightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={onCloseLightbox}
        />
      )}
    </>
  );
}
