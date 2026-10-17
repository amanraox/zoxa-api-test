"use client";

import { Check, Pause, Play, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, IconButton, TextInput } from "@/components/ui/controls";
import { useVoices } from "@/hooks/useCatalog";
import { DEFAULT_TTS_VOICES, XAI_VOICES, languageName } from "@/lib/zoxa/catalog";
import type { TTSProvider, VoiceInfo } from "@/lib/zoxa/types";
import { cn } from "@/lib/utils";

const MAX_ROWS = 200;

/** Searchable voice browser for the selected TTS provider/model. `null` = provider default. */
export function VoicePicker({
  provider,
  model,
  value,
  onChange,
}: {
  provider: TTSProvider;
  model: string | null;
  value: string | null;
  onChange: (voice: string | null) => void;
}) {
  const fixed = provider === "xai";
  const res = useVoices(provider, model);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
    },
    [],
  );

  const voices: VoiceInfo[] = useMemo(
    () => (fixed ? XAI_VOICES.map((v) => ({ voice_id: v, name: v[0].toUpperCase() + v.slice(1) })) : (res.data ?? [])),
    [fixed, res.data],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return voices;
    return voices.filter((v) =>
      [v.name, v.voice_id, v.gender, v.accent, v.language, v.description].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [voices, query]);

  const current = voices.find((v) => v.voice_id === value);
  const defaultId = DEFAULT_TTS_VOICES[provider];

  const preview = (v: VoiceInfo) => {
    if (!v.preview_url) return;
    if (playing === v.voice_id) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    const a = new Audio(v.preview_url);
    a.onended = () => setPlaying(null);
    a.onerror = () => setPlaying(null);
    audio.current = a;
    void a.play().then(() => setPlaying(v.voice_id), () => setPlaying(null));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg bg-input px-3 py-2 ring-1 ring-line">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-fg">
            {value === null ? "Provider default" : current?.name ?? "Custom voice"}
          </div>
          <div className="truncate font-mono text-[10.5px] text-faint">{value ?? `${defaultId} (default)`}</div>
        </div>
        {value !== null && (
          <button type="button" className="text-[11.5px] text-muted hover:text-fg" onClick={() => onChange(null)}>
            Use default
          </button>
        )}
      </div>

      {!fixed && (
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={res.loading ? "Loading voices…" : `Search ${voices.length} voices`}
            className="pl-8"
          />
        </div>
      )}

      {res.error && !fixed ? (
        <div className="flex items-center justify-between rounded-lg bg-err/8 px-3 py-2 text-[12px] text-err ring-1 ring-err/25">
          Could not load voices
          <IconButton icon={RefreshCw} label="Retry" size={13} className="h-6 w-6" onClick={res.reload} />
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-lg ring-1 ring-line">
          {filtered.slice(0, MAX_ROWS).map((v) => {
            const selected = v.voice_id === value;
            return (
              <div
                key={v.voice_id}
                role="button"
                tabIndex={0}
                onClick={() => onChange(v.voice_id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange(v.voice_id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 border-b border-line px-3 py-2 last:border-b-0 transition-colors",
                  selected ? "bg-accent/10" : "hover:bg-panel-2",
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {selected && <Check size={13} className="text-accent" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] text-fg">{v.name}</div>
                  {v.description && <div className="truncate text-[11px] text-faint">{v.description}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {v.gender && <Badge>{v.gender}</Badge>}
                  {v.language && <Badge>{languageName(v.language)}</Badge>}
                </div>
                {v.preview_url && (
                  <IconButton
                    icon={playing === v.voice_id ? Pause : Play}
                    label="Preview"
                    size={12}
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      preview(v);
                    }}
                  />
                )}
              </div>
            );
          })}
          {!res.loading && filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-[12px] text-faint">No voices match.</div>
          )}
          {filtered.length > MAX_ROWS && (
            <div className="px-3 py-2 text-center text-[11px] text-faint">
              Showing {MAX_ROWS} of {filtered.length} — refine the search
            </div>
          )}
        </div>
      )}

      {!fixed && (
        <div className="flex gap-1.5">
          <TextInput mono value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Paste a custom voice id" />
          <button
            type="button"
            disabled={!custom.trim()}
            onClick={() => {
              onChange(custom.trim());
              setCustom("");
            }}
            className="h-9 shrink-0 rounded-lg px-3 text-[12px] font-medium text-fg ring-1 ring-line hover:ring-line-strong disabled:opacity-40"
          >
            Use id
          </button>
        </div>
      )}
    </div>
  );
}
