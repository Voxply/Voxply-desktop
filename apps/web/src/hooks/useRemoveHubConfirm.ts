import { useCallback, useState } from "react";
import { loadIdentity, masterPubkeyOf } from "@identity/index";
import { getHomeHubDesignation } from "@platform";
import { homeHubStatus } from "@wavvon/ui";
import type { Hub } from "@shared/types";

interface Pending {
  hubId: string;
  hubName: string;
}

/** Gate `handleRemoveHub` behind a confirmation, and work out what the dialog
 *  should warn about.
 *
 *  The warning is the only part that needs anything asynchronous: whether this
 *  hub is in the identity's signed home hub list, and whether it is the last
 *  one. That answer decides nothing here — removal is local either way — it
 *  only decides what the user is told (decisions.md, "Leave hub does not
 *  leave").
 *
 *  A lookup that fails leaves `homeHub` null and the dialog silent on the
 *  subject. Guessing "not a home hub" would be the wrong way to be wrong: the
 *  warning exists precisely because nothing else would mention it. */
export function useRemoveHubConfirm(removeHub: (hubId: string) => Promise<void>) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [homeHub, setHomeHub] = useState<{ isHomeHub: boolean; isLast: boolean } | null>(null);

  const requestRemoveHub = useCallback((hubId: string, hubs: Hub[]) => {
    const hub = hubs.find((h) => h.hub_id === hubId);
    setHomeHub(null);
    setPending({ hubId, hubName: hub?.hub_name ?? hub?.hub_url ?? hubId });

    void (async () => {
      try {
        const identity = await loadIdentity();
        if (!identity) return;
        const designation = await getHomeHubDesignation(masterPubkeyOf(identity));
        if (!designation) return;
        setHomeHub(homeHubStatus(designation.hubs, hub?.hub_url ?? ""));
      } catch {
        /* leave it null — the dialog then says nothing about home hubs */
      }
    })();
  }, []);

  const cancel = useCallback(() => {
    setPending(null);
    setHomeHub(null);
  }, []);

  const confirm = useCallback(async () => {
    if (!pending) return;
    const { hubId } = pending;
    setPending(null);
    setHomeHub(null);
    await removeHub(hubId);
  }, [pending, removeHub]);

  return { pending, homeHub, requestRemoveHub, cancel, confirm };
}
