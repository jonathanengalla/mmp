import React, { useEffect, useState } from "react";
import { getApprovalWorkflow, updateApprovalWorkflow } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";

export const AdminApprovalWorkflowPage: React.FC = () => {
  const { tokens } = useSession();
  const [requireApproval, setRequireApproval] = useState(false);
  const [approverRoles, setApproverRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const resp = await getApprovalWorkflow(tokens.access_token);
      setRequireApproval(!!resp.requireApproval);
      setApproverRoles(resp.approverRoles || []);
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Failed to load workflow", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  const toggleRole = (role: string) => {
    setApproverRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireApproval && approverRoles.length === 0) {
      setToast({ msg: "Select at least one approver role", type: "error" });
      return;
    }
    if (!tokens?.access_token) {
      setToast({ msg: "Login required", type: "error" });
      return;
    }
    try {
      setSaving(true);
      await updateApprovalWorkflow(tokens.access_token, { requireApproval, approverRoles });
      setToast({ msg: "Approval workflow saved", type: "success" });
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="Approval Workflow" description="Control member approval requirements and approver roles.">
      <Card>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <form onSubmit={onSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", marginBottom: "var(--space-md)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
                Require approval for new members
              </label>
              <small className="pr-form-hint">When enabled, selected roles must approve new member registrations.</small>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", marginBottom: "var(--space-md)" }}>
              <label>Approver Roles</label>
              <div style={{ display: "flex", gap: "var(--space-md)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                  <input type="checkbox" checked={approverRoles.includes("admin")} onChange={() => toggleRole("admin")} disabled={!requireApproval} />
                  admin
                </label>
              </div>
              <small className="pr-form-hint">Select roles allowed to approve when approval is required.</small>
            </div>
            <Button type="submit" disabled={saving} fullWidth>
              {saving ? "Saving..." : "Save"}
            </Button>
          </form>
        )}
      </Card>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

