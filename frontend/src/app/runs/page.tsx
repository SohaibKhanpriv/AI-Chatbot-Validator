"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Run, type Dataset } from "@/lib/api";
import RunCreateForm from "@/components/RunCreateForm";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    try {
      const [r, d] = await Promise.all([api.runs.list(), api.datasets.list()]);
      setRuns(r);
      setDatasets(d);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(runId: number) {
    if (!confirm("Delete this run and all its responses and validations?")) return;
    setDeletingId(runId);
    try {
      await api.runs.delete(runId);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[var(--neural-primary)]">Runs</h1>
      <RunCreateForm datasets={datasets} onCreated={load} />
      <div className="crystal-card overflow-hidden">
        <h2 className="p-4 border-b border-white/10 text-lg font-semibold">All runs</h2>
        {loading ? (
          <p className="p-6 text-zinc-500">Loading...</p>
        ) : runs.length === 0 ? (
          <p className="p-6 text-zinc-500">No runs. Create one above.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 p-4 hover:bg-white/5">
                <Link href={`/runs/${r.id}`} className="flex-1 min-w-0 text-[var(--neural-primary)] hover:underline truncate">
                  {r.name}
                </Link>
                <span className="text-sm text-zinc-400 shrink-0">
                  {r.processed_count}/{r.total_queries} · {r.status}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  disabled={deletingId === r.id}
                  className="shrink-0 p-2 rounded text-zinc-500 hover:text-[var(--neural-secondary)] hover:bg-white/5 disabled:opacity-50"
                  title="Delete run and all records"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
