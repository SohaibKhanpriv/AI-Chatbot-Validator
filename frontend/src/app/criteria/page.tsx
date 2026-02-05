"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type ValidationCriterionOut } from "@/lib/api";

export default function CriteriaPage() {
  const [criteria, setCriteria] = useState<ValidationCriterionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.prompts.criteria();
      setCriteria(data);
    } catch {
      setCriteria([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveCriterion = async (
    id: number,
    patch: Partial<Pick<ValidationCriterionOut, "name" | "description" | "prompt_key" | "active" | "sort_order" | "applies_to_all" | "additional_info">>
  ) => {
    setSavingId(id);
    try {
      await api.prompts.patchCriterion(id, patch);
      await load();
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[var(--neural-primary)]">Validation criteria</h1>
      <p className="text-zinc-400 text-sm">
        Pre-read criteria used for validation. These are evaluated in batches of 50. Seed from Prompt Hub if empty. Edit to add more detail (e.g. additional_info) or change applies_to_all.
      </p>
      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : criteria.length === 0 ? (
        <div className="crystal-card p-6 space-y-3">
          <p className="text-zinc-500">No criteria. Seed prompts and validation criteria from the Prompt Hub, then refresh this page.</p>
          <Link
            href="/prompt-hub"
            className="inline-block px-4 py-2 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30"
          >
            Open Prompt Hub and seed
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {criteria.map((c) => (
            <div key={c.id} className="crystal-card p-5">
              {editingId === c.id ? (
                <CriterionEditForm
                  c={c}
                  onSave={saveCriterion}
                  onCancel={() => setEditingId(null)}
                  saving={savingId === c.id}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-[var(--neural-primary)]">{c.key}</span>
                    <div className="flex items-center gap-2">
                      {c.applies_to_all !== false && (
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--neural-primary)]/20 text-[var(--neural-primary)]">
                          Applies to all
                        </span>
                      )}
                      {c.active ? (
                        <span className="text-xs text-[var(--neural-green)]">Active</span>
                      ) : (
                        <span className="text-xs text-zinc-500">Inactive</span>
                      )}
                      <button
                        onClick={() => setEditingId(c.id)}
                        className="px-3 py-1.5 rounded border border-white/20 text-zinc-400 hover:bg-white/5 text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-zinc-200">{c.name}</h3>
                  {c.description && <p className="text-sm text-zinc-400 mt-1">{c.description}</p>}
                  {c.additional_info && (
                    <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-xs text-zinc-500">Additional info:</span>
                      <p className="text-sm text-zinc-300 mt-1">{c.additional_info}</p>
                    </div>
                  )}
                  {c.prompt_key && (
                    <p className="text-xs text-zinc-500 mt-2">Prompt: {c.prompt_key}</p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CriterionEditForm({
  c,
  onSave,
  onCancel,
  saving,
}: {
  c: ValidationCriterionOut;
  onSave: (id: number, patch: Parameters<typeof api.prompts.patchCriterion>[1]) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description ?? "");
  const [prompt_key, setPromptKey] = useState(c.prompt_key ?? "");
  const [active, setActive] = useState(c.active);
  const [sort_order, setSortOrder] = useState(c.sort_order);
  const [applies_to_all, setAppliesToAll] = useState(c.applies_to_all !== false);
  const [additional_info, setAdditionalInfo] = useState(c.additional_info ?? "");

  useEffect(() => {
    setName(c.name);
    setDescription(c.description ?? "");
    setPromptKey(c.prompt_key ?? "");
    setActive(c.active);
    setSortOrder(c.sort_order);
    setAppliesToAll(c.applies_to_all !== false);
    setAdditionalInfo(c.additional_info ?? "");
  }, [c.id]);

  const handleSave = () => {
    onSave(c.id, {
      name,
      description: description || null,
      prompt_key: prompt_key || null,
      active,
      sort_order,
      applies_to_all,
      additional_info: additional_info.trim() || null,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm resize-y"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Additional info (extra context for this criterion)</label>
        <textarea
          value={additional_info}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          rows={2}
          placeholder="Optional: what to emphasize when evaluating this criterion"
          className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm resize-y"
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Prompt key</label>
          <input
            value={prompt_key}
            onChange={(e) => setPromptKey(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm min-w-[180px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded" />
            <span className="text-sm">Active</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={applies_to_all} onChange={(e) => setAppliesToAll(e.target.checked)} className="rounded" />
            <span className="text-sm">Applies to all queries</span>
          </label>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Sort order</label>
          <input
            type="number"
            value={sort_order}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            className="w-20 rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-white/20 text-zinc-400 hover:bg-white/5">
          Cancel
        </button>
      </div>
    </div>
  );
}
