"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Dataset } from "@/lib/api";
import DatasetsParser from "@/components/DatasetsParser";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const data = await api.datasets.list();
      setDatasets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load datasets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[var(--neural-primary)]">Datasets</h1>
      <DatasetsParser onCreated={load} />
      {error && (
        <div className="crystal-card p-4 text-amber-400 text-sm">{error}</div>
      )}
      <div className="crystal-card overflow-hidden">
        <h2 className="p-4 border-b border-white/10 text-lg font-semibold">All datasets</h2>
        {loading ? (
          <p className="p-6 text-zinc-500">Loading...</p>
        ) : datasets.length === 0 ? (
          <div className="p-6 text-zinc-500 space-y-2">
            <p>No datasets yet.</p>
            <p className="text-sm">
              Seed the NEURO training dataset from the{" "}
              <Link href="/prompt-hub" className="text-[var(--neural-primary)] hover:underline">
                Prompt Hub
              </Link>{" "}
              (click &quot;Seed prompts & criteria&quot;), or create a new dataset by parsing text or uploading a file above.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {datasets.map((d) => (
              <li key={d.id} className="flex items-center justify-between p-4 hover:bg-white/5">
                <Link href={`/datasets/${d.id}`} className="text-[var(--neural-primary)] hover:underline">
                  {d.name}
                </Link>
                <span className="text-sm text-zinc-400">{d.source_type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
