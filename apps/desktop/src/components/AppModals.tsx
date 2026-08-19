import type { Channel } from "../types";
import { Lightbox } from "./Lightbox";
import { EditDescriptionModal } from "@wavvon/ui";
import { BannerEditModal } from "./BannerEditModal";

// Small self-contained modal zoo: none of these need more than a channel +
// a couple of value/callback props, so they group into one app-local
// component instead of separate JSX blocks in App.tsx.
export function AppModals({
  lightbox,
  onCloseLightbox,
  editDescriptionChannel,
  editDescriptionValue,
  onDescriptionChange,
  onSaveDescription,
  onCloseEditDescription,
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
