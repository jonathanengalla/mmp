import React, { useEffect, useState } from "react";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Table, TableHeader, TableBody, TableRow, TableHeadCell, TableCell } from "../components/ui/Table";
import { Tag } from "../components/primitives/Tag";
import { Button } from "../components/primitives/Button";
import { useSession } from "../hooks/useSession";
import { DevEmailLogEntry, fetchDevEmailLog } from "../api/client";

const formatDate = (iso: string) => new Date(iso).toLocaleString();

const typeVariant = (template?: string | null) => {
  if (!template) return "default";
  if (template.startsWith("dues_")) return "info";
  if (template.startsWith("event_")) return "warning";
  return "default";
};

export const AdminEmailLogPage: React.FC = () => {
  const { tokens, hasRole } = useSession();
  const token = tokens?.access_token || null;
  const [items, setItems] = useState<DevEmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const canView = hasRole?.("admin") || hasRole?.("finance_manager");

  const load = async () => {
    if (!token || !canView) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDevEmailLog(token);
      setItems(data);
    } catch (e: any) {
      const detail = e?.message || "";
      const base = "Failed to load email log";
      setError(detail ? `${base}: ${detail}` : base);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canView]);

  const toggleRow = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <Page title="Email Log" description="Internal dev log of dues and event notification emails.">
      {!canView && <Card>You do not have access to view the email log.</Card>}
      {canView && (
        <Card>
          {loading && <div>Loading email log...</div>}
          {!loading && error && (
            <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
              <span style={{ color: "var(--color-error)" }}>{error}</span>
              <Button variant="secondary" onClick={load}>
                Retry
              </Button>
            </div>
          )}
          {!loading && !error && items.length === 0 && <div>No emails logged yet.</div>}
          {!loading && !error && items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeadCell>Sent At</TableHeadCell>
                  <TableHeadCell>To</TableHeadCell>
                  <TableHeadCell>Subject</TableHeadCell>
                  <TableHeadCell>Type</TableHeadCell>
                  <TableHeadCell align="right">Details</TableHeadCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isOpen = openId === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <TableRow>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                        <TableCell>{item.to}</TableCell>
                        <TableCell>{item.subject}</TableCell>
                        <TableCell>
                          <Tag variant={typeVariant(item.template)} size="sm">
                            {item.template || "n/a"}
                          </Tag>
                        </TableCell>
                        <TableCell align="right">
                          <Button variant="secondary" size="sm" onClick={() => toggleRow(item.id)}>
                            {isOpen ? "Hide JSON" : "View JSON"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <pre
                              style={{
                                background: "var(--color-surface-1)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "var(--radius-md)",
                                padding: "var(--space-sm)",
                                fontSize: "12px",
                                overflowX: "auto",
                              }}
                            >
                              {JSON.stringify(item.payload ?? item, null, 2)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </Page>
  );
};

export default AdminEmailLogPage;


