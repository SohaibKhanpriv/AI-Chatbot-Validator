"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type PromptOut } from "@/lib/api";

type SeedResult = {
  prompts_seeded: number;
  criteria_seeded: number;
  dataset_queries_seeded: number;
  message?: string;
};

export default function PromptHubPage() {
  const [prompts, setPrompts] = useState<PromptOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [systemRef, setSystemRef] = useState<string>("");
  const [systemRefLoading, setSystemRefLoading] = useState(false);
  const [systemRefSaving, setSystemRefSaving] = useState(false);
  const [systemRefEditing, setSystemRefEditing] = useState(false);
  const [expandedPromptId, setExpandedPromptId] = useState<number | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<PromptOut | null>(null);
  const [savingPromptId, setSavingPromptId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.prompts.list();
      setPrompts(data);
    } catch {
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSystemRef = useCallback(async () => {
    setSystemRefLoading(true);
    try {
      const r = await api.prompts.getSystemBehaviorReference();
      setSystemRef(r.content ?? "");
    } catch {
      setSystemRef("");
    } finally {
      setSystemRefLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadSystemRef();
  }, [load, loadSystemRef]);

  const seed = async () => {
    setSeeding(true);
    setSeedError(null);
    setSeedResult(null);
    try {
      const result = await api.prompts.seed();
      setSeedResult(result);
      await load();
      await loadSystemRef();
    } catch (e) {
      let message = e instanceof Error ? e.message : "Seed failed";
      try {
        const parsed = JSON.parse(message);
        if (typeof parsed.detail === "string") message = parsed.detail;
      } catch {
        // keep original message
      }
      setSeedError(message);
    } finally {
      setSeeding(false);
    }
  };

  const saveSystemRef = async () => {
    setSystemRefSaving(true);
    try {
      await api.prompts.putSystemBehaviorReference(systemRef);
      setSystemRefEditing(false);
    } finally {
      setSystemRefSaving(false);
    }
  };

  const savePrompt = async (p: PromptOut, name: string, body: string) => {
    setSavingPromptId(p.id);
    try {
      await api.prompts.patch(p.id, { name, body });
      await load();
      setEditingPrompt(null);
      setExpandedPromptId(null);
    } finally {
      setSavingPromptId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--neural-primary)]">Prompt Hub</h1>
        <button
          onClick={seed}
          disabled={seeding}
          className="px-4 py-2 rounded-lg bg-[var(--neural-accent)]/20 text-[var(--neural-accent)] border border-[var(--neural-accent)]/50 hover:bg-[var(--neural-accent)]/30 disabled:opacity-50"
        >
          {seeding ? "Seeding..." : "Seed prompts & criteria"}
        </button>
      </div>
      <p className="text-zinc-400 text-sm">
        All processing prompts are stored here. Seed loads default prompts, validation criteria, and the NEURO training dataset (if available).
      </p>
      {seedError && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 text-amber-200 text-sm">
          {seedError}
        </div>
      )}
      {seedResult && (
        <div className="rounded-lg bg-[var(--neural-primary)]/10 border border-[var(--neural-primary)]/30 p-4 text-sm">
          {seedResult.message ?? `Seeded ${seedResult.prompts_seeded} prompts, ${seedResult.criteria_seeded} criteria, ${seedResult.dataset_queries_seeded} dataset queries.`}
          {seedResult.dataset_queries_seeded === 0 && (
            <p className="mt-2 text-zinc-400 text-xs">
              No new dataset was created (NEURO dataset may already exist or YAML is missing). You can still create datasets by parsing text or uploading a file on the Datasets page.
            </p>
          )}
        </div>
      )}

      {/* Global system understanding (reference) */}
      <div className="crystal-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--neural-primary)]">Global system understanding</h2>
        <p className="text-zinc-400 text-sm">
          Reference used by validation and expectation clarity. Injected so the LLM understands the chat system, intents, and response schema.
        </p>
        {systemRefLoading ? (
          <p className="text-zinc-500">Loading...</p>
        ) : systemRefEditing ? (
          <div className="space-y-3">
            <textarea
              value={systemRef}
              onChange={(e) => setSystemRef(e.target.value)}
              rows={16}
              className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--neural-primary)] resize-y"
              placeholder="Markdown or plain text..."
            />
            <div className="flex gap-2">
              <button
                onClick={saveSystemRef}
                disabled={systemRefSaving}
                className="px-4 py-2 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30 disabled:opacity-50"
              >
                {systemRefSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setSystemRefEditing(false)}
                className="px-4 py-2 rounded-lg border border-white/20 text-zinc-400 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap bg-black/20 rounded-lg p-4 max-h-64 overflow-y-auto">
              {systemRef || "(empty — seed or edit to add reference)"}
            </pre>
            <button
              onClick={() => setSystemRefEditing(true)}
              className="px-4 py-2 rounded-lg border border-white/20 text-zinc-400 hover:bg-white/5 text-sm"
            >
              Edit global reference
            </button>
          </div>
        )}
      </div>

      {/* System prompts (list + view/edit) */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--neural-primary)]">System prompts</h2>
        {loading ? (
          <p className="text-zinc-500">Loading...</p>
        ) : prompts.length === 0 ? (
          <div className="crystal-card p-6">
            <p className="text-zinc-500 mb-4">No prompts. Click &quot;Seed prompts & criteria&quot; to load defaults.</p>
            <button
              onClick={seed}
              disabled={seeding}
              className="px-4 py-2 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50"
            >
              Seed
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {prompts.map((p) => (
              <div key={p.id} className="crystal-card overflow-hidden">
                <div
                  className="flex flex-wrap items-center justify-between gap-2 p-4 cursor-pointer hover:bg-white/5"
                  onClick={() => editingPrompt?.id !== p.id && setExpandedPromptId(expandedPromptId === p.id ? null : p.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-[var(--neural-primary)]">{p.key}</span>
                    <span className="text-zinc-200">{p.name}</span>
                    <span className="text-xs text-zinc-500">v{p.version}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPrompt(p);
                      setExpandedPromptId(p.id);
                    }}
                    className="px-3 py-1.5 rounded border border-white/20 text-zinc-400 hover:bg-white/5 text-sm"
                  >
                    Edit
                  </button>
                </div>
                {expandedPromptId === p.id && (
                  <div className="border-t border-white/10 p-4 bg-black/20">
                    {editingPrompt?.id === p.id ? (
                      <PromptEditForm
                        prompt={p}
                        onSave={savePrompt}
                        onCancel={() => setEditingPrompt(null)}
                        saving={savingPromptId === p.id}
                      />
                    ) : (
                      <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono overflow-x-auto">
                        {p.body || "(empty)"}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PromptEditForm({
  prompt,
  onSave,
  onCancel,
  saving,
}: {
  prompt: PromptOut;
  onSave: (p: PromptOut, name: string, body: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(prompt.name);
  const [body, setBody] = useState(prompt.body);
  useEffect(() => {
    setName(prompt.name);
    setBody(prompt.body);
  }, [prompt.id, prompt.name, prompt.body]);
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
        <label className="block text-xs text-zinc-500 mb-1">Body (system prompt)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm font-mono resize-y"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave(prompt, name, body)}
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
