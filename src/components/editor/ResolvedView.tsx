"use client";

import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Note } from "@/components/ui/controls";
import { useDraft } from "@/components/editor/DraftContext";
import { toRequestBody } from "@/lib/draft";
import { ApiError, zoxa, type ApiIssue } from "@/lib/zoxa/client";
import type { Issue } from "@/lib/zoxa/validate";

type Result =
  | { ok: true; snapshot: Record<string, unknown>; at: number }
  | { ok: false; message: string; issues: ApiIssue[]; at: number };

/**
 * Server-side validation via POST /agents/preview-snapshot: the exact config
 * the runner would consume (defaults filled, variables substituted), or the
 * server's own validation errors — without starting a call.
 */
export function ResolvedView({ issues }: { issues: Issue[] }) {
  const { draft } = useDraft();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = async () => {
    setBusy(true);
    const body = toRequestBody(draft);
    try {
      const res = await zoxa.previewSnapshot({
        agent: body.agent,
        agentId: body.agentId,
        contextVariables: body.contextVariables,
      });
      setResult({ ok: true, snapshot: res.snapshot, at: Date.now() });
    } catch (e) {
      setResult({
        ok: false,
        message: e instanceof Error ? e.message : "Validation failed",
        issues: e instanceof ApiError ? e.issues : [],
        at: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  };

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-panel p-4 ring-1 ring-line">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          Pre-flight checks
          {errors.length > 0 && <Badge tone="err">{errors.length} error{errors.length > 1 ? "s" : ""}</Badge>}
          {warnings.length > 0 && <Badge tone="warn">{warnings.length} warning{warnings.length > 1 ? "s" : ""}</Badge>}
          {issues.length === 0 && <Badge tone="ok">clean</Badge>}
        </div>
        {issues.length > 0 && (
          <ul className="mt-2 space-y-1">
            {issues.map((i, k) => (
              <li key={k} className="flex gap-2 text-[12px]">
                <span className={i.level === "error" ? "text-err" : "text-warn"}>{i.level === "error" ? "●" : "○"}</span>
                <span>
                  <code className="font-mono text-[11px] text-faint">{i.path}</code> {i.message}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11.5px] text-faint">Local checks mirror the server&apos;s hard rules. The server is authoritative.</p>
      </div>

      <Button variant="primary" icon={ShieldCheck} onClick={validate} disabled={busy} className="w-full">
        {busy ? "Validating…" : "Validate on server"}
      </Button>
      <p className="text-center text-[11px] text-faint">POST /api/v1/agents/preview-snapshot · no call is placed</p>

      {result &&
        (result.ok ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[12.5px] text-ok">
              <CheckCircle2 size={14} /> Valid — this is exactly what the runner would use
            </div>
            <pre className="max-h-[50vh] overflow-auto rounded-lg bg-input p-3 font-mono text-[11px] leading-relaxed ring-1 ring-line">
              {JSON.stringify(result.snapshot, null, 2)}
            </pre>
          </div>
        ) : (
          <Note tone="err">
            <div className="flex items-center gap-1.5 font-medium">
              <XCircle size={13} /> {result.message}
            </div>
            {result.issues.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 font-mono text-[11px]">
                {result.issues.map((i, k) => (
                  <li key={k}>
                    {i.path && <b>{i.path}: </b>}
                    {i.message}
                  </li>
                ))}
              </ul>
            )}
          </Note>
        ))}
    </div>
  );
}
