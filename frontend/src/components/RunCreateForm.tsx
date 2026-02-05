"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Dataset } from "@/lib/api";

type Props = { datasets: Dataset[]; onCreated: () => void };

export default function RunCreateForm({ datasets, onCreated }: Props) {
  const [name, setName] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [apiUrl, setApiUrl] = useState("http://127.0.0.1:8000/app/api/stream/");
  const [authToken, setAuthToken] = useState("");
  const [newThread, setNewThread] = useState(true);
  const [queryLimit, setQueryLimit] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!datasetId) {
      setError("Select a dataset");
      return;
    }
    if (!authToken.trim()) {
      setError("Enter auth token (JWT)");
      return;
    }
    setLoading(true);
    try {
      const token = authToken.trim().startsWith("Bearer ") ? authToken.trim() : `Bearer ${authToken.trim()}`;
      const limitNum = queryLimit.trim() ? parseInt(queryLimit.trim(), 10) : null;
      if (queryLimit.trim() && (Number.isNaN(limitNum) || limitNum < 1)) {
        setError("Query limit must be a positive number");
        return;
      }
      await api.runs.create({
        name: name || "Run",
        dataset_id: parseInt(datasetId, 10),
        api_url: apiUrl.trim(),
        auth_token: token,
        new_thread_per_query: newThread,
        query_limit: limitNum ?? undefined,
      });
      setName("");
      setDatasetId("");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create run");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="crystal-card p-6">
      <h2 className="text-lg font-semibold mb-4">Create run</h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Run name"
            className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--neural-primary)]"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Dataset</label>
          <select
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--neural-primary)]"
          >
            <option value="">Select dataset</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">API URL</label>
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://127.0.0.1:8000/app/api/stream/"
            className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--neural-primary)]"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">JWT / Bearer token</label>
          <input
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder="Bearer your_token_here"
            className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--neural-primary)]"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Query limit (optional)</label>
          <input
            type="text"
            inputMode="numeric"
            value={queryLimit}
            onChange={(e) => setQueryLimit(e.target.value)}
            placeholder="All queries (full run)"
            className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--neural-primary)]"
          />
          <p className="text-xs text-zinc-500 mt-1">Leave empty for full run. Enter a number (e.g. 5) to run only the first N queries (quick run).</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="newThread"
            checked={newThread}
            onChange={(e) => setNewThread(e.target.checked)}
            className="rounded border-[var(--glass-border)] bg-white/5"
          />
          <label htmlFor="newThread" className="text-sm text-zinc-400">
            New thread per query
          </label>
        </div>
        {error && <p className="text-amber-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create & start run"}
        </button>
      </form>
    </div>
  );
}
