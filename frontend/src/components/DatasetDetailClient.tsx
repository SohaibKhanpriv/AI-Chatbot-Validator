"use client";

import { useState, useCallback } from "react";
import { api, type DatasetWithQueries, type QueryOut } from "@/lib/api";

type Props = { datasetId: number; initialDataset: DatasetWithQueries };

function ExpectationsClearIcon({ clear, feedback }: { clear: boolean; feedback?: string | null }) {
  if (clear) return null;
  return (
    <span
      className="inline-flex items-center text-amber-400 ml-1"
      title={feedback || "Expectations may be unclear"}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

export default function DatasetDetailClient({ datasetId, initialDataset }: Props) {
  const [dataset, setDataset] = useState<DatasetWithQueries>(initialDataset);
  const [editing, setEditing] = useState(false);
  const [editingDataset, setEditingDataset] = useState(false);
  const [name, setName] = useState(initialDataset.name);
  const [systemBehavior, setSystemBehavior] = useState(initialDataset.system_behavior ?? "");
  const [reEvaluateLoading, setReEvaluateLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<Record<number, { query_text: string; expectations: string }>>({});

  const refetch = useCallback(async () => {
    try {
      const next = await api.datasets.get(datasetId);
      setDataset(next);
      setName(next.name);
      setSystemBehavior(next.system_behavior ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refetch");
    }
  }, [datasetId]);

  const handleReEvaluate = async () => {
    setError(null);
    setReEvaluateLoading(true);
    try {
      await api.datasets.evaluateExpectations(datasetId);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-evaluate failed");
    } finally {
      setReEvaluateLoading(false);
    }
  };

  const startEdit = () => {
    const rows: Record<number, { query_text: string; expectations: string }> = {};
    dataset.queries.forEach((q) => {
      rows[q.id] = { query_text: q.query_text, expectations: q.expectations ?? "" };
    });
    setEditRows(rows);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditRows({});
    setEditing(false);
  };

  const handleSaveRows = async () => {
    setError(null);
    setSaveLoading(true);
    try {
      const toSave = dataset.queries.filter((q) => {
        const r = editRows[q.id];
        return r && (r.query_text !== q.query_text || (r.expectations ?? "") !== (q.expectations ?? ""));
      });
      for (const q of toSave) {
        const r = editRows[q.id];
        if (r) await api.datasets.patchQuery(datasetId, q.id, { query_text: r.query_text, expectations: r.expectations || null });
      }
      await refetch();
      setEditRows({});
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveDataset = async () => {
    setError(null);
    setSaveLoading(true);
    try {
      await api.datasets.patch(datasetId, { name, system_behavior: systemBehavior || null });
      await refetch();
      setEditingDataset(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaveLoading(false);
    }
  };

  const updateEditRow = (queryId: number, field: "query_text" | "expectations", value: string) => {
    setEditRows((prev) => ({
      ...prev,
      [queryId]: { ...prev[queryId], [field]: value },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-[var(--neural-primary)]">
          {editingDataset ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border border-[var(--glass-border)] rounded px-2 py-1 text-xl min-w-[200px]"
            />
          ) : (
            dataset.name
          )}
        </h1>
        {editingDataset ? (
          <>
            <button
              onClick={handleSaveDataset}
              disabled={saveLoading}
              className="px-3 py-1.5 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30 disabled:opacity-50 text-sm"
            >
              {saveLoading ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditingDataset(false)}
              className="px-3 py-1.5 rounded-lg border border-white/20 text-zinc-400 hover:bg-white/5 text-sm"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditingDataset(true)}
            className="px-3 py-1.5 rounded-lg border border-white/20 text-zinc-400 hover:bg-white/5 text-sm"
          >
            Edit dataset
          </button>
        )}
      </div>

      <p className="text-zinc-400 text-sm">Source: {dataset.source_type} · {dataset.queries.length} queries</p>

      <div className="crystal-card p-4">
        <h3 className="text-sm font-medium text-zinc-400 mb-2">System behavior</h3>
        {editingDataset ? (
          <textarea
            value={systemBehavior}
            onChange={(e) => setSystemBehavior(e.target.value)}
            rows={4}
            className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--neural-primary)] resize-y"
            placeholder="Describe what the system is for (used during validation)"
          />
        ) : (
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">
            {dataset.system_behavior && dataset.system_behavior.trim() ? dataset.system_behavior : "—"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleReEvaluate}
          disabled={reEvaluateLoading}
          className="px-4 py-2 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30 disabled:opacity-50 text-sm"
        >
          {reEvaluateLoading ? "Re-evaluating..." : "Re-evaluate expectations"}
        </button>
        {!editing ? (
          <button
            onClick={startEdit}
            className="px-4 py-2 rounded-lg border border-white/20 text-zinc-300 hover:bg-white/5 text-sm"
          >
            Edit queries
          </button>
        ) : (
          <>
            <button
              onClick={handleSaveRows}
              disabled={saveLoading}
              className="px-4 py-2 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30 disabled:opacity-50 text-sm"
            >
              {saveLoading ? "Saving..." : "Save"}
            </button>
            <button onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-white/20 text-zinc-400 hover:bg-white/5 text-sm">
              Cancel
            </button>
          </>
        )}
      </div>

      {error && <p className="text-amber-400 text-sm">{error}</p>}

      <div className="crystal-card overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[var(--card-bg)] border-b border-white/10">
              <tr>
                <th className="p-3 text-sm text-zinc-400 font-medium">#</th>
                <th className="p-3 text-sm text-zinc-400 font-medium">Query</th>
                <th className="p-3 text-sm text-zinc-400 font-medium">Expectations</th>
              </tr>
            </thead>
            <tbody>
              {dataset.queries.map((q, i) => {
                const meta = q.meta ?? {};
                const isUnclear = meta.expectations_clear === false;
                const row = editRows[q.id];
                const showInputs = editing && row != null;
                return (
                  <tr key={q.id} className="border-b border-white/5">
                    <td className="p-3 text-zinc-500">{i + 1}</td>
                    <td className="p-3 text-sm">
                      {showInputs ? (
                        <input
                          value={row.query_text}
                          onChange={(e) => updateEditRow(q.id, "query_text", e.target.value)}
                          className="w-full rounded bg-white/5 border border-[var(--glass-border)] px-2 py-1 text-sm"
                        />
                      ) : (
                        q.query_text
                      )}
                    </td>
                    <td className="p-3 text-sm text-zinc-400">
                      {showInputs ? (
                        <div className="flex items-start gap-1">
                          <input
                            value={row.expectations}
                            onChange={(e) => updateEditRow(q.id, "expectations", e.target.value)}
                            className="flex-1 min-w-0 rounded bg-white/5 border border-[var(--glass-border)] px-2 py-1 text-sm"
                          />
                        </div>
                      ) : (
                        <span className="inline-flex items-center">
                          {q.expectations ?? "—"}
                          <ExpectationsClearIcon clear={!isUnclear} feedback={meta.expectations_feedback} />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
