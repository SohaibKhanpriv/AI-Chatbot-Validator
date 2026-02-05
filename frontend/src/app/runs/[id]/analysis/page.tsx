import { api } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import DeepAnalysisTable from "@/components/DeepAnalysisTable";

export default async function DeepAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const runId = parseInt(id, 10);
  if (Number.isNaN(runId)) notFound();
  let analysis;
  try {
    analysis = await api.reports.getDeepAnalysis(runId);
  } catch {
    notFound();
  }
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/runs/${runId}`}
          className="text-[var(--neural-primary)] hover:underline text-sm"
        >
          ← Run detail
        </Link>
        <Link
          href={`/runs/${runId}/report`}
          className="text-zinc-400 hover:text-[var(--neural-primary)] text-sm"
        >
          Summary report
        </Link>
        <h1 className="text-2xl font-bold text-[var(--neural-primary)]">
          Deep analysis: {analysis.run_name}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="crystal-card p-5">
          <p className="text-zinc-400 text-sm">Success rate</p>
          <p className="text-3xl font-bold text-[var(--neural-green)]">
            {analysis.success_rate_pct.toFixed(1)}%
          </p>
        </div>
        <div className="crystal-card p-5">
          <p className="text-zinc-400 text-sm">Passed (all criteria)</p>
          <p className="text-3xl font-bold text-[var(--neural-primary)]">
            {analysis.success_count} / {analysis.responses_count}
          </p>
        </div>
        <div className="crystal-card p-5">
          <p className="text-zinc-400 text-sm">Total queries</p>
          <p className="text-3xl font-bold">{analysis.total_queries}</p>
        </div>
        <div className="crystal-card p-5">
          <p className="text-zinc-400 text-sm">Criteria</p>
          <p className="text-xl font-bold">
            {analysis.criterion_keys.length}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4 text-zinc-200">
          Validations per query
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Each row is one query. Expand a row to see full query text, expectations, response, and validation reasons.
        </p>
        <DeepAnalysisTable data={analysis} runId={runId} />
      </div>
    </div>
  );
}
