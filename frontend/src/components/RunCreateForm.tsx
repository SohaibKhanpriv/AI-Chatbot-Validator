"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Dataset, ValidationCriterionOut } from "@/lib/api";

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

  const [criteria, setCriteria] = useState<ValidationCriterionOut[]>([]);
  const [validationPanelExpanded, setValidationPanelExpanded] = useState(false);
  const [selectedCriterionKeys, setSelectedCriterionKeys] = useState<Set<string>>(new Set());
  const [infoCriterionKey, setInfoCriterionKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.prompts
      .criteria()
      .then((list) => {
        if (!cancelled) {
          setCriteria(list);
          setSelectedCriterionKeys(new Set(list.filter((c) => c.active).map((c) => c.key)));
        }
      })
      .catch(() => {
        if (!cancelled) setCriteria([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCriterion = (key: string) => {
    setSelectedCriterionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
      if (queryLimit.trim() && (limitNum === null || Number.isNaN(limitNum) || limitNum < 1)) {
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
        criterion_keys: criteria.length > 0 ? Array.from(selectedCriterionKeys) : undefined,
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

        {/* Expandable validation panel */}
        {criteria.length > 0 && (
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setValidationPanelExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-300 hover:bg-white/5 transition-colors"
            >
              <span>Validations</span>
              <span className="text-zinc-500">
                {selectedCriterionKeys.size} of {criteria.length} selected
              </span>
              <svg
                className={`w-5 h-5 text-zinc-500 transition-transform ${validationPanelExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {validationPanelExpanded && (
              <div className="border-t border-white/10 p-3 space-y-2 max-h-56 overflow-y-auto">
                {criteria.map((c) => (
                  <div key={c.key} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      id={`criterion-${c.key}`}
                      checked={selectedCriterionKeys.has(c.key)}
                      onChange={() => toggleCriterion(c.key)}
                      className="rounded border-[var(--glass-border)] bg-white/5 text-[var(--neural-primary)] focus:ring-[var(--neural-primary)]"
                    />
                    <label htmlFor={`criterion-${c.key}`} className="flex-1 text-sm text-zinc-300 cursor-pointer truncate">
                      {c.name}
                    </label>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setInfoCriterionKey(infoCriterionKey === c.key ? null : c.key)}
                        className="p-1 rounded text-zinc-500 hover:text-[var(--neural-primary)] hover:bg-white/10 transition-colors"
                        aria-label="Info"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      {infoCriterionKey === c.key && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            aria-hidden
                            onClick={() => setInfoCriterionKey(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[240px] max-w-[320px] p-3 rounded-lg bg-[var(--card-bg)] border border-white/20 shadow-xl text-xs text-zinc-300 space-y-2">
                            {c.description && (
                              <p className="whitespace-pre-wrap">{c.description}</p>
                            )}
                            {c.additional_info && (
                              <p className="whitespace-pre-wrap text-zinc-500 border-t border-white/10 pt-2">
                                {c.additional_info}
                              </p>
                            )}
                            {!c.description && !c.additional_info && (
                              <p className="text-zinc-500">No description.</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
