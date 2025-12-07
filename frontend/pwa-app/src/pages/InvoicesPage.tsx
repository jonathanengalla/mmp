import React, { useEffect, useState } from "react";
import { InvoiceTable } from "../components/InvoiceTable";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Tag } from "../components/primitives/Tag";
import { Modal } from "../components/ui/Modal";
import { FormField } from "../components/primitives/FormField";
import { Button } from "../components/primitives/Button";
import { Toast } from "../components/Toast";
import { Invoice, RecordInvoicePaymentPayload } from "../../../../libs/shared/src/models";
import { listMyInvoices, recordInvoicePayment } from "../api/client";
import { useSession } from "../hooks/useSession";

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

  const canRecordPayments = hasRole?.("admin") || hasRole?.("finance_manager");

  const loadInvoices = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const resp = await listMyInvoices(token);
      setInvoices(resp.items ?? resp);
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
        padding: "var(--space-3) var(--space-4)",
        background: "var(--color-error-soft, rgba(239,68,68,0.1))",
        borderRadius: "var(--radius-medium)",
        color: "var(--color-error)",
        fontSize: "var(--font-body-sm, 0.875rem)",
      }}
    >
      {message}
    </div>
  );

  const renderEmpty = (label: string) => (
    <div
      style={{
        padding: "var(--space-6)",
        textAlign: "center",
        color: "var(--color-text-muted)",
        background: "var(--color-surface-1, #f8fafc)",
        borderRadius: "var(--radius-medium)",
        border: "1px dashed var(--color-border)",
      }}
    >
      {label}
    </div>
  );

  const renderLoading = () => (
    <div
      style={{
        padding: "var(--space-6)",
        textAlign: "center",
        color: "var(--color-text-muted)",
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

  return (
    <Page title="Invoices" description="View your membership and event dues.">
      {error && renderError(error)}
      <Card
        title="Invoice Summary"
        actions={<Tag variant={loading ? "default" : "info"}>{loading ? "Loading" : `${invoices.length} invoices`}</Tag>}
      >
        {loading && renderLoading()}
        {!loading && invoices.length === 0 && renderEmpty("You have no invoices at this time.")}
        {!loading && invoices.length > 0 && (
          <InvoiceTable invoices={invoices} onRecordPayment={canRecordPayments ? openRecordPayment : undefined} />
        )}
      </Card>

      <Modal
        open={paymentModalOpen && !!selectedInvoice}
        onClose={closePaymentModal}
        title="Record payment"
        size="md"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)" }}>
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
          <div style={{ display: "grid", gap: "var(--space-md)" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{selectedInvoice.description}</div>
              {selectedInvoice.eventTitle && (
                <div style={{ color: "var(--color-text-muted)" }}>Event: {selectedInvoice.eventTitle}</div>
              )}
              <div style={{ marginTop: "var(--space-xs)", fontSize: "0.9rem" }}>
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

export default InvoicesPage;

