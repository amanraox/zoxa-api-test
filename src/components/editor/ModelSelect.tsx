"use client";

import { ChevronDown, RefreshCw } from "lucide-react";

import { IconButton } from "@/components/ui/controls";
import { languageName, providerLabel } from "@/lib/zoxa/catalog";
import type { AvailableModel } from "@/lib/zoxa/types";
import { cn } from "@/lib/utils";

/**
 * Grouped (by provider) model select backed by the live catalog. STT/TTS
 * models that cannot serve every selected language are disabled with the
 * reason inline — the server would 400 them anyway.
 */
export function ModelSelect({
  models,
  type,
  provider,
  model,
  languages,
  onChange,
  loading,
  error,
  onRetry,
  restrictProvider,
}: {
  models: AvailableModel[] | undefined;
  type: AvailableModel["type"];
  provider: string;
  model: string;
  languages: string[];
  onChange: (provider: string, model: string) => void;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  restrictProvider?: string;
}) {
  const rows = (models ?? []).filter((m) => m.type === type && (!restrictProvider || m.provider === restrictProvider));
  const providers = [...new Set(rows.map((m) => m.provider))];
  const key = `${provider}::${model}`;
  const known = rows.some((m) => `${m.provider}::${m.id}` === key);

  const missing = (m: AvailableModel) => (m.languages ? languages.filter((l) => !m.languages!.includes(l)) : []);

  if (error && !models) {
    return (
      <div className="flex h-9 items-center justify-between rounded-lg bg-err/8 px-3 text-[12px] text-err ring-1 ring-err/25">
        Could not load models
        {onRetry && <IconButton icon={RefreshCw} label="Retry" size={13} className="h-6 w-6" onClick={onRetry} />}
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={key}
        disabled={loading && !models}
        onChange={(e) => {
          const [p, m] = e.target.value.split("::");
          onChange(p, m);
        }}
        className={cn(
          "h-9 w-full appearance-none rounded-lg bg-input px-3 pr-8 text-[13px] text-fg ring-1 ring-line",
          "focus:ring-accent/70 focus:outline-none disabled:opacity-50",
        )}
      >
        {loading && !models && <option value={key}>Loading catalog…</option>}
        {!known && models && (
          <option value={key}>
            {providerLabel(provider)} · {model || "(none)"} — not in catalog
          </option>
        )}
        {providers.map((p) => (
          <optgroup key={p} label={providerLabel(p)}>
            {rows
              .filter((m) => m.provider === p)
              .map((m) => {
                const gap = missing(m);
                return (
                  <option key={m.id} value={`${m.provider}::${m.id}`} disabled={gap.length > 0}>
                    {m.name}
                    {m.is_default ? "  ·  default" : ""}
                    {gap.length ? `  —  no ${gap.map(languageName).join(", ")}` : ""}
                  </option>
                );
              })}
          </optgroup>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-faint" />
    </div>
  );
}
