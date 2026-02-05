import { api } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import ExportReportButton from "@/components/ExportReportButton";

export default async function RunReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runId = parseInt(id, 10);
  if (Number.isNaN(runId)) notFound();
  let report;
  try {
    report = await api.reports.get(runId);
  } catch {
    notFound();
  }
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link href={`/runs/${runId}`} className="text-[var(--neural-primary)] hover:underline text-sm">
          ← Run detail
        </Link>
        <Link
          href={`/runs/${runId}/analysis`}
          className="px-3 py-1.5 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30 text-sm"
        >
          Deep analysis
        </Link>
        {report.responses_count > 0 && (
          <ExportReportButton runId={runId} disabled={false} />
        )}
        <h1 className="text-2xl font-bold text-[var(--neural-primary)]">Run report</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="crystal-card p-5">
          <p className="text-zinc-400 text-sm">Success rate</p>
          <p className="text-3xl font-bold text-[var(--neural-green)]">{report.success_rate_pct.toFixed(1)}%</p>
        </div>
        <div className="crystal-card p-5">
          <p className="text-zinc-400 text-sm">Passed (all criteria)</p>
          <p className="text-3xl font-bold text-[var(--neural-primary)]">
            {report.success_count} / {report.responses_count}
          </p>
        </div>
        <div className="crystal-card p-5">
          <p className="text-zinc-400 text-sm">Total queries</p>
          <p className="text-3xl font-bold">{report.total_queries}</p>
        </div>
      </div>
      <div className="crystal-card p-6">
        <h2 className="text-lg font-semibold mb-4">Per criterion</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-3 text-sm text-zinc-400 font-medium">Criterion</th>
                <th className="p-3 text-sm text-zinc-400 font-medium">Passed</th>
                <th className="p-3 text-sm text-zinc-400 font-medium">Total</th>
                <th className="p-3 text-sm text-zinc-400 font-medium">Pass rate</th>
                <th className="p-3 text-sm text-zinc-400 font-medium">Avg score</th>
              </tr>
            </thead>
            <tbody>
              {report.per_criterion.map((c) => (
                <tr key={c.criterion_key} className="border-b border-white/5">
                  <td className="p-3 font-medium">{c.criterion_key}</td>
                  <td className="p-3">{c.passed_count}</td>
                  <td className="p-3">{c.total_count}</td>
                  <td className="p-3 text-[var(--neural-primary)]">{c.pass_rate_pct.toFixed(1)}%</td>
                  <td className="p-3">{c.avg_score != null ? c.avg_score.toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.per_criterion.length === 0 && (
          <p className="p-4 text-zinc-500 text-sm">No validation results yet.</p>
        )}
      </div>
    </div>
  );
}
