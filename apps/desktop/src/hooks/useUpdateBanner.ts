import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

interface UpdateInfo {
  version: string;
  notes: string | null;
}

export function useUpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlistenFn: (() => void) | null = null;
    listen<UpdateInfo>("update-available", (ev) => {
      setUpdateInfo(ev.payload);
    }).then((fn) => {
      if (cancelled) { fn(); return; }
      unlistenFn = fn;
    });
    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, []);

  return { updateInfo, dismissUpdateInfo: () => setUpdateInfo(null) };
}
