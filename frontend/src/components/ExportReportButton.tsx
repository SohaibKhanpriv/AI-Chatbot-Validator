"use client";

import { useState, useRef, useEffect } from "react";
import { api, type DeepAnalysis } from "@/lib/api";
import ExcelJS from "exceljs";

const LIGHT_GREEN = "FFD4EDDA";
const LIGHT_YELLOW = "FFFFF3CD";

export type ExportType = "full" | "simple";

function responseDisplay(row: DeepAnalysis["rows"][0]): string {
  if (row.error) return row.error;
  if (row.response_text) return row.response_text;
  if (row.response != null)
    return typeof row.response === "string" ? row.response : JSON.stringify(row.response);
  return "";
}

function setHeaderStyle(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2D3748" },
  };
}

function autoSizeColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    if (col) {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const val = cell.value;
        const len = val != null ? String(val).length : 0;
        if (len > maxLen) maxLen = Math.min(len, 80);
      });
      col.width = maxLen + 1;
    }
  });
}

function buildFullSheet(workbook: ExcelJS.Workbook, data: DeepAnalysis): ExcelJS.Worksheet {
  const { rows, criterion_keys, criterion_names } = data;
  const sheet = workbook.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 1 }] });

  const headerRow = [
    "Query #",
    "Query",
    "Expectations",
    "Response",
    ...criterion_keys.flatMap((ckey) => [
      `${criterion_names[ckey] ?? ckey} (Pass)`,
      `${criterion_names[ckey] ?? ckey} (Score)`,
      `${criterion_names[ckey] ?? ckey} (Reason)`,
    ]),
    "Overall (Pass)",
  ];
  sheet.addRow(headerRow);
  setHeaderStyle(sheet);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const validationByKey = new Map(row.validations.map((v) => [v.criterion_key, v]));
    const cells: (string | number | null)[] = [
      i + 1,
      row.query_text ?? "",
      row.expectations ?? "",
      responseDisplay(row),
    ];
    for (const ckey of criterion_keys) {
      const v = validationByKey.get(ckey);
      cells.push(v?.passed ? "Pass" : "Fail");
      cells.push(v?.score ?? null);
      cells.push(v?.reason ?? "");
    }
    cells.push(row.all_passed ? "Pass" : "Fail");
    const excelRow = sheet.addRow(cells);
    const fillColor = row.all_passed ? LIGHT_GREEN : LIGHT_YELLOW;
    excelRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillColor },
      };
    });
  }

  autoSizeColumns(sheet);
  return sheet;
}

function buildSimpleSheet(workbook: ExcelJS.Workbook, data: DeepAnalysis): ExcelJS.Worksheet {
  const { rows } = data;
  const sheet = workbook.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.addRow(["Query #", "Query", "Expectations", "Response"]);
  setHeaderStyle(sheet);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    sheet.addRow([
      i + 1,
      row.query_text ?? "",
      row.expectations ?? "",
      responseDisplay(row),
    ]);
  }

  autoSizeColumns(sheet);
  return sheet;
}

function downloadReport(
  data: DeepAnalysis,
  runId: number,
  runName: string | undefined,
  type: ExportType
) {
  const workbook = new ExcelJS.Workbook();
  if (type === "full") buildFullSheet(workbook, data);
  else buildSimpleSheet(workbook, data);
  const safeName = (runName || `run-${runId}`).replace(/[^\w\s-]/g, "").trim() || `run-${runId}`;
  const suffix = type === "full" ? "report" : "simple";
  workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}-${suffix}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  });
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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  async function handleExport(type: ExportType) {
    setOpen(false);
    setLoading(true);
    setError(null);
    try {
      const data = await api.reports.getDeepAnalysis(runId);
      if (!data.rows.length) {
        setError("No data to export.");
        return;
      }
      downloadReport(data, runId, runName, type);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2" ref={menuRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled || loading}
          className="px-4 py-2 rounded-lg bg-[var(--neural-green)]/20 text-[var(--neural-green)] border border-[var(--neural-green)]/50 hover:bg-[var(--neural-green)]/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center gap-1.5"
        >
          {loading ? "Exporting…" : "Export"}
          <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 min-w-[240px] rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg py-1 z-50">
            <button
              type="button"
              onClick={() => handleExport("full")}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-[var(--neural-green)]/10 text-[var(--text)] flex flex-col items-start gap-0.5"
            >
              <span className="font-medium">Full report</span>
              <span className="text-xs text-[var(--neural-secondary)]">
                Query, response, expectations, validations &amp; pass/fail
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleExport("simple")}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-[var(--neural-green)]/10 text-[var(--text)] flex flex-col items-start gap-0.5 border-t border-[var(--border)]"
            >
              <span className="font-medium">Simple export</span>
              <span className="text-xs text-[var(--neural-secondary)]">
                Query, response, and expectations only
              </span>
            </button>
          </div>
        )}
      </div>
      {error && <span className="text-sm text-[var(--neural-secondary)]">{error}</span>}
    </div>
  );
}
