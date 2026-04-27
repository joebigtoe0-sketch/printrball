"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/env";
import type { ActivityEntry, ApiStateResponse, HistoricalRound, StatsResponse } from "@/lib/types";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export function useHomeData() {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const stateQuery = useQuery({
    queryKey: ["state"],
    queryFn: () => fetchJson<ApiStateResponse>("/api/state"),
    refetchInterval: hidden ? false : 2500,
    retry: 3,
    retryDelay: (i) => Math.min(30_000, 1000 * 2 ** i),
  });

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetchJson<StatsResponse>("/api/stats"),
    refetchInterval: hidden ? false : 30_000,
    staleTime: 20_000,
  });

  const historyQuery = useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const body = await fetchJson<{ items: HistoricalRound[] }>("/api/history?limit=12");
      return body.items;
    },
    refetchInterval: hidden ? false : 15_000,
  });

  const activityQuery = useQuery({
    queryKey: ["activity"],
    queryFn: () => fetchJson<ActivityEntry[]>("/api/activity?limit=50"),
    refetchInterval: hidden ? false : 5000,
  });

  const [feed, setFeed] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    const rows = activityQuery.data;
    if (!rows) return;
    setFeed((prev) => {
      const map = new Map<number, ActivityEntry>();
      for (const r of rows) map.set(r.id, r);
      for (const r of prev) map.set(r.id, r);
      return [...map.values()].sort((a, b) => b.ts - a.ts).slice(0, 80);
    });
  }, [activityQuery.data]);

  const reconcile = useCallback(() => {
    void qc.invalidateQueries();
  }, [qc]);

  const live = !stateQuery.isError;

  return {
    state: stateQuery.data,
    stats: statsQuery.data,
    winners: historyQuery.data ?? [],
    feed,
    loading: stateQuery.isLoading,
    error: stateQuery.isError,
    live,
    reconcile,
  };
}
