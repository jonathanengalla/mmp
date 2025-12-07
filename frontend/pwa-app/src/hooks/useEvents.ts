import { useEffect, useState } from "react";
import { listUpcomingEvents } from "../api/client";
import { useSession } from "./useSession";
import { UpcomingEventDto } from "../../../../libs/shared/src/models";

type UseEventsState = {
  upcoming: UpcomingEventDto[];
  past: UpcomingEventDto[];
  loading: boolean;
  error: string | null;
};

export function useEvents(): UseEventsState {
  const { tokens } = useSession();
  const [upcoming, setUpcoming] = useState<UpcomingEventDto[]>([]);
  const [past, setPast] = useState<UpcomingEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      if (!tokens?.access_token) {
        setUpcoming([]);
        setPast([]);
        setLoading(false);
        return;
      }
      try {
        const items = await listUpcomingEvents(tokens.access_token);
        if (cancelled) return;
        setUpcoming(items || []);
        setPast([]);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Failed to load events");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tokens?.access_token]);

  return { upcoming, past, loading, error };
}

