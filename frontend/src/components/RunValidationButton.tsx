"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Run } from "@/lib/api";

const POLL_INTERVAL_MS = 2000;

export default function RunValidationButton({
  runId,
  run: initialRun,
}: {
  runId: number;
  run: Run;
}) {
  const router = useRouter();
  const [run, setRun] = useState<Run>(initialRun);
  const [loading, setLoading] = useState(false);

  const isCompleted = run.status === "completed";
  const isValidationRunning = run.validation_status === "running";
  const canStartValidation =
    isCompleted && !isValidationRunning;
  const showValidating = isCompleted && isValidationRunning;

  async function handleStartValidation() {
    if (!canStartValidation || loading) return;
    setLoading(true);
    try {
      const updated = await api.runs.startValidation(runId);
      setRun(updated);
      if (updated.validation_status === "running") {
        pollUntilDone();
      } else {
        setLoading(false);
        router.refresh();
      }
    } catch {
      setLoading(false);
    }
  }

  function pollUntilDone() {
    const interval = setInterval(async () => {
      try {
        const updated = await api.runs.get(runId);
        setRun(updated);
        if (updated.validation_status !== "running") {
          clearInterval(interval);
          setLoading(false);
          router.refresh();
        }
      } catch {
        clearInterval(interval);
        setLoading(false);
      }
    }, POLL_INTERVAL_MS);
  }

  if (!isCompleted) return null;

  if (showValidating || loading) {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 cursor-default">
        <span className="inline-block w-4 h-4 border-2 border-[var(--neural-primary)] border-t-transparent rounded-full animate-spin" />
        Validating…
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleStartValidation}
      disabled={!canStartValidation}
      className="px-4 py-2 rounded-lg bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] border border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {run.validation_status === "completed" || run.validation_status === "failed"
        ? "Re-run validation"
        : "Run validation"}
    </button>
  );
}
