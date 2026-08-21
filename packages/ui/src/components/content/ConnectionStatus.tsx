import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface ConnectionStatusProps {
  /** Median round trip to the hub in ms, or null before the first reply. */
  rttMs: number | null;
  /** Spread around that median in ms, or null with fewer than two samples. */
  jitterMs: number | null;
  /** Worst inbound voice packet loss as a percentage, or null when not in
   *  voice (or in voice but hearing nobody yet). */
  inboundLossPercent: number | null;
  /** False while the socket is down — the last numbers are then stale and are
   *  shown as such rather than frozen and passed off as live. */
  connected: boolean;
}

/** Green up to this, amber up to the next, red beyond. */
const RTT_GOOD = 80;
const RTT_FAIR = 200;
const LOSS_GOOD = 1;
const LOSS_FAIR = 5;

function band(value: number, good: number, fair: number): "good" | "fair" | "poor" {
  if (value <= good) return "good";
  if (value <= fair) return "fair";
  return "poor";
}

/**
 * Live connection readout: a compact latency chip that opens the detail.
 *
 * The chip is always in the same place whether or not you are in voice — the
 * panel gains a packet-loss row instead of the chip moving or changing shape,
 * so there is one fixed home for the control.
 *
 * Outbound loss is not here, and not as an empty row either: a sender cannot
 * measure which of its own packets went missing. That number has to come from
 * the relay, which can see gaps in the cleartext counter, and it does not yet.
 */
export function ConnectionStatus({
  rttMs,
  jitterMs,
  inboundLossPercent,
  connected,
}: ConnectionStatusProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const rttBand = !connected ? "poor" : rttMs === null ? "fair" : band(rttMs, RTT_GOOD, RTT_FAIR);
  const label = !connected
    ? t("connection.offline")
    : rttMs === null
      ? "…"
      : `${rttMs} ms`;

  return (
    <div className="conn-status">
      <button
        className={`conn-chip ${rttBand}`}
        onClick={() => setOpen((v) => !v)}
        title={t("connection.title")}
        aria-label={t("connection.title")}
        aria-expanded={open}
      >
        {label}
      </button>

      {open && (
        <div className="conn-panel" role="dialog" aria-label={t("connection.title")}>
          <div className="conn-row">
            <span className="conn-key">{t("connection.ping")}</span>
            <span className={`conn-val ${rttBand}`}>
              {rttMs === null ? "—" : `${rttMs} ms`}
              {jitterMs !== null && <span className="conn-pm"> ± {jitterMs}</span>}
            </span>
          </div>

          <div className="conn-row">
            <span className="conn-key">{t("connection.loss_in")}</span>
            <span
              className={`conn-val ${
                inboundLossPercent === null
                  ? ""
                  : band(inboundLossPercent, LOSS_GOOD, LOSS_FAIR)
              }`}
            >
              {inboundLossPercent === null ? "—" : `${inboundLossPercent} %`}
            </span>
          </div>

          <p className="muted conn-note">
            {inboundLossPercent === null
              ? t("connection.loss_needs_voice")
              : t("connection.loss_inbound_only")}
          </p>
        </div>
      )}
    </div>
  );
}
