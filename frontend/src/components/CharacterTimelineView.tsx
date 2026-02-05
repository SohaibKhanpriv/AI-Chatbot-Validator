"use client";

import { useState, useMemo } from "react";
import type { CharacterTimeline, QueryTimelineItem } from "@/lib/api";

const QUERY_COL_WIDTH = 56;
const CHAR_COL_MIN_WIDTH = 88;

const CHARACTER_COLORS = [
  "var(--neural-primary)",
  "var(--neural-green)",
  "var(--neural-secondary)",
  "var(--neural-accent)",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
];
function colorForCharacterIndex(index: number): string {
  return CHARACTER_COLORS[index % CHARACTER_COLORS.length];
}

function useCharacterColumns(items: QueryTimelineItem[]): string[] {
  return useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const ch of item.chunks) {
        if (ch.avatar?.trim()) set.add(ch.avatar.trim());
      }
    }
    return Array.from(set).sort();
  }, [items]);
}

function hasAvatar(item: QueryTimelineItem, avatar: string): boolean {
  return item.chunks.some((ch) => ch.avatar === avatar);
}

function rowsWithNodeForCharacter(items: QueryTimelineItem[], avatar: string): Set<number> {
  const set = new Set<number>();
  items.forEach((item, idx) => {
    if (hasAvatar(item, avatar)) set.add(idx);
  });
  return set;
}

function QueryCell({
  item,
  onShowTooltip,
  onHideTooltip,
  showTooltip,
  queryText,
}: {
  item: QueryTimelineItem;
  onShowTooltip: () => void;
  onHideTooltip: () => void;
  showTooltip: boolean;
  queryText: string;
}) {
  return (
    <div
      className="relative sticky left-0 z-20 flex items-center justify-center shrink-0 border-r border-white/10 bg-[var(--card-bg)] pr-2"
      style={{ width: QUERY_COL_WIDTH, minWidth: QUERY_COL_WIDTH }}
    >
      <div
        className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--neural-primary)]/20 text-[var(--neural-primary)] font-semibold text-sm cursor-default border-2 border-[var(--neural-primary)]/50 hover:bg-[var(--neural-primary)]/30 transition-colors"
        onMouseEnter={onShowTooltip}
        onMouseLeave={onHideTooltip}
      >
        {item.query_index}
      </div>
      {showTooltip && (
        <div
          className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 min-w-[220px] max-w-[420px] p-3 rounded-lg bg-[var(--card-bg)] border border-white/20 shadow-xl text-sm text-zinc-200 whitespace-pre-wrap"
          style={{ marginLeft: QUERY_COL_WIDTH + 12 }}
          role="tooltip"
        >
          {queryText || "—"}
        </div>
      )}
    </div>
  );
}

function CharacterCell({
  hasNode,
  inTimelineRange,
  color,
  responseText,
}: {
  hasNode: boolean;
  inTimelineRange: boolean;
  color: string;
  responseText: string | null;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="relative flex items-center justify-center min-h-[56px] py-2">
      {inTimelineRange && (
        <div
          className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 rounded opacity-60"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {hasNode && (
        <div
          className="relative z-10 shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-default bg-white/10"
          style={{ borderColor: color }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {showTooltip && responseText != null && responseText !== "" && (
            <div
              className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-50 min-w-[240px] max-w-[400px] max-h-[280px] overflow-y-auto p-3 rounded-lg bg-[var(--card-bg)] border border-white/20 shadow-xl text-sm text-zinc-200 whitespace-pre-wrap"
              role="tooltip"
            >
              {responseText}
            </div>
          )}
          {showTooltip && (responseText == null || responseText === "") && (
            <div
              className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-50 px-2 py-1 rounded text-xs text-zinc-500"
              role="tooltip"
            >
              No response text
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CharacterTimelineView({ timeline }: { timeline: CharacterTimeline }) {
  const items = timeline.items;
  const characterColumns = useCharacterColumns(items);
  const [tooltipItemId, setTooltipItemId] = useState<number | null>(null);

  const rowsWithNodeByChar = useMemo(() => {
    const map = new Map<string, Set<number>>();
    characterColumns.forEach((avatar) => {
      map.set(avatar, rowsWithNodeForCharacter(items, avatar));
    });
    return map;
  }, [items, characterColumns]);

  const rangeByChar = useMemo(() => {
    const map = new Map<string, { min: number; max: number }>();
    characterColumns.forEach((avatar) => {
      const rows = rowsWithNodeByChar.get(avatar);
      if (!rows || rows.size === 0) return;
      const indices = Array.from(rows);
      map.set(avatar, { min: Math.min(...indices), max: Math.max(...indices) });
    });
    return map;
  }, [characterColumns, rowsWithNodeByChar]);

  if (characterColumns.length === 0) {
    return (
      <div className="crystal-card overflow-hidden">
        <h2 className="p-4 border-b border-white/10 text-lg font-semibold text-[var(--neural-primary)]">
          {timeline.run_name || `Run ${timeline.run_id}`}
        </h2>
        <div className="p-8 text-center text-zinc-500">No avatar data for this run.</div>
      </div>
    );
  }

  return (
    <div className="crystal-card overflow-hidden">
      <h2 className="p-4 border-b border-white/10 text-lg font-semibold text-[var(--neural-primary)]">
        {timeline.run_name || `Run ${timeline.run_id}`}
      </h2>
      <div className="max-h-[70vh] overflow-auto scrollbar-thin">
        {/* Header row */}
        <div className="flex border-b border-white/10 bg-white/5 sticky top-0 z-10">
          <div
            className="sticky left-0 z-20 shrink-0 border-r border-white/10 bg-white/5 px-2 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider"
            style={{ width: QUERY_COL_WIDTH, minWidth: QUERY_COL_WIDTH }}
          >
            Query
          </div>
          {characterColumns.map((avatar, charIdx) => (
            <div
              key={avatar}
              className="flex items-center justify-center shrink-0 px-2 py-3 text-sm font-medium border-b border-white/5 truncate"
              style={{
                minWidth: CHAR_COL_MIN_WIDTH,
                color: colorForCharacterIndex(charIdx),
              }}
              title={avatar}
            >
              {avatar.length > 12 ? `${avatar.slice(0, 10)}…` : avatar}
            </div>
          ))}
        </div>
        {/* Data rows */}
        {items.map((item, rowIdx) => (
          <div
            key={item.message_response_id}
            className="flex border-b border-white/5 hover:bg-white/[0.02] min-h-[56px]"
          >
            <QueryCell
              item={item}
              onShowTooltip={() => setTooltipItemId(item.message_response_id)}
              onHideTooltip={() => setTooltipItemId(null)}
              showTooltip={tooltipItemId === item.message_response_id}
              queryText={item.query_text}
            />
            {characterColumns.map((avatar, charIdx) => {
              const rowsWithNode = rowsWithNodeByChar.get(avatar) ?? new Set();
              const range = rangeByChar.get(avatar);
              const hasNode = rowsWithNode.has(rowIdx);
              const inTimelineRange =
                range != null && rowIdx >= range.min && rowIdx <= range.max;
              return (
                <div
                  key={avatar}
                  className="flex flex-col shrink-0 border-r border-white/5"
                  style={{ minWidth: CHAR_COL_MIN_WIDTH }}
                >
                  <CharacterCell
                    hasNode={hasNode}
                    inTimelineRange={inTimelineRange}
                    color={colorForCharacterIndex(charIdx)}
                    responseText={item.response_text ?? null}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
