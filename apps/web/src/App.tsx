import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useUnreadCounts } from "./hooks/useUnreadCounts";
import { useNotificationPrefs } from "./hooks/useNotificationPrefs";
import { useTypingIndicators } from "./hooks/useTypingIndicators";
import { useSoundboardChips } from "./hooks/useSoundboardChips";
import { useHubConnection } from "./hooks/useHubConnection";
import { useHubAdmin } from "./hooks/useHubAdmin";
import { useAlliances } from "./hooks/useAlliances";
import { useSettingsProfile } from "./hooks/useSettingsProfile";
import { useFarmAdmin } from "./hooks/useFarmAdmin";
import { useWhisper, pickReplyPubkey } from "./hooks/useWhisper";
import { useScreenShare } from "./hooks/useScreenShare";
import { useDms } from "./hooks/useDms";
import { useWhisperKeybinds } from "./hooks/useWhisperKeybinds";
import { useVoice } from "./hooks/useVoice";
import type { VoiceExtDeps } from "./hooks/useVoice";
import { useVideo } from "./hooks/useVideo";
import { useWsHandlers } from "./hooks/useWsHandlers";
import { useAddHubFlow } from "./hooks/useAddHubFlow";
import { useChannelCrud } from "./hooks/useChannelCrud";
import { loadWhisperReplyBind, saveWhisperReplyBind } from "./utils/whisperReply";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { flattenTree, descendantIds, computeDepth, channelPath, formatPubkey } from "@wavvon/core";
import { getScoped, setScoped } from "./utils/accountScope";
import { DISCOVERY_NEW_HUB_URL, HUB_SETUP_COMMAND } from "./constants";
import type {
  Channel,
  Attachment,
  Message,
  User,
  VoiceParticipant,
  Hub,
  MeInfo,
  Conversation,
  AllianceInfo,
  AllianceSharedChannel,
} from "@shared/types";
import type { BotAppLaunchEvent, BotAppOpenEvent, PresenceStatus } from "./types";
import { HubSidebar } from "@wavvon/ui";
import { ChannelSidebar } from "@wavvon/ui";
import { WhisperInbox } from "@wavvon/ui";
import { ContentArea } from "@components/layout/ContentArea";
import { loadDefaultProfile, saveDefaultProfile, loadFollowsDefault, type DefaultProfile } from "./utils/profiles";
import { getUserProfile, listRoleCategories, patchMyProfileOnHub, listRoles, listUserRoles, assignRoleToUser, removeRoleFromUser, createInvite } from "@platform";
import { getHubSettings, saveHubSettings } from "@platform";
import {
  getChannelPermissions, setChannelRolePermissions, clearChannelRolePermissions,
  listChannelBans, banFromChannel, unbanFromChannel,
  listHubIcons, getTalkPower, setTalkPower,
  forumListTags, forumCreateTag, forumEditTag, forumDeleteTag,
} from "@platform";
import type { UserProfileCardActions, UserContextMenuActions, WhisperTarget, WhisperReplyBind } from "@wavvon/ui";
import { getCurrentSurvey, isLobbyScopeConfined, connectHubWebSocket } from "@platform";
import { SurveyModal } from "@components/polls/SurveyModal";
import { HubStreamsPanel } from "@wavvon/ui";
import { AddHubModal } from "@wavvon/ui";
import { isPasskeySupported } from "@platform";
import { QuickInviteModal } from "@wavvon/ui";
import { ChannelSettingsModal, type ChannelSettingsSaveFields } from "@wavvon/ui";
import { EditDescriptionModal } from "@wavvon/ui";
import type { ChannelPermissionsTabActions, ChannelBansTabActions, ChannelTalkPowerTabActions } from "@wavvon/ui";
import { CreateHubFork } from "@components/hubs/CreateHubFork";
import { BotAppLaunchCard, EventComposer, PollComposer, FocusTrap, GameModal, KeyboardShortcuts, ChannelContextMenu, VoiceMoveMenu, VoiceMoveToast, VoiceMovePromptModal, SearchBar, DiscoverPage, Lobby, FarmSettingsPage, HubSetupWizard } from "@wavvon/ui";
import { createEvent, createPoll } from "@platform";
import { moveChannelOptions, computeDragIntent } from "@wavvon/ui";
import { useVoiceMoveUx, usePresenceStatus, useHubSetupWizardGate } from "@wavvon/ui";
import {
  HubAdminPage,
  type RolesSectionActions,
  type MemberRoleManagerActions,
  type ServerTagsSectionActions,
  type InviteManagerActions,
  type NativeBotsSectionActions,
  type AuditLogSectionActions,
  type CertificationsSectionActions,
  type SoundboardAdminSectionActions,
  type OnboardingAdminSectionActions,
} from "@wavvon/ui";
import {
  createRole, updateRole, deleteRole,
  createRoleCategory, updateRoleCategory, deleteRoleCategory,
  getDiscoveryTags, setDiscoveryTags, submitToDirectory,
  listBadges, listPendingBadges, acceptBadge, declineBadge, removeBadge, grantBadge,
  createHubIcon, renameHubIcon, deleteHubIcon,
  listNativeBots, createNativeBot, deleteNativeBot, getNativeBotDetail, setNativeBotWebhook,
  getAuditLog,
  listCertIssuances, getCertSettings, saveCertSettings, issueCertManual, revokeCert, grantUserBadge,
  listSoundboardClips, uploadSoundboardClip, deleteSoundboardClip,
  listPendingUsers, approvePendingUser, setLobbySettings, setChallengeSettings,
  muteMember, timeoutMember, voiceMuteMember, voiceUnmuteMember, listVoiceMutes,
  getSurveyAdmin, setSurveyAdmin, getSurveyResponses,
  listAlliances, createAlliance, leaveAlliance,
  listPendingAllianceInvites, acceptAllianceInvite, declineAllianceInvite,
  listAllianceSharedChannels, shareChannelWithAlliance, unshareChannelFromAlliance,
  createAllianceInvite, sendAlliancePushInvite, joinAllianceByCode,
  getRecoveryContacts, setRecoveryContacts, removeRecoveryContact,
  listAdminRecoveryRequests, approveRecoveryRequest, denyRecoveryRequest,
  openRotationRequest, getRotationRequestBundle, attestRotationRequest,
} from "@platform";
import {
  adminListWebhooks, adminCreateWebhook, adminRegenerateWebhook, adminDeleteWebhook,
  adminListExternalBots, adminAddExternalBot, adminRemoveExternalBot,
  adminGetBotChannelScope, adminSetBotChannelScope,
} from "./platform/commands/bots";
import { ModerationTab } from "@components/admin/ModerationTab";
import { OutgoingWebhooksSection } from "@components/admin/OutgoingWebhooksSection";
import { BotCapabilitiesPanel } from "@components/admin/BotCapabilitiesPanel";
import { RecoveryContactsSection, type RecoveryContactsSectionActions } from "@wavvon/ui";
import { WelcomeScreenContainer } from "@components/layout/WelcomeScreen";
import { SettingsPage } from "@components/settings/SettingsPage";
import { UserContextMenu } from "@wavvon/ui";
import { VideoPipWindow } from "@components/voice/VideoPipWindow";
import { FriendsModal } from "@wavvon/ui";
import { listFriends, listPendingFriendRequests, sendFriendRequest, acceptFriendRequest, removeFriend } from "@platform";
import { MobileShell } from "@wavvon/ui";
import { buildChannelTree } from "@wavvon/core";
import type { TreeNode } from "@wavvon/core";
import { saveDraft, loadDraft, clearDraft, hasDraft } from "./utils/drafts";
import { ScreenShareSelfPreview } from "@components/voice/ScreenShareSelfPreview";
import { listBotCommands, updateDmBlocks, getDmBlocks, fetchVoiceRoster, activeSession, sendBotAppJoin } from "@platform";
import { sendSetStatus, fetchSoundboardAudioBytes } from "@platform";
import {
  restorePersistedHubs,
  removeHub,
  setActiveHub,
  listHubs,
  refreshHubInfo,
  reorderHubs,
  hubFetch,
  HubApiError,
  loadSavedHubs,
  fetchWithTimeout,
  getLobbyStatus,
  getLobbyWelcome,
  submitLobbyPow,
  getFarmSettings,
  patchFarmSettings,
  getFarmHubsAdmin,
  suspendFarmHub,
  deleteFarmHub,
  getFarmUsers,
  revokeFarmUserSessions,
  getFarmServers,
  generateFarmServerToken,
  farmTotpSetup,
  farmTotpConfirm,
  farmTotpDisable,
} from "@platform";
import { getActiveHubId } from "@platform";
import {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  searchMessages,
  getUnreadCounts,
  markChannelRead,
  subscribeChannel,
} from "@platform";
import {
  publishDhKey,
} from "@platform";
import { loadIdentity, publicKeyHex, setSwitchGuard } from "@identity/index";
import { IdentitySetupScreen, type IdentitySetupCompletion } from "@components/identity/IdentitySetupScreen";
import type { HubInputResult } from "@wavvon/core";

// ---- Types ----
type View = "channels" | "dms";

// The member profile card's own-profile save also propagates to every other
// hub following the account's default profile (see utils/profiles.ts) — pure
// module-level plumbing, no App state needed, so it lives beside the import
// list rather than being rebuilt every render.
const profileCardActions: UserProfileCardActions = {
  getUserProfile: (pubkey) => getUserProfile(pubkey),
  listRoleCategories: () => listRoleCategories(),
  saveMyProfile: async (hubId, fields) => {
    await patchMyProfileOnHub(hubId, fields);
    const follows = loadFollowsDefault();
    if (follows.includes(hubId)) {
      const def = loadDefaultProfile();
      if (def) saveDefaultProfile({ ...def, ...fields });
      for (const hid of follows) {
        if (hid !== hubId) {
          try { await patchMyProfileOnHub(hid, fields); } catch { /* offline hub catches up later */ }
        }
      }
    }
  },
};

// ---- App ----

export interface AppProps {
  // Set by AccountRoot right after an in-place account switch initiated from
  // Settings → Account, so the user lands back there on the new account
  // instead of the main view.
  initialView?: "settings-account";
}

export default function App({ initialView }: AppProps = {}) {
  const { t } = useTranslation();
  // === Identity ===
  const [ready, setReady] = useState<"checking" | "setup" | "ok">("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const {
    showSettings, setShowSettings,
    settingsTab, setSettingsTab,
    theme,
    skin,
    customThemes,
    activeCustomThemeId,
    recoveryPhrase, setRecoveryPhrase,
    mentionPingEnabled, setMentionPingEnabled,
    handleSetTheme,
    handleSkinChange,
    handleApplyCustomTheme,
    handleNewCustomTheme,
    handleRenameCustomTheme,
    handleDuplicateCustomTheme,
    handleDeleteCustomTheme,
    handleImportCustomTheme,
    handleShowRecovery,
    handleRecoverIdentity,
  } = useSettingsProfile(setPublicKey, initialView);

  // === Hubs ===
  const [hubs, setHubs] = useState<Hub[]>([]);
  // Active hub's ambient IANA timezone (HubClock in the sidebar header) —
  // member-facing, so fetched from /info alongside the loadHubData self-heal
  // rather than gated behind the admin settings fetch.
  const [activeHubTimezone, setActiveHubTimezone] = useState<string | null>(null);
  const [activeHubId, setActiveHubIdState] = useState<string | null>(null);
  const { hubConnected, reconnectingHubs, handleStatusChange } = useHubConnection();
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState("");
  const [voicePoliteAnnouncement, setVoicePoliteAnnouncement] = useState("");
  const voiceAnnounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingVoiceAnnouncementsRef = useRef<string[]>([]);
  const [pingByHub, setPingByHub] = useState<Record<string, number | null>>({});
  const [hubDropdownOpen, setHubDropdownOpen] = useState(false);
  const [showQuickInvite, setShowQuickInvite] = useState(false);
  const [homeHubUrl, setHomeHubUrl] = useState<string | undefined>(undefined);
  const [channelCtxMenu, setChannelCtxMenu] = useState<{ channel: Channel; x: number; y: number } | null>(null);
  // "Create event"/"create poll" from the channel context menu (create-anything
  // task): both composers are self-contained modals that only need a target
  // channel id, so they can be opened without switching to that channel first.
  const [eventComposerChannelId, setEventComposerChannelId] = useState<string | null>(null);
  const [pollComposerChannelId, setPollComposerChannelId] = useState<string | null>(null);

  // === Hub data ===
  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [meInfo, setMeInfo] = useState<MeInfo | null>(null);
  const [slashCommands, setSlashCommands] = useState<Array<{ command: string; description: string; bot_name: string }>>([]);
  const {
    userAlliances, setUserAlliances, allianceChannels, setAllianceChannels,
    selectedAllianceChannel, allianceMessages, loadAlliances,
    selectAllianceChannel, clearSelectedAllianceChannel, sendAllianceMessage,
  } = useAlliances(showHubError);
  const [pendingApprovalHubs, setPendingApprovalHubs] = useState<Set<string>>(new Set());
  // lobby-bot-survey.md Feature 1 — hubs whose session is confined to the
  // lobby (PoW below the hub's min_security_level). Detected reactively via
  // the 403 lobby_scope_confined body loadHubData() gets back from
  // /channels, which covers both the initial join and reconnect-after-close
  // (requirement: re-detect on reload) with one code path.
  const [lobbyHubs, setLobbyHubs] = useState<Set<string>>(new Set());

  // === View ===
  const [view, setView] = useState<View>("channels");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  // === Messages ===
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [newWhileScrolledUp, setNewWhileScrolledUp] = useState(0);
  const [memberSidebarHidden, setMemberSidebarHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);
  const [firstNotifyingMessageId, setFirstNotifyingMessageId] = useState<string | null>(null);

  // === Unread / notifications ===
  const {
    unreadByChannel, unreadDms, setUnreadDms,
    bumpUnread, clearUnread, clearHubUnread: clearHubUnreadFn, seedUnreadFromServer,
  } = useUnreadCounts();

  // === DMs ===
  const {
    conversations, setConversations, dmMessages,
    selectedConversation, setSelectedConversation, selectedConvRef,
    handleSelectConversation, handleStartConversation, handleSendDm,
    onDm, onDmMemberChanged,
  } = useDms({
    inputText,
    setInputText,
    setUnreadDms,
    onConversationSelected: () => { setSelectedChannel(null); setView("dms"); },
    showHubError,
  });
  const {
    hubNotifyMode, channelNotifyMode, pinnedChannels, collapsedCategories, hideSilenced,
    hideBirthdays, toggleHideBirthdays,
    setHubNotifyMode, setChannelNotifyMode, setCollapsedCategories, toggleHideSilenced, effectiveNotifyMode,
  } = useNotificationPrefs();
  const silencedChannelIds = useMemo(() => {
    if (!activeHubId) return new Set<string>();
    return new Set(
      channels
        .filter((c) => !c.is_category && effectiveNotifyMode(activeHubId, c.id) === "silent")
        .map((c) => c.id),
    );
  }, [channels, activeHubId, effectiveNotifyMode]);
  const pubkeyToName = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const u of users) m[u.public_key] = u.display_name ?? null;
    return m;
  }, [users]);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [ignoredUsers, setIgnoredUsers] = useState<Set<string>>(() => {
    try {
      const raw = getScoped("wavvon.ignoredUsers");
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });

  function toggleBlockUser(pubkey: string) {
    const prev = blockedUsers;
    const next = new Set(prev);
    if (next.has(pubkey)) next.delete(pubkey);
    else next.add(pubkey);
    setBlockedUsers(next);
    // Optimistic update; on failure revert and say so — a silently
    // unpersisted block is a safety problem, not a cosmetic one.
    updateDmBlocks(Array.from(next)).catch((e) => {
      setBlockedUsers(prev);
      showHubError(e instanceof HubApiError ? e.message : String(e));
    });
  }

  function toggleIgnoreUser(pubkey: string) {
    setIgnoredUsers((prev) => {
      const next = new Set(prev);
      if (next.has(pubkey)) next.delete(pubkey);
      else next.add(pubkey);
      try { setScoped("wavvon.ignoredUsers", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }
  // === Hub admin ===
  const {
    showHubAdmin, setShowHubAdmin,
    hubAdminTab, setHubAdminTab,
    hubAdminName, setHubAdminName,
    hubAdminDescription, setHubAdminDescription,
    hubAdminIcon, setHubAdminIcon,
    hubAdminRequireApproval, setHubAdminRequireApproval,
    hubAdminMinLevel, setHubAdminMinLevel,
    hubAdminWelcomeLabel, setHubAdminWelcomeLabel,
    hubAdminWelcomeInviteUrl, setHubAdminWelcomeInviteUrl,
    hubAdminTimezone, setHubAdminTimezone,
    hubAdminBirthdaysEnabled, setHubAdminBirthdaysEnabled,
    hubAdminSaveError,
    hubAdminMembers,
    hubAdminBans,
    hubAdminInvites,
    hubAdminPending,
    maxChannelDepth, setMaxChannelDepth,
    hubListed,
    onHubListedChange,
    voiceMutedKeys,
    onMuteMember,
    onTimeoutMember,
    onVoiceMuteMember,
    onVoiceUnmuteMember,
    openHubAdmin,
    saveHubAdminSettings,
    addInvite,
    removeInvite,
    setMemberRoles,
  } = useHubAdmin({
    activeHubId,
    // The sidebar renders the locally-stored hub list, whose hub_name/hub_icon
    // are written at add-time — sync them or a rename/icon change never shows
    // up there.
    onSaved: () => {
      if (!activeHubId) return;
      refreshHubInfo(activeHubId).then((info) => {
        if (info) setHubs(listHubs());
      }).catch(() => {});
    },
  });

  // === Profile on the active hub (community-axis; the hub is the source of
  // truth, PATCH /me writes it). The per-account default profile is read from
  // scoped storage at use time — no App state to go stale.
  async function handleUpdateHubProfile(profile: DefaultProfile) {
    try {
      await hubFetch("/me", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: profile.display_name,
          avatar: profile.avatar ?? "",
          bio: profile.bio ?? "",
          pronouns: profile.pronouns ?? "",
          status_message: profile.status_message ?? "",
          activities: profile.activities ?? "",
          accent_color: profile.accent_color ?? "",
          cover: profile.cover ?? "",
          favorite_hubs: profile.favorite_hubs,
          show_hubs: profile.show_hubs,
          birthday: profile.birthday ?? "",
        }),
      });
      hubFetch("/me").then((r) => r.json() as Promise<MeInfo>).then(setMeInfo).catch(() => {});
      hubFetch("/users").then((r) => r.json() as Promise<User[]>).then(setUsers).catch(() => {});
    } catch (e) {
      showHubError(e instanceof HubApiError ? e.message : String(e));
    }
  }

  // The settings profile editor PATCHes any hub itself (via that hub's own
  // session); App only needs to refresh its active-hub mirrors afterwards.
  function handleHubProfileSaved(hubId: string) {
    if (hubId !== activeHubId) return;
    hubFetch("/me").then((r) => r.json() as Promise<MeInfo>).then(setMeInfo).catch(() => {});
    hubFetch("/users").then((r) => r.json() as Promise<User[]>).then(setUsers).catch(() => {});
  }

  // === Farm admin ===
  const {
    showFarmSettings, setShowFarmSettings,
    farmAdminTab, setFarmAdminTab,
    farmAdminUrl,
    isFarmAdmin,
    showCreateHub, setShowCreateHub,
    knownFarms,
  } = useFarmAdmin({ publicKey, hubs });
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // === New web-only UI state ===
  const [showDiscover, setShowDiscover] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showDisplayNamePrompt, setShowDisplayNamePrompt] = useState(false);
  const [firstRunName, setFirstRunName] = useState("");
  const [userContextMenu, setUserContextMenu] = useState<{
    user: User;
    position: { x: number; y: number };
  } | null>(null);

  // === Refs mirrored for WS handlers / voice (created early so the voice
  // cluster below, and useWsHandlers further down, can read them) ===
  const publicKeyRef = useRef<string | null>(publicKey);
  publicKeyRef.current = publicKey;
  const meInfoRef = useRef<MeInfo | null>(null);
  useEffect(() => { meInfoRef.current = meInfo; }, [meInfo]);
  const mentionPingEnabledRef = useRef(mentionPingEnabled);
  mentionPingEnabledRef.current = mentionPingEnabled;
  const effectiveNotifyModeRef = useRef(effectiveNotifyMode);
  effectiveNotifyModeRef.current = effectiveNotifyMode;

  // === Presence (own status, shared across every hub this account is on) ===
  const { myPresence, myPresenceRef, handleSetStatus } = usePresenceStatus({
    loadRaw: () => getScoped("wavvon.presence"),
    persist: (p) => { try { setScoped("wavvon.presence", JSON.stringify(p)); } catch { /* storage unavailable */ } },
    broadcast: (s) => { try { sendSetStatus(s, null); } catch { /* ws not ready */ } },
    // Optimistic: the hubs' member_status broadcasts will confirm. Invisible
    // shows the user offline (to everyone, incl. their own roster view); the
    // footer picker still reflects "invisible".
    applyToRoster: (s) => {
      setUsers((prev) => prev.map((u) =>
        u.public_key === publicKey
          ? { ...u, online: s !== "invisible", status: s === "online" || s === "invisible" ? null : s, status_custom: null }
          : u,
      ));
    },
  });

  // === Voice / video / whisper / voice-move UX ===
  // The hubFetch("/channels") -> setChannels resync used when a spawner join
  // lands in a sibling room not yet in the local channel list.
  function refetchChannels() {
    hubFetch("/channels").then((r) => r.json() as Promise<Channel[]>).then(setChannels).catch(() => {});
  }
  // Filled in below once useVideo/useWhisper/useVoiceMoveUx exist. useVoice
  // only ever reads extRef.current at call time (async), so it's safe for
  // this to start out as no-ops and be overwritten later in the same render.
  const voiceExtRef = useRef<VoiceExtDeps>({
    createVideoSession: () => {},
    disposeVideo: () => {},
    stopVideoSessionOnly: () => {},
    stopWhisperIfActive: () => {},
    clearVoiceChannelNameHint: () => {},
  });
  const voice = useVoice({
    publicKey, publicKeyRef, meInfoRef, showHubError, refetchChannels, extRef: voiceExtRef,
  });
  const video = useVideo({ voiceChannelId: voice.voiceChannelId, showHubError, publicKeyRef });
  const voiceMoveUx = useVoiceMoveUx({ joinVoice: voice.handleVoiceJoin });
  const whisper = useWhisper({ activeHubId, voiceChannelId: voice.voiceChannelId });
  voiceExtRef.current = {
    createVideoSession: video.createVideoSession,
    disposeVideo: video.disposeVideo,
    stopVideoSessionOnly: video.stopVideoSessionOnly,
    stopWhisperIfActive: () => { if (whisper.isWhispering) whisper.stopWhisper(); },
    clearVoiceChannelNameHint: () => voiceMoveUx.setVoiceChannelNameHint(null),
  };
  const whisperOptoutRef = useRef(whisper.whisperOptout);
  whisperOptoutRef.current = whisper.whisperOptout;
  const [whisperReplyBind, setWhisperReplyBindState] = useState<WhisperReplyBind>(loadWhisperReplyBind);
  const setWhisperReplyBind = (bind: WhisperReplyBind) => {
    setWhisperReplyBindState(bind);
    saveWhisperReplyBind(bind);
  };
  // Reply key target: the most recent inbound whisperer (see pickReplyPubkey).
  const whisperReplyTarget = useMemo<WhisperTarget | null>(() => {
    const pk = pickReplyPubkey(whisper.inboundWhisperLog);
    if (!pk) return null;
    const name = users.find((u) => u.public_key === pk)?.display_name;
    return { type: "user", id: pk, label: name || pk.slice(0, 8) };
  }, [whisper.inboundWhisperLog, users]);
  useWhisperKeybinds({
    voiceChannelId: voice.voiceChannelId,
    whisperLists: whisper.whisperLists,
    isWhispering: whisper.isWhispering,
    startWhisper: whisper.startWhisper,
    stopWhisper: whisper.stopWhisper,
    replyBind: whisperReplyBind,
    replyTarget: whisperReplyTarget,
  });
  const [showWhisperPanel, setShowWhisperPanel] = useState(false);
  const [surveyToShow, setSurveyToShow] = useState<import("@platform").SurveyAdmin | null>(null);
  const surveyDismissedRef = useRef<Set<string>>(new Set());
  // Registered so switchAccount can refuse a mid-voice switch at the source
  // (defense in depth alongside the disabled Switch button in Settings →
  // Account) — switching accounts while joined to a voice channel is blocked
  // outright, not auto-left on the caller's behalf.
  useEffect(() => {
    setSwitchGuard(() => (voice.voiceChannelId ? t("settings.account.accounts.switch_blocked_voice") : null));
    return () => setSwitchGuard(null);
  }, [voice.voiceChannelId, t]);

  const [activeBotApps, setActiveBotApps] = useState<Map<string, BotAppLaunchEvent>>(new Map());
  const [activeOpenApp, setActiveOpenApp] = useState<{ event: BotAppOpenEvent; hubUrl: string } | null>(null);

  const loadingHub = useRef(false);

  // === Identity init ===

  useEffect(() => {
    loadIdentity().then((rec) => {
      if (rec) {
        setPublicKey(rec.canonical_pubkey ?? publicKeyHex(rec.seed_hex));
        setReady("ok");
      } else {
        setReady("setup");
      }
    });
  }, []);

  function handleIdentityComplete(result: IdentitySetupCompletion) {
    // Nickname + avatar chosen during onboarding become the default profile,
    // which the first-hub effect below applies automatically via PATCH /me.
    if (result.profile) saveDefaultProfile({ display_name: result.profile.display_name, avatar: result.profile.avatar, bio: null, pronouns: null, status_message: null, activities: null, accent_color: null, cover: null, favorite_hubs: [], show_hubs: false, birthday: null });
    loadIdentity().then((rec) => {
      if (rec) setPublicKey(rec.canonical_pubkey ?? publicKeyHex(rec.seed_hex));
      setReady("ok");
    });
  }

  // Document title (unread count)
  const unreadByHub = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const [hub, m] of Object.entries(unreadByChannel)) {
      out[hub] = Object.keys(m).length;
    }
    return out;
  }, [unreadByChannel]);

  useEffect(() => {
    const total = Object.values(unreadByHub).reduce((n, v) => n + v, 0);
    document.title = total > 0 ? `(${total > 99 ? "99+" : total}) Wavvon` : "Wavvon";
  }, [unreadByHub]);

  // === Typing ===
  const selectedChannelIdRef = useRef<string | undefined>(undefined);
  const selectedConvIdRef = useRef<string | undefined>(undefined);
  const { typingByKey, dmTypingByKey, receiveTyping, pingTyping, pingDmTyping } = useTypingIndicators(
    () => selectedChannelIdRef.current,
    () => selectedConvIdRef.current,
    () => publicKeyRef.current,
  );
  const { chipsByChannel: soundboardChipsByChannel, receiveSoundboardPlayed } = useSoundboardChips();

  // === Refs ===
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesEndChannelRef = useRef<HTMLLIElement | null>(null);
  const messagesContainerRef = useRef<HTMLOListElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const [showFriends, setShowFriends] = useState(false);

  // === WS handlers (stable via ref) ===

  const activeHubIdRef = useRef<string | null>(null);
  useEffect(() => { activeHubIdRef.current = activeHubId; }, [activeHubId]);

  // Outbound screen share + cross-channel hub-streams discovery.
  const {
    screenShareViewerRef, activeScreenShares, sharing, shareKbps, shareLocalStream,
    hubStreams, showHubStreams, setShowHubStreams, subscribedStreamIds,
    handleStartShare, handleStopShare, handleOpenHubStreams, handleWatchStream,
    handleStopWatchStream, onScreenShare, onScreenShareChunk,
  } = useScreenShare({ activeHubIdRef, showHubError });

  const hubsRef = useRef<Hub[]>([]);
  const channelsRef = useRef<Channel[]>([]);
  useEffect(() => { channelsRef.current = channels; }, [channels]);
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);
  useEffect(() => { hubsRef.current = hubs; }, [hubs]);

  useEffect(() => {
    if (hubs.length === 1 && meInfo !== null && !meInfo.display_name) {
      // A default profile means the user already told us who they want to
      // be — apply it silently instead of asking again. Read at fire time so
      // edits made in Settings since mount are honored.
      const def = loadDefaultProfile();
      if (def) {
        void handleUpdateHubProfile(def);
      } else {
        setShowDisplayNamePrompt(true);
      }
    }
  // Only fire once when meInfo first loads on the first hub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meInfo?.display_name, hubs.length]);

  const selectedChannelRef = useRef<Channel | null>(null);
  useEffect(() => {
    selectedChannelRef.current = selectedChannel;
    selectedChannelIdRef.current = selectedChannel?.id;
  }, [selectedChannel]);

  useEffect(() => {
    selectedConvIdRef.current = selectedConversation?.id;
  }, [selectedConversation]);

  // Toast state for hub error messages (W6)
  const [hubErrorToast, setHubErrorToast] = useState<string | null>(null);
  const hubErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showHubError(msg: string) {
    if (hubErrorTimerRef.current) clearTimeout(hubErrorTimerRef.current);
    setHubErrorToast(msg);
    hubErrorTimerRef.current = setTimeout(() => setHubErrorToast(null), 5000);
  }

  // Scrolls to and flashes an already-loaded message row (reply-jump,
  // pinned-message jump, and the tail end of message-permalink navigation
  // once the target channel's history has loaded — nested-channels-ux.md §1.3).
  function handleScrollToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1200);
  }

  // A channel-permalink message target may point at a channel that wasn't
  // yet selected, so the message row doesn't exist until its history loads.
  useEffect(() => {
    if (!pendingScrollMessageId) return;
    if (!messages.some((m) => m.id === pendingScrollMessageId)) return;
    const id = pendingScrollMessageId;
    setPendingScrollMessageId(null);
    requestAnimationFrame(() => handleScrollToMessage(id));
  }, [messages, pendingScrollMessageId]);

  // Give up on a pending message-permalink scroll if the target isn't in
  // the loaded history window (e.g. it's older than what's fetched).
  useEffect(() => {
    if (!pendingScrollMessageId) return;
    const timer = setTimeout(() => setPendingScrollMessageId(null), 8000);
    return () => clearTimeout(timer);
  }, [pendingScrollMessageId]);

  const loadHubDataRef = useRef<() => Promise<void>>(async () => {});
  loadHubDataRef.current = loadHubData;

  const { stableHandlers, stableHandlersRef } = useWsHandlers({
    activeHubIdRef, hubsRef, selectedChannelRef, meInfoRef, publicKeyRef,
    myPresenceRef, effectiveNotifyModeRef, mentionPingEnabledRef, whisperOptoutRef,
    setMessages, setStickToBottom, setNewWhileScrolledUp, bumpUnread,
    setUsers, setChannels, setHubs, setActiveHubTimezone,
    setVoicePartByChannel: voice.setVoicePartByChannel,
    onDm, onDmMemberChanged, receiveTyping,
    onScreenShare, onScreenShareChunk, receiveSoundboardPlayed,
    handleStatusChange, setAssertiveAnnouncement, showHubError,
    loadHubDataRef,
    voiceOnVoiceState: voice.onVoiceState,
    voiceOnVoiceZoneState: voice.onVoiceZoneState,
    voiceOnVoiceZoneCreated: voice.onVoiceZoneCreated,
    voiceOnVoiceZoneDestroyed: voice.onVoiceZoneDestroyed,
    voiceOnVoicePositionUpdated: voice.onVoicePositionUpdated,
    handleVideoMessage: video.handleVideoMessage,
    receiveWhisperEvent: whisper.receiveWhisperEvent,
    onVoiceMovePush: voiceMoveUx.onVoiceMovePush,
    setActiveBotApps, setActiveOpenApp,
  });

  // === Hub restore on startup ===

  useEffect(() => {
    if (ready !== "ok") return;
    async function restore() {
      const list = await restorePersistedHubs(stableHandlers);
      setHubs(list);
      const id = getActiveHubId();
      if (id) {
        setActiveHubIdState(id);
        await loadHubData();
        publishDhKey().catch(() => {});
      }
      const globalHomeHub = window.__WAVVON_HOME_HUB__;
      if (typeof globalHomeHub === "string" && globalHomeHub.trim() && loadSavedHubs().length === 0) {
        setHomeHubUrl(globalHomeHub.trim());
      }
    }
    void restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function clearHubUnread(hubId: string) { clearHubUnreadFn(hubId); }

  // === Hub data loading ===

  async function loadHubData() {
    if (loadingHub.current) return;
    loadingHub.current = true;
    // Self-heal the locally-cached hub name+icon (stored at add-time): a
    // rename or icon change done in hub admin — possibly on another device —
    // otherwise never reaches the sidebar, not even across reloads.
    // Fire-and-forget.
    {
      const hubId = getActiveHubId();
      if (hubId) {
        refreshHubInfo(hubId).then((info) => {
          if (info) {
            setHubs(listHubs());
            setActiveHubTimezone(info.timezone);
          }
        }).catch(() => { /* cosmetic sync only */ });
      }
    }
    try {
      const [ch, usr, me, convs, cmds, voiceRoster, dmBlocks] = await Promise.allSettled([
        hubFetch("/channels").then((r) => r.json() as Promise<Channel[]>),
        hubFetch("/users").then((r) => r.json() as Promise<User[]>),
        hubFetch("/me").then((r) => r.json() as Promise<MeInfo>),
        hubFetch("/conversations").then((r) => r.json() as Promise<Conversation[]>),
        listBotCommands().catch(() => [] as Array<{ command: string; description: string; bot_name: string }>),
        fetchVoiceRoster().catch(() => ({} as Record<string, VoiceParticipant[]>)),
        getDmBlocks().catch(() => null),
      ]);
      // A lobby-scoped session (lobby-bot-survey.md Feature 1) 403s every
      // route outside the lobby allowlist — /channels is always in that
      // batch, so its rejection reason is the signal. Checked before
      // touching any other settled promise; the others 403 the same way and
      // there's nothing useful to salvage from them for a lobby hub.
      const hubIdForLobbyCheck = getActiveHubId();
      if (ch.status === "rejected" && isLobbyScopeConfined(ch.reason)) {
        if (hubIdForLobbyCheck) {
          setLobbyHubs((prev) => new Set([...prev, hubIdForLobbyCheck]));
        }
        // Drop whatever channel/user/conversation data is left over from a
        // previously active member hub — the lobby screen replaces the main
        // content area, but the persistent hub sidebar renders straight off
        // this state and would otherwise show a stale, unrelated hub's data.
        setChannels([]);
        setUsers([]);
        setConversations([]);
        setSelectedChannel(null);
        return;
      }
      if (hubIdForLobbyCheck) {
        setLobbyHubs((prev) => {
          if (!prev.has(hubIdForLobbyCheck)) return prev;
          const next = new Set(prev);
          next.delete(hubIdForLobbyCheck);
          return next;
        });
      }
      void loadAlliances();
      if (ch.status === "fulfilled") {
        setChannels(ch.value);
        if (!selectedChannelRef.current) {
          const first = ch.value.find((c) => !c.is_category && c.channel_type !== "banner" && c.channel_type !== "spawner");
          if (first) {
            setSelectedChannel(first);
            // Load the auto-selected channel's history + subscribe. Without
            // this the message pane stays empty after a hub switch (only
            // handleSelectChannel fetched messages, and switching bypasses it).
            subscribeChannel(first.id).catch(() => {});
            getMessages(first.id)
              .then((msgs) => {
                // Guard against a racing manual selection while we awaited.
                if (selectedChannelRef.current?.id === first.id) {
                  setMessages(msgs);
                  setStickToBottom(true);
                }
              })
              .catch(() => {});
          }
        }
      }
      if (usr.status === "fulfilled") setUsers(usr.value);
      if (me.status === "fulfilled") {
        const meVal = me.value;
        setMeInfo(meVal);
        const hubId = getActiveHubId();
        if (meVal.approval_status === "pending" && hubId) {
          setPendingApprovalHubs((prev) => new Set([...prev, hubId]));
          return;
        }
        if (hubId) {
          setPendingApprovalHubs((prev) => {
            if (!prev.has(hubId)) return prev;
            const next = new Set(prev);
            next.delete(hubId);
            return next;
          });
        }
      }
      if (convs.status === "fulfilled") setConversations(convs.value);
      if (cmds.status === "fulfilled") setSlashCommands(cmds.value);
      if (voiceRoster.status === "fulfilled") voice.setVoicePartByChannel(voiceRoster.value);
      // The hub is the source of truth for DM blocks; without this seed the
      // list silently reset to empty on every reload.
      if (dmBlocks.status === "fulfilled" && dmBlocks.value) setBlockedUsers(new Set(dmBlocks.value));
      const hubId = getActiveHubId();
      if (hubId) {
        getUnreadCounts().then((counts) => seedUnreadFromServer(hubId, counts)).catch(() => {});
      }
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      // Show the onboarding survey if this hub has an active one we haven't
      // handled this session.
      // GET /survey/current only returns a survey when one is enabled (no
      // `enabled` field on the public shape), so its presence is the signal.
      getCurrentSurvey().then((s) => {
        if (s && s.questions.length > 0 && !surveyDismissedRef.current.has(s.id)) {
          setSurveyToShow(s);
        }
      }).catch(() => {});
    } finally {
      loadingHub.current = false;
    }
  }

  // Lobby -> member transition in place (lobby-bot-survey.md Feature 1):
  // /lobby/submit-pow already flipped the session's scope server-side on the
  // same token, so there's no re-auth here — just open the WS the hub had
  // been rejecting, drop the lobby screen, and pull the now-unlocked hub
  // data.
  async function handleLobbyPromoted(hubId: string) {
    setLobbyHubs((prev) => {
      if (!prev.has(hubId)) return prev;
      const next = new Set(prev);
      next.delete(hubId);
      return next;
    });
    connectHubWebSocket(hubId, stableHandlersRef.current);
    if (hubId === activeHubIdRef.current) {
      await loadHubData();
      publishDhKey().catch(() => {});
    }
    const hubName = hubsRef.current.find((h) => h.hub_id === hubId)?.hub_name ?? "the hub";
    showHubError(t("lobby.welcome", { hub: hubName }));
  }

  // === Hub management ===

  async function handleSwitchHub(hubId: string) {
    setActiveHub(hubId);
    setActiveHubIdState(hubId);
    setSelectedChannel(null);
    setSelectedConversation(null);
    clearSelectedAllianceChannel();
    setUserAlliances([]);
    setAllianceChannels({});
    setMessages([]);
    setView("channels");
    await loadHubData();
  }

  // Applies a parsed channel/message permalink target once its hub is the
  // active one: selects the channel and, for a message target, queues the
  // scroll-to-message once that channel's history has loaded.
  async function applyDeepLinkTarget(hubId: string, target: NonNullable<HubInputResult["target"]>) {
    if (getActiveHubId() !== hubId) {
      await handleSwitchHub(hubId);
    }
    let list = channelsRef.current;
    try {
      list = await hubFetch("/channels").then((r) => r.json() as Promise<Channel[]>);
    } catch { /* fall back to whatever is already loaded */ }
    const ch = list.find((c) => c.id === target.channelId);
    if (!ch) {
      showHubError(t("hub.permalink.channel_not_found"));
      return;
    }
    await handleSelectChannel(ch);
    if (target.kind === "message") setPendingScrollMessageId(target.messageId);
  }

  async function handleRemoveHub(hubId: string) {
    await removeHub(hubId);
    const list = listHubs();
    setHubs(list);
    if (activeHubId === hubId) {
      const next = list[0]?.hub_id ?? null;
      setActiveHubIdState(next);
      setSelectedChannel(null);
      setSelectedConversation(null);
      clearSelectedAllianceChannel();
      setUserAlliances([]);
      setAllianceChannels({});
      if (next) await loadHubData();
    }
  }

  function handleHubReorder(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setHubs((prev) => {
      const next = arrayMove(
        prev,
        prev.findIndex((h) => h.hub_id === active.id),
        prev.findIndex((h) => h.hub_id === over.id),
      );
      reorderHubs(next.map((h) => h.hub_id)).catch(() => {});
      return next;
    });
  }

  const {
    hubUrl, setHubUrl,
    inviteCode, setInviteCode,
    hubPreview, setHubPreview,
    addingHub,
    addHubError, setAddHubError,
    fingerprintMatch, setFingerprintMatch,
    showAddHub, setShowAddHub,
    handleHubUrlInput,
    handlePreviewHub,
    handleAddHub,
    handleAddHubWithPasskey,
  } = useAddHubFlow({
    publicKey, stableHandlers, hubsRef, setHubs, setActiveHubIdState, loadHubData,
    setShowCreateHub, applyDeepLinkTarget, t,
  });

  async function handleSaveFirstRunName() {
    const name = firstRunName.trim();
    if (!name) { setShowDisplayNamePrompt(false); return; }
    try {
      await hubFetch("/me", { method: "PATCH", body: JSON.stringify({ display_name: name }) });
      setMeInfo((prev) => prev ? { ...prev, display_name: name } : prev);
    } catch { /* non-critical, ignore */ }
    setShowDisplayNamePrompt(false);
  }

  // === Channel / messages ===

  async function handleSelectChannel(ch: Channel) {
    setSelectedChannel(ch);
    setSelectedConversation(null);
    clearSelectedAllianceChannel();
    setView("channels");
    setMessages([]);
    setReplyTarget(null);
    setEditingMessageId(null);
    if (activeHubId) {
      clearUnread(activeHubId, ch.id);
      setInputText(loadDraft(`${activeHubId}/${ch.id}`));
    } else {
      setInputText("");
    }
    markChannelRead(ch.id).catch(() => {});
    // Channels created after the WS connected are not in the hub's
    // auto-subscribe set; subscribing is idempotent for the rest.
    subscribeChannel(ch.id).catch(() => {});
    try {
      const msgs = await getMessages(ch.id);
      setMessages(msgs);
      setStickToBottom(true);
      setNewWhileScrolledUp(0);
    } catch {}
  }

  function handleSelectAllianceChannel(alliance: AllianceInfo, channel: AllianceSharedChannel) {
    setSelectedChannel(null);
    setSelectedConversation(null);
    setView("channels");
    setInputText("");
    setReplyTarget(null);
    setEditingMessageId(null);
    void selectAllianceChannel(alliance, channel);
  }

  async function handleSendAllianceMessage() {
    if (!selectedAllianceChannel || !inputText.trim()) return;
    const text = inputText;
    setInputText("");
    await sendAllianceMessage(text);
  }

  // Expands whatever ancestor categories are collapsed so a breadcrumb
  // category crumb (nested-channels-ux.md §1.4) becomes visible, then
  // scrolls the sidebar to it.
  function handleBreadcrumbCategoryClick(categoryId: string) {
    const hubId = activeHubId;
    if (!hubId) return;
    const ancestorsAbove = channelPath(channels, categoryId).slice(0, -1);
    if (ancestorsAbove.length > 0) {
      setCollapsedCategories((prev) => {
        const m = { ...(prev[hubId] ?? {}) };
        let changed = false;
        for (const anc of ancestorsAbove) {
          if (m[anc.id]) { delete m[anc.id]; changed = true; }
        }
        return changed ? { ...prev, [hubId]: m } : prev;
      });
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`sidebar-node-${categoryId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  async function handleChannelDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const forbidden = descendantIds(channelTree, activeId);
    if (forbidden.has(overId)) return;

    const allFlat = flattenTree(channelTree);
    const activeFlat = allFlat.find((n) => n.node.id === activeId);
    const overFlat = allFlat.find((n) => n.node.id === overId);
    if (!activeFlat || !overFlat) return;

    // Edge-zone rule (nested-channels-ux drag&drop fix): dropping on the
    // top/bottom edge of a category reorders as a sibling instead of always
    // nesting — otherwise root-level items could never be reordered around
    // a category.
    const intent = over.rect
      ? computeDragIntent(active.rect.current.translated, over.rect, overFlat.node.is_category)
      : "before";
    const willNest = intent === "nest";

    if (maxChannelDepth > 0) {
      const maxCodeDepth = maxChannelDepth - 1;
      const parentForDepth = willNest ? overFlat.node.id : overFlat.parentId;
      const newDepth = parentForDepth !== null
        ? computeDepth(channels, parentForDepth) + 1
        : 0;
      if (newDepth > maxCodeDepth) return;
      if (activeFlat.node.is_category && newDepth >= maxCodeDepth) return;
    }

    const newParentId = willNest ? overFlat.node.id : overFlat.parentId;
    const parentChanged = newParentId !== activeFlat.node.parent_id;

    const channelsWithNewParent = parentChanged
      ? channels.map((c) => (c.id === activeId ? { ...c, parent_id: newParentId } : c))
      : channels;

    const sorted = [...channelsWithNewParent].sort((a, b) => a.display_order - b.display_order);
    const oldIndex = sorted.findIndex((c) => c.id === activeId);
    const newIndex = sorted.findIndex((c) => c.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(sorted, oldIndex, newIndex);
    setChannels(reordered.map((c, i) => ({ ...c, display_order: i })));

    try {
      const { moveChannel, reorderChannels } = await import("./platform/commands/hubAdmin");
      if (parentChanged) {
        await moveChannel(activeId, newParentId);
      }
      await reorderChannels(reordered.map((c) => c.id));
    } catch { /* optimistic — ignore network errors */ }
  }

  async function handleSend() {
    if (!selectedChannel || !inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");
    if (activeHubId) clearDraft(`${activeHubId}/${selectedChannel.id}`);
    try {
      await sendMessage(selectedChannel.id, text, pendingAttachments.length ? pendingAttachments : undefined, replyTarget?.id);
      setPendingAttachments([]);
      setReplyTarget(null);
    } catch {}
  }

  async function handleSaveEdit() {
    if (!editingMessageId || !editingDraft.trim() || !selectedChannel) return;
    try {
      await editMessage(selectedChannel.id, editingMessageId, editingDraft.trim());
      setEditingMessageId(null);
      setEditingDraft("");
    } catch {}
  }

  function handleCancelEdit() { setEditingMessageId(null); setEditingDraft(""); }

  function handleStartEdit(msg: Message) {
    setEditingMessageId(msg.id);
    setEditingDraft(msg.content);
  }

  async function handleDeleteMessage(msgId: string) {
    if (!selectedChannel) return;
    try {
      await deleteMessage(selectedChannel.id, msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch {}
  }

  async function handleToggleReaction(msgId: string, emoji: string) {
    if (!selectedChannel) return;
    const msg = messages.find((m) => m.id === msgId);
    const existing = msg?.reactions?.find((r) => r.emoji === emoji);
    try {
      if (existing?.me) await removeReaction(selectedChannel.id, msgId, emoji);
      else await addReaction(selectedChannel.id, msgId, emoji);
    } catch {}
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
    if (e.key === "Escape") { setReplyTarget(null); setEditingMessageId(null); }
  }

  // Mover's side: right-click "Move to channel…" (events.md §7.1) and the
  // event staging panel (§7.5, eventId set) both funnel through here.
  function handleMoveMember(targetPubkey: string, targetChannelId: string, eventId?: string) {
    const ws = activeSession().ws;
    if (!ws) { showHubError("Not connected"); return; }
    ws.sendVoiceMove(targetPubkey, targetChannelId, eventId);
  }

  const channelTypingByKey = useMemo(() => {
    if (!selectedChannel) return {} as Record<string, { name: string; ts: number }>;
    const prefix = `${selectedChannel.id}:`;
    const out: Record<string, { name: string; ts: number }> = {};
    for (const [k, v] of Object.entries(typingByKey)) {
      if (k.startsWith(prefix)) out[k] = v;
    }
    return out;
  }, [typingByKey, selectedChannel]);

  const convTypingByKey = useMemo(() => {
    if (!selectedConversation) return {} as Record<string, { name: string; ts: number }>;
    const prefix = `${selectedConversation.id}:`;
    const out: Record<string, { name: string; ts: number }> = {};
    for (const [k, v] of Object.entries(dmTypingByKey)) {
      if (k.startsWith(prefix)) out[k] = v;
    }
    return out;
  }, [dmTypingByKey, selectedConversation]);

  const isAdmin = useMemo(
    () => meInfo?.roles?.some((r) => r.permissions?.includes("admin")) ?? false,
    [meInfo],
  );

  // First-run hub setup wizard (decisions.md 2026-07-25): shown once per hub
  // when an admin lands on an empty channel list. "Done" covers both
  // "picked a template" and "started blank" — never re-nag either way.
  const { showHubSetupWizard, setShowHubSetupWizard, closeHubSetupWizard } = useHubSetupWizardGate({
    storageGet: () => getScoped("wavvon.hubSetupWizardDone"),
    storageSet: (raw) => { try { setScoped("wavvon.hubSetupWizardDone", raw); } catch { /* storage unavailable */ } },
    activeHubId,
    isAdmin,
    channelCount: channels.length,
  });

  const {
    createChannelCtx, setCreateChannelCtx,
    createChannelLoading,
    createChannelError, setCreateChannelError,
    channelSettingsCtx, setChannelSettingsCtx,
    channelSettingsSaving,
    channelSettingsDeleting,
    channelSettingsError, setChannelSettingsError,
    editDescChannel, setEditDescChannel,
    editDescValue, setEditDescValue,
    renameRoomCtx, setRenameRoomCtx,
    renameRoomName, setRenameRoomName,
    renameRoomSaving,
    renameRoomError, setRenameRoomError,
    handleCreateChannel,
    createChannelForWizard,
    handleSaveChannelSettings,
    handleDeleteChannel,
    handleSaveDescription,
    handleRenameRoom,
    handleHubSetupWizardComplete,
  } = useChannelCrud({
    setChannels, selectedChannel, setSelectedChannel, showHubError, handleSelectChannel,
    activeHubId, closeHubSetupWizard,
  });

  const canManageRoles = useMemo(
    () => meInfo?.roles?.some((r) => r.permissions?.includes("admin") || r.permissions?.includes("manage_roles")) ?? false,
    [meInfo],
  );

  // Gates the voice roster's "Move to channel…" entry (events.md §7.1). The
  // hub re-checks channel-scoped against the destination on every voice_move —
  // this is UX-only, same posture as the other client-side permission gates here.
  const canMoveMembers = useMemo(
    () => meInfo?.roles?.some((r) => r.permissions?.includes("admin") || r.permissions?.includes("move_members")) ?? false,
    [meInfo],
  );

  const voiceMoveChannelOptions = useMemo(
    () => moveChannelOptions(channels).filter((c) => c.id !== voiceMoveUx.voiceMoveMenu?.currentChannelId),
    [channels, voiceMoveUx.voiceMoveMenu],
  );

  // Same permission the invite endpoints require (routes/invites.rs) — gates
  // the "Invite people" entry for non-admin members too.
  const canCreateInvites = useMemo(
    () => isAdmin || (meInfo?.roles?.some((r) => r.permissions?.includes("manage_channels")) ?? false),
    [isAdmin, meInfo],
  );

  // Same permission the poll-create endpoint requires (SEND_MESSAGES) —
  // gates the "Create poll" context-menu entry the same way the composer's
  // own "+" attach menu is implicitly gated (anyone who can post here).
  const canSendMessages = useMemo(
    () => meInfo?.roles?.some((r) => r.permissions?.includes("admin") || r.permissions?.includes("send_messages")) ?? false,
    [meInfo],
  );

  const canUseSoundboard = useMemo(() => {
    if (voice.myVoicePerms && voice.myVoicePerms.channel_id === voice.voiceChannelId) {
      return voice.myVoicePerms.is_admin || voice.myVoicePerms.permissions.includes("use_soundboard");
    }
    return meInfo?.roles?.some((r) => r.permissions?.includes("admin") || r.permissions?.includes("use_soundboard")) ?? false;
  }, [voice.myVoicePerms, voice.voiceChannelId, meInfo]);

  const canManageSoundboard = useMemo(
    () => meInfo?.roles?.some((r) => r.permissions?.includes("admin") || r.permissions?.includes("manage_soundboard")) ?? false,
    [meInfo],
  );

  const myRoles = useMemo(() => meInfo?.roles ?? [], [meInfo]);

  // Highest priority among the viewer's own roles — the hub only lets you
  // assign/remove roles strictly below your own priority.
  const myMaxPriority = useMemo(
    () => myRoles.reduce((m, r) => Math.max(m, r.priority), 0),
    [myRoles],
  );

  const channelPermissionsTabActions: ChannelPermissionsTabActions = {
    getChannelPermissions,
    setChannelRolePermissions,
    clearChannelRolePermissions,
    listRoles,
  };

  const channelBansTabActions: ChannelBansTabActions = {
    listChannelBans,
    banFromChannel,
    unbanFromChannel,
  };

  const channelTalkPowerTabActions: ChannelTalkPowerTabActions = {
    getTalkPower,
    setTalkPower,
  };

  const userContextMenuActions: UserContextMenuActions = {
    listRoles,
    listUserRoles,
    assignRole: assignRoleToUser,
    removeRole: removeRoleFromUser,
    muteUser: (pubkey) => hubFetch("/moderation/mutes", { method: "POST", body: JSON.stringify({ target_public_key: pubkey }) }).then(() => {}),
    kickUser: (pubkey) => hubFetch("/moderation/kick", { method: "POST", body: JSON.stringify({ target_public_key: pubkey }) }).then(() => {}),
    banUser: (pubkey) => hubFetch("/moderation/bans", { method: "POST", body: JSON.stringify({ target_public_key: pubkey }) }).then(() => {}),
    dm: (user) => handleStartConversation(user.public_key),
    addFriend: (user) => {
      void sendFriendRequest(user.public_key)
        .then(() => showHubError(`Friend request sent to ${user.display_name ?? user.public_key.slice(0, 8)}`))
        .catch((e) => showHubError(`Failed to send friend request: ${e}`));
    },
    toggleBlock: toggleBlockUser,
    toggleIgnore: toggleIgnoreUser,
  };

  const knownDisplayNames = useMemo(
    () => new Set(users.map((u) => u.display_name).filter(Boolean) as string[]),
    [users],
  );

  const channelTree = useMemo<TreeNode[]>(
    () => buildChannelTree(channels),
    [channels],
  );

  useEffect(() => {
    if (!selectedChannel) {
      setSearchResults(null);
      return;
    }
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const r = await searchMessages(selectedChannel.id, q);
        if (!cancelled) setSearchResults(r);
      } catch {
        if (!cancelled) setSearchResults([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchQuery, selectedChannel]);

  useEffect(() => {
    if (hubs.length === 0) return;
    let cancelled = false;
    async function tick() {
      for (const h of hubs) {
        if (cancelled) return;
        try {
          const { pingHub } = await import("./platform/commands/hubs");
          const ms = await pingHub(h.hub_id);
          if (cancelled) return;
          setPingByHub((prev) => ({ ...prev, [h.hub_id]: ms }));
        } catch {
          if (cancelled) return;
          setPingByHub((prev) => ({ ...prev, [h.hub_id]: null }));
        }
      }
    }
    void tick();
    const interval = setInterval(() => { void tick(); }, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubs.length]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

      if (mod && e.key === "/") {
        e.preventDefault();
        setShowKeyboardShortcuts((v) => !v);
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        setShowSettings((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearchBar((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }
      if (mod && e.key === "ArrowDown") {
        e.preventDefault();
        setActiveHubIdState((prev) => {
          const idx = hubs.findIndex((h) => h.hub_id === prev);
          const next = hubs[idx + 1];
          return next ? next.hub_id : prev;
        });
        return;
      }
      if (mod && e.key === "ArrowUp") {
        e.preventDefault();
        setActiveHubIdState((prev) => {
          const idx = hubs.findIndex((h) => h.hub_id === prev);
          const next = hubs[idx - 1];
          return next ? next.hub_id : prev;
        });
        return;
      }
      if (!inInput && e.key === "/") {
        e.preventDefault();
        messageInputRef.current?.focus();
        return;
      }
      if (e.altKey && (e.code === "ArrowDown" || e.code === "ArrowUp")) {
        e.preventDefault();
        const hubId = activeHubIdRef.current;
        const unreadSet = hubId ? (unreadByChannel[hubId] ?? {}) : {};
        const visibleChannels = channels.filter((c) => !c.is_category);
        const unreadChannels = visibleChannels.filter((c) => unreadSet[c.id]);
        const pool = unreadChannels.length > 0 ? unreadChannels : visibleChannels;
        const idx = pool.findIndex((c) => c.id === selectedChannel?.id);
        const next = e.code === "ArrowDown"
          ? pool[(idx + 1) % pool.length]
          : pool[(idx - 1 + pool.length) % pool.length];
        if (next) void handleSelectChannel(next);
        return;
      }
      if (e.key === "Escape" && !inInput) {
        if (showKeyboardShortcuts) { setShowKeyboardShortcuts(false); return; }
        if (showSettings) { setShowSettings(false); return; }
        if (showHubAdmin) { setShowHubAdmin(false); return; }
        if (showFarmSettings) { setShowFarmSettings(false); return; }
        if (showCreateHub) { setShowCreateHub(false); return; }
        if (showAddHub) { setShowAddHub(false); return; }
        if (showQuickInvite) { setShowQuickInvite(false); return; }
        if (showSearchBar) { setShowSearchBar(false); return; }
        if (searchOpen) { setSearchOpen(false); return; }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hubs, channels, selectedChannel, messageInputRef, unreadByChannel, showKeyboardShortcuts, showSettings, showHubAdmin, showFarmSettings, showCreateHub, showAddHub, showQuickInvite, showSearchBar, searchOpen]);

  // === Render ===

  if (ready === "checking") {
    return <div style={{ padding: 32 }}>Loading…</div>;
  }

  if (ready === "setup") {
    return <IdentitySetupScreen onComplete={handleIdentityComplete} />;
  }

  // With zero hubs joined, "channels" view has nothing to show — force the
  // rail into the DM/friends view so the shell chrome (footer identity,
  // friends button, +add-hub) stays meaningful instead of showing an empty
  // hub header.
  const hasNoHubs = hubs.length === 0;
  const sidebarView = hasNoHubs ? "dms" : view;

  return (
    <div className="main-layout">
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveAnnouncement}
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {voicePoliteAnnouncement}
      </div>
      <WhisperInbox
        entries={whisper.inboundWhisperLog.map((e) => ({
          ...e,
          name: users.find((u) => u.public_key === e.pubkey)?.display_name || e.pubkey.slice(0, 8),
        }))}
        onDismiss={whisper.dismissInbound}
        onClearAll={whisper.clearInbound}
      />

      {hubErrorToast && (
        <div
          style={{
            position: "fixed", top: 52, left: "50%", transform: "translateX(-50%)",
            background: "var(--surface)", border: "1px solid var(--danger, #e05252)",
            borderRadius: "var(--r-md)", padding: "8px 16px", zIndex: 9999,
            fontSize: "var(--text-sm)", color: "var(--danger, #e05252)",
          }}
        >
          {hubErrorToast}
        </div>
      )}

      {voiceMoveUx.voiceMoveToast && (
        <VoiceMoveToast
          channelName={voiceMoveUx.voiceMoveToast.channelName}
          canRejoin={voiceMoveUx.voiceMoveToast.sourceChannelId !== null}
          onRejoin={voiceMoveUx.handleRejoinPreviousVoiceChannel}
          onDismiss={voiceMoveUx.dismissVoiceMoveToast}
        />
      )}

      {voiceMoveUx.voiceMovePrompt && (
        <VoiceMovePromptModal
          channelName={voiceMoveUx.voiceMovePrompt.targetChannelName}
          onAccept={voiceMoveUx.handleAcceptVoiceMove}
          onDecline={voiceMoveUx.handleDeclineVoiceMove}
        />
      )}

      {voiceMoveUx.voiceMoveMenu && (
        <VoiceMoveMenu
          displayName={voiceMoveUx.voiceMoveMenu.displayName}
          position={voiceMoveUx.voiceMoveMenu.position}
          channels={voiceMoveChannelOptions}
          onMove={(channelId) => { handleMoveMember(voiceMoveUx.voiceMoveMenu!.pubkey, channelId); voiceMoveUx.setVoiceMoveMenu(null); }}
          onClose={() => voiceMoveUx.setVoiceMoveMenu(null)}
        />
      )}

      {sharing && (
        <ScreenShareSelfPreview
          stream={shareLocalStream}
          kbps={shareKbps}
          onStop={handleStopShare}
        />
      )}

      {showKeyboardShortcuts && (
        <KeyboardShortcuts onClose={() => setShowKeyboardShortcuts(false)} />
      )}

      {showDiscover && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "var(--bg, #1a1a2e)", overflow: "auto" }}>
          <DiscoverPage
            onClose={() => setShowDiscover(false)}
            onJoinHub={(hubUrl, inviteCode) => {
              setHubUrl(hubUrl);
              setInviteCode(inviteCode);
              setShowDiscover(false);
              setShowAddHub(true);
            }}
            fetchUrl={fetchWithTimeout}
          />
        </div>
      )}

      {showSearchBar && (
        <SearchBar
          onSearch={(q) => hubFetch(`/search?q=${encodeURIComponent(q)}`).then((r) => r.json())}
          onClose={() => setShowSearchBar(false)}
          onNavigate={(channelId, _messageId) => {
            const ch = channels.find((c) => c.id === channelId);
            if (ch) void handleSelectChannel(ch);
            setShowSearchBar(false);
          }}
        />
      )}

      {showFriends && (
        <FriendsModal
          actions={{ listFriends, listPendingFriendRequests, sendFriendRequest, acceptFriendRequest, removeFriend }}
          onClose={() => setShowFriends(false)}
          onToast={(msg) => showHubError(msg)}
        />
      )}

      {showHubStreams && (
        <HubStreamsPanel
          streams={hubStreams}
          subscribedIds={subscribedStreamIds.current}
          currentChannelId={selectedChannel?.id ?? null}
          channels={channels}
          nameFor={(pk) => users.find((u) => u.public_key === pk)?.display_name || pk.slice(0, 8)}
          onWatch={handleWatchStream}
          onStopWatch={handleStopWatchStream}
          onClose={() => setShowHubStreams(false)}
        />
      )}

      {surveyToShow && (
        <SurveyModal
          survey={surveyToShow}
          onDone={() => { surveyDismissedRef.current.add(surveyToShow.id); setSurveyToShow(null); }}
          onSkip={() => { surveyDismissedRef.current.add(surveyToShow.id); setSurveyToShow(null); }}
        />
      )}

      {showSettings && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "var(--bg, #1a1a2e)", overflow: "auto", display: "flex" }}>
          <SettingsPage
            tab={settingsTab}
            onTab={setSettingsTab}
            onClose={() => setShowSettings(false)}
            hubs={hubs}
            publicKey={publicKey}
            theme={theme}
            onThemeChange={handleSetTheme}
            skin={skin}
            onSkinChange={handleSkinChange}
            customThemes={customThemes}
            activeCustomThemeId={activeCustomThemeId}
            onApplyCustomTheme={handleApplyCustomTheme}
            onNewCustomTheme={handleNewCustomTheme}
            onRenameCustomTheme={handleRenameCustomTheme}
            onDuplicateCustomTheme={handleDuplicateCustomTheme}
            onDeleteCustomTheme={handleDeleteCustomTheme}
            onImportSkin={handleImportCustomTheme}
            onHubProfileSaved={handleHubProfileSaved}
            mentionPingEnabled={mentionPingEnabled}
            onMentionPingChange={(v) => {
              setMentionPingEnabled(v);
              try { setScoped("wavvon.mentionPing", v ? "1" : "0"); } catch {}
            }}
            recoveryPhrase={recoveryPhrase}
            onShowRecovery={handleShowRecovery}
            blocks={Array.from(blockedUsers).map((p) => ({ pubkey: p, since: 0 }))}
            ignores={Array.from(ignoredUsers).map((p) => ({ pubkey: p, since: 0 }))}
            onUnblock={toggleBlockUser}
            onUnignore={toggleIgnoreUser}
            knownNames={pubkeyToName}
            hideBirthdays={hideBirthdays}
            onToggleHideBirthdays={toggleHideBirthdays}
            inVoice={voice.voiceChannelId !== null}
          />
        </div>
      )}

      {userContextMenu && (
        <UserContextMenu
          user={userContextMenu.user}
          publicKey={publicKey}
          isAdmin={isAdmin}
          canManageRoles={canManageRoles}
          myMaxPriority={myMaxPriority}
          blockedUsers={blockedUsers}
          ignoredUsers={ignoredUsers}
          position={userContextMenu.position}
          actions={userContextMenuActions}
          onClose={() => setUserContextMenu(null)}
          onToast={(msg) => showHubError(msg)}
          onRolesChanged={() => {
            hubFetch("/users").then((r) => r.json() as Promise<User[]>).then(setUsers).catch(() => {});
          }}
        />
      )}

      {voice.voiceChannelId && (video.videoEnabled || video.remoteVideoStreams.size > 0) && (
        <VideoPipWindow
          title={`#${channels.find((c) => c.id === voice.voiceChannelId)?.name ?? "voice"}`}
          localStream={video.localVideoStream}
          remoteStreams={video.remoteVideoStreams}
          nameFor={(pk) => users.find((u) => u.public_key === pk)?.display_name || pk.slice(0, 8)}
        />
      )}

      {showFarmSettings && (
        <FarmSettingsPage
          farmUrl={farmAdminUrl}
          tab={farmAdminTab}
          onTab={setFarmAdminTab}
          onClose={() => setShowFarmSettings(false)}
          actions={{
            getSettings: getFarmSettings,
            patchSettings: patchFarmSettings,
            getHubs: getFarmHubsAdmin,
            suspendHub: suspendFarmHub,
            deleteHub: deleteFarmHub,
            getUsers: getFarmUsers,
            revokeUserSessions: revokeFarmUserSessions,
            getServers: getFarmServers,
            generateServerToken: generateFarmServerToken,
            totpSetup: farmTotpSetup,
            totpConfirm: farmTotpConfirm,
            totpDisable: farmTotpDisable,
          }}
        />
      )}

      {showCreateHub && (
        <CreateHubFork
          knownFarms={knownFarms}
          wsHandlers={stableHandlers}
          onHubCreated={(hub) => {
            setHubs((prev) => {
              if (prev.some((h) => h.hub_id === hub.hub_id)) return prev;
              return [...prev, hub];
            });
            setActiveHubIdState(hub.hub_id);
            setShowCreateHub(false);
          }}
          discoveryNewUrl={DISCOVERY_NEW_HUB_URL}
          setupCommand={HUB_SETUP_COMMAND}
          inviteValue={hubUrl}
          onInviteChange={handleHubUrlInput}
          inviteLoading={addingHub}
          inviteError={addHubError}
          onRedeemInvite={handleAddHub}
          onClose={() => {
            setShowCreateHub(false);
            setHubUrl("");
            setInviteCode("");
            setHubPreview({ state: "idle" });
            setAddHubError(null);
          }}
        />
      )}

      <MobileShell
        showHubSidebar
        showChannelSidebar
        showContent
        onBack={() => {}}
      >
      <HubSidebar
        hubs={hubs}
        activeHubId={activeHubId}
        view={sidebarView as "channels" | "dms"}
        showDiscover={true}
        unreadDms={unreadDms}
        unreadByHub={unreadByHub}
        pingByHub={pingByHub}
        hubNotifyMode={hubNotifyMode}
        lobbyHubIds={lobbyHubs}
        hasActiveHub={!!activeHubId}
        isFarmAdmin={isFarmAdmin}
        onSwitchToDms={() => setView("dms")}
        onSwitchHub={handleSwitchHub}
        onRemoveHub={handleRemoveHub}
        onSetHubNotifyMode={(hubId, mode) =>
          setHubNotifyMode((prev) => { const n = { ...prev }; if (mode === "all") delete n[hubId]; else n[hubId] = mode; return n; })
        }
        onHubReorder={handleHubReorder}
        onAddHub={() => setShowAddHub(true)}
        onCreateHub={() => setShowCreateHub(true)}
        onDiscover={() => setShowDiscover(true)}
        onFarmSettings={() => { setShowFarmSettings(true); setFarmAdminTab("general"); }}
      />

      <ChannelSidebar
        view={sidebarView as "channels" | "dms"}
        activeHubId={activeHubId}
        hubs={hubs}
        channels={channels}
        selectedChannel={selectedChannel}
        unreadByChannel={unreadByChannel}
        collapsedCategories={collapsedCategories}
        voicePartByChannel={voice.voicePartByChannel}
        voiceChannelId={voice.voiceChannelId}
        voiceChannelNameHint={voiceMoveUx.voiceChannelNameHint}
        selfMuted={voice.selfMuted}
        selfDeafened={voice.selfDeafened}
        users={users}
        publicKey={publicKey}
        pingByHub={pingByHub}
        isAdmin={isAdmin}
        canCreateInvites={canCreateInvites}
        hubNotifyMode={hubNotifyMode}
        hubDropdownOpen={hubDropdownOpen}
        hubTimezone={activeHubTimezone}
        hideSilenced={hideSilenced}
        silencedChannelIds={silencedChannelIds}
        userAlliances={userAlliances}
        allianceChannels={allianceChannels}
        selectedAllianceChannel={selectedAllianceChannel}
        conversations={conversations}
        selectedConversation={selectedConversation}
        unreadDms={unreadDms}
        channelTree={channelTree}
        effectiveNotifyMode={effectiveNotifyMode}
        onToggleCategoryCollapsed={(hubId, catId) =>
          setCollapsedCategories((prev) => {
            const m = { ...(prev[hubId] ?? {}) };
            if (m[catId]) delete m[catId]; else m[catId] = true;
            return { ...prev, [hubId]: m };
          })
        }
        onHubDropdownOpenChange={setHubDropdownOpen}
        onSetHubMode={(hubId, mode) =>
          setHubNotifyMode((prev) => { const n = { ...prev }; if (mode === "all") delete n[hubId]; else n[hubId] = mode; return n; })
        }
        onToggleHideSilenced={toggleHideSilenced}
        onClearHubUnread={clearHubUnread}
        onRemoveHub={handleRemoveHub}
        onOpenHubAdmin={() => void openHubAdmin()}
        onOpenHubAdminInvites={() => { void openHubAdmin(); setHubAdminTab("invites"); }}
        onOpenQuickInvite={() => setShowQuickInvite(true)}
        onOpenCreateChannel={(parentId, isCategory) => { setChannelSettingsCtx(null); setCreateChannelCtx({ parentId, isCategory }); setCreateChannelError(null); }}
        onSelectChannel={handleSelectChannel}
        onChannelContextMenu={(e, channel) => { e.preventDefault(); setChannelCtxMenu({ channel, x: e.clientX, y: e.clientY }); }}
        canOpenChannelSettings={isAdmin || canManageRoles}
        myStatus={myPresence.status === "online" ? null : myPresence.status}
        onSetStatus={handleSetStatus}
        onOpenChannelSettings={(channel) => { setCreateChannelCtx(null); setChannelSettingsCtx(channel); setChannelSettingsError(null); }}
        onVoiceJoin={(ch) => ch && void voice.handleVoiceJoin(ch.id)}
        onVoiceLeave={voice.handleVoiceLeave}
        onParticipantContextMenu={canMoveMembers ? (e, p, channelId) => {
          e.preventDefault();
          if (p.public_key === publicKey) return; // hide self — move your own voice by joining directly
          voiceMoveUx.setVoiceMoveMenu({
            pubkey: p.public_key,
            displayName: p.display_name || formatPubkey(p.public_key),
            position: { x: e.clientX, y: e.clientY },
            currentChannelId: channelId,
          });
        } : undefined}
        onSelectAllianceChannel={(a, c) => handleSelectAllianceChannel(a, c as AllianceSharedChannel)}
        onOpenFriends={() => setShowFriends(true)}
        onSelectConversation={handleSelectConversation}
        onToggleSelfMute={voice.handleToggleMute}
        onToggleSelfDeafen={voice.handleToggleDeafen}
        onOpenSettings={() => setShowSettings(true)}
        onDragEnd={handleChannelDragEnd}
        voiceGains={voice.voiceGains}
        onSetVoiceGain={voice.handleSetVoiceGain}
        inboundWhispers={whisper.inboundWhispers}
        hasDraft={hasDraft}
        onOpenSearch={() => setShowSearchBar(true)}
        canUseSoundboard={canUseSoundboard}
        onListSoundboardClips={listSoundboardClips}
        onTriggerSoundboardClip={voice.handleTriggerSoundboardClip}
        soundboardPlayingClipId={voice.soundboardPlayingClipId}
        soundboardChips={voice.voiceChannelId ? soundboardChipsByChannel[voice.voiceChannelId] ?? [] : []}
        sharing={sharing}
        onScreenShare={() => {
          if (sharing) handleStopShare();
          else if (selectedChannel) void handleStartShare(selectedChannel.id);
        }}
        videoEnabled={video.videoEnabled}
        onToggleVideo={video.handleToggleVideo}
        isWhispering={whisper.isWhispering}
        whisperTargets={whisper.whisperTargets}
        whisperLists={whisper.whisperLists}
        showWhisperPanel={showWhisperPanel}
        onToggleWhisperPanel={() => setShowWhisperPanel((p) => !p)}
        onCloseWhisperPanel={() => setShowWhisperPanel(false)}
        onStartWhisper={whisper.startWhisper}
        onStopWhisper={whisper.stopWhisper}
        onSaveWhisperList={whisper.saveWhisperList}
        onDeleteWhisperList={whisper.deleteWhisperList}
        onListWhisperRoles={() => listRoles().then((rs) => rs.map((r) => ({ id: r.id, name: r.name })))}
        whisperReplyBind={whisperReplyBind}
        onSetWhisperReplyBind={setWhisperReplyBind}
        whisperOptout={whisper.whisperOptout}
        onSetWhisperOptout={whisper.setWhisperOptout}
      />

      {activeOpenApp && (
        <GameModal
          miniAppUrl={activeOpenApp.event.mini_app_url}
          sessionToken={activeOpenApp.event.session_token}
          channelId={activeOpenApp.event.channel_id}
          botId={activeOpenApp.event.bot_id}
          hubUrl={activeOpenApp.hubUrl}
          title={activeBotApps.get(activeOpenApp.event.bot_id)?.title ?? "Game"}
          requiresCamera={activeOpenApp.event.requires_camera}
          onClose={() => setActiveOpenApp(null)}
        />
      )}

      {hasNoHubs ? (
        <main className="content" style={{ overflow: "auto" }}>
          <WelcomeScreenContainer
            wsHandlers={stableHandlers}
            onHubAdded={(hub, target) => {
              setHubs(listHubs());
              setActiveHubIdState(hub.hub_id);
              // Same post-join publish as the Add-hub modal paths — without
              // it a first-run user has no DH key on their first hub until
              // the next reload, so DMs to them fall back to plaintext and
              // their encrypted sends can't be decrypted by the peer.
              publishDhKey().catch(() => {});
              void loadHubData().then(() => {
                if (target) return applyDeepLinkTarget(hub.hub_id, target);
              });
            }}
            initialHubUrl={homeHubUrl}
            onBrowse={() => setShowDiscover(true)}
          />
        </main>
      ) : activeHubId && lobbyHubs.has(activeHubId) && publicKey ? (
        <main className="content" style={{ overflow: "auto" }}>
          <Lobby
            key={activeHubId}
            hubId={activeHubId}
            hubName={hubs.find((h) => h.hub_id === activeHubId)?.hub_name ?? ""}
            pubkeyHex={publicKey}
            actions={{
              getStatus: getLobbyStatus,
              getWelcome: getLobbyWelcome,
              submitProof: submitLobbyPow,
            }}
            onPromoted={() => void handleLobbyPromoted(activeHubId)}
          />
        </main>
      ) : activeHubId && pendingApprovalHubs.has(activeHubId) ? (
        <main className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 40 }}>⏳</div>
          <h2 style={{ margin: 0 }}>Waiting for approval</h2>
          <p className="muted" style={{ margin: 0, textAlign: "center", maxWidth: 320 }}>
            Your membership request is pending. A hub admin will review your request shortly.
          </p>
          <button className="btn-secondary" onClick={() => loadHubData()}>Check again</button>
        </main>
      ) : <>
        {(() => {
          if (!selectedChannel) return null;
          const cards = Array.from(activeBotApps.values()).filter(
            (ev) => ev.channel_id === selectedChannel.id,
          );
          if (cards.length === 0) return null;
          return (
            <div className="bot-app-launch-cards">
              {cards.map((ev) => (
                <BotAppLaunchCard
                  key={ev.bot_id}
                  event={ev}
                  onJoin={sendBotAppJoin}
                />
              ))}
            </div>
          );
        })()}
        <ContentArea
        view={view as "channels" | "dms"}
        activeHubId={activeHubId}
        hubs={hubs}
        channels={channels}
        onBreadcrumbCategoryClick={handleBreadcrumbCategoryClick}
        selectedChannel={selectedChannel}
        selectedConversation={selectedConversation}
        selectedAllianceChannel={selectedAllianceChannel}
        messages={messages}
        searchResults={searchResults}
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        dmMessages={dmMessages}
        allianceMessages={allianceMessages}
        users={users}
        publicKey={publicKey}
        blockedUsers={blockedUsers}
        ignoredUsers={ignoredUsers}
        knownDisplayNames={knownDisplayNames}
        myDisplayName={meInfo?.display_name ?? null}
        isAdmin={isAdmin}
        myRoles={myRoles}
        editingMessageId={editingMessageId}
        editingDraft={editingDraft}
        replyTarget={replyTarget}
        pendingAttachments={pendingAttachments}
        stickToBottom={stickToBottom}
        newWhileScrolledUp={newWhileScrolledUp}
        hubConnected={hubConnected}
        reconnectingHubs={reconnectingHubs}
        memberSidebarHidden={memberSidebarHidden}
        voiceActiveUsers={voice.voiceActiveUsers}
        inputText={inputText}
        typingByKey={channelTypingByKey}
        dmTypingByKey={convTypingByKey}
        messagesEndRef={messagesEndRef}
        messagesEndChannelRef={messagesEndChannelRef}
        messagesContainerRef={messagesContainerRef}
        messageInputRef={messageInputRef}
        onReconnect={() => {}}
        onToggleReaction={handleToggleReaction}
        onSetReplyTarget={setReplyTarget}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onStartEdit={handleStartEdit}
        onDeleteMessage={handleDeleteMessage}
        onSend={handleSend}
        onSendDm={handleSendDm}
        onSendAllianceMessage={() => void handleSendAllianceMessage()}
        onPingTyping={pingTyping}
        onPingDmTyping={pingDmTyping}
        onSetPendingAttachments={setPendingAttachments}
        onAttachFiles={() => {}}
        onOpenEditDescription={(ch) => { setEditDescChannel(ch); setEditDescValue(ch.description ?? ""); }}
        firstNotifyingMessageId={firstNotifyingMessageId}
        onClearFirstNotify={() => setFirstNotifyingMessageId(null)}
        onScrollToMessage={handleScrollToMessage}
        onSetMemberSidebarHidden={setMemberSidebarHidden}
        onSetSearchOpen={setSearchOpen}
        onSetSearchQuery={setSearchQuery}
        onCloseSearch={() => { setSearchOpen(false); setSearchResults(null); setSearchQuery(""); }}
        onJumpToBottom={() => { setStickToBottom(true); setNewWhileScrolledUp(0); }}
        onMessagesScroll={() => {
          const el = messagesContainerRef.current;
          if (!el) return;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          setStickToBottom(atBottom);
          if (atBottom) setNewWhileScrolledUp(0);
        }}
        onSetUserContextMenu={(menu) => {
          if (!menu) { setUserContextMenu(null); return; }
          setUserContextMenu({ user: menu.user, position: { x: menu.x, y: menu.y } });
        }}
        onSetEditingDraft={setEditingDraft}
        onInputTextChange={(v) => {
          setInputText(v);
          if (activeHubId && selectedChannel) saveDraft(`${activeHubId}/${selectedChannel.id}`, v);
        }}
        onKeyDown={handleKeyDown}
        onOpenImage={() => {}}
        onToast={(msg) => showHubError(msg)}
        onError={(msg) => showHubError(typeof msg === "string" ? msg : String((msg as Record<string, unknown>).message ?? msg))}
        slashCommands={slashCommands}
        activeScreenShares={activeScreenShares}
        screenShareViewerRef={screenShareViewerRef}
        onOpenHubStreams={handleOpenHubStreams}
        onStartConversation={handleStartConversation}
        profileCardActions={profileCardActions}
        voicePartByChannel={voice.voicePartByChannel}
        selfInvisible={myPresence.status === "invisible"}
        hideBirthdays={hideBirthdays}
        canMoveMembers={canMoveMembers}
        onMoveMember={handleMoveMember}
      /></>}
      </MobileShell>

      {showHubAdmin && activeHubId && (
        <div className="modal-overlay" style={{ display: "flex", alignItems: "stretch", justifyContent: "stretch" }}>
          <HubAdminPage
            tab={hubAdminTab}
            onTab={setHubAdminTab}
            onClose={() => setShowHubAdmin(false)}
            hubName={hubAdminName}
            onHubNameChange={setHubAdminName}
            hubDescription={hubAdminDescription}
            onHubDescriptionChange={setHubAdminDescription}
            hubIcon={hubAdminIcon}
            onHubIconChange={setHubAdminIcon}
            requireApproval={hubAdminRequireApproval}
            onRequireApprovalChange={setHubAdminRequireApproval}
            minSecurityLevel={hubAdminMinLevel}
            onMinSecurityLevelChange={setHubAdminMinLevel}
            maxChannelDepth={maxChannelDepth}
            onMaxChannelDepthChange={setMaxChannelDepth}
            welcomeLabel={hubAdminWelcomeLabel}
            onWelcomeLabelChange={setHubAdminWelcomeLabel}
            welcomeInviteUrl={hubAdminWelcomeInviteUrl}
            onWelcomeInviteUrlChange={setHubAdminWelcomeInviteUrl}
            timezone={hubAdminTimezone}
            onTimezoneChange={setHubAdminTimezone}
            birthdaysEnabled={hubAdminBirthdaysEnabled}
            onBirthdaysEnabledChange={setHubAdminBirthdaysEnabled}
            saveError={hubAdminSaveError}
            onSave={saveHubAdminSettings}
            hubListed={hubListed}
            onHubListedChange={onHubListedChange}
            submitToDirectory={submitToDirectory}
            pendingMembers={hubAdminPending}
            onApproveMember={(pk) => hubFetch(`/hub/pending/${pk}/approve`, { method: "POST" }).catch(() => {})}
            members={hubAdminMembers}
            onKickMember={(pk) => hubFetch(`/moderation/kick`, { method: "POST", body: JSON.stringify({ target_public_key: pk }) }).catch(() => {})}
            onBanMember={(pk) => hubFetch(`/moderation/bans`, { method: "POST", body: JSON.stringify({ target_public_key: pk }) }).catch(() => {})}
            onMuteMember={onMuteMember}
            onTimeoutMember={onTimeoutMember}
            onVoiceMuteMember={onVoiceMuteMember}
            onVoiceUnmuteMember={onVoiceUnmuteMember}
            voiceMutedKeys={voiceMutedKeys}
            bans={hubAdminBans}
            onUnban={(pk) => hubFetch(`/moderation/bans/${pk}`, { method: "DELETE" }).catch(() => {})}
            invites={hubAdminInvites}
            activeHubUrl={hubs.find((h) => h.hub_id === activeHubId)?.hub_url ?? ""}
            hubSerial={activeHubId ?? ""}
            myPubkey={publicKey ?? ""}
            isAdmin={isAdmin}
            canManageSoundboard={canManageSoundboard}
            canManageRoles={canManageRoles}
            myMaxPriority={myMaxPriority}
            onMemberRolesChanged={setMemberRoles}
            onCreateInvite={(maxUses, expiresIn, grantRoleId) =>
              hubFetch("/invites", { method: "POST", body: JSON.stringify({ max_uses: maxUses, expires_in_seconds: expiresIn, grant_role_id: grantRoleId }) })
                .then((r) => r.json() as Promise<import("@shared/types").InviteInfo>)
                .then((inv) => addInvite(inv))
                .catch(() => {})
            }
            onRevokeInvite={(code) => {
              hubFetch(`/invites/${code}`, { method: "DELETE" }).catch(() => {});
              removeInvite(code);
            }}
            channels={channels}
            rolesActions={{
              listRoles, createRole, updateRole, deleteRole,
              listRoleCategories, createRoleCategory, updateRoleCategory, deleteRoleCategory,
            } as RolesSectionActions}
            memberRoleActions={{ listRoles, listUserRoles, assignRoleToUser, removeRoleFromUser } as MemberRoleManagerActions}
            serverTagsActions={{
              getDiscoveryTags, setDiscoveryTags,
              listBadges, listPendingBadges, acceptBadge, declineBadge, removeBadge, grantBadge,
            } as ServerTagsSectionActions}
            inviteActions={{ listRoles, getHubSettings, saveHubSettings } as InviteManagerActions}
            webhookActions={{
              loadWebhooks: adminListWebhooks,
              createWebhook: adminCreateWebhook,
              regenerateWebhook: adminRegenerateWebhook,
              deleteWebhook: adminDeleteWebhook,
            }}
            externalBotActions={{
              loadBots: adminListExternalBots,
              addBot: adminAddExternalBot,
              removeBot: adminRemoveExternalBot,
              getBotChannelScope: adminGetBotChannelScope,
              setBotChannelScope: adminSetBotChannelScope,
            }}
            renderBotCapabilities={(pubkey) => <BotCapabilitiesPanel pubkey={pubkey} />}
            nativeBotActions={{
              listNativeBots, createNativeBot, deleteNativeBot,
              getBotDetail: getNativeBotDetail, setBotWebhook: setNativeBotWebhook,
            } as NativeBotsSectionActions}
            auditLogActions={{ getAuditLog } as AuditLogSectionActions}
            certActions={{
              listCertIssuances, getCertSettings, saveCertSettings, issueCertManual, revokeCert, grantUserBadge,
            } as CertificationsSectionActions}
            soundboardActions={{
              listSoundboardClips, uploadSoundboardClip, deleteSoundboardClip, fetchSoundboardAudioBytes,
            } as SoundboardAdminSectionActions}
            onboardingActions={{
              listPendingUsers, approvePendingUser, setLobbySettings, setChallengeSettings,
            } as OnboardingAdminSectionActions}
            allianceActions={{
              listAlliances, createAlliance, leaveAlliance,
              listPendingAllianceInvites,
              acceptAllianceInvite: (inviteId, ownHubUrl) => acceptAllianceInvite(inviteId, ownHubUrl).then(() => {}),
              declineAllianceInvite,
              listAllianceSharedChannels, shareChannelWithAlliance, unshareChannelFromAlliance,
              createAllianceInvite, sendAlliancePushInvite,
              joinAllianceByCode: (inviterHubUrl, allianceId, inviteToken, ownHubUrl) =>
                joinAllianceByCode(inviterHubUrl, allianceId, inviteToken, ownHubUrl).then(() => {}),
            }}
            hubIconActions={{ listHubIcons, createHubIcon, renameHubIcon, deleteHubIcon }}
            surveyActions={{
              getSurveyAdmin, setSurveyAdmin, getSurveyResponses,
              loadAssignableRoles: () =>
                listRoles().then((roles) => roles.filter((r) => !r.permissions.includes("admin")).map((r) => ({ id: r.id, name: r.name }))),
            }}
            renderModerationTab={() => <ModerationTab />}
            renderOutgoingWebhooks={() => <OutgoingWebhooksSection channels={channels} />}
            renderRecoveryContacts={() => {
              const hubUrl = hubs.find((h) => h.hub_id === activeHubId)?.hub_url ?? "";
              const recoveryActions: RecoveryContactsSectionActions = {
                getContacts: getRecoveryContacts,
                setContacts: setRecoveryContacts,
                removeContact: removeRecoveryContact,
                listAdminRequests: isAdmin ? listAdminRecoveryRequests : undefined,
                approveRequest: isAdmin ? approveRecoveryRequest : undefined,
                denyRequest: isAdmin ? denyRecoveryRequest : undefined,
                openRotationRequest: (oldPubkey, reason) => openRotationRequest(hubUrl, oldPubkey, reason),
                getRotationRequest: (id) => getRotationRequestBundle(hubUrl, id),
                attestRotationRequest: (bundle) => attestRotationRequest(hubUrl, bundle),
              };
              return <RecoveryContactsSection isAdmin={isAdmin} actions={recoveryActions} showMemberCards={false} />;
            }}
          />
        </div>
      )}

      {showAddHub && (
        <AddHubModal
          hubUrl={hubUrl}
          onHubUrlChange={handleHubUrlInput}
          hubPreview={hubPreview}
          inviteCode={inviteCode}
          onInviteCodeChange={setInviteCode}
          loading={addingHub}
          error={addHubError}
          fingerprintMatch={fingerprintMatch}
          onAdd={handleAddHub}
          onAddWithPasskey={publicKey ? handleAddHubWithPasskey : undefined}
          passkeySupported={isPasskeySupported()}
          onClose={() => {
            setShowAddHub(false);
            setHubPreview({ state: "idle" });
            setAddHubError(null);
            setFingerprintMatch(false);
          }}
          onBrowse={() => { setShowAddHub(false); setShowDiscover(true); }}
        />
      )}

      {showQuickInvite && activeHubId && (
        <QuickInviteModal
          activeHubUrl={hubs.find((h) => h.hub_id === activeHubId)?.hub_url ?? ""}
          hubSerial={activeHubId}
          myMaxPriority={myMaxPriority}
          onClose={() => setShowQuickInvite(false)}
          actions={{ listRoles, createInvite }}
        />
      )}

      {eventComposerChannelId && (
        <EventComposer
          channelId={eventComposerChannelId}
          channels={channels}
          canHubWide={isAdmin}
          advancedFieldsSupported
          onSubmit={createEvent}
          onCreated={() => {}}
          onClose={() => setEventComposerChannelId(null)}
        />
      )}

      {pollComposerChannelId && (
        <PollComposer
          channelId={pollComposerChannelId}
          onCreatePoll={createPoll}
          onCreated={() => {}}
          onClose={() => setPollComposerChannelId(null)}
        />
      )}

      {(createChannelCtx || channelSettingsCtx) && (
        <ChannelSettingsModal
          channel={channelSettingsCtx}
          createParentId={createChannelCtx?.parentId ?? null}
          createParentName={createChannelCtx?.parentId ? (channels.find((c) => c.id === createChannelCtx.parentId)?.name ?? null) : null}
          createInitialIsCategory={createChannelCtx?.isCategory}
          saving={channelSettingsCtx ? channelSettingsSaving : createChannelLoading}
          deleting={channelSettingsDeleting}
          error={channelSettingsCtx ? channelSettingsError : createChannelError}
          canManageRoles={canManageRoles}
          isAdmin={isAdmin}
          myMaxPriority={myMaxPriority}
          hubUrl={hubs.find((h) => h.hub_id === activeHubId)?.hub_url}
          onSave={channelSettingsCtx ? handleSaveChannelSettings : handleCreateChannel}
          onDelete={handleDeleteChannel}
          onClose={() => {
            setCreateChannelCtx(null); setCreateChannelError(null);
            setChannelSettingsCtx(null); setChannelSettingsError(null);
          }}
          permissionsActions={channelPermissionsTabActions}
          bansActions={channelBansTabActions}
          bansUsers={users}
          talkPowerActions={channelTalkPowerTabActions}
          listHubIcons={listHubIcons}
          listForumTags={forumListTags}
          forumTagsActions={{ createTag: forumCreateTag, editTag: forumEditTag, deleteTag: forumDeleteTag }}
        />
      )}

      {showHubSetupWizard && activeHubId && (
        <HubSetupWizard
          actions={{ onCreateChannel: createChannelForWizard }}
          onDismiss={() => closeHubSetupWizard(activeHubId)}
          onComplete={handleHubSetupWizardComplete}
        />
      )}

      {channelCtxMenu && (
        <ChannelContextMenu
          menu={channelCtxMenu}
          activeHubId={activeHubId}
          effectiveNotifyMode={effectiveNotifyMode}
          onSetNotifyMode={(hubId, channelId, mode) => {
            setChannelNotifyMode((prev) => {
              const hubMap = { ...(prev[hubId] ?? {}) };
              if (mode === "all") delete hubMap[channelId]; else hubMap[channelId] = mode;
              return { ...prev, [hubId]: hubMap };
            });
          }}
          onClose={() => setChannelCtxMenu(null)}
          onCopyLink={async (channel) => {
            const hubUrl = hubs.find((h) => h.hub_id === activeHubId)?.hub_url;
            if (!hubUrl) return;
            const link = `wavvon://${hubUrl.replace(/^https?:\/\//, "")}/channel/${channel.id}`;
            try {
              await navigator.clipboard.writeText(link);
              showHubError(t("message.action.link_copied"));
            } catch (e) {
              showHubError(String(e));
            }
          }}
          onCreateEvent={isAdmin ? (channel) => setEventComposerChannelId(channel.id) : undefined}
          onCreatePoll={canSendMessages ? (channel) => setPollComposerChannelId(channel.id) : undefined}
          onRenameTempRoom={
            channelCtxMenu.channel.is_temporary && channelCtxMenu.channel.owner_pubkey === publicKey && !isAdmin
              ? (channel) => {
                  setRenameRoomCtx(channel);
                  setRenameRoomName(channel.name);
                  setRenameRoomError(null);
                }
              : undefined
          }
          onCreateChannelIn={isAdmin ? (parentId) => { setChannelSettingsCtx(null); setCreateChannelCtx({ parentId, isCategory: false }); setCreateChannelError(null); } : undefined}
          onCreateChannel={isAdmin ? () => { setChannelSettingsCtx(null); setCreateChannelCtx({ parentId: null, isCategory: false }); setCreateChannelError(null); } : undefined}
          onCreateCategory={isAdmin ? () => { setChannelSettingsCtx(null); setCreateChannelCtx({ parentId: null, isCategory: true }); setCreateChannelError(null); } : undefined}
          onEditChannel={isAdmin ? (channel) => { setCreateChannelCtx(null); setChannelSettingsCtx(channel); setChannelSettingsError(null); } : undefined}
          onDeleteChannel={isAdmin ? (channel) => { setCreateChannelCtx(null); setChannelSettingsCtx(channel); setChannelSettingsError(null); } : undefined}
        />
      )}

      {editDescChannel && (
        <EditDescriptionModal
          channel={editDescChannel}
          description={editDescValue}
          onDescriptionChange={setEditDescValue}
          onSave={() => void handleSaveDescription()}
          onClose={() => setEditDescChannel(null)}
        />
      )}

      {renameRoomCtx && (
        <div className="modal-overlay" onClick={() => setRenameRoomCtx(null)}>
          <FocusTrap>
            <div className="modal" style={{ maxWidth: 400 }} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h3>{t("channel.temp.rename_title")}</h3>
              <input
                type="text"
                value={renameRoomName}
                onChange={(e) => setRenameRoomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRenameRoom();
                  if (e.key === "Escape") setRenameRoomCtx(null);
                }}
                autoFocus
                style={{ display: "block", width: "100%", marginBottom: "var(--space-3)" }}
              />
              {renameRoomError && <div className="error" style={{ marginBottom: 8 }}>{renameRoomError}</div>}
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setRenameRoomCtx(null)}>{t("modal.cancel")}</button>
                <button onClick={() => void handleRenameRoom()} disabled={renameRoomSaving || !renameRoomName.trim()}>
                  {renameRoomSaving ? "…" : t("modal.save")}
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}

      {showDisplayNamePrompt && (
        <div className="modal-overlay" onClick={() => setShowDisplayNamePrompt(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3>{t("onboarding.display_name.title")}</h3>
            <p className="muted" style={{ marginBottom: 12, fontSize: "var(--text-sm)" }}>
              {t("onboarding.display_name.hint")}
            </p>
            <input
              type="text"
              value={firstRunName}
              onChange={(e) => setFirstRunName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSaveFirstRunName(); if (e.key === "Escape") setShowDisplayNamePrompt(false); }}
              placeholder={t("onboarding.display_name.placeholder")}
              style={{ width: "100%", marginBottom: 12 }}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDisplayNamePrompt(false)}>
                {t("onboarding.display_name.skip")}
              </button>
              <button onClick={() => void handleSaveFirstRunName()} disabled={!firstRunName.trim()}>
                {t("onboarding.display_name.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
