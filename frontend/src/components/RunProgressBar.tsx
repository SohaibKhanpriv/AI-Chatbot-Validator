"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Props = {
  processed: number;
  total: number;
  status: string;
  remaining: number;
  runId: number;
};

const POLL_INTERVAL_MS = 2000;

export default function RunProgressBar({ processed, total, status, remaining, runId }: Props) {
  const [live, setLive] = useState({ processed, total, status, remaining });

  useEffect(() => {
    setLive({ processed, total, status, remaining });
  }, [processed, total, status, remaining]);

  useEffect(() => {
    if (status === "completed" || status === "failed") return;
    const t = setInterval(async () => {
      try {
        const p = await api.progress(runId);
        setLive({
          processed: p.processed,
          total: p.total,
          status: p.status,
          remaining: p.remaining,
        });
      } catch {
        // ignore
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [runId, status]);

  const pct = live.total > 0 ? Math.round((live.processed / live.total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-zinc-400">
        <span>
          {live.processed} / {live.total} queries processed
        </span>
        <span>{live.remaining} remaining</span>
      </div>
      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--neural-primary)] to-[var(--neural-accent)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500">Status: {live.status}</p>
    </div>
  );
}
