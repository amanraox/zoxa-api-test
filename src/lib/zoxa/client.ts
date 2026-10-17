/**
 * Browser-side client for the console's own proxy routes. Every zoxa error
 * shape is normalized into an `ApiError` with a headline + per-field issues.
 */

import type {
  AgentTemplate,
  AvailableModel,
  CallReport,
  CallRequestBody,
  CreateCallResponse,
  KbDocument,
  SavedTool,
  TTSProvider,
  VoiceInfo,
} from "./types";

export interface ApiIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: ApiIssue[] = [],
    readonly raw: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function issueFrom(entry: unknown): ApiIssue | null {
  if (!isObj(entry)) return typeof entry === "string" ? { path: "", message: entry } : null;
  const loc = Array.isArray(entry.loc) ? entry.loc.filter((p) => p !== "body").join(".") : "";
  const path = typeof entry.path === "string" ? entry.path : loc;
  const message = String(entry.message ?? entry.msg ?? JSON.stringify(entry));
  return { path, message };
}

/**
 * zoxa returns several error shapes:
 *   {detail: "text"} · {detail: [{loc,msg}]} (FastAPI 422)
 *   {detail: {error, details: [{path|loc, message|msg}]}} (config validation)
 */
export function toApiError(status: number, body: unknown): ApiError {
  const detail = isObj(body) && "detail" in body ? body.detail : body;
  if (typeof detail === "string") return new ApiError(status, detail, [], body);
  if (Array.isArray(detail)) {
    const issues = detail.map(issueFrom).filter((i): i is ApiIssue => i !== null);
    return new ApiError(status, "Request validation failed", issues, body);
  }
  if (isObj(detail)) {
    const issues = Array.isArray(detail.details)
      ? detail.details.map(issueFrom).filter((i): i is ApiIssue => i !== null)
      : [];
    const headline = String(detail.error ?? detail.message ?? `Request failed (${status})`);
    return new ApiError(status, headline.replaceAll("_", " "), issues, body);
  }
  return new ApiError(status, `Request failed (${status})`, [], body);
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, "Network error — is the console server running?");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

const api = (path: string) => `/api/zoxa/${path}`;
const json = (data: unknown) => JSON.stringify(data);

export const zoxa = {
  listModels: () => request<{ data: AvailableModel[] }>(api("agents/models/available")).then((r) => r.data),

  listVoices: (provider: TTSProvider, model?: string | null) => {
    const q = model ? `?model=${encodeURIComponent(model)}` : "";
    return request<{ voices: VoiceInfo[] }>(api(`user/configurations/voices/${provider}${q}`)).then((r) => r.voices);
  },

  listTools: () => request<SavedTool[]>(api("tools?status=active")),

  listDocuments: (limit: number, offset: number) =>
    request<{ documents: KbDocument[]; total: number }>(api(`knowledge-base/documents?limit=${limit}&offset=${offset}`)),

  listTemplates: () => request<{ templates: AgentTemplate[] }>(api("agents/templates")).then((r) => r.templates),

  previewSnapshot: (body: { agent?: unknown; agentId?: string; contextVariables?: Record<string, string> }) =>
    request<{ snapshot: Json }>(api("agents/preview-snapshot"), { method: "POST", body: json(body) }),

  createCall: (body: CallRequestBody) =>
    request<CreateCallResponse>("/api/call", { method: "POST", body: json(body) }),

  getCallReport: (callId: string) => request<CallReport>(`/api/calls/${encodeURIComponent(callId)}`),
};
