import { useState, type ReactNode } from "react";
import { formatPubkey, formatRelative, type Channel } from "@wavvon/core";
import type { BanInfo, InviteInfo, MemberAdminInfo, NameColorMode, PendingUser, RoleInfo } from "../../types";
import { ImagePicker } from "../ImagePicker";
import { AlliancesSection, type AlliancesSectionActions } from "./AlliancesSection";
import { ExternalBotSection, type ExternalBotSectionActions } from "./ExternalBotSection";
import { WebhooksSection, type WebhooksSectionActions } from "./WebhooksSection";
import { HubIconsSection, type HubIconsSectionActions } from "./HubIconsSection";
import { SurveyAdminSection, type SurveyAdminSectionActions } from "./SurveyAdminSection";
import { RolesSection, type RolesSectionActions } from "./RolesSection";
import { MemberRoleManager, type MemberRoleManagerActions } from "./MemberRoleManager";
import { ServerTagsSection, type ServerTagsSectionActions } from "./ServerTagsSection";
import { InviteManager, type InviteManagerActions } from "./InviteManager";
import { NativeBotsSection, type NativeBotsSectionActions } from "./NativeBotsSection";
import { AuditLogSection, type AuditLogSectionActions } from "./AuditLogSection";
import { CertificationsSection, type CertificationsSectionActions } from "./CertificationsSection";
import { SoundboardAdminSection, type SoundboardAdminSectionActions } from "./SoundboardAdminSection";
import { OnboardingAdminSection, type OnboardingAdminSectionActions } from "./OnboardingAdminSection";
import { moveChannelOptions } from "../../utils/voiceMove";

export type HubAdminTab =
  | "overview"
  | "discovery"
  | "tags"
  | "roles"
  | "members"
  | "bans"
  | "invites"
  | "integrations"
  | "external-bots"
  | "certifications"
  | "recovery"
  | "moderation"
  | "soundboard"
  | "native-bots"
  | "alliances"
  | "hub-icons"
  | "onboarding"
  | "survey"
  | "audit-log";

export interface HubAdminPageProps {
  tab: HubAdminTab;
  onTab: (t: HubAdminTab) => void;
  onClose: () => void;

  hubName: string;
  onHubNameChange: (v: string) => void;
  hubDescription: string;
  onHubDescriptionChange: (v: string) => void;
  hubIcon: string;
  onHubIconChange: (v: string) => void;
  requireApproval: boolean;
  onRequireApprovalChange: (v: boolean) => void;
  minSecurityLevel: number;
  onMinSecurityLevelChange: (v: number) => void;
  maxChannelDepth: number;
  onMaxChannelDepthChange: (v: number) => void;
  welcomeLabel: string;
  onWelcomeLabelChange: (v: string) => void;
  welcomeInviteUrl: string;
  onWelcomeInviteUrlChange: (v: string) => void;
  /** IANA name, or "" for unset — matches the empty-string-clears convention
   *  used across the rest of this page's PATCH-backed fields. */
  timezone: string;
  onTimezoneChange: (v: string) => void;
  birthdaysEnabled: boolean;
  onBirthdaysEnabledChange: (v: boolean) => void;
  /** How the hub resolves a member's rendered name color when both a role
   *  color and the member's own choice are set. Default "role_over_user". */
  nameColorMode: NameColorMode;
  onNameColorModeChange: (v: NameColorMode) => void;
  /** Channel idle voice participants are auto-moved into, or "" for unset
   *  (sweep disabled) — same empty-string-clears convention as `timezone`. */
  afkChannelId: string;
  onAfkChannelIdChange: (v: string) => void;
  /** Idle threshold in seconds before the hub moves someone to the AFK
   *  channel. Hub minimum is 60. */
  afkTimeoutSecs: number;
  onAfkTimeoutSecsChange: (v: number) => void;
  saveError: string | null;
  onSave: () => void;

  /** Whether this hub is currently listed in `/federation/listing`. */
  hubListed: boolean;
  onHubListedChange: (listed: boolean) => void;
  submitToDirectory: (
    directoryUrl: string,
    tags: string[],
    language: string,
    bio: string,
    inviteCode: string | null,
  ) => Promise<void>;

  pendingMembers: PendingUser[];
  onApproveMember: (publicKey: string) => void;
  members: MemberAdminInfo[];
  onKickMember: (publicKey: string) => void;
  onBanMember: (publicKey: string) => void;
  onMuteMember: (publicKey: string) => void;
  onTimeoutMember: (publicKey: string) => void;
  onVoiceMuteMember: (publicKey: string) => void;
  onVoiceUnmuteMember: (publicKey: string) => void;
  voiceMutedKeys: Set<string>;
  /** Whether the viewer can assign/remove roles (admin or manage_roles). Gates the inline role manager. */
  canManageRoles: boolean;
  /** Highest priority among the viewer's own roles; only lower-priority roles are assignable (matches the hub guard). */
  myMaxPriority: number;
  onMemberRolesChanged: (publicKey: string, roles: RoleInfo[]) => void;

  bans: BanInfo[];
  onUnban: (publicKey: string) => void;

  invites: InviteInfo[];
  activeHubUrl: string;
  /** This hub's stable serial (its public key) — embedded in invite links so a
   *  farm can route the same domain to different hubs. */
  onCreateInvite: (maxUses: number | null, expiresInSeconds: number | null, grantRoleId: string | null) => void;
  onRevokeInvite: (code: string) => void;

  myPubkey: string;
  isAdmin: boolean;
  canManageSoundboard: boolean;
  channels: Channel[];

  rolesActions: RolesSectionActions;
  memberRoleActions: MemberRoleManagerActions;
  serverTagsActions: ServerTagsSectionActions;
  inviteActions: InviteManagerActions;
  webhookActions: WebhooksSectionActions;
  externalBotActions: ExternalBotSectionActions;
  renderBotCapabilities?: (pubkey: string) => ReactNode;
  nativeBotActions: NativeBotsSectionActions;
  auditLogActions: AuditLogSectionActions;
  certActions: CertificationsSectionActions;
  /** Soundboard hub routes (upload/list/delete/fetch-audio) — omitted where
   *  the platform has no Tauri commands for them yet; the tab disappears. */
  soundboardActions?: SoundboardAdminSectionActions;
  onboardingActions: OnboardingAdminSectionActions;
  allianceActions: AlliancesSectionActions;
  hubIconActions: HubIconsSectionActions;
  surveyActions: SurveyAdminSectionActions;

  /** These three subtrees stay platform-local render props rather than
   *  hoisted components: they have no counterpart to converge with on the
   *  other platform (moderation suite / outgoing webhooks / recovery
   *  contacts are web-only today — see docs/docs/client-parity.md). */
  renderModerationTab?: () => ReactNode;
  renderOutgoingWebhooks?: () => ReactNode;
  renderRecoveryContacts?: () => ReactNode;
}

// `Intl.supportedValuesOf` isn't in every configured lib target here yet
// (TS lib.esnext.intl); cast locally rather than widen the whole app's lib
// set for one feature-detected call.
const supportedTimeZones = (Intl as unknown as { supportedValuesOf?: (key: "timeZone") => string[] })
  .supportedValuesOf;

function hubToWavvonUrl(hubUrl: string): string {
  try {
    const u = new URL(hubUrl);
    const hostPort = u.port ? `${u.hostname}:${u.port}` : u.hostname;
    return `wavvon://${hostPort}`;
  } catch {
    return `wavvon://${hubUrl}`;
  }
}

export function HubAdminPage(props: HubAdminPageProps) {
  const [copiedShare, setCopiedShare] = useState(false);
  const [dirTags, setDirTags] = useState("");
  const [dirLanguage, setDirLanguage] = useState("en");
  const [dirBio, setDirBio] = useState("");
  const [dirInviteCode, setDirInviteCode] = useState("");
  const [dirUrl, setDirUrl] = useState("https://discovery.wavvon.io");
  const [dirStatus, setDirStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [dirError, setDirError] = useState("");
  const [listingBusy, setListingBusy] = useState(false);

  async function handleSubmitToDirectory() {
    setDirStatus("submitting");
    setDirError("");
    try {
      await props.submitToDirectory(
        dirUrl,
        dirTags.split(",").map((s) => s.trim()).filter(Boolean),
        dirLanguage.trim() || "en",
        dirBio,
        dirInviteCode.trim() || null,
      );
      setDirStatus("ok");
    } catch (e) {
      setDirError(String(e));
      setDirStatus("error");
    }
  }

  async function handleListingToggle(next: boolean) {
    setListingBusy(true);
    try {
      await props.onHubListedChange(next);
    } finally {
      setListingBusy(false);
    }
  }

  // Grouped into contiguous sections so the long admin nav reads clearly.
  const G_GENERAL = "General";
  const G_MEMBERS = "Members & safety";
  const G_FEDERATION = "Federation";
  const G_INTEGRATIONS = "Integrations & bots";
  const G_CUSTOM = "Customization";
  const G_ADVANCED = "Advanced";
  const admin = props.isAdmin;
  const TABS: { id: HubAdminTab; label: string; group: string }[] = [
    { id: "overview", label: "Overview", group: G_GENERAL },
    { id: "discovery", label: "Discovery", group: G_GENERAL },
    { id: "tags", label: "Tags", group: G_GENERAL },
    { id: "roles", label: "Roles", group: G_MEMBERS },
    { id: "members", label: "Members", group: G_MEMBERS },
    { id: "bans", label: "Bans", group: G_MEMBERS },
    { id: "invites", label: "Invites", group: G_MEMBERS },
    ...(admin && props.renderModerationTab ? [{ id: "moderation" as HubAdminTab, label: "Moderation", group: G_MEMBERS }] : []),
    ...(admin ? [
      { id: "onboarding" as HubAdminTab, label: "Onboarding", group: G_MEMBERS },
      { id: "survey" as HubAdminTab, label: "Survey", group: G_MEMBERS },
    ] : []),
    { id: "certifications", label: "Certifications", group: G_MEMBERS },
    ...(admin && props.renderRecoveryContacts ? [{ id: "recovery" as HubAdminTab, label: "Recovery requests", group: G_MEMBERS }] : []),
    // Alliances is cross-hub channel sharing, not a bot/webhook integration —
    // grouped with other cross-hub features instead. The federated ban list
    // lives inside the Moderation tab, not its own nav entry, so it doesn't
    // move here.
    ...(admin ? [{ id: "alliances" as HubAdminTab, label: "Alliances", group: G_FEDERATION }] : []),
    { id: "integrations", label: "Webhooks", group: G_INTEGRATIONS },
    { id: "external-bots", label: "External bots", group: G_INTEGRATIONS },
    ...(admin ? [{ id: "native-bots" as HubAdminTab, label: "Native bots", group: G_INTEGRATIONS }] : []),
    ...(admin ? [{ id: "hub-icons" as HubAdminTab, label: "Icons", group: G_CUSTOM }] : []),
    ...(props.canManageSoundboard && props.soundboardActions ? [{ id: "soundboard" as HubAdminTab, label: "Soundboard", group: G_CUSTOM }] : []),
    ...(admin ? [{ id: "audit-log" as HubAdminTab, label: "Audit log", group: G_ADVANCED }] : []),
  ];

  return (
    <div className="settings-page">
      <aside className="settings-nav">
        <h2>Hub admin</h2>
        <ul>
          {TABS.map((tab, i) => (
            <li key={tab.id}>
              {(i === 0 || TABS[i - 1].group !== tab.group) && (
                <div className="settings-nav-group">{tab.group}</div>
              )}
              <button
                className={`settings-nav-item ${props.tab === tab.id ? "active" : ""}`}
                onClick={() => props.onTab(tab.id)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
        <button className="settings-nav-close" onClick={props.onClose}>Close</button>
      </aside>
      <main className="settings-content">
        <button className="settings-close-x" onClick={props.onClose} title="Close">×</button>

        {props.tab === "overview" && (
          <section>
            <h1>Overview</h1>
            <div className="settings-cards">
              <div className="settings-card">
                <h3>Identity</h3>
                <div className="settings-section">
                  <label className="settings-label" htmlFor="admin-hub-name">Hub name</label>
                  <input id="admin-hub-name" type="text" value={props.hubName} onChange={(e) => props.onHubNameChange(e.target.value)} />
                </div>
                <div className="settings-section">
                  <label className="settings-label" htmlFor="admin-hub-desc">Description</label>
                  <textarea id="admin-hub-desc" rows={2} value={props.hubDescription} onChange={(e) => props.onHubDescriptionChange(e.target.value)} />
                </div>
                <div className="settings-section">
                  <label className="settings-label">Hub icon</label>
                  <div className="hub-icon-editor">
                    {props.hubIcon ? (
                      <img src={props.hubIcon} alt="Hub icon" className="hub-icon-preview" />
                    ) : (
                      <div className="hub-icon-preview placeholder">No icon</div>
                    )}
                    <ImagePicker
                      onPick={props.onHubIconChange}
                      onClear={() => props.onHubIconChange("")}
                      hasValue={!!props.hubIcon}
                      buttonLabel="Choose icon"
                    />
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <h3>Access</h3>
                <div className="settings-section">
                  <label className="settings-label">Membership</label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={props.requireApproval} onChange={(e) => props.onRequireApprovalChange(e.target.checked)} />
                    Require admin approval for new members
                  </label>
                </div>
                <div className="settings-section">
                  <label className="settings-label" htmlFor="admin-antispam">Minimum proof-of-work level</label>
                  <input id="admin-antispam" type="number" min={0} max={9999} value={props.minSecurityLevel} onChange={(e) => props.onMinSecurityLevelChange(Number(e.target.value))} />
                </div>
              </div>

              <div className="settings-card">
                <h3>Locale &amp; appearance</h3>
                <div className="settings-section">
                  <label className="settings-label" htmlFor="admin-hub-timezone">Hub timezone</label>
                  <p className="muted">
                    Ambient flavor for members (a hub-local clock) — message and event times always stay in each viewer's own local time.
                  </p>
                  {typeof supportedTimeZones === "function" ? (
                    <select
                      id="admin-hub-timezone"
                      value={props.timezone}
                      onChange={(e) => props.onTimezoneChange(e.target.value)}
                    >
                      <option value="">Not set</option>
                      {supportedTimeZones("timeZone").map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="muted">Timezone picker isn't supported by this browser.</p>
                  )}
                  <label className="checkbox-label" style={{ marginTop: "var(--space-2)" }}>
                    <input
                      type="checkbox"
                      checked={props.birthdaysEnabled}
                      onChange={(e) => props.onBirthdaysEnabledChange(e.target.checked)}
                    />
                    Show member birthdays (🎂 badge on the day, if the member shared one)
                  </label>
                </div>
                <div className="settings-section">
                  <label className="settings-label" htmlFor="admin-name-color-mode">Member name colors</label>
                  <p className="muted">
                    Members can pick their own name color; roles can carry a color too. This decides which one wins when both are set.
                  </p>
                  <select
                    id="admin-name-color-mode"
                    value={props.nameColorMode}
                    onChange={(e) => props.onNameColorModeChange(e.target.value as typeof props.nameColorMode)}
                  >
                    {/* Short labels: the sentence-length ones overflowed the
                        select in a narrow card, and the paragraph above
                        already carries the explanation. */}
                    <option value="role_over_user">Role color wins</option>
                    <option value="user_over_role">Member's choice wins</option>
                    <option value="role_only">Role colors only</option>
                    <option value="user_only">Member colors only</option>
                    <option value="none">No name colors</option>
                  </select>
                </div>
              </div>

              <div className="settings-card">
                <h3>Channels &amp; voice</h3>
                <div className="settings-section">
                  <label className="settings-label" htmlFor="admin-afk-channel">AFK channel</label>
                  <p className="muted">
                    Members idle in voice (not speaking) longer than the timeout are moved here automatically.
                  </p>
                  {/* Channel and timeout are one decision, so they share a row —
                      the timeout only appears once a channel is picked. */}
                  <div className="settings-card-row">
                    <div>
                      <select
                        id="admin-afk-channel"
                        value={props.afkChannelId}
                        onChange={(e) => props.onAfkChannelIdChange(e.target.value)}
                      >
                        <option value="">No AFK channel</option>
                        {moveChannelOptions(props.channels).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    {props.afkChannelId && (
                      <div>
                        <label className="settings-label" htmlFor="admin-afk-timeout">AFK timeout</label>
                        <select
                          id="admin-afk-timeout"
                          value={props.afkTimeoutSecs}
                          onChange={(e) => props.onAfkTimeoutSecsChange(Number(e.target.value))}
                        >
                          <option value={60}>1 minute</option>
                          <option value={300}>5 minutes</option>
                          <option value={900}>15 minutes</option>
                          <option value={1800}>30 minutes</option>
                          <option value={3600}>1 hour</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
                <div className="settings-section">
                  <label className="settings-label" htmlFor="admin-max-depth">Max channel nesting depth</label>
                  <p className="muted">How many levels deep channel categories can nest.</p>
                  <input id="admin-max-depth" type="number" min={0} max={20} value={props.maxChannelDepth} onChange={(e) => props.onMaxChannelDepthChange(Number(e.target.value))} />
                </div>
              </div>

              <div className="settings-card">
                <h3>Welcome message</h3>
                <div className="settings-section">
                  <p className="muted">Shown to new members right after they join. Optional.</p>
                  <div className="settings-card-row">
                    <div>
                      <label className="settings-label" htmlFor="admin-welcome-label">Label</label>
                      <input
                        id="admin-welcome-label"
                        type="text"
                        maxLength={100}
                        value={props.welcomeLabel}
                        placeholder="e.g. Join our Discord too!"
                        onChange={(e) => props.onWelcomeLabelChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="settings-label" htmlFor="admin-welcome-invite">Invite URL</label>
                      <input
                        id="admin-welcome-invite"
                        type="text"
                        value={props.welcomeInviteUrl}
                        placeholder="https:// or wavvon://"
                        onChange={(e) => props.onWelcomeInviteUrlChange(e.target.value)}
                      />
                    </div>
                  </div>
                  {(props.welcomeLabel.trim() || props.welcomeInviteUrl.trim()) && (
                    <p className="muted">Shown to new members as: "{props.welcomeLabel.trim() || "(label)"}" → {props.welcomeInviteUrl.trim() || "(invite)"}</p>
                  )}
                </div>
              </div>
            </div>
            {props.saveError && <p className="error-text">{props.saveError}</p>}
            <div className="settings-save-bar">
              <button onClick={props.onSave}>Save</button>
            </div>
          </section>
        )}

        {props.tab === "discovery" && (
          <section>
            <h1>Discovery</h1>
            <div className="settings-section">
              <label className="settings-label">Public listing</label>
              <div className="settings-row">
                <label>List this hub publicly</label>
                <input
                  type="checkbox"
                  checked={props.hubListed}
                  disabled={listingBusy}
                  onChange={(e) => handleListingToggle(e.target.checked)}
                />
              </div>
              <p className="muted">When enabled, anyone can discover this hub via its /federation/listing endpoint.</p>
            </div>
            <div className="settings-section">
              <label className="settings-label">Share link</label>
              <div className="settings-row">
                <code className="pubkey-display">{hubToWavvonUrl(props.activeHubUrl)}</code>
                <button onClick={() => { navigator.clipboard.writeText(hubToWavvonUrl(props.activeHubUrl)).catch(() => {}); setCopiedShare(true); setTimeout(() => setCopiedShare(false), 2000); }}>
                  {copiedShare ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div className="settings-section">
              <label className="settings-label">Hub directory</label>
              <p className="muted">Submit to {dirUrl}</p>
              <div className="settings-section">
                <label className="settings-label">Tags</label>
                <input type="text" placeholder="gaming, english, casual" value={dirTags} onChange={(e) => setDirTags(e.target.value)} />
              </div>
              <div className="settings-section">
                <label className="settings-label">Language</label>
                <input type="text" placeholder="en" value={dirLanguage} onChange={(e) => setDirLanguage(e.target.value)} />
              </div>
              <div className="settings-section">
                <label className="settings-label">Bio</label>
                <textarea rows={3} placeholder="Describe this hub" value={dirBio} onChange={(e) => setDirBio(e.target.value)} />
              </div>
              <div className="settings-section">
                <label className="settings-label">Invite code (optional)</label>
                <input type="text" placeholder="abc123" value={dirInviteCode} onChange={(e) => setDirInviteCode(e.target.value)} />
              </div>
              <div className="settings-section">
                <label className="settings-label">Directory URL</label>
                <input type="text" value={dirUrl} onChange={(e) => setDirUrl(e.target.value)} />
              </div>
              {dirStatus === "ok" && <p className="muted" style={{ color: "var(--success)" }}>Submitted.</p>}
              {dirStatus === "error" && <p className="error-text">{dirError}</p>}
              <button onClick={handleSubmitToDirectory} disabled={dirStatus === "submitting"}>
                {dirStatus === "submitting" ? "Submitting…" : "Submit"}
              </button>
            </div>
          </section>
        )}

        {props.tab === "tags" && (
          <ServerTagsSection actions={props.serverTagsActions} />
        )}

        {props.tab === "members" && (
          <section>
            {props.pendingMembers.length > 0 && (
              <div className="pending-section">
                <h2>Pending approval ({props.pendingMembers.length})</h2>
                <table className="members-table">
                  <thead><tr>
                    <th>User</th>
                    <th>Signed up</th>
                    <th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {props.pendingMembers.map((p) => (
                      <tr key={p.public_key}>
                        <td>
                          <div>{p.display_name || "(no name)"}</div>
                          <div className="member-pk" title={p.public_key}>{formatPubkey(p.public_key)}</div>
                        </td>
                        <td>{formatRelative(p.first_seen_at)}</td>
                        <td>
                          <button className="btn-small" onClick={() => props.onApproveMember(p.public_key)}>Approve</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h1>Members ({props.members.length})</h1>
            <table className="members-table">
              <thead><tr>
                <th>Name</th>
                <th>Roles</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr></thead>
              <tbody>
                {props.members.map((m) => (
                  <tr key={m.public_key}>
                    <td>
                      <div>{m.display_name || "(no name)"}</div>
                      <div className="member-pk" title={m.public_key}>{formatPubkey(m.public_key)}</div>
                    </td>
                    <td>
                      {props.canManageRoles ? (
                        <MemberRoleManager
                          pubkey={m.public_key}
                          currentRoles={m.roles}
                          myMaxPriority={props.myMaxPriority}
                          onChanged={(roles) => props.onMemberRolesChanged(m.public_key, roles)}
                          actions={props.memberRoleActions}
                        />
                      ) : (
                        m.roles.map((r) => r.name).join(", ") || "—"
                      )}
                    </td>
                    <td>{formatRelative(m.first_seen_at)}</td>
                    <td style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                      <button className="btn-small" onClick={() => props.onKickMember(m.public_key)}>Kick</button>
                      <button className="btn-small danger" onClick={() => props.onBanMember(m.public_key)}>Ban</button>
                      <button className="btn-small btn-secondary" onClick={() => props.onMuteMember(m.public_key)}>Mute</button>
                      <button className="btn-small btn-secondary" onClick={() => props.onTimeoutMember(m.public_key)}>Timeout</button>
                      {props.voiceMutedKeys.has(m.public_key) ? (
                        <button className="btn-small btn-secondary" onClick={() => props.onVoiceUnmuteMember(m.public_key)}>Unmute voice</button>
                      ) : (
                        <button className="btn-small btn-secondary" onClick={() => props.onVoiceMuteMember(m.public_key)}>Mute voice</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {props.members.length === 0 && <p className="muted">No members yet.</p>}
          </section>
        )}

        {props.tab === "bans" && (
          <section>
            <h1>Bans ({props.bans.length})</h1>
            {props.bans.length === 0 && <p className="muted">No bans yet.</p>}
            {props.bans.length > 0 && (
              <table className="members-table">
                <thead><tr>
                  <th>User</th>
                  <th>Reason</th>
                  <th>Banned by</th>
                  <th>When</th>
                  <th>Actions</th>
                </tr></thead>
                <tbody>
                  {props.bans.map((b) => (
                    <tr key={b.target_public_key}>
                      <td><span className="member-pk">{formatPubkey(b.target_public_key)}</span></td>
                      <td>{b.reason || <span className="muted">—</span>}</td>
                      <td><span className="member-pk" title={b.banned_by}>{formatPubkey(b.banned_by)}</span></td>
                      <td>{formatRelative(b.created_at)}</td>
                      <td><button className="btn-small" onClick={() => props.onUnban(b.target_public_key)}>Unban</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {props.tab === "invites" && (
          <InviteManager
            invites={props.invites}
            activeHubUrl={props.activeHubUrl}
            myMaxPriority={props.myMaxPriority}
            isAdmin={props.isAdmin}
            onCreateInvite={props.onCreateInvite}
            onRevokeInvite={props.onRevokeInvite}
            actions={props.inviteActions}
          />
        )}

        {props.tab === "roles" && <RolesSection actions={props.rolesActions} />}

        {props.tab === "integrations" && (
          <>
            <WebhooksSection channels={props.channels} actions={props.webhookActions} />
            {props.renderOutgoingWebhooks?.()}
          </>
        )}

        {props.tab === "external-bots" && (
          <ExternalBotSection
            channels={props.channels}
            actions={props.externalBotActions}
            renderCapabilities={props.renderBotCapabilities}
          />
        )}

        {props.tab === "certifications" && (
          <CertificationsSection actions={props.certActions} />
        )}

        {props.tab === "recovery" && props.renderRecoveryContacts?.()}

        {props.tab === "soundboard" && props.canManageSoundboard && props.soundboardActions && (
          <SoundboardAdminSection actions={props.soundboardActions} />
        )}

        {props.tab === "moderation" && props.isAdmin && props.renderModerationTab?.()}

        {props.tab === "native-bots" && props.isAdmin && (
          <NativeBotsSection actions={props.nativeBotActions} />
        )}
        {props.tab === "alliances" && props.isAdmin && (
          <AlliancesSection
            activeHubUrl={props.activeHubUrl}
            channels={props.channels}
            actions={props.allianceActions}
          />
        )}
        {props.tab === "hub-icons" && props.isAdmin && (
          <HubIconsSection actions={props.hubIconActions} />
        )}
        {props.tab === "onboarding" && props.isAdmin && (
          <OnboardingAdminSection actions={props.onboardingActions} />
        )}
        {props.tab === "survey" && props.isAdmin && (
          <SurveyAdminSection actions={props.surveyActions} />
        )}
        {props.tab === "audit-log" && props.isAdmin && (
          <AuditLogSection actions={props.auditLogActions} />
        )}
      </main>
    </div>
  );
}
