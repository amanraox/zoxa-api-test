"use client";

import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  Copy,
  FlaskConical,
  Link2,
  PhoneForwarded,
  PhoneOff,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  Wrench,
} from "lucide-react";
import { useState, type ComponentType } from "react";

import { Boundary } from "@/components/ui/Boundary";
import { Badge, IconButton, Note, Section } from "@/components/ui/controls";
import { useAgentField } from "@/components/editor/DraftContext";
import { useSavedTools } from "@/hooks/useCatalog";
import { TOOL_TYPE_META, newTool, sanitizeToolName } from "@/lib/zoxa/catalog";
import type { AgentTool, InlineTool, InlineToolType } from "@/lib/zoxa/types";
import { cn } from "@/lib/utils";

import {
  EndCallToolEditor,
  FunctionToolEditor,
  QueryToolEditor,
  TestToolEditor,
  TransferToolEditor,
} from "../tools/ToolEditors";

const ICONS: Record<InlineToolType, ComponentType<{ size?: number; className?: string }>> = {
  function: Webhook,
  query: BookOpen,
  endCall: PhoneOff,
  transferCall: PhoneForwarded,
  testTool: FlaskConical,
};

const TYPES: InlineToolType[] = ["function", "query", "testTool", "endCall", "transferCall"];

function toolName(t: AgentTool) {
  return typeof t === "string" ? t : (t.name ?? (t.type === "endCall" ? "end_call" : ""));
}

export function ToolsSection() {
  const [tools, setTools] = useAgentField<AgentTool[]>(["tools"]);
  const list = Array.isArray(tools) ? tools : [];
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const saved = useSavedTools();

  const names = list.filter((t) => typeof t !== "string").map(toolName);
  const update = (i: number, t: AgentTool) => setTools(list.map((x, j) => (j === i ? t : x)));
  const remove = (i: number) => {
    setTools(list.filter((_, j) => j !== i));
    setOpen(null);
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setTools(next);
    setOpen(open === i ? i + dir : open);
  };
  const add = (t: AgentTool) => {
    setTools([...list, t]);
    setOpen(list.length);
    setAdding(false);
  };
  const duplicate = (i: number) => {
    const t = list[i];
    if (typeof t === "string") return;
    const copy = structuredClone(t) as InlineTool;
    const fresh = newTool(t.type, names);
    copy.name = fresh.name;
    add(copy);
  };

  const dupes = new Set(names.map(sanitizeToolName).filter((n, i, all) => all.indexOf(n) !== i));
  const hasEndCall = list.some((t) => typeof t !== "string" && t.type === "endCall");

  return (
    <Section
      id="sec-tools"
      title="Tools"
      icon={Wrench}
      badge={<Badge>{list.length}</Badge>}
      summary={list.length ? list.map(toolName).join(", ") : "No tools"}
    >
      {!hasEndCall && <Note>No end-call tool — zoxa will add its default <code>end_call</code> automatically.</Note>}

      <div className="space-y-2">
        {list.map((t, i) => {
          const isRef = typeof t === "string";
          const Icon = isRef ? Link2 : ICONS[t.type] ?? Wrench;
          const savedMeta = isRef ? saved.data?.find((s) => s.tool_uuid === t) : null;
          const label = isRef ? (savedMeta?.name ?? "Saved tool") : toolName(t);
          const dup = !isRef && dupes.has(sanitizeToolName(toolName(t)));
          const expanded = open === i;
          return (
            <div key={i} className={cn("rounded-lg bg-panel-2/50 ring-1", dup ? "ring-err/50" : "ring-line")}>
              <div className="flex items-center gap-2 px-2.5 py-2">
                <button type="button" onClick={() => setOpen(expanded ? null : i)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel ring-1 ring-line">
                    <Icon size={13} className="text-muted" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[12.5px] text-fg">{label || "unnamed"}</span>
                    <span className="block truncate text-[11px] text-faint">
                      {isRef ? `ref · ${t}` : TOOL_TYPE_META[t.type]?.label ?? t.type}
                      {dup && <span className="text-err"> · duplicate name</span>}
                    </span>
                  </span>
                  <ChevronDown size={14} className={cn("ml-auto shrink-0 text-faint transition-transform", expanded && "rotate-180")} />
                </button>
                <div className="flex shrink-0">
                  <IconButton icon={ArrowUp} label="Move up" size={12} className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} />
                  <IconButton icon={ArrowDown} label="Move down" size={12} className="h-7 w-7" disabled={i === list.length - 1} onClick={() => move(i, 1)} />
                  {!isRef && <IconButton icon={Copy} label="Duplicate" size={12} className="h-7 w-7" onClick={() => duplicate(i)} />}
                  <IconButton icon={Trash2} label="Remove" size={12} className="h-7 w-7 hover:text-err" onClick={() => remove(i)} />
                </div>
              </div>
              {expanded && (
                <div className="space-y-4 border-t border-line px-3 pt-3 pb-3">
                  <Boundary label={`Tool “${label}”`} resetKey={t}>
                    <ToolBody tool={t} onChange={(next) => update(i, next)} />
                  </Boundary>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="space-y-2 rounded-lg p-2 ring-1 ring-line">
          <div className="grid grid-cols-2 gap-1.5">
            {TYPES.map((type) => {
              const Icon = ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => add(newTool(type, names))}
                  className="flex items-start gap-2 rounded-lg bg-panel-2/60 p-2.5 text-left ring-1 ring-line transition-colors hover:ring-accent/60"
                >
                  <Icon size={14} className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    <span className="block text-[12.5px] font-medium text-fg">{TOOL_TYPE_META[type].label}</span>
                    <span className="block text-[11px] leading-snug text-faint">{TOOL_TYPE_META[type].blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="rounded-lg bg-panel-2/60 p-2.5 ring-1 ring-line">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12.5px] font-medium">
                <Link2 size={14} className="text-accent" /> Saved tool (by UUID)
              </span>
              <IconButton icon={RefreshCw} label="Reload saved tools" size={12} className="h-6 w-6" onClick={saved.reload} />
            </div>
            {saved.loading ? (
              <p className="text-[11.5px] text-faint">Loading…</p>
            ) : saved.error ? (
              <p className="text-[11.5px] text-err">Could not load saved tools.</p>
            ) : saved.data?.length ? (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {saved.data.map((s) => (
                  <button
                    key={s.tool_uuid}
                    type="button"
                    disabled={list.includes(s.tool_uuid)}
                    onClick={() => add(s.tool_uuid)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40"
                  >
                    <span className="truncate font-mono text-[12px]">{s.name}</span>
                    <Badge>{s.category}</Badge>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11.5px] text-faint">No saved tools in this organization.</p>
            )}
          </div>
          <button type="button" onClick={() => setAdding(false)} className="w-full py-1 text-[12px] text-muted hover:text-fg">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line text-[12.5px] text-muted transition-colors hover:border-accent/60 hover:text-fg"
        >
          <Plus size={14} /> Add tool
        </button>
      )}
    </Section>
  );
}

function ToolBody({ tool, onChange }: { tool: AgentTool; onChange: (t: AgentTool) => void }) {
  if (typeof tool === "string") {
    return (
      <Note>
        Reference to saved tool <code className="font-mono">{tool}</code>. zoxa resolves it at call time; edit it in the
        dashboard&apos;s Tools page.
      </Note>
    );
  }
  switch (tool.type) {
    case "function":
      return <FunctionToolEditor tool={tool} onChange={onChange} />;
    case "query":
      return <QueryToolEditor tool={tool} onChange={onChange} />;
    case "endCall":
      return <EndCallToolEditor tool={tool} onChange={onChange} />;
    case "transferCall":
      return <TransferToolEditor tool={tool} onChange={onChange} />;
    case "testTool":
      return <TestToolEditor tool={tool} onChange={onChange} />;
    default:
      return <Note tone="warn">Unknown tool type — edit it in the raw request.</Note>;
  }
}
