const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function fetcher<T>(path: string, options?: RequestInit): Promise<T> {
  const url = getApiUrl(path);
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`API request failed (${url}): ${msg}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type Dataset = {
  id: number;
  name: string;
  source_type: string;
  created_at: string;
  system_behavior?: string | null;
};
export type QueryOut = {
  id: number;
  dataset_id: number;
  query_text: string;
  expectations: string | null;
  meta?: { expectations_clear?: boolean; expectations_feedback?: string } | null;
};
export type DatasetWithQueries = Dataset & { queries: QueryOut[] };
export type Run = {
  id: number;
  name: string;
  dataset_id: number;
  api_url: string;
  new_thread_per_query: boolean;
  total_queries: number;
  processed_count: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};
export type Progress = { processed: number; total: number; status: string; remaining: number };
export type PromptOut = { id: number; key: string; name: string; body: string; version: number; created_at: string };
export type ValidationCriterionOut = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  prompt_key: string | null;
  active: boolean;
  sort_order: number;
  applies_to_all: boolean;
  additional_info: string | null;
};
export type CriterionSummary = {
  criterion_key: string;
  passed_count: number;
  total_count: number;
  pass_rate_pct: number;
  avg_score: number | null;
};
export type RunReport = {
  run_id: number;
  total_queries: number;
  responses_count: number;
  success_count: number;
  success_rate_pct: number;
  per_criterion: CriterionSummary[];
};

export type ValidationItem = {
  criterion_key: string;
  criterion_name: string;
  passed: boolean;
  score: number | null;
  reason: string | null;
  override_passed?: boolean | null;
  reviewer_comment?: string | null;
};

export type ValidationOverrideUpdate = {
  message_response_id: number;
  criterion_key: string;
  override_passed?: boolean | null;
  reviewer_comment?: string | null;
};

export type QueryValidationRow = {
  message_response_id: number;
  query_text: string;
  expectations: string | null;
  expectations_clear?: boolean | null;
  response_text: string | null;
  /** Full response object (e.g. text, character, actions) when available; else same as response_text */
  response?: string | Record<string, unknown> | null;
  error: string | null;
  validations: ValidationItem[];
  all_passed: boolean;
};

export type DeepAnalysis = {
  run_id: number;
  run_name: string;
  total_queries: number;
  responses_count: number;
  success_count: number;
  success_rate_pct: number;
  criterion_keys: string[];
  criterion_names: Record<string, string>;
  rows: QueryValidationRow[];
};

export type TimelineChunk = { order: number; avatar: string };
export type QueryTimelineItem = {
  query_index: number;
  query_text: string;
  message_response_id: number;
  response_text?: string | null;
  chunks: TimelineChunk[];
};
export type CharacterTimeline = {
  run_id: number;
  run_name: string;
  items: QueryTimelineItem[];
};

export const api = {
  datasets: {
    list: () => fetcher<Dataset[]>("/datasets"),
    get: (id: number) => fetcher<DatasetWithQueries>(`/datasets/${id}`),
    parse: (form: FormData) =>
      fetch(`${API_BASE}/datasets/parse`, { method: "POST", body: form }).then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json() as Promise<DatasetWithQueries>;
      }),
    patch: (id: number, body: { name?: string; system_behavior?: string | null }) =>
      fetcher<Dataset>(`/datasets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    evaluateExpectations: (id: number) =>
      fetcher<{ clear_count: number; unclear_count: number }>(`/datasets/${id}/evaluate-expectations`, {
        method: "POST",
      }),
    createQuery: (datasetId: number, body: { query_text?: string; expectations?: string | null }) =>
      fetcher<QueryOut>(`/datasets/${datasetId}/queries`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchQuery: (datasetId: number, queryId: number, body: { query_text?: string; expectations?: string | null }) =>
      fetcher<QueryOut>(`/datasets/${datasetId}/queries/${queryId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    reorderQueries: (datasetId: number, queryIds: number[]) =>
      fetcher<DatasetWithQueries>(`/datasets/${datasetId}/queries/reorder`, {
        method: "PUT",
        body: JSON.stringify({ query_ids: queryIds }),
      }),
    delete: (id: number) => fetcher<{ ok: boolean }>(`/datasets/${id}`, { method: "DELETE" }),
  },
  runs: {
    list: () => fetcher<Run[]>("/runs"),
    get: (id: number) => fetcher<Run>(`/runs/${id}`),
    create: (body: {
      name: string;
      dataset_id: number;
      api_url: string;
      auth_token: string;
      new_thread_per_query?: boolean;
      query_limit?: number | null;
      criterion_keys?: string[] | null;
    }) => fetcher<Run>("/runs", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: number) => fetcher<{ ok: boolean }>(`/runs/${id}`, { method: "DELETE" }),
  },
  progress: (runId: number) => fetcher<Progress>(`/runs/${runId}/progress`),
  prompts: {
    list: () => fetcher<PromptOut[]>("/prompts"),
    get: (id: number) => fetcher<PromptOut>(`/prompts/${id}`),
    patch: (id: number, body: { name?: string; body?: string }) =>
      fetcher<PromptOut>(`/prompts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    criteria: () => fetcher<ValidationCriterionOut[]>("/prompts/criteria"),
    patchCriterion: (id: number, body: Partial<Pick<ValidationCriterionOut, "name" | "description" | "prompt_key" | "active" | "sort_order" | "applies_to_all" | "additional_info">>) =>
      fetcher<ValidationCriterionOut>(`/prompts/criteria/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    getSystemBehaviorReference: () => fetcher<{ content: string }>("/prompts/system-behavior-reference"),
    putSystemBehaviorReference: (content: string) =>
      fetcher<{ content: string }>("/prompts/system-behavior-reference", {
        method: "PUT",
        body: JSON.stringify({ content }),
      }),
    seed: () =>
      fetcher<{ prompts_seeded: number; criteria_seeded: number; dataset_queries_seeded: number; message?: string }>(
        "/prompts/seed",
        { method: "POST" }
      ),
  },
  reports: {
    get: (runId: number) => fetcher<RunReport>(`/runs/${runId}/report`),
    getDeepAnalysis: (runId: number) => fetcher<DeepAnalysis>(`/runs/${runId}/analysis`),
    getCharacterTimeline: (runId: number) =>
      fetcher<CharacterTimeline>(`/runs/${runId}/character-timeline`),
    patchValidationOverrides: (runId: number, updates: ValidationOverrideUpdate[]) =>
      fetcher<{ updated: number }>(`/runs/${runId}/validations`, {
        method: "PATCH",
        body: JSON.stringify({ updates }),
      }),
  },
};
