import { useEffect, useState } from "react";
import { Invoice } from "../../../../libs/shared/src/models";
import { listMyInvoices } from "../api/client";
import { useSession } from "./useSession";

type UseInvoicesState = {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
};

export function useInvoices(): UseInvoicesState {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tokens } = useSession();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!tokens?.access_token) {
        setLoading(false);
        setInvoices([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await listMyInvoices(tokens.access_token);
        if (cancelled) return;
        setInvoices(data);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Failed to load invoices");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tokens?.access_token]);

  return { invoices, loading, error };
}

