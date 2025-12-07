import React, { useEffect, useState } from "react";
import { getFeatureFlags, updateFeatureFlags } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";

type Flags = { payments: boolean; events: boolean; communications: boolean; reporting: boolean };

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "var(--space-sm) 0",
  borderBottom: "1px solid var(--color-border)",
};

export const AdminFeatureFlagsPage: React.FC = () => {
  const { tokens } = useSession();
  const [flags, setFlags] = useState<Flags>({ payments: true, events: true, communications: true, reporting: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const resp = await getFeatureFlags(tokens.access_token);
      setFlags({
        payments: !!resp.payments,
        events: !!resp.events,
        communications: !!resp.communications,
        reporting: !!resp.reporting,
      });
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Failed to load feature flags", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  const toggle = (key: keyof Flags) => setFlags((prev) => ({ ...prev, [key]: !prev[key] }));

  const onSave = async () => {
    if (!tokens?.access_token) {
      setToast({ msg: "Login required", type: "error" });
      return;
    }
    try {
      setSaving(true);
      await updateFeatureFlags(tokens.access_token, flags);
      setToast({ msg: "Feature flags saved", type: "success" });
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="Feature Flags" description="Toggle modules per tenant.">
      <Card>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <div style={rowStyle}>
              <div>
                <div style={{ fontWeight: 600 }}>Payments</div>
                <div style={{ color: "var(--color-text-muted)" }}>Enable dues and payments flows.</div>
              </div>
              <input type="checkbox" checked={flags.payments} onChange={() => toggle("payments")} />
            </div>
            <div style={rowStyle}>
              <div>
                <div style={{ fontWeight: 600 }}>Events</div>
                <div style={{ color: "var(--color-text-muted)" }}>Enable event creation, registration, and fees.</div>
              </div>
              <input type="checkbox" checked={flags.events} onChange={() => toggle("events")} />
            </div>
            <div style={rowStyle}>
              <div>
                <div style={{ fontWeight: 600 }}>Communications</div>
                <div style={{ color: "var(--color-text-muted)" }}>Enable broadcasts and reminders.</div>
              </div>
              <input type="checkbox" checked={flags.communications} onChange={() => toggle("communications")} />
            </div>
            <div style={rowStyle}>
              <div>
                <div style={{ fontWeight: 600 }}>Reporting</div>
                <div style={{ color: "var(--color-text-muted)" }}>Enable reports dashboards and exports.</div>
              </div>
              <input type="checkbox" checked={flags.reporting} onChange={() => toggle("reporting")} />
            </div>
            <Button onClick={onSave} disabled={saving} fullWidth style={{ marginTop: "var(--space-md)" }}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        )}
      </Card>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

