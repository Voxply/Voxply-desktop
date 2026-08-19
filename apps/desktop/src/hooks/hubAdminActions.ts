import { invoke } from "@tauri-apps/api/core";
import type {
  RoleInfo,
  RoleCategory,
  InviteInfo,
  PendingUser,
  BotAdminInfo,
  BotDetailInfo,
  BotCreatedResult,
  FarmSettings,
  FarmHubEntry,
  FarmUserEntry,
  FarmServerEntry,
} from "../types";
import type {
  RolesSectionActions,
  MemberRoleManagerActions,
  ServerTagsSectionActions,
  InviteManagerActions,
  NativeBotsSectionActions,
  AuditLogSectionActions,
  CertificationsSectionActions,
  OnboardingAdminSectionActions,
  WebhooksSectionActions,
  ExternalBotSectionActions,
  AlliancesSectionActions,
  HubIconsSectionActions,
  SurveyAdminSectionActions,
  FarmSettingsActions,
  HubIcon,
  WebhookInfo,
  WebhookCreatedResult,
  ExternalBotRow,
  ExternalBotInviteResult,
  SurveyAdmin,
  SurveyResponseView,
  HubSelfTagSettings,
  HubBadge,
  PendingBadgeOffer,
  CertIssuance,
  CertAdmissionSettings,
  AuditLogPage,
  Alliance,
  AllianceInvite,
  PendingAllianceInvite,
  SharedChannel,
} from "@wavvon/ui";

// Pure invoke wrappers for HubAdminPage's sections that take no hub-url
// argument (they operate on "the active hub" implicitly via the request's
// auth context) — no App state involved, so these are stable module-level
// consts rather than something rebuilt every render inside App's JSX.
export const rolesActions: RolesSectionActions = {
  listRoles: () => invoke<RoleInfo[]>("list_roles"),
  createRole: (input) =>
    invoke<RoleInfo>("create_role", {
      name: input.name,
      permissions: input.permissions,
      priority: input.priority,
      displaySeparately: input.display_separately,
    }),
  updateRole: (roleId, updates) =>
    invoke<RoleInfo>("update_role", {
      roleId,
      name: updates.name ?? null,
      permissions: updates.permissions ?? null,
      priority: updates.priority ?? null,
      displaySeparately: updates.display_separately ?? null,
      color: updates.color ?? null,
      icon: updates.icon ?? null,
      categoryId: updates.category_id ?? null,
    }),
  deleteRole: (roleId) => invoke("delete_role", { roleId }),
  listRoleCategories: () => invoke<RoleCategory[]>("list_role_categories"),
  createRoleCategory: (input) =>
    invoke<RoleCategory>("create_role_category", { name: input.name, position: input.position }),
  updateRoleCategory: (id, updates) =>
    invoke<RoleCategory>("update_role_category", {
      categoryId: id,
      name: updates.name ?? null,
      color: updates.color ?? null,
      icon: updates.icon ?? null,
      position: updates.position ?? null,
    }),
  deleteRoleCategory: (id) => invoke("delete_role_category", { categoryId: id }),
};

export const memberRoleActions: MemberRoleManagerActions = {
  listRoles: () => invoke<RoleInfo[]>("list_roles"),
  listUserRoles: (pubkey) => invoke<RoleInfo[]>("list_user_roles", { targetPublicKey: pubkey }),
  assignRoleToUser: (pubkey, roleId) => invoke("assign_role", { targetPublicKey: pubkey, roleId }),
  removeRoleFromUser: (pubkey, roleId) => invoke("unassign_role", { targetPublicKey: pubkey, roleId }),
};

export const serverTagsActions: ServerTagsSectionActions = {
  getDiscoveryTags: () => invoke<HubSelfTagSettings>("get_discovery_settings"),
  setDiscoveryTags: (tags, nsfw) => invoke("set_discovery_tags", { tags, nsfw }),
  listBadges: () => invoke<HubBadge[]>("list_badges"),
  listPendingBadges: () => invoke<PendingBadgeOffer[]>("list_pending_badges"),
  acceptBadge: (id) => invoke("accept_badge", { badgeId: id }),
  declineBadge: (id) => invoke("decline_badge", { badgeId: id }),
  removeBadge: (id) => invoke("remove_badge", { badgeId: id }),
  grantBadge: (targetHubUrl, label) => invoke("grant_badge", { targetHubUrl, label }),
};

export const inviteActions: InviteManagerActions = {
  listRoles: () => invoke<RoleInfo[]>("list_roles"),
  getHubSettings: () =>
    invoke<{ default_invite_role_id: string | null }>("get_hub_settings").then((s) => ({
      default_invite_role_id: s.default_invite_role_id ?? null,
    })),
  saveHubSettings: (settings) =>
    invoke("update_hub_branding", { defaultInviteRoleId: settings.default_invite_role_id }),
};

export const allianceActions: AlliancesSectionActions = {
  listAlliances: () => invoke<Alliance[]>("list_alliances"),
  createAlliance: (name) => invoke<Alliance>("create_alliance", { name }),
  leaveAlliance: (allianceId) => invoke("leave_alliance", { allianceId }),
  listPendingAllianceInvites: () => invoke<PendingAllianceInvite[]>("list_pending_alliance_invites"),
  acceptAllianceInvite: (inviteId, ownHubUrl) =>
    invoke("respond_to_alliance_invite", { inviteId, accept: true, ownHubUrl }),
  declineAllianceInvite: (inviteId) =>
    invoke("respond_to_alliance_invite", { inviteId, accept: false }),
  listAllianceSharedChannels: (allianceId) =>
    invoke<SharedChannel[]>("list_alliance_shared_channels", { allianceId }),
  shareChannelWithAlliance: (allianceId, channelId, includeDescendants) =>
    invoke("share_channel_with_alliance", { allianceId, channelId, includeDescendants }),
  unshareChannelFromAlliance: (allianceId, channelId) =>
    invoke("unshare_channel_from_alliance", { allianceId, channelId }),
  createAllianceInvite: (allianceId) => invoke<AllianceInvite>("create_alliance_invite", { allianceId }),
  sendAlliancePushInvite: (allianceId, targetHubUrl, ownHubUrl, message) =>
    invoke("send_alliance_push_invite", { allianceId, targetHubUrl, ownHubUrl, message }),
  joinAllianceByCode: (inviterHubUrl, allianceId, inviteToken, ownHubUrl) =>
    invoke("join_alliance", {
      inviterHubUrl, allianceId, inviteToken, ownHubPublicUrl: ownHubUrl,
    }).then(() => {}),
};

export const submitToDirectory = (
  directoryUrl: string,
  tags: string[],
  language: string,
  bio: string,
  inviteCode: string | null,
) => invoke<void>("submit_to_directory", { directoryUrl, tags, language, bio, inviteCode });

export const hubIconActions: HubIconsSectionActions = {
  listHubIcons: () => invoke<HubIcon[]>("list_hub_icons"),
  createHubIcon: (name, svgContent) => invoke<HubIcon>("create_hub_icon", { name, svgContent }),
  renameHubIcon: (iconId, name) => invoke("rename_hub_icon", { iconId, name }),
  deleteHubIcon: (iconId) => invoke("delete_hub_icon", { iconId }),
};

// The rest of HubAdminPage's sections need the active hub's URL, which is
// App state — these are factories rather than plain consts, parameterized
// by a getter so HubAdminContainer can supply "whichever hub is active
// right now" without the factories themselves closing over App state.
export function makeWebhookActions(getHubUrl: () => string): WebhooksSectionActions {
  return {
    loadWebhooks: () => invoke<WebhookInfo[]>("admin_list_webhooks", { hubUrl: getHubUrl() }),
    createWebhook: (channelId, displayName, avatarUrl) =>
      invoke<WebhookCreatedResult>("admin_create_webhook", { hubUrl: getHubUrl(), channelId, displayName, avatarUrl }),
    regenerateWebhook: (webhookId) =>
      invoke<WebhookCreatedResult>("admin_regenerate_webhook", { hubUrl: getHubUrl(), webhookId }),
    deleteWebhook: (webhookId) => invoke("admin_delete_webhook", { hubUrl: getHubUrl(), webhookId }),
  };
}

export function makeExternalBotActions(getHubUrl: () => string): ExternalBotSectionActions {
  return {
    loadBots: () => invoke<ExternalBotRow[]>("admin_list_external_bots", { hubUrl: getHubUrl() }),
    addBot: (pubkey, localNote) =>
      invoke<ExternalBotInviteResult>("admin_add_external_bot", { hubUrl: getHubUrl(), pubkey, localNote }),
    removeBot: (pubkey) => invoke("admin_remove_external_bot", { hubUrl: getHubUrl(), pubkey }),
    getBotChannelScope: (pubkey) => invoke<string[]>("admin_get_bot_channel_scope", { hubUrl: getHubUrl(), pubkey }),
    setBotChannelScope: (pubkey, channelIds) =>
      invoke("admin_set_bot_channel_scope", { hubUrl: getHubUrl(), pubkey, channelIds }),
  };
}

export function makeNativeBotActions(getHubUrl: () => string): NativeBotsSectionActions {
  return {
    listNativeBots: () => invoke<BotAdminInfo[]>("admin_list_bots", { hubUrl: getHubUrl() }),
    createNativeBot: (input) =>
      invoke<BotCreatedResult>("admin_create_bot", {
        hubUrl: getHubUrl(),
        displayName: input.display_name,
        miniAppUrl: input.mini_app_url ?? null,
        requiresCamera: input.requires_camera ?? false,
      }),
    deleteNativeBot: (pubkey) => invoke("admin_delete_bot", { hubUrl: getHubUrl(), pubkey }),
    getBotDetail: (pubkey) => invoke<BotDetailInfo>("admin_get_bot_detail", { hubUrl: getHubUrl(), pubkey }),
    setBotWebhook: (pubkey, webhookUrl) =>
      invoke("admin_set_bot_webhook", { hubUrl: getHubUrl(), pubkey, webhookUrl }),
  };
}

export function makeAuditLogActions(getHubUrl: () => string): AuditLogSectionActions {
  return {
    getAuditLog: (opts) =>
      invoke<AuditLogPage>("get_audit_log", { hubUrl: getHubUrl(), cursor: opts.cursor ?? null, limit: opts.limit ?? null }),
  };
}

export function makeCertActions(getHubUrl: () => string): CertificationsSectionActions {
  return {
    listCertIssuances: () => invoke<CertIssuance[]>("list_issued_certs", { hubUrl: getHubUrl() }),
    getCertSettings: () => invoke<CertAdmissionSettings>("get_cert_settings", { hubUrl: getHubUrl() }),
    saveCertSettings: (settings) => invoke("save_cert_settings", { hubUrl: getHubUrl(), settings }),
    issueCertManual: (subjectPubkey) => invoke("issue_cert", { hubUrl: getHubUrl(), subjectPubkey }),
    revokeCert: (subjectPubkey) => invoke("revoke_cert", { hubUrl: getHubUrl(), subjectPubkey }),
    grantUserBadge: (subjectPubkey, label) =>
      invoke("grant_user_badge", { hubUrl: getHubUrl(), subjectPubkey, label }),
  };
}

export function makeOnboardingActions(getHubUrl: () => string): OnboardingAdminSectionActions {
  return {
    listPendingUsers: () => invoke<PendingUser[]>("list_pending_members"),
    approvePendingUser: (pk) => invoke("approve_member", { targetPublicKey: pk }),
    setLobbySettings: (lobbyEnabled, welcomeMd) =>
      invoke("set_lobby_settings", { hubUrl: getHubUrl(), lobbyEnabled, welcomeMd: welcomeMd ?? null }),
    setChallengeSettings: (mode, difficulty) =>
      invoke("set_challenge_settings", { hubUrl: getHubUrl(), challengeMode: mode, challengeDifficulty: difficulty }),
    getLobbyWelcome: () =>
      invoke<{ welcome_md: string }>("lobby_get_welcome", { hubUrl: getHubUrl() }),
  };
}

export function makeSurveyActions(getHubUrl: () => string): SurveyAdminSectionActions {
  return {
    getSurveyAdmin: () => invoke<SurveyAdmin | null>("survey_admin_get", { hubUrl: getHubUrl() }),
    setSurveyAdmin: (survey) => invoke("survey_admin_put", { hubUrl: getHubUrl() , survey }),
    getSurveyResponses: () =>
      invoke<SurveyResponseView[]>("survey_admin_responses", { hubUrl: getHubUrl(), status: "all" }),
    loadAssignableRoles: () =>
      invoke<RoleInfo[]>("list_roles").then((roles) =>
        roles.filter((r) => !r.permissions.includes("admin")).map((r) => ({ id: r.id, name: r.name }))
      ),
  };
}

// FarmSettingsPage's actions are all parameterized by farmUrl per call —
// no App state involved either, so this is a stable module-level const too.
export const farmSettingsActions: FarmSettingsActions = {
  getSettings: (farmUrl) => invoke<FarmSettings>("get_farm_settings", { farmUrl }),
  patchSettings: (farmUrl, settings) => invoke<FarmSettings>("patch_farm_settings", { farmUrl, settings }),
  getHubs: (farmUrl) => invoke<{ hubs: FarmHubEntry[] }>("get_farm_hubs_admin", { farmUrl }),
  suspendHub: (farmUrl, hubId, suspended, reason) => invoke("suspend_farm_hub", { farmUrl, hubId, suspended, reason }),
  deleteHub: (farmUrl, hubId) => invoke("delete_farm_hub", { farmUrl, hubId }),
  getUsers: (farmUrl, page, limit) =>
    invoke<{ users: FarmUserEntry[]; total: number; page: number; limit: number }>("get_farm_users", { farmUrl, page, limit }),
  revokeUserSessions: (farmUrl, pubkey) => invoke("revoke_farm_user_sessions", { farmUrl, pubkey }),
  getServers: (farmUrl) => invoke<{ servers: FarmServerEntry[] }>("get_farm_servers", { farmUrl }),
  generateServerToken: (farmUrl, name, region) =>
    invoke<{ server_id: string; token: string }>("generate_farm_server_token", { farmUrl, name, region }),
  totpSetup: (farmUrl) => invoke<{ secret: string; qr_url: string }>("farm_totp_setup", { farmUrl }),
  totpConfirm: (farmUrl, secret, code) => invoke("farm_totp_confirm", { farmUrl, secret, code }),
  totpDisable: (farmUrl, code) => invoke("farm_totp_disable", { farmUrl, code }),
};
