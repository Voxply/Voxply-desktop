import { useEffect, useState } from "react";

export interface HubSetupWizardGateDeps {
  // Persisted done-map storage (scoped localStorage on web, plain
  // localStorage on desktop). May throw; failures are cosmetic.
  storageGet: () => string | null;
  storageSet: (raw: string) => void;
  activeHubId: string | null;
  isAdmin: boolean;
  channelCount: number;
}

// First-run hub setup wizard gate (decisions.md 2026-07-25): shown once per
// hub when an admin lands on an empty channel list. "Done" covers both
// "picked a template" and "started blank" — never re-nag either way.
// Uses the same isAdmin gate the sidebar uses for its own "create channel"
// entry; channels and roles land in the same loadHubData batch, so there is
// no stale-isAdmin window.
export function useHubSetupWizardGate({
  storageGet, storageSet, activeHubId, isAdmin, channelCount,
}: HubSetupWizardGateDeps) {
  const [showHubSetupWizard, setShowHubSetupWizard] = useState(false);
  const [wizardDone, setWizardDone] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(storageGet() || "{}") as Record<string, boolean>; }
    catch { return {}; }
  });

  function markHubSetupWizardDone(hubId: string) {
    setWizardDone((prev) => {
      const next = { ...prev, [hubId]: true };
      try { storageSet(JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }

  function closeHubSetupWizard(hubId: string) {
    markHubSetupWizardDone(hubId);
    setShowHubSetupWizard(false);
  }

  useEffect(() => {
    if (!activeHubId || !isAdmin) return;
    if (channelCount > 0) return;
    if (wizardDone[activeHubId]) return;
    setShowHubSetupWizard(true);
  }, [activeHubId, isAdmin, channelCount, wizardDone]);

  return {
    showHubSetupWizard,
    setShowHubSetupWizard,
    markHubSetupWizardDone,
    closeHubSetupWizard,
  };
}
