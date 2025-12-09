import React, { useState, useCallback, useEffect } from "react";
import { searchDirectoryMembers, MemberDirectoryEntry, MemberDirectorySearchResponse } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { PageShell, Card, Button, Input, Badge, Table, TableCard } from "../ui";

const PAGE_SIZE = 20;

export const DirectoryPage: React.FC = () => {
  const { tokens } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberDirectoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const doSearch = useCallback(async (searchQuery: string, searchOffset: number) => {
    if (!tokens?.access_token) return;

    setLoading(true);
    setLoadError(null);
    try {
      const resp: MemberDirectorySearchResponse = await searchDirectoryMembers(tokens.access_token, {
        q: searchQuery,
        limit: PAGE_SIZE,
        offset: searchOffset,
      });
      setResults(resp.items);
      setTotal(resp.total);
      setHasSearched(true);
    } catch (err: unknown) {
      const error = err as { error?: { message?: string } };
      setLoadError(error?.error?.message || "Failed to search directory");
    } finally {
      setLoading(false);
    }
  }, [tokens]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        doSearch(query, 0);
        setOffset(0);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      doSearch(query, 0);
      setOffset(0);
    }
  };

  const handleNext = () => {
    const newOffset = offset + PAGE_SIZE;
    if (newOffset < total) {
      setOffset(newOffset);
      doSearch(query, newOffset);
    }
  };

  const handlePrev = () => {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(newOffset);
    doSearch(query, newOffset);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setTotal(0);
    setOffset(0);
    setHasSearched(false);
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <PageShell title="Member Directory" description="Search members by name or email">
      {/* Search card */}
      <Card>
        <form onSubmit={handleSearch}>
          <div style={{ display: "flex", gap: "var(--app-space-sm)", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email..."
              />
            </div>
            <Button type="submit" disabled={loading || !query.trim()}>
              Search
            </Button>
            {query && (
              <Button type="button" variant="ghost" onClick={handleClear}>
                Clear
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Results */}
      <div style={{ marginTop: "var(--app-space-lg)" }}>
        {/* Error state */}
        {loadError && (
          <Card>
            <div style={{ padding: "var(--app-space-xl)", textAlign: "center" }}>
              <div style={{ 
                width: 56,
                height: 56,
                borderRadius: "var(--app-radius-pill)",
                background: "var(--app-color-surface-2)",
                color: "var(--app-color-state-error)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "var(--app-space-md)",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h3 style={{ fontSize: "var(--rcme-font-size-h3)", margin: "0 0 var(--app-space-sm) 0", fontWeight: 600 }}>
                Search failed
              </h3>
              <p style={{ color: "var(--app-color-text-secondary)", marginBottom: "var(--app-space-md)" }}>
                {loadError}
              </p>
              <Button variant="secondary" onClick={() => doSearch(query, offset)}>
                Try again
              </Button>
            </div>
          </Card>
        )}

        {/* Initial state */}
        {!loadError && !hasSearched && !loading && (
          <Card>
            <div style={{ 
              padding: "var(--app-space-xxl)", 
              textAlign: "center",
              color: "var(--app-color-text-muted)",
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
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p style={{ margin: 0, fontSize: "var(--rcme-font-size-body)" }}>
                Type a name or email to search the directory
              </p>
            </div>
          </Card>
        )}

        {/* Loading state */}
        {loading && (
          <Card>
            <div style={{ padding: "var(--app-space-xl)", textAlign: "center", color: "var(--app-color-text-muted)" }}>
              <div className="pr-skeleton" style={{ 
                width: 40, 
                height: 40, 
                borderRadius: "var(--app-radius-pill)",
                margin: "0 auto var(--app-space-md)",
              }} />
              <p style={{ margin: 0 }}>Searching...</p>
            </div>
          </Card>
        )}

        {/* Empty results */}
        {!loadError && hasSearched && !loading && results.length === 0 && (
          <Card>
            <div style={{ 
              padding: "var(--app-space-xxl)", 
              textAlign: "center",
              color: "var(--app-color-text-muted)",
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="17" y1="11" x2="22" y2="6" />
                <line x1="22" y1="11" x2="17" y2="6" />
              </svg>
              <h3 style={{ 
                fontSize: "var(--rcme-font-size-h3)", 
                margin: "0 0 var(--app-space-sm) 0",
                fontWeight: 600,
                color: "var(--app-color-text-primary)",
              }}>
                No members found
              </h3>
              <p style={{ margin: 0, fontSize: "var(--rcme-font-size-body)" }}>
                No members match "{query}"
              </p>
            </div>
          </Card>
        )}

        {/* Results list */}
        {!loadError && !loading && results.length > 0 && (
          <Card padding="none">
            <div style={{ padding: "var(--app-space-md)", borderBottom: "1px solid var(--app-color-border-subtle)" }}>
              <span style={{ color: "var(--app-color-text-secondary)" }}>
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} members
              </span>
            </div>
            
            <TableCard>
              <Table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--app-space-sm)" }}>
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={`${member.first_name} ${member.last_name}`}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "var(--radius-full)",
                                objectFit: "cover",
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: "var(--app-radius-pill)",
                              background: "var(--app-color-surface-2)",
                              color: "var(--app-color-text-primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "var(--font-weight-semibold)",
                              fontSize: "var(--font-caption)",
                              flexShrink: 0,
                            }}>
                              {member.first_name?.charAt(0)}{member.last_name?.charAt(0)}
                            </div>
                          )}
                          <span style={{ fontWeight: "var(--font-weight-medium)" }}>
                            {member.first_name} {member.last_name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <a 
                          href={`mailto:${member.email}`}
                          style={{ color: "var(--app-color-brand-primary)" }}
                        >
                          {member.email}
                        </a>
                      </td>
                      <td>
                        {member.phone || <span style={{ color: "var(--app-color-text-muted)" }}>—</span>}
                      </td>
                      <td>
                        <Badge variant={member.status === "active" ? "success" : "info"}>
                          {member.status || "active"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableCard>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ 
                padding: "var(--app-space-md)", 
                borderTop: "1px solid var(--app-color-border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{ color: "var(--app-color-text-secondary)" }}>
                  Page {currentPage} of {totalPages}
                </span>
                <div style={{ display: "flex", gap: "var(--app-space-sm)" }}>
                  <Button variant="ghost" size="sm" onClick={handlePrev} disabled={offset === 0}>
                    Previous
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleNext} disabled={offset + PAGE_SIZE >= total}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </PageShell>
  );
};
