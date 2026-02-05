import Link from "next/link";
import { api } from "@/lib/api";

export default async function DashboardPage() {
  let runs: Awaited<ReturnType<typeof api.runs.list>> = [];
  let error = false;
  try {
    runs = await api.runs.list();
  } catch {
    error = true;
  }
  const recent = runs.slice(0, 5);
  const completed = runs.filter((r) => r.status === "completed");
  const successRate =
    completed.length > 0
      ? completed.reduce((acc, r) => acc + (r.processed_count / (r.total_queries || 1)) * 100, 0) / completed.length
      : 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[var(--neural-primary)]">Dashboard</h1>
      {error && (
        <div className="crystal-card p-4 text-amber-400 text-sm">
          Could not reach API. Ensure backend is running and NEXT_PUBLIC_API_URL is set.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="crystal-card p-5">
          <p className="text-zinc-400 text-sm">Total Runs</p>
          <p className="text-2xl font-bold text-[var(--neural-primary)]">{runs.length}</p>
        </div>
        <div className="crystal-card p-5">
          <p className="text-zinc-400 text-sm">Completed</p>
          <p className="text-2xl font-bold text-[var(--neural-green)]">{completed.length}</p>
        </div>
        <div className="crystal-card p-5">
          <p className="text-zinc-400 text-sm">Avg completion</p>
          <p className="text-2xl font-bold text-[var(--neural-accent)]">{successRate.toFixed(1)}%</p>
        </div>
      </div>
      <div className="crystal-card p-5">
        <h2 className="text-lg font-semibold mb-4 text-zinc-200">Recent Runs</h2>
        {recent.length === 0 ? (
          <p className="text-zinc-500">No runs yet. Create one from the Runs page.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <Link href={`/runs/${r.id}`} className="text-[var(--neural-primary)] hover:underline">
                  {r.name}
                </Link>
                <span className="text-sm text-zinc-400">
                  {r.processed_count}/{r.total_queries} — {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <Link
            href="/runs"
            className="text-sm text-[var(--neural-primary)] hover:underline"
          >
            View all runs →
          </Link>
        </div>
      </div>
    </div>
  );
}
