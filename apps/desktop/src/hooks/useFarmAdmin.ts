import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Hub } from "../types";
import type { FarmAdminTab } from "@wavvon/ui";

interface UseFarmAdminParams {
  publicKey: string | null;
  hubs: Hub[];
}

export function useFarmAdmin({ publicKey, hubs }: UseFarmAdminParams) {
  const [showFarmSettings, setShowFarmSettings] = useState(false);
  const [farmAdminTab, setFarmAdminTab] = useState<FarmAdminTab>("general");
  const [farmAdminUrl, setFarmAdminUrl] = useState("");
  const [isFarmAdmin, setIsFarmAdmin] = useState(false);
  const [showCreateHub, setShowCreateHub] = useState(false);
  const [knownFarms, setKnownFarms] = useState<{ url: string; name: string }[]>([]);

  // After hubs load and publicKey is known, check whether any connected hub
  // is backed by a farm and whether the local user is its admin.
  useEffect(() => {
    if (!publicKey || hubs.length === 0) return;
    async function checkFarmAdmin() {
      const farms: { url: string; name: string }[] = [];
      for (const hub of hubs) {
        try {
          const info = await invoke<{
            farm_url?: string | null;
          }>("get_hub_info", { hubUrl: hub.hub_url });
          if (!info.farm_url) continue;
          const farmUrl = info.farm_url;
          const farmInfo = await invoke<{
            admin_pubkey?: string;
            name?: string;
          }>("get_farm_info", { farmUrl });
          const name = farmInfo.name ?? farmUrl;
          if (!farms.some((f) => f.url === farmUrl)) {
            farms.push({ url: farmUrl, name });
          }
          if (farmInfo.admin_pubkey && farmInfo.admin_pubkey === publicKey) {
            setIsFarmAdmin(true);
            setFarmAdminUrl(farmUrl);
          }
        } catch {
          // Not a farmed hub or farm unreachable — skip.
        }
      }
      setKnownFarms(farms);
    }
    void checkFarmAdmin();
  }, [publicKey, hubs.length]);

  return {
    showFarmSettings,
    setShowFarmSettings,
    farmAdminTab,
    setFarmAdminTab,
    farmAdminUrl,
    isFarmAdmin,
    showCreateHub,
    setShowCreateHub,
    knownFarms,
  };
}
