import React, { useEffect, useState } from "react";
import { listPendingMembers, approveMember, rejectMember } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { Table, TableHeader, TableBody, TableRow, TableHeadCell, TableCell } from "../components/ui/Table";
import { Tag } from "../components/ui/Tag";
import { Modal } from "../components/ui/Modal";

interface PendingMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  created_at: number;
}

export const AdminPendingMembersPage: React.FC = () => {
  const { tokens } = useSession();
  const [items, setItems] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; member: PendingMember | null }>({
    open: false,
    member: null,
  });
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const resp = await listPendingMembers(tokens.access_token);
      setItems(resp.items || []);
    } catch (err: unknown) {
      const error = err as { error?: { message?: string } };
      setToast({ msg: error?.error?.message || "Failed to load pending members", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tokens]);

  const handleApprove = async (member: PendingMember) => {
    if (!tokens?.access_token) return;
    setActionLoading(member.id);
    try {
      await approveMember(tokens.access_token, member.id);
      setItems((prev) => prev.filter((m) => m.id !== member.id));
      setToast({ msg: `${member.first_name} ${member.last_name} has been approved`, type: "success" });
    } catch (err: unknown) {
      const error = err as { error?: { message?: string } };
      setToast({ msg: error?.error?.message || "Failed to approve member", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (member: PendingMember) => {
    setRejectModal({ open: true, member });
    setRejectReason("");
  };

  const handleReject = async () => {
    if (!tokens?.access_token || !rejectModal.member) return;
    setActionLoading(rejectModal.member.id);
    try {
      await rejectMember(tokens.access_token, rejectModal.member.id, rejectReason || undefined);
      setItems((prev) => prev.filter((m) => m.id !== rejectModal.member!.id));
      setToast({
        msg: `${rejectModal.member.first_name} ${rejectModal.member.last_name} has been rejected`,
        type: "success",
      });
      setRejectModal({ open: false, member: null });
    } catch (err: unknown) {
      const error = err as { error?: { message?: string } };
      setToast({ msg: error?.error?.message || "Failed to reject member", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Page 
      title="Pending Members" 
      description="Review and approve or reject pending member registrations"
      actions={
        <Button variant="ghost" onClick={load} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Refresh
        </Button>
      }
    >
      <Card padding="none">
        {/* Header with count */}
        <div style={{ 
          padding: "var(--space-4) var(--space-6)", 
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-body-sm)" }}>
            {items.length} pending {items.length === 1 ? "member" : "members"}
          </span>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-text-muted)" }}>
            <div className="pr-skeleton" style={{ 
              width: 40, 
              height: 40, 
              borderRadius: "var(--radius-full)",
              margin: "0 auto var(--space-4)",
            }} />
            <p style={{ margin: 0 }}>Loading...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div style={{ 
            padding: "var(--space-10)", 
            textAlign: "center",
            color: "var(--color-text-muted)",
          }}>
            <svg 
              width="48" 
              height="48" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5"
              style={{ margin: "0 auto var(--space-4)", opacity: 0.5 }}
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <polyline points="17 11 19 13 23 9" />
            </svg>
            <h3 style={{ 
              fontSize: "var(--font-h3)", 
              margin: "0 0 var(--space-2) 0",
              fontWeight: "var(--font-weight-semibold)",
              color: "var(--color-text-primary)",
            }}>
              All caught up!
            </h3>
            <p style={{ margin: 0, fontSize: "var(--font-body-md)" }}>
              No pending members to review
            </p>
          </div>
        )}

        {/* Members table */}
        {!loading && items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeadCell>Member</TableHeadCell>
                <TableHeadCell>Email</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Registered</TableHeadCell>
                <TableHeadCell align="right">Actions</TableHeadCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-full)",
                        background: "var(--color-warning-soft)",
                        color: "var(--color-warning)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "var(--font-weight-semibold)",
                        fontSize: "var(--font-caption)",
                        flexShrink: 0,
                      }}>
                        {m.first_name?.charAt(0)}{m.last_name?.charAt(0)}
                      </div>
                      <span style={{ fontWeight: "var(--font-weight-medium)" }}>
                        {m.first_name} {m.last_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    <Tag variant="warning">{m.status}</Tag>
                  </TableCell>
                  <TableCell>
                    {m.created_at ? new Date(m.created_at).toLocaleDateString() : "N/A"}
                  </TableCell>
                  <TableCell align="right">
                    <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(m)}
                        disabled={actionLoading === m.id}
                        loading={actionLoading === m.id}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => openRejectModal(m)}
                        disabled={actionLoading === m.id}
                      >
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Reject Modal */}
      <Modal
        open={rejectModal.open}
        onClose={() => setRejectModal({ open: false, member: null })}
        title="Reject Member"
        description="This action cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectModal({ open: false, member: null })}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleReject} disabled={actionLoading !== null} loading={actionLoading !== null}>
              Reject Member
            </Button>
          </>
        }
      >
        {rejectModal.member && (
          <div>
            <p style={{ margin: "0 0 var(--space-4)" }}>
              Are you sure you want to reject{" "}
              <strong>{rejectModal.member.first_name} {rejectModal.member.last_name}</strong>{" "}
              ({rejectModal.member.email})?
            </p>
            <div className="pr-form-field">
              <label htmlFor="rejectReason" style={{ 
                fontWeight: "var(--font-weight-medium)",
                fontSize: "var(--font-label)",
                marginBottom: "var(--space-1)",
                display: "block",
              }}>
                Reason (optional)
              </label>
              <textarea
                id="rejectReason"
                className="pr-input"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter a reason for rejection..."
                style={{ resize: "vertical" }}
              />
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};
