"use client";

import { Braces, ListTree, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Field, IconButton, Note, Segmented, Select, TextArea, TextInput, Toggle } from "@/components/ui/controls";
import { jsonEqual } from "@/lib/path";

/**
 * JSON-Schema editor for an HTTP tool's `parameters`. Simple flat schemas get
 * a row builder; anything richer (nested objects, arrays) is edited as JSON.
 */

type ParamType = "string" | "number" | "integer" | "boolean";
interface Row {
  name: string;
  type: ParamType;
  description: string;
  required: boolean;
  enumValues: string;
}

type Schema = Record<string, unknown> | null | undefined;
const TYPES: ParamType[] = ["string", "number", "integer", "boolean"];

function toRows(schema: Schema): Row[] | null {
  if (!schema) return [];
  if (schema.type !== "object") return null;
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const rows: Row[] = [];
  for (const [name, p] of Object.entries(props)) {
    if (typeof p !== "object" || !TYPES.includes(p.type as ParamType)) return null;
    if (Object.keys(p).some((k) => !["type", "description", "enum"].includes(k))) return null;
    if (p.enum !== undefined && (p.type !== "string" || !Array.isArray(p.enum))) return null;
    rows.push({
      name,
      type: p.type as ParamType,
      description: typeof p.description === "string" ? p.description : "",
      required: required.includes(name),
      enumValues: Array.isArray(p.enum) ? (p.enum as string[]).join(", ") : "",
    });
  }
  const extraKeys = Object.keys(schema).filter((k) => !["type", "properties", "required"].includes(k));
  return extraKeys.length ? null : rows;
}

function toSchema(rows: Row[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const r of rows) {
    if (!r.name.trim()) continue;
    const enums = r.enumValues.split(",").map((v) => v.trim()).filter(Boolean);
    properties[r.name.trim()] = {
      type: r.type,
      ...(r.description.trim() ? { description: r.description.trim() } : {}),
      ...(r.type === "string" && enums.length ? { enum: enums } : {}),
    };
  }
  const required = rows.filter((r) => r.required && r.name.trim()).map((r) => r.name.trim());
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

export function ParamsEditor({ value, onChange }: { value: Schema; onChange: (v: Record<string, unknown> | null) => void }) {
  const representable = toRows(value);
  const [mode, setMode] = useState<"rows" | "json">(representable ? "rows" : "json");
  const [rows, setRows] = useState<Row[]>(representable ?? []);
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Resync local state when the schema changes from outside (raw editor, load).
  useEffect(() => {
    const fromRows = toSchema(rows);
    if (!jsonEqual(fromRows, value ?? { type: "object", properties: {} })) {
      const r = toRows(value);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external resync
      if (r) setRows(r);
    }
    let parsed: unknown = undefined;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* local text mid-edit */
    }
    if (parsed === undefined || !jsonEqual(parsed, value ?? {})) {
      if (jsonError === null) setText(JSON.stringify(value ?? {}, null, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emitRows = (next: Row[]) => {
    setRows(next);
    onChange(toSchema(next));
  };

  return (
    <Field
      label="Parameters"
      help="JSON Schema the LLM fills when it calls the tool. Sent as the JSON body for POST/PUT/PATCH, as the query string for GET/DELETE."
      right={
        <Segmented
          size="sm"
          value={mode}
          onChange={(m) => {
            if (m === "rows" && !toRows(value)) return;
            setMode(m);
          }}
          options={[
            { value: "rows", label: <ListTree size={12} /> },
            { value: "json", label: <Braces size={12} /> },
          ]}
        />
      }
    >
      {mode === "rows" ? (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const patch = (p: Partial<Row>) => emitRows(rows.map((x, j) => (j === i ? { ...x, ...p } : x)));
            return (
              <div key={i} className="space-y-1.5 rounded-lg bg-input p-2 ring-1 ring-line">
                <div className="flex items-center gap-1.5">
                  <TextInput mono value={r.name} placeholder="param_name" onChange={(e) => patch({ name: e.target.value })} />
                  <Select value={r.type} onChange={(t) => patch({ type: t })} options={TYPES.map((t) => ({ value: t, label: t }))} className="w-28 shrink-0" />
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
                    <Toggle checked={r.required} onChange={(v) => patch({ required: v })} label="Required" />
                    req
                  </label>
                  <IconButton icon={X} label="Remove parameter" size={13} onClick={() => emitRows(rows.filter((_, j) => j !== i))} />
                </div>
                <TextInput value={r.description} placeholder="What this parameter means (the LLM reads this)" onChange={(e) => patch({ description: e.target.value })} />
                {r.type === "string" && (
                  <TextInput value={r.enumValues} placeholder="Allowed values (optional, comma-separated)" onChange={(e) => patch({ enumValues: e.target.value })} />
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setRows([...rows, { name: "", type: "string", description: "", required: false, enumValues: "" }])}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line text-[12px] text-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            <Plus size={13} /> Add parameter
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {!toRows(value) && <Note>This schema uses features the row builder can&apos;t show — edit it as JSON.</Note>}
          <TextArea
            mono
            minRows={6}
            maxRows={20}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              try {
                const parsed = JSON.parse(e.target.value || "null");
                if (parsed !== null && (typeof parsed !== "object" || Array.isArray(parsed))) {
                  setJsonError("Must be a JSON object or null");
                  return;
                }
                setJsonError(null);
                onChange(parsed);
              } catch (err) {
                setJsonError(err instanceof Error ? err.message : "Invalid JSON");
              }
            }}
          />
          {jsonError && <p className="text-[11.5px] text-err">{jsonError}</p>}
        </div>
      )}
    </Field>
  );
}
