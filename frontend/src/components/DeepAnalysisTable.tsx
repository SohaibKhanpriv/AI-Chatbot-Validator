"use client";

import { Fragment, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, type DeepAnalysis, type QueryValidationRow, type ValidationItem, type ValidationOverrideUpdate } from "@/lib/api";

const MAX_PREVIEW = 80;

function truncate(s: string, max: number = MAX_PREVIEW) {
  if (!s) return "—";
  return s.length <= max ? s : s.slice(0, max) + "…";
}

type LocalOverride = { override_passed?: boolean | null; reviewer_comment?: string | null };

export default function DeepAnalysisTable({ data, runId }: { data: DeepAnalysis; runId: number }) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<Record<string, LocalOverride>>({});
  const [saving, setSaving] = useState(false);
  const { rows, criterion_keys, criterion_names } = data;

  const overrideKey = (messageResponseId: number, criterionKey: string) =>
    `${messageResponseId}:${criterionKey}`;

  const getEffective = (v: ValidationItem, local: LocalOverride | undefined) => {
    const overridePassed = local?.override_passed !== undefined ? local.override_passed : v.override_passed;
    const effectivePassed =
      overridePassed !== undefined && overridePassed !== null ? overridePassed : v.passed;
    const reviewerComment =
      local?.reviewer_comment !== undefined ? local.reviewer_comment : (v.reviewer_comment ?? "");
    return { effectivePassed, overridePassed, reviewerComment };
  };

  const setOverride = useCallback((messageResponseId: number, criterionKey: string, patch: LocalOverride) => {
    const key = overrideKey(messageResponseId, criterionKey);
    setLocalOverrides((prev) => {
      const next = { ...prev[key] };
      for (const [k, val] of Object.entries(patch)) {
        if (val === undefined) delete next[k as keyof LocalOverride];
        else next[k as keyof LocalOverride] = val;
      }
      const out = { ...prev };
      if (Object.keys(next).length === 0) delete out[key];
      else out[key] = next;
      return out;
    });
  }, []);

  const buildUpdates = useCallback((): ValidationOverrideUpdate[] => {
    return Object.entries(localOverrides).map(([key, val]) => {
      const [mrId, ckey] = key.split(":");
      const update: ValidationOverrideUpdate = {
        message_response_id: parseInt(mrId, 10),
        criterion_key: ckey,
      };
      if ("override_passed" in val) update.override_passed = val.override_passed ?? null;
      if ("reviewer_comment" in val) update.reviewer_comment = val.reviewer_comment ?? null;
      return update;
    });
  }, [localOverrides]);

  const handleSave = useCallback(async () => {
    const updates = buildUpdates();
    if (updates.length === 0) return;
    setSaving(true);
    try {
      await api.reports.patchValidationOverrides(runId, updates);
      setLocalOverrides({});
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [runId, buildUpdates, router]);

  const getValidation = (row: QueryValidationRow, ckey: string) =>
    row.validations.find((v) => v.criterion_key === ckey);

  const getDisplayPassed = (row: QueryValidationRow, ckey: string): boolean => {
    const v = getValidation(row, ckey);
    if (!v) return false;
    const local = localOverrides[overrideKey(row.message_response_id, ckey)];
    const { effectivePassed } = getEffective(v, local);
    return effectivePassed;
  };

  const getRowAllPassed = (row: QueryValidationRow): boolean =>
    row.validations.length > 0 &&
    row.validations.every((v) => {
      const local = localOverrides[overrideKey(row.message_response_id, v.criterion_key)];
      const { effectivePassed } = getEffective(v, local);
      return effectivePassed;
    });

  const hasLocalChanges = Object.keys(localOverrides).length > 0;

  return (
    <div className="crystal-card overflow-hidden">
      <div className="flex items-center justify-end gap-2 p-2 border-b border-white/10">
        {editMode ? (
          <>
            <button
              type="button"
              onClick={() => {
                setEditMode(false);
                setLocalOverrides({});
              }}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 rounded border border-white/10 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasLocalChanges || saving}
              className="px-3 py-1.5 text-sm bg-[var(--neural-primary)] text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="px-3 py-1.5 text-sm text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 rounded hover:bg-[var(--neural-primary)]/10"
          >
            Edit
          </button>
        )}
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/20 bg-white/5">
              <th className="p-2 w-8 text-zinc-400 font-medium text-xs">#</th>
              <th className="p-3 min-w-[180px] text-zinc-400 font-medium text-sm">Query</th>
              <th className="p-3 min-w-[140px] text-zinc-400 font-medium text-sm">Expectations</th>
              {criterion_keys.map((ckey) => (
                <th key={ckey} className="p-3 text-zinc-400 font-medium text-sm whitespace-nowrap" title={criterion_names[ckey] ?? ckey}>
                  {criterion_names[ckey] ?? ckey}
                </th>
              ))}
              <th className="p-3 text-zinc-400 font-medium text-sm w-20 bg-[var(--card-bg)] sticky right-10 z-10 border-l border-white/10 shadow-[-4px_0_8px_rgba(0,0,0,0.2)]">Overall</th>
              <th className="p-2 w-10 bg-[var(--card-bg)] sticky right-0 z-10 border-l border-white/10 shadow-[-4px_0_8px_rgba(0,0,0,0.2)]" aria-label="Expand" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isExpanded = expandedId === row.message_response_id;
              return (
                <Fragment key={row.message_response_id}>
                  <tr
                    key={row.message_response_id}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${isExpanded ? "bg-white/5" : ""}`}
                  >
                    <td className="p-2 text-zinc-500 text-sm">{idx + 1}</td>
                    <td className="p-3 text-sm max-w-[220px]" title={row.query_text}>
                      <span className="line-clamp-2">{truncate(row.query_text, 100)}</span>
                    </td>
                    <td className="p-3 text-sm text-zinc-400 max-w-[160px]" title={row.expectations ?? ""}>
                      <span className="inline-flex items-center gap-1">
                        {truncate(row.expectations ?? "", 60)}
                        {row.expectations_clear === false && (
                          <span
                            className="inline-flex text-amber-400 shrink-0"
                            title="Expectations may be unclear"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path
                                fillRule="evenodd"
                                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        )}
                      </span>
                    </td>
                    {criterion_keys.map((ckey) => {
                      const v = getValidation(row, ckey);
                      if (!v)
                        return (
                          <td key={ckey} className="p-3 text-zinc-600 text-sm">
                            —
                          </td>
                        );
                      const displayPassed = getDisplayPassed(row, ckey);
                      return (
                        <td key={ckey} className="p-3" title={v.reason ?? undefined}>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                              displayPassed
                                ? "bg-[var(--neural-green)]/20 text-[var(--neural-green)]"
                                : "bg-[var(--neural-secondary)]/20 text-[var(--neural-secondary)]"
                            }`}
                          >
                            {displayPassed ? "Pass" : "Fail"}
                            {v.score != null && (
                              <span className="opacity-80">({v.score})</span>
                            )}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-3 bg-[var(--card-bg)] sticky right-10 z-10 border-l border-white/10 shadow-[-4px_0_8px_rgba(0,0,0,0.2)]">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          getRowAllPassed(row)
                            ? "bg-[var(--neural-green)]/20 text-[var(--neural-green)]"
                            : "bg-[var(--neural-secondary)]/20 text-[var(--neural-secondary)]"
                        }`}
                      >
                        {getRowAllPassed(row) ? "Pass" : "Fail"}
                      </span>
                    </td>
                    <td className="p-2 bg-[var(--card-bg)] sticky right-0 z-10 border-l border-white/10 shadow-[-4px_0_8px_rgba(0,0,0,0.2)]">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : row.message_response_id)
                        }
                        className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-[var(--neural-primary)] transition-colors"
                        aria-expanded={isExpanded}
                        title={isExpanded ? "Collapse" : "Expand details"}
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${row.message_response_id}-detail`} className="bg-black/20 border-b border-white/10">
                      <td colSpan={4 + criterion_keys.length + 2} className="p-6">
                        <div className="grid gap-6 md:grid-cols-1">
                          <div>
                            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Query</h4>
                            <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words bg-white/5 p-4 rounded-lg">
                              {row.query_text || "—"}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Expectations</h4>
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words bg-white/5 p-4 rounded-lg">
                              {row.expectations || "—"}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Response</h4>
                            <div className="text-sm text-zinc-300 whitespace-pre-wrap break-words bg-white/5 p-4 rounded-lg max-h-64 overflow-y-auto font-mono">
                              {row.error ? (
                                <span className="text-[var(--neural-secondary)]">{row.error}</span>
                              ) : row.response != null && typeof row.response === "object" ? (
                                <pre className="text-xs">
                                  {JSON.stringify(row.response, null, 2)}
                                </pre>
                              ) : (
                                (typeof row.response === "string" ? row.response : row.response_text) || "—"
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Validations</h4>
                            <ul className="space-y-3">
                              {row.validations.map((v) => {
                                const local = localOverrides[overrideKey(row.message_response_id, v.criterion_key)];
                                const { effectivePassed, overridePassed, reviewerComment } = getEffective(v, local);
                                const hasOverride = overridePassed !== undefined && overridePassed !== null;
                                return (
                                  <li
                                    key={v.criterion_key}
                                    className={`p-3 rounded-lg border ${
                                      effectivePassed
                                        ? "border-[var(--neural-green)]/30 bg-[var(--neural-green)]/5"
                                        : "border-[var(--neural-secondary)]/30 bg-[var(--neural-secondary)]/5"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <span className="font-medium text-sm">{v.criterion_name}</span>
                                      <span
                                        className={`text-xs font-medium ${
                                          effectivePassed ? "text-[var(--neural-green)]" : "text-[var(--neural-secondary)]"
                                        }`}
                                      >
                                        {effectivePassed ? "Pass" : "Fail"}
                                        {v.score != null && ` (${v.score})`}
                                      </span>
                                    </div>
                                    {v.reason && (
                                      <p className="text-xs text-zinc-400 mt-2">{v.reason}</p>
                                    )}
                                    {editMode && (
                                      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                                        <label className="flex items-center gap-2 text-sm">
                                          <input
                                            type="checkbox"
                                            checked={hasOverride}
                                            onChange={(e) =>
                                              setOverride(row.message_response_id, v.criterion_key, {
                                                override_passed: e.target.checked ? effectivePassed : null,
                                              })
                                            }
                                            className="rounded border-white/20"
                                          />
                                          Override (e.g. does not apply / falsely validated)
                                        </label>
                                        {hasOverride && (
                                          <div className="flex items-center gap-2 text-sm">
                                            <span className="text-zinc-500">Mark as:</span>
                                            <label className="inline-flex items-center gap-1">
                                              <input
                                                type="radio"
                                                name={`${row.message_response_id}:${v.criterion_key}:pass`}
                                                checked={effectivePassed}
                                                onChange={() =>
                                                  setOverride(row.message_response_id, v.criterion_key, {
                                                    override_passed: true,
                                                  })
                                                }
                                                className="rounded border-white/20"
                                              />
                                              Pass
                                            </label>
                                            <label className="inline-flex items-center gap-1">
                                              <input
                                                type="radio"
                                                name={`${row.message_response_id}:${v.criterion_key}:pass`}
                                                checked={!effectivePassed}
                                                onChange={() =>
                                                  setOverride(row.message_response_id, v.criterion_key, {
                                                    override_passed: false,
                                                  })
                                                }
                                                className="rounded border-white/20"
                                              />
                                              Fail
                                            </label>
                                          </div>
                                        )}
                                        <div>
                                          <label className="block text-xs text-zinc-500 mb-1">Comment</label>
                                          <textarea
                                            value={reviewerComment ?? ""}
                                            onChange={(e) =>
                                              setOverride(row.message_response_id, v.criterion_key, {
                                                reviewer_comment: e.target.value || null,
                                              })
                                            }
                                            placeholder="e.g. N/A - does not apply; or note on incorrect validation"
                                            className="w-full text-sm bg-black/20 border border-white/10 rounded px-2 py-1.5 text-zinc-200 placeholder-zinc-500 min-h-[60px]"
                                            rows={2}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="p-12 text-center text-zinc-500">
          No responses or validations for this run yet.
        </div>
      )}
    </div>
  );
}
