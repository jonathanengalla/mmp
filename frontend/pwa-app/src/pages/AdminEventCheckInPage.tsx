import React, { useState } from "react";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { FormField } from "../components/primitives/FormField";
import { Button } from "../components/primitives/Button";
import { Tag } from "../components/ui/Tag";
import { useSession } from "../hooks/useSession";
import { checkInByCode } from "../api/client";
import { EventCheckInResult } from "../../../../libs/shared/src/models";

export const AdminEventCheckInPage: React.FC = () => {
  const { tokens } = useSession();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<EventCheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access_token) {
      setError("Login required");
      return;
    }
    if (!code.trim()) {
      setError("Code is required");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const resp = await checkInByCode(tokens.access_token, code.trim());
      setResult(resp);
    } catch (err: any) {
      setResult(null);
      setError(err?.message || err?.error?.message || "Check-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title="Event Check-in" description="Scan or enter registration codes to check in attendees.">
      <Card>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--space-md)" }}>
          <FormField label="Registration code">
            <input
              className="pr-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="EVT-..."
              autoFocus
            />
          </FormField>
          <Button type="submit" disabled={loading}>
            {loading ? "Checking..." : "Check in"}
          </Button>
        </form>
        {error && <Tag variant="danger" style={{ marginTop: "var(--space-md)" }}>{error}</Tag>}
        {result && (
          <Card title="Check-in result" style={{ marginTop: "var(--space-md)" }}>
            <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", marginBottom: "var(--space-sm)" }}>
              <Tag variant="success">Checked in</Tag>
              <div style={{ color: "var(--color-text-muted)" }}>{result.checkedInAt}</div>
            </div>
            <div>Event ID: {result.eventId}</div>
            <div>Registration ID: {result.registrationId}</div>
            <div>Status: {result.checkInStatus}</div>
          </Card>
        )}
      </Card>
    </Page>
  );
};

export default AdminEventCheckInPage;

