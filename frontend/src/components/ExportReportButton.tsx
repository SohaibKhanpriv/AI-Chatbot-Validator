"use client";

import { useState } from "react";
import { api, type DeepAnalysis } from "@/lib/api";
import * as XLSX from "xlsx";

function buildSheet(data: DeepAnalysis): XLSX.WorkSheet {
  const { rows, criterion_keys, criterion_names } = data;
  const headers = [
    "Query #",
    "Query",
    "Expectations",
    ...criterion_keys.flatMap((ckey) => [
      `${criterion_names[ckey] ?? ckey} (score)`,
      `${criterion_names[ckey] ?? ckey} (pass)`,
    ]),
    "Overall (pass)",
  ];
  const sheetData: (string | number | null)[][] = [headers];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const validationByKey = new Map(row.validations.map((v) => [v.criterion_key, v]));
    const cells: (string | number | null)[] = [
      i + 1,
      row.query_text ?? "",
      row.expectations ?? "",
    ];
    for (const ckey of criterion_keys) {
      const v = validationByKey.get(ckey);
      cells.push(v?.score ?? null);
      cells.push(v?.passed ? "Pass" : "Fail");
    }
    cells.push(row.all_passed ? "Pass" : "Fail");
    sheetData.push(cells);
  }
  return XLSX.utils.aoa_to_sheet(sheetData);
}

function downloadWorkbook(data: DeepAnalysis, runId: number, runName?: string) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  const safeName = (runName || `run-${runId}`).replace(/[^\w\s-]/g, "").trim() || `run-${runId}`;
  XLSX.writeFile(wb, `${safeName}-report.xlsx`);
}

export default function ExportReportButton({
  runId,
  runName,
  disabled,
}: {
  runId: number;
  runName?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.reports.getDeepAnalysis(runId);
      if (!data.rows.length) {
        setError("No data to export.");
        return;
      }
      downloadWorkbook(data, runId, runName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={disabled || loading}
        className="px-4 py-2 rounded-lg bg-[var(--neural-green)]/20 text-[var(--neural-green)] border border-[var(--neural-green)]/50 hover:bg-[var(--neural-green)]/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {loading ? "Exporting…" : "Export report"}
      </button>
      {error && <span className="text-sm text-[var(--neural-secondary)]">{error}</span>}
    </div>
  );
}
