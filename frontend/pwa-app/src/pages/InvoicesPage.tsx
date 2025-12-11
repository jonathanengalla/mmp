import React, { useEffect, useState } from "react";
import { InvoiceTable } from "../components/InvoiceTable";
import { Modal } from "../components/ui/Modal";
import { FormField } from "../components/primitives/FormField";
import { Toast } from "../components/Toast";
import { Invoice, RecordInvoicePaymentPayload } from "../../../../libs/shared/src/models";
import { listMyInvoices, listTenantInvoices, recordInvoicePayment } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Card, Button, Badge, PageShell, Input } from "../ui";

const InvoicesPage: React.FC = () => {
  const { tokens, hasRole } = useSession();
  const token = tokens?.access_token || null;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Invoice["status"] | "all">("all");

  const canRecordPayments = hasRole?.("admin") || hasRole?.("finance_manager");

  const loadInvoices = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    const isAdminFinance = hasRole?.("admin") || hasRole?.("finance_manager") || hasRole?.("super_admin");
    try {
      setLoading(true);
      const resp = isAdminFinance ? await listTenantInvoices(token, { limit: 200 }) : await listMyInvoices(token);
      setInvoices((resp as any).items ?? (resp as any));
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const renderError = (message: string) => (
    <div
      style={{
        padding: "var(--rcme-space-md) var(--rcme-space-lg)",
        background: "var(--rcme-color-surface-2)",
        borderRadius: "var(--rcme-radius-md)",
        color: "var(--rcme-color-state-error)",
        fontSize: "var(--rcme-font-size-label)",
        border: "1px solid var(--rcme-color-border-strong)",
      }}
    >
      {message}
    </div>
  );

  const renderEmpty = (label: string) => (
    <div
      style={{
        padding: "var(--rcme-space-xxl)",
        textAlign: "center",
        color: "var(--rcme-color-text-muted)",
        background: "var(--rcme-color-surface-1)",
        borderRadius: "var(--rcme-radius-md)",
        border: "1px dashed var(--rcme-color-border-subtle)",
      }}
    >
      {label}
    </div>
  );

  const renderLoading = () => (
    <div
      style={{
        padding: "var(--rcme-space-xxl)",
        textAlign: "center",
        color: "var(--rcme-color-text-muted)",
      }}
    >
      Loading invoices...
    </div>
  );

  const openRecordPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentMethod("");
    setPaymentReference("");
    setPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    if (submittingPayment) return;
    setPaymentModalOpen(false);
    setSelectedInvoice(null);
  };

  const handleRecordPayment = async () => {
    if (!token || !selectedInvoice) return;
    setSubmittingPayment(true);
    try {
      const payload: RecordInvoicePaymentPayload = {
        paymentMethod: paymentMethod || "manual",
        paymentReference: paymentReference || null,
        paidAt: null,
      };
      const updated = await recordInvoicePayment(token, selectedInvoice.id, payload);
      setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
      setToast({ message: "Payment recorded and invoice marked as paid.", type: "success" });
      closePaymentModal();
    } catch (e: any) {
      setToast({ message: e?.message || "Failed to record payment.", type: "error" });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inv.id.toLowerCase().includes(q) ||
      (inv.description || "").toLowerCase().includes(q) ||
      (inv.eventTitle || "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const metrics = (() => {
    const total = filteredInvoices.length;
    const paid = filteredInvoices.filter((i) => i.status === "paid");
    const pending = filteredInvoices.filter((i) => i.status === "pending");
    const failed = filteredInvoices.filter((i) => i.status !== "paid" && i.status !== "pending");
    const sum = (list: Invoice[]) => list.reduce((acc, inv) => acc + (inv.amountCents || 0), 0) / 100;
    return {
      total,
      paidCount: paid.length,
      paidAmount: sum(paid),
      pendingCount: pending.length,
      pendingAmount: sum(pending),
      failedCount: failed.length,
    };
  })();

  const handleRefresh = loadInvoices;

  return (
    <PageShell
      title="Invoices"
      description="View your recent invoices and payment status."
      actions={
        <Button variant="secondary" size="sm" onClick={handleRefresh}>
          Refresh
        </Button>
      }
    >
      {/* Main layout area */}
      <div className="invoices-layout" style={{ display: "grid", gap: "var(--app-space-lg)" }}>
        {error && renderError(error)}

        {/* Filters row */}
        <Card elevation="sm" padding="sm">
          <div style={{ display: "flex", gap: "var(--app-space-sm)", flexWrap: "wrap", alignItems: "center" }}>
            <Input
              placeholder="Search invoices or events"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 220, flex: "1 1 220px" }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Invoice["status"] | "all")}
              style={{
                padding: "10px 12px",
                borderRadius: "var(--app-radius-md)",
                border: "1px solid var(--app-color-border-subtle)",
                background: "var(--app-color-surface-0)",
                color: "var(--app-color-text-primary)",
                minWidth: 160,
              }}
            >
              <option value="all">Status: All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="draft">Draft</option>
            </select>
            <Button variant="ghost" onClick={loadInvoices}>
              Refresh
            </Button>
          </div>
        </Card>

        {/* Summary cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--app-space-md)",
          }}
        >
          <Card elevation="sm" padding="md">
            <div style={{ color: "var(--app-color-text-muted)", marginBottom: "var(--app-space-xs)" }}>Total invoices</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{metrics.total}</div>
          </Card>
          <Card elevation="sm" padding="md">
            <div style={{ color: "var(--app-color-text-muted)", marginBottom: "var(--app-space-xs)" }}>Paid</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{metrics.paidCount}</div>
            <div style={{ color: "var(--app-color-text-secondary)", marginTop: "var(--app-space-xs)" }}>
              ₱{metrics.paidAmount.toFixed(2)}
            </div>
          </Card>
          <Card elevation="sm" padding="md">
            <div style={{ color: "var(--app-color-text-muted)", marginBottom: "var(--app-space-xs)" }}>Pending</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{metrics.pendingCount}</div>
            <div style={{ color: "var(--app-color-text-secondary)", marginTop: "var(--app-space-xs)" }}>
              ₱{metrics.pendingAmount.toFixed(2)}
            </div>
          </Card>
          <Card elevation="sm" padding="md">
            <div style={{ color: "var(--app-color-text-muted)", marginBottom: "var(--app-space-xs)" }}>Other statuses</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{metrics.failedCount}</div>
          </Card>
        </div>

        {/* Table container */}
        <Card elevation="md" padding="md">
          {loading && renderLoading()}
          {!loading && filteredInvoices.length === 0 && renderEmpty("No invoices match the current filters.")}
          {!loading && filteredInvoices.length > 0 && (
            <InvoiceTable invoices={filteredInvoices} onRecordPayment={canRecordPayments ? openRecordPayment : undefined} />
          )}
        </Card>

        <Modal
          open={paymentModalOpen && !!selectedInvoice}
          onClose={closePaymentModal}
          title="Record payment"
          size="md"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--rcme-space-sm)" }}>
              <Button variant="secondary" disabled={submittingPayment} onClick={closePaymentModal}>
                Cancel
              </Button>
              <Button disabled={submittingPayment} onClick={handleRecordPayment}>
                {submittingPayment ? "Saving..." : "Mark as paid"}
              </Button>
            </div>
          }
        >
          {selectedInvoice && (
            <div style={{ display: "grid", gap: "var(--rcme-space-md)" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{selectedInvoice.description}</div>
                {selectedInvoice.eventTitle && (
                  <div style={{ color: "var(--rcme-color-text-muted)" }}>Event: {selectedInvoice.eventTitle}</div>
                )}
                <div style={{ marginTop: "var(--rcme-space-xs)", fontSize: "0.9rem" }}>
                  Amount: {(selectedInvoice.amountCents / 100).toFixed(2)} {selectedInvoice.currency}
                </div>
              </div>
              <FormField label="Payment method">
                <select
                  className="pr-input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Select method</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="gcash">GCash</option>
                  <option value="card">Card</option>
                </select>
              </FormField>
              <FormField label="Reference / notes (optional)">
                <input
                  className="pr-input"
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Receipt number, bank ref, or note"
                  style={{ width: "100%" }}
                />
              </FormField>
            </div>
          )}
        </Modal>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </PageShell>
  );
};

export default InvoicesPage;

