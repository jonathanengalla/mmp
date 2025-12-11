import React, { useEffect, useState, useRef } from "react";
import { listMembersReport, updateMemberRoles, adminUpdateMemberAvatar, getProfileCustomFieldSchema, Role, ALL_ROLES, ROLE_LABELS, ProfileCustomFieldSchema } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { Table, TableHeader, TableBody, TableRow, TableHeadCell, TableCell, TableCard } from "../components/ui/Table";
import { Tag } from "../components/ui/Tag";
import { Modal } from "../components/ui/Modal";

interface MemberReportItem {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  membershipTypeId?: string;
  createdAt?: number;
  roles?: Role[];
  avatarUrl?: string | null;
  customFields?: Record<string, string | number | boolean | null> | null;
}

export const AdminMemberReportPage: React.FC = () => {
  const { tokens } = useSession();
  const [items, setItems] = useState<MemberReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [customFieldSchema, setCustomFieldSchema] = useState<ProfileCustomFieldSchema | null>(null);

  const normalizeStatusParam = (status: string | undefined) => {
    if (!status || status === "all") return undefined;
    const map: Record<string, string> = {
      active: "ACTIVE",
      pending: "PENDING_VERIFICATION",
      inactive: "INACTIVE",
      suspended: "SUSPENDED",
    };
    return map[status.toLowerCase()];
  };

  const statusBadgeVariant = (status: string) => {
    const s = status.toLowerCase();
    if (s === "active") return "success";
    if (s === "pending_verification" || s === "pending") return "warning";
    if (s === "suspended") return "danger";
    if (s === "inactive") return "default";
    return "default";
  };

  const statusBadgeLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === "pending_verification") return "pending";
    return s;
  };

  // Edit roles modal state
  const [editRolesModal, setEditRolesModal] = useState<{
    open: boolean;
    member: MemberReportItem | null;
    selectedRoles: Role[];
    saving: boolean;
  }>({
    open: false,
    member: null,
    selectedRoles: [],
    saving: false,
  });

  // Edit avatar modal state
  const [editAvatarModal, setEditAvatarModal] = useState<{
    open: boolean;
    member: MemberReportItem | null;
    preview: string | null;
    saving: boolean;
  }>({
    open: false,
    member: null,
    preview: null,
    saving: false,
  });
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const statusParam = normalizeStatusParam(statusFilter);
      const [resp, schema] = await Promise.all([
        listMembersReport(tokens.access_token, { status: statusParam, page, page_size: pageSize }),
        getProfileCustomFieldSchema(tokens.access_token),
      ]);
      const normalized = (resp.items || []).map((m) => ({
        ...m,
        status: m.status ? m.status.toLowerCase() : "",
      }));
      setItems(normalized);
      setTotalItems(resp.totalItems ?? 0);
      setCustomFieldSchema(schema);
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Failed to load report", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, page, statusFilter]);

  const openEditRolesModal = (member: MemberReportItem) => {
    setEditRolesModal({
      open: true,
      member,
      selectedRoles: member.roles || ["member"],
      saving: false,
    });
  };

  const closeEditRolesModal = () => {
    setEditRolesModal({
      open: false,
      member: null,
      selectedRoles: [],
      saving: false,
    });
  };

  const openEditAvatarModal = (member: MemberReportItem) => {
    setEditAvatarModal({
      open: true,
      member,
      preview: null,
      saving: false,
    });
  };

  const closeEditAvatarModal = () => {
    setEditAvatarModal({
      open: false,
      member: null,
      preview: null,
      saving: false,
    });
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setToast({ msg: "Image must be less than 2MB", type: "error" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditAvatarModal((prev) => ({ ...prev, preview: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = async () => {
    if (!tokens?.access_token || !editAvatarModal.member) return;

    setEditAvatarModal((prev) => ({ ...prev, saving: true }));

    try {
      await adminUpdateMemberAvatar(
        tokens.access_token,
        editAvatarModal.member.member_id,
        { avatarUrl: editAvatarModal.preview }
      );

      // Update the item in the list
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.member_id === editAvatarModal.member?.member_id
            ? { ...item, avatarUrl: editAvatarModal.preview }
            : item
        )
      );

      setToast({
        msg: `Avatar updated for ${editAvatarModal.member.first_name} ${editAvatarModal.member.last_name}`,
        type: "success",
      });
      closeEditAvatarModal();
    } catch (err: any) {
      setToast({ msg: err?.message || "Failed to update avatar", type: "error" });
      setEditAvatarModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleRemoveAvatar = async () => {
    if (!tokens?.access_token || !editAvatarModal.member) return;

    setEditAvatarModal((prev) => ({ ...prev, saving: true }));

    try {
      await adminUpdateMemberAvatar(
        tokens.access_token,
        editAvatarModal.member.member_id,
        { avatarUrl: null }
      );

      setItems((prevItems) =>
        prevItems.map((item) =>
          item.member_id === editAvatarModal.member?.member_id
            ? { ...item, avatarUrl: null }
            : item
        )
      );

      setToast({
        msg: `Avatar removed for ${editAvatarModal.member.first_name} ${editAvatarModal.member.last_name}`,
        type: "success",
      });
      closeEditAvatarModal();
    } catch (err: any) {
      setToast({ msg: err?.message || "Failed to remove avatar", type: "error" });
      setEditAvatarModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const toggleRole = (role: Role) => {
    setEditRolesModal((prev) => {
      const isSelected = prev.selectedRoles.includes(role);
      let newRoles: Role[];
      if (isSelected) {
        newRoles = prev.selectedRoles.filter((r) => r !== role);
      } else {
        newRoles = [...prev.selectedRoles, role];
      }
      return { ...prev, selectedRoles: newRoles };
    });
  };

  const handleSaveRoles = async () => {
    if (!tokens?.access_token || !editRolesModal.member) return;

    if (editRolesModal.selectedRoles.length === 0) {
      setToast({ msg: "At least one role must be selected", type: "error" });
      return;
    }

    setEditRolesModal((prev) => ({ ...prev, saving: true }));

    try {
      const result = await updateMemberRoles(
        tokens.access_token,
        editRolesModal.member.member_id,
        editRolesModal.selectedRoles
      );

      // Update the item in the list
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.member_id === editRolesModal.member?.member_id
            ? { ...item, roles: result.roles }
            : item
        )
      );

      setToast({
        msg: `Roles updated for ${editRolesModal.member.first_name} ${editRolesModal.member.last_name}`,
        type: "success",
      });
      closeEditRolesModal();
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Failed to update roles", type: "error" });
      setEditRolesModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const getRoleTagVariant = (role: Role): "default" | "success" | "warning" | "danger" | "info" => {
    switch (role) {
      case "admin":
        return "danger";
      case "member":
        return "default";
      case "event_manager":
        return "success";
      case "finance_manager":
        return "warning";
      case "communications_manager":
        return "info";
      default:
        return "default";
    }
  };

  const rows = items.map((m) => (
    <TableRow key={m.member_id}>
      <TableCell>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {m.avatarUrl ? (
            <img
              src={m.avatarUrl}
              alt={`${m.first_name} ${m.last_name}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-full)",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-full)",
                background: "var(--app-color-primary-soft)",
                color: "var(--app-color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "var(--font-weight-semibold)",
                fontSize: "var(--font-caption)",
                flexShrink: 0,
              }}
            >
              {m.first_name?.charAt(0)}
              {m.last_name?.charAt(0)}
            </div>
          )}
          <span style={{ fontWeight: "var(--font-weight-medium)" }}>
            {m.first_name} {m.last_name}
          </span>
        </div>
      </TableCell>
      <TableCell>{m.email}</TableCell>
      <TableCell>
        <Tag variant={statusBadgeVariant(m.status)}>
          {statusBadgeLabel(m.status)}
        </Tag>
      </TableCell>
      <TableCell>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
          {(m.roles || ["member"]).map((role) => (
            <Tag key={role} variant={getRoleTagVariant(role)} size="sm">
              {ROLE_LABELS[role] || role}
            </Tag>
          ))}
        </div>
      </TableCell>
      {customFieldSchema && customFieldSchema.fields.length > 0 && (
        <TableCell>
          {m.customFields && Object.keys(m.customFields).length > 0 ? (
            <div style={{ fontSize: "var(--font-caption)", color: "var(--app-color-text-secondary)" }}>
              {Object.entries(m.customFields)
                .filter(([_, v]) => v !== null && v !== "" && v !== undefined)
                .slice(0, 3) // Show first 3 fields
                .map(([key, value]) => {
                  const field = customFieldSchema.fields.find((f) => f.id === key);
                  const label = field?.label || key;
                  const displayValue = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
                  return (
                    <div key={key} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>
                      <span style={{ fontWeight: "var(--font-weight-medium)" }}>{label}:</span> {displayValue}
                    </div>
                  );
                })}
              {Object.keys(m.customFields).filter((k) => m.customFields![k] !== null && m.customFields![k] !== "").length > 3 && (
                <span style={{ color: "var(--app-color-text-muted)" }}>+{Object.keys(m.customFields).filter((k) => m.customFields![k] !== null && m.customFields![k] !== "").length - 3} more</span>
              )}
            </div>
          ) : (
            <span style={{ color: "var(--app-color-text-muted)", fontSize: "var(--font-caption)" }}>—</span>
          )}
        </TableCell>
      )}
      <TableCell>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "N/A"}</TableCell>
      <TableCell align="right">
        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => openEditAvatarModal(m)}>
            Edit Avatar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditRolesModal(m)}>
            Edit Roles
          </Button>
        </div>
      </TableCell>
    </TableRow>
  ));

  return (
    <Page title="Member Roster Report" description="View all members and manage their roles">
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <label style={{ fontWeight: "var(--font-weight-medium)", fontSize: "var(--font-label)" }}>
            Status filter:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pr-input"
            style={{ maxWidth: 200 }}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          <Button
            variant="secondary"
            onClick={() => {
              setPage(1);
              load();
            }}
          >
            Apply
          </Button>
        </div>

        {loading && (
          <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--app-color-text-muted)" }}>
            <div
              className="pr-skeleton"
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-full)",
                margin: "0 auto var(--space-4)",
              }}
            />
            <p style={{ margin: 0 }}>Loading members...</p>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--app-color-text-muted)" }}>
            <p style={{ margin: 0 }}>No members found.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeadCell>Member</TableHeadCell>
                  <TableHeadCell>Email</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Roles</TableHeadCell>
                  {customFieldSchema && customFieldSchema.fields.length > 0 && (
                    <TableHeadCell>Custom Fields</TableHeadCell>
                  )}
                  <TableHeadCell>Created</TableHeadCell>
                  <TableHeadCell align="right">Actions</TableHeadCell>
                </TableRow>
              </TableHeader>
            <TableBody>{rows}</TableBody>
            </Table>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-3)",
              }}
            >
              <div style={{ color: "var(--app-color-text-secondary)", fontSize: "var(--font-body-sm)" }}>
                {`Showing ${items.length === 0 ? 0 : (page - 1) * pageSize + 1}-${Math.min(
                  page * pageSize,
                  totalItems
                )} of ${totalItems}`}
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <span style={{ color: "var(--app-color-text-secondary)", fontSize: "var(--font-body-sm)" }}>
                  Page {page} of {Math.max(1, Math.ceil(totalItems / pageSize))}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(totalItems / pageSize)}
                >
                  Next
                </Button>
              </div>
            </div>
          </TableCard>
        )}
      </Card>

      {/* Edit Roles Modal */}
      <Modal
        open={editRolesModal.open}
        onClose={closeEditRolesModal}
        title="Edit Member Roles"
        description={
          editRolesModal.member
            ? `Update roles for ${editRolesModal.member.first_name} ${editRolesModal.member.last_name}`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeEditRolesModal} disabled={editRolesModal.saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveRoles}
              disabled={editRolesModal.saving || editRolesModal.selectedRoles.length === 0}
              loading={editRolesModal.saving}
            >
              Save Roles
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <p style={{ margin: "0 0 var(--space-2)", color: "var(--app-color-text-secondary)", fontSize: "var(--font-body-sm)" }}>
            Select one or more roles for this member:
          </p>
          {ALL_ROLES.map((role) => (
            <label
              key={role}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-3)",
                background: editRolesModal.selectedRoles.includes(role)
                  ? "var(--app-color-primary-soft)"
                  : "var(--app-color-surface-1)",
                borderRadius: "var(--radius-md)",
                border: editRolesModal.selectedRoles.includes(role)
                  ? "1px solid var(--app-color-primary)"
                  : "1px solid var(--app-color-border-subtle)",
                cursor: "pointer",
                transition: "all var(--motion-fast)",
              }}
            >
              <input
                type="checkbox"
                checked={editRolesModal.selectedRoles.includes(role)}
                onChange={() => toggleRole(role)}
                style={{
                  width: 18,
                  height: 18,
                  accentColor: "var(--app-color-primary)",
                  cursor: "pointer",
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "var(--font-weight-medium)" }}>{ROLE_LABELS[role]}</div>
                <div style={{ fontSize: "var(--font-caption)", color: "var(--app-color-text-muted)" }}>
                  {getRoleDescription(role)}
                </div>
              </div>
              <Tag variant={getRoleTagVariant(role)} size="sm">
                {role}
              </Tag>
            </label>
          ))}
          {editRolesModal.selectedRoles.length === 0 && (
            <div
              style={{
                padding: "var(--space-3)",
                background: "var(--app-color-error-soft)",
                color: "var(--app-color-state-error)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--font-body-sm)",
              }}
            >
              At least one role must be selected.
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Avatar Modal */}
      <Modal
        open={editAvatarModal.open}
        onClose={closeEditAvatarModal}
        title="Edit Member Avatar"
        description={
          editAvatarModal.member
            ? `Update avatar for ${editAvatarModal.member.first_name} ${editAvatarModal.member.last_name}`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeEditAvatarModal} disabled={editAvatarModal.saving}>
              Cancel
            </Button>
            {editAvatarModal.preview && (
              <Button
                variant="primary"
                onClick={handleSaveAvatar}
                disabled={editAvatarModal.saving}
                loading={editAvatarModal.saving}
              >
                Save Avatar
              </Button>
            )}
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
          {/* Current or preview avatar */}
          <div style={{ position: "relative" }}>
            {editAvatarModal.preview || editAvatarModal.member?.avatarUrl ? (
              <img
                src={editAvatarModal.preview || editAvatarModal.member?.avatarUrl || ""}
                alt="Avatar preview"
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "var(--radius-full)",
                  objectFit: "cover",
                  border: "3px solid var(--app-color-border-subtle)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "var(--radius-full)",
                  background: "var(--app-color-primary-soft)",
                  color: "var(--app-color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "var(--font-weight-bold)",
                  fontSize: "var(--font-h2)",
                  border: "3px solid var(--app-color-border-subtle)",
                }}
              >
                {editAvatarModal.member?.first_name?.charAt(0)}
                {editAvatarModal.member?.last_name?.charAt(0)}
              </div>
            )}
          </div>

          {/* File input */}
          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            style={{ display: "none" }}
          />

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button
              variant="secondary"
              onClick={() => avatarFileInputRef.current?.click()}
              disabled={editAvatarModal.saving}
            >
              {editAvatarModal.member?.avatarUrl || editAvatarModal.preview ? "Change Photo" : "Upload Photo"}
            </Button>
            {(editAvatarModal.member?.avatarUrl || editAvatarModal.preview) && !editAvatarModal.preview && (
              <Button
                variant="ghost"
                onClick={handleRemoveAvatar}
                disabled={editAvatarModal.saving}
              >
                Remove
              </Button>
            )}
            {editAvatarModal.preview && (
              <Button
                variant="ghost"
                onClick={() => setEditAvatarModal((prev) => ({ ...prev, preview: null }))}
                disabled={editAvatarModal.saving}
              >
                Clear
              </Button>
            )}
          </div>

          <p style={{ color: "var(--app-color-text-muted)", fontSize: "var(--font-caption)", margin: 0 }}>
            Recommended: Square image, max 2MB
          </p>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

function getRoleDescription(role: Role): string {
  switch (role) {
    case "admin":
      return "Full access to all administrative functions";
    case "member":
      return "Basic member access to portal features";
    case "event_manager":
      return "Create, edit, and manage events";
    case "finance_manager":
      return "Access to billing, invoices, and payment reports";
    case "communications_manager":
      return "Manage broadcasts and communications";
    default:
      return "";
  }
}
