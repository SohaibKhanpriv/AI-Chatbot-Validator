"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Run, type Progress } from "@/lib/api";
import RunProgressBar from "@/components/RunProgressBar";

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? parseInt(params.id, 10) : NaN;
  const [run, setRun] = useState<Run | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (Number.isNaN(id)) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [r, p] = await Promise.all([api.runs.get(id), api.progress(id)]);
        if (!cancelled) {
          setRun(r);
          setProgress(p);
        }
      } catch {
        if (!cancelled) setRun(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading && !run) {
    return (
      <div className="space-y-6">
        <Link href="/runs" className="text-[var(--neural-primary)] hover:underline text-sm">
          ← Runs
        </Link>
        <p className="text-zinc-500">Loading run...</p>
      </div>
    );
  }
  if (!run) {
    return (
      <div className="space-y-6">
        <Link href="/runs" className="text-[var(--neural-primary)] hover:underline text-sm">
          ← Runs
        </Link>
        <p className="text-amber-400">Run not found.</p>
      </div>
    );
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleting(true);
    try {
      await api.runs.delete(id);
      router.push("/runs");
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/runs" className="text-[var(--neural-primary)] hover:underline text-sm">
            ← Runs
          </Link>
          <h1 className="text-2xl font-bold text-[var(--neural-primary)]">{run.name}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {run.status === "completed" && (
            <>
              <Link
                href={`/runs/${id}/report`}
                className="px-4 py-2 rounded-lg bg-[var(--neural-green)]/20 text-[var(--neural-green)] border border-[var(--neural-green)]/50 hover:bg-[var(--neural-green)]/30"
              >
                View report
              </Link>
              <Link
                href={`/runs/${id}/analysis`}
                className="px-4 py-2 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30"
              >
                Deep analysis
              </Link>
            </>
          )}
          {deleteConfirm ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-amber-400">Delete all records for this run?</span>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg border border-zinc-500 text-zinc-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg bg-[var(--neural-secondary)]/20 text-[var(--neural-secondary)] border border-[var(--neural-secondary)]/50 hover:bg-[var(--neural-secondary)]/30 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-lg border border-zinc-500 text-zinc-400 hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
              title="Delete this run and all its responses and validations"
            >
              Delete run
            </button>
          )}
        </div>
      </div>
      <div className="crystal-card p-5">
        <p className="text-zinc-400 text-sm mb-2">Status: {run.status}</p>
        {progress && (
          <RunProgressBar
            processed={progress.processed}
            total={progress.total}
            status={progress.status}
            remaining={progress.remaining}
            runId={id}
          />
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="crystal-card p-4">
          <p className="text-zinc-400 text-sm">Total queries</p>
          <p className="text-xl font-bold">{run.total_queries}</p>
        </div>
        <div className="crystal-card p-4">
          <p className="text-zinc-400 text-sm">Processed</p>
          <p className="text-xl font-bold text-[var(--neural-primary)]">{run.processed_count}</p>
        </div>
        <div className="crystal-card p-4">
          <p className="text-zinc-400 text-sm">Remaining</p>
          <p className="text-xl font-bold">{(run.total_queries || 0) - (run.processed_count || 0)}</p>
        </div>
        <div className="crystal-card p-4">
          <p className="text-zinc-400 text-sm">API</p>
          <p className="text-sm truncate" title={run.api_url}>
            {run.api_url}
          </p>
        </div>
      </div>
    </div>
  );
}
