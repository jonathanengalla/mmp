import React, { useEffect, useState } from "react";
import { Button } from "../components/primitives/Button";
import { Card } from "../components/primitives/Card";
import { Page } from "../components/primitives/Page";
import { FormField } from "../components/primitives/FormField";
import { Table, TableBody, TableCell, TableHeadCell, TableHeader, TableRow, TableCard } from "../components/ui/Table";
import { useSession } from "../hooks/useSession";
import { createDuesRun, getDuesSummary, DuesSummaryResponse } from "../api/client";

const formatMoney = (amountCents: number, currency: string) => {
  const amount = (amountCents || 0) / 100;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currency || "PHP",
  }).format(amount);
};

export const AdminDuesSummaryPage: React.FC = () => {
  const { tokens } = useSession();
  const token = tokens?.access_token;
  const [summary, setSummary] = useState<DuesSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", periodKey: "", amount: "", currency: "PHP", dueDate: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadSummary = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const resp = await getDuesSummary(token);
      setSummary(resp);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load dues summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const amountNumber = Number(form.amount);
    if (!form.label || !form.periodKey || !amountNumber || amountNumber <= 0 || !form.currency) {
      setMessage("Label, period key, amount, and currency are required.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await createDuesRun(token, {
        label: form.label,
        periodKey: form.periodKey,
        amountCents: Math.round(amountNumber * 100),
        currency: form.currency,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      });
      setMessage("Dues run created. Refreshing summary...");
      await loadSummary();
    } catch (e: any) {
      setMessage(e?.message || "Failed to create dues run");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page title="Dues & Billing Summary" description="Create dues runs and track collection by period.">
      <Card title="Create Dues Run">
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--space-md)", maxWidth: 520 }}>
          <FormField label="Label">
            <input
              className="pr-input"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="2025 Annual Dues"
            />
          </FormField>
          <FormField label="Period key">
            <input
              className="pr-input"
              value={form.periodKey}
              onChange={(e) => setForm((f) => ({ ...f, periodKey: e.target.value }))}
              placeholder="2025-annual"
            />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
            <FormField label="Amount">
              <input
                className="pr-input"
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="5000"
              />
            </FormField>
            <FormField label="Currency">
              <input
                className="pr-input"
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                placeholder="PHP"
              />
            </FormField>
          </div>
          <FormField label="Due date (optional)">
            <input
              className="pr-input"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </FormField>
          <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create dues run"}
            </Button>
            {message && <span style={{ color: "var(--app-color-text-muted)" }}>{message}</span>}
          </div>
        </form>
      </Card>

      <Card title="Dues Summary">
        {loading && <div>Loading dues summary...</div>}
        {!loading && error && (
          <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
            <span style={{ color: "var(--app-color-state-error)" }}>{error}</span>
            <Button variant="secondary" onClick={loadSummary}>
              Retry
            </Button>
          </div>
        )}
        {!loading && !error && summary && summary.items.length === 0 && <div>No dues runs yet. Create your first dues run above.</div>}
        {!loading && !error && summary && summary.items.length > 0 && (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeadCell>Period</TableHeadCell>
                  <TableHeadCell>Label</TableHeadCell>
                  <TableHeadCell>Currency</TableHeadCell>
                  <TableHeadCell>Total invoices</TableHeadCell>
                  <TableHeadCell>Unpaid</TableHeadCell>
                  <TableHeadCell>Paid</TableHeadCell>
                  <TableHeadCell>Total amount</TableHeadCell>
                  <TableHeadCell>Unpaid amount</TableHeadCell>
                  <TableHeadCell>Paid amount</TableHeadCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.items.map((item) => (
                  <TableRow key={item.periodKey}>
                    <TableCell>{item.periodKey}</TableCell>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{item.currency}</TableCell>
                    <TableCell>{item.totalCount}</TableCell>
                    <TableCell>{item.unpaidCount}</TableCell>
                    <TableCell>{item.paidCount}</TableCell>
                    <TableCell>{formatMoney(item.amountCentsTotal, item.currency)}</TableCell>
                    <TableCell>{formatMoney(item.amountCentsUnpaid, item.currency)}</TableCell>
                    <TableCell>{formatMoney(item.amountCentsPaid, item.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </Card>
    </Page>
  );
};
