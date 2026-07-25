// First-run hub setup wizard (decisions.md 2026-07-25): starter channel
// structures an admin can pick from instead of landing in an empty sidebar.

export type HubTemplateId = "gaming" | "community" | "clan" | "reading";

export type HubTemplateChannelKind = "text" | "forum" | "voice" | "category";

export interface HubTemplateChannelSpec {
  /** Stable id, also the i18n key suffix under hub_setup.channel_name.<key>. */
  key: string;
  kind: HubTemplateChannelKind;
  /** `key` of the category this channel nests under, within the same template. */
  parentKey?: string;
}

export interface HubTemplateDef {
  id: HubTemplateId;
  channels: HubTemplateChannelSpec[];
}

export const HUB_TEMPLATES: HubTemplateDef[] = [
  {
    id: "gaming",
    channels: [
      { key: "welcome", kind: "text" },
      { key: "cat_text", kind: "category" },
      { key: "general", kind: "text", parentKey: "cat_text" },
      { key: "clips_and_screenshots", kind: "text", parentKey: "cat_text" },
      { key: "looking_for_group", kind: "forum", parentKey: "cat_text" },
      { key: "cat_voice", kind: "category" },
      { key: "lobby", kind: "voice", parentKey: "cat_voice" },
      { key: "squad_1", kind: "voice", parentKey: "cat_voice" },
      { key: "squad_2", kind: "voice", parentKey: "cat_voice" },
    ],
  },
  {
    id: "community",
    channels: [
      { key: "welcome", kind: "text" },
      { key: "announcements", kind: "text" },
      { key: "cat_chat", kind: "category" },
      { key: "general", kind: "text", parentKey: "cat_chat" },
      { key: "introductions", kind: "text", parentKey: "cat_chat" },
      { key: "off_topic", kind: "text", parentKey: "cat_chat" },
      { key: "events_and_ideas", kind: "forum" },
      { key: "cat_voice", kind: "category" },
      { key: "lounge", kind: "voice", parentKey: "cat_voice" },
    ],
  },
  {
    id: "clan",
    channels: [
      { key: "announcements", kind: "text" },
      { key: "cat_clan_hall", kind: "category" },
      { key: "general", kind: "text", parentKey: "cat_clan_hall" },
      { key: "recruitment", kind: "text", parentKey: "cat_clan_hall" },
      { key: "strategy", kind: "forum", parentKey: "cat_clan_hall" },
      { key: "cat_ops", kind: "category" },
      { key: "raid_voice", kind: "voice", parentKey: "cat_ops" },
      { key: "officers", kind: "voice", parentKey: "cat_ops" },
    ],
  },
  {
    id: "reading",
    channels: [
      { key: "welcome", kind: "text" },
      { key: "cat_library", kind: "category" },
      { key: "book_club", kind: "forum", parentKey: "cat_library" },
      { key: "currently_reading", kind: "text", parentKey: "cat_library" },
      { key: "recommendations", kind: "text", parentKey: "cat_library" },
      { key: "cat_voice", kind: "category" },
      { key: "reading_room", kind: "voice", parentKey: "cat_voice" },
    ],
  },
];

/**
 * Categories must exist before the leaves that nest under them (the create
 * endpoint needs a real parent id), but otherwise template order is kept —
 * creation order IS sidebar display_order, so a partition that front-loads
 * every category would push root leaves like "welcome" to the bottom.
 */
export function orderPlanSteps(channels: HubTemplateChannelSpec[]): HubTemplateChannelSpec[] {
  const out: HubTemplateChannelSpec[] = [];
  const placed = new Set<string>();
  const place = (c: HubTemplateChannelSpec) => {
    if (placed.has(c.key)) return;
    const parent = c.parentKey ? channels.find((x) => x.key === c.parentKey) : undefined;
    if (parent) place(parent);
    placed.add(c.key);
    out.push(c);
  };
  channels.forEach(place);
  return out;
}

export function firstTextChannelKey(template: HubTemplateDef): string | undefined {
  return template.channels.find((c) => c.kind === "text")?.key;
}
