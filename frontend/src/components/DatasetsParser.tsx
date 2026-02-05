"use client";

import { useState } from "react";
import { api } from "@/lib/api";

type Props = { onCreated: () => void };

export default function DatasetsParser({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [systemBehavior, setSystemBehavior] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.set("name", name || "Parsed dataset");
      form.set("source_type", file ? "file" : "text");
      if (file) form.set("file", file);
      else form.set("raw_content", rawContent);
      if (systemBehavior.trim()) form.set("system_behavior", systemBehavior.trim());
      await api.datasets.parse(form);
      setName("");
      setRawContent("");
      setSystemBehavior("");
      setFile(null);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="crystal-card p-6">
      <h2 className="text-lg font-semibold mb-4">Parse queries & expectations</h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dataset name"
            className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--neural-primary)]"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">File (or paste below)</label>
          <input
            type="file"
            accept=".txt,.csv,.json,.pdf,.docx,text/plain,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-[var(--neural-primary)]/20 file:text-[var(--neural-primary)]"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Or paste raw content</label>
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            placeholder="Paste text with queries and expectations..."
            rows={5}
            className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--neural-primary)] resize-y"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">System behavior (optional)</label>
          <textarea
            value={systemBehavior}
            onChange={(e) => setSystemBehavior(e.target.value)}
            placeholder="Describe what the system is for (used during validation)"
            rows={3}
            className="w-full rounded-lg bg-white/5 border border-[var(--glass-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--neural-primary)] resize-y"
          />
        </div>
        {error && <p className="text-amber-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || (!rawContent && !file)}
          className="px-4 py-2 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Parsing..." : "Parse & save"}
        </button>
      </form>
    </div>
  );
}
