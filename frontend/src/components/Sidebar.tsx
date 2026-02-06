"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, type Run } from "@/lib/api";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/datasets", label: "Datasets" },
  { href: "/runs", label: "Runs" },
  { href: "/character-timeline", label: "Character timeline" },
  { href: "/prompt-hub", label: "Prompt Hub" },
  { href: "/criteria", label: "Validation Criteria" },
];

const POLL_INTERVAL_MS = 4000;

function BackgroundTasksList() {
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchRuns = async () => {
      try {
        const list = await api.runs.list();
        if (!cancelled) setRuns(list);
      } catch {
        if (!cancelled) setRuns([]);
      }
    };
    fetchRuns();
    const interval = setInterval(() => {
      fetchRuns();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const runningRuns = runs.filter((r) => r.status === "running");
  const validatingRuns = runs.filter((r) => r.validation_status === "running");
  const hasTasks = runningRuns.length > 0 || validatingRuns.length > 0;

  if (!hasTasks) return null;

  return (
    <div className="p-2 border-t border-[var(--glass-border)]">
      <p className="px-3 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        Background tasks
      </p>
      <ul className="space-y-1 mt-1">
        {runningRuns.map((r) => (
          <li key={r.id}>
            <Link
              href={`/runs/${r.id}`}
              className="block px-3 py-2 rounded-lg text-sm text-[var(--neural-primary)] bg-[var(--neural-primary)]/10 truncate"
              title={r.name}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--neural-primary)] animate-pulse mr-2 align-middle" />
              Run: {r.name}
            </Link>
          </li>
        ))}
        {validatingRuns.map((r) => (
          <li key={`v-${r.id}`}>
            <Link
              href={`/runs/${r.id}/report`}
              className="block px-3 py-2 rounded-lg text-sm text-[var(--neural-accent)] bg-[var(--neural-accent)]/10 truncate"
              title={r.name}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--neural-accent)] animate-pulse mr-2 align-middle" />
              Validating: {r.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen glass border-r border-[var(--glass-border)] flex flex-col transition-[width] duration-200 ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <div className={`flex items-center border-b border-[var(--glass-border)] shrink-0 ${collapsed ? "justify-center p-2" : "p-5"}`}>
        {collapsed ? (
          <span className="text-xs font-bold bg-gradient-to-r from-[var(--neural-primary)] to-[var(--neural-secondary)] bg-clip-text text-transparent">
            AI
          </span>
        ) : (
          <h1 className="text-lg font-bold bg-gradient-to-r from-[var(--neural-primary)] via-[var(--neural-accent)] to-[var(--neural-secondary)] bg-clip-text text-transparent">
            AI Validation
          </h1>
        )}
      </div>
      {!collapsed && (
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map(({ href, label }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`block px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? "link-active text-[var(--neural-primary)]" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
      {!collapsed && <BackgroundTasksList />}
      <div className="p-2 border-t border-[var(--glass-border)]">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-[var(--neural-primary)] transition-colors"
          title={collapsed ? "Expand menu" : "Collapse menu"}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.19 12l-3.03 3.03a.75.75 0 001.06 1.06l4.5-4.5a.75.75 0 000-1.06l-4.5-4.5a.75.75 0 10-1.06 1.06L11.19 12H4.5a.75.75 0 000 1.5h6.69z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12.81 12l3.03-3.03a.75.75 0 10-1.06-1.06l-4.5 4.5a.75.75 0 000 1.06l4.5 4.5a.75.75 0 001.06-1.06L12.81 12H19.5a.75.75 0 000-1.5h-6.69z" />
            </svg>
          )}
        </button>
      </div>
    </aside>
  );
}
