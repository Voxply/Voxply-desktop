import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Report } from "@shared/types";
import { listReports, reviewReport } from "../../platform/commands/moderation";
import { formatRelative } from "@wavvon/core";

function truncate(s: string | null, max: number): string {
  if (!s) return "—";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function ContentReportsSection() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listReports("pending");
      setReports(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleReview(
    reportId: string,
    action: "dismiss" | "delete_message" | "ban_user",
  ) {
    try {
      await reviewReport(reportId, action);
      await load();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="settings-section">
      <h2>{t("hub.admin.reports.title")}</h2>
      {error && <p className="error-text">{error}</p>}
      {loading && <p className="muted">{t("hub.admin.reports.loading")}</p>}
      {!loading && reports.length === 0 && (
        <p className="muted">{t("hub.admin.reports.empty")}</p>
      )}
      {!loading && reports.length > 0 && (
        <table className="members-table">
          <thead>
            <tr>
              <th>{t("hub.admin.reports.col.preview")}</th>
              <th>{t("hub.admin.reports.col.reporter")}</th>
              <th>{t("hub.admin.reports.col.reason")}</th>
              <th>{t("hub.admin.reports.col.reported")}</th>
              <th>{t("hub.admin.reports.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                    {truncate(r.message_content, 100)}
                  </span>
                </td>
                <td>
                  <span className="member-pk">{r.reporter_pubkey.slice(0, 8)}</span>
                </td>
                <td>{r.reason}</td>
                <td>{formatRelative(r.reported_at)}</td>
                <td style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <button
                    className="btn-small btn-secondary"
                    onClick={() => handleReview(r.id, "dismiss")}
                  >
                    {t("hub.admin.reports.dismiss")}
                  </button>
                  <button
                    className="btn-small btn-secondary danger"
                    onClick={() => handleReview(r.id, "delete_message")}
                  >
                    {t("hub.admin.reports.delete_message")}
                  </button>
                  <button
                    className="btn-small btn-secondary danger"
                    onClick={() => handleReview(r.id, "ban_user")}
                  >
                    {t("hub.admin.reports.ban_user")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
