import React from "react";
import { formatRelative } from "@wavvon/core";

export interface WhisperInboxEntry {
  pubkey: string;
  name: string;
  startedAt: number;
  live: boolean;
}

interface Props {
  entries: WhisperInboxEntry[];
  onDismiss: (pubkey: string, startedAt: number) => void;
  onClearAll: () => void;
}

/** Persistent log of who whispered to you this voice session (events.md
 *  whisper follow-up) — unlike the transient "is whispering" indicator,
 *  entries stay put until dismissed so a missed whisper isn't lost the
 *  moment it ends. */
export function WhisperInbox({ entries, onDismiss, onClearAll }: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="whisper-inbox">
      <div className="whisper-inbox-header">
        <span className="whisper-inbox-title">Whispers</span>
        <button className="whisper-inbox-clear" onClick={onClearAll}>Clear all</button>
      </div>
      <div className="whisper-inbox-list">
        {entries.map((e) => (
          <div key={`${e.pubkey}:${e.startedAt}`} className="whisper-inbox-row">
            <span className="whisper-inbox-name">{e.name}</span>
            <span className="whisper-inbox-status">
              {e.live ? "is whispering" : "whispered you"}
            </span>
            <span className="whisper-inbox-time muted">{formatRelative(Math.floor(e.startedAt / 1000))}</span>
            <button
              className="whisper-inbox-dismiss"
              onClick={() => onDismiss(e.pubkey, e.startedAt)}
              aria-label="Dismiss"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
