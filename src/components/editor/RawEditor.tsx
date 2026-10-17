"use client";

import { json, jsonParseLinter } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { linter, lintGutter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import { AlignLeft, Check, Copy, Terminal, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, Note } from "@/components/ui/controls";
import { useDraft } from "@/components/editor/DraftContext";
import { fromRequestBody, toRequestBody } from "@/lib/draft";

const theme = EditorView.theme({
  "&": { backgroundColor: "var(--input)", color: "var(--fg)", fontSize: "12px", height: "100%" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-content": { caretColor: "var(--accent)", padding: "10px 0" },
  ".cm-gutters": { backgroundColor: "var(--input)", color: "var(--faint)", border: "none" },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--accent) 6%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--muted)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in oklab, var(--accent) 28%, transparent) !important",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor": { borderLeftColor: "var(--accent)" },
  ".cm-tooltip": { backgroundColor: "var(--panel)", border: "1px solid var(--line)", color: "var(--fg)" },
});

const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--info)" },
  { tag: tags.string, color: "var(--ok)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--accent)" },
  { tag: [tags.brace, tags.squareBracket, tags.separator, tags.punctuation], color: "var(--faint)" },
]);

const extensions = [
  json(),
  linter(jsonParseLinter()),
  lintGutter(),
  EditorView.lineWrapping,
  theme,
  syntaxHighlighting(highlight),
];

const shellQuote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

/**
 * The full POST /api/v1/call body, editable. Valid JSON is applied to the
 * draft immediately (the form follows); invalid JSON is held locally with the
 * parse error shown, and the form keeps the last valid state.
 */
export function RawEditor() {
  const { draft, setDraft } = useDraft();
  const formatted = useMemo(() => JSON.stringify(toRequestBody(draft), null, 2), [draft]);
  const [text, setText] = useState(formatted);
  const [error, setError] = useState<string | null>(null);
  const [outOfSync, setOutOfSync] = useState(false);
  const [copied, setCopied] = useState<"json" | "curl" | null>(null);
  const synced = useRef(formatted);

  // Form changed underneath us: follow it, unless the user holds invalid text.
  useEffect(() => {
    if (formatted === synced.current) return;
    synced.current = formatted;
    if (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect external change
      setOutOfSync(true);
    } else {
      setText(formatted);
    }
  }, [formatted, error]);

  const onChange = (value: string) => {
    setText(value);
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }
    const next = fromRequestBody(draft, parsed);
    if (typeof next === "string") {
      setError(next);
      return;
    }
    setError(null);
    setOutOfSync(false);
    synced.current = JSON.stringify(toRequestBody(next), null, 2);
    setDraft(next);
  };

  const copy = async (kind: "json" | "curl") => {
    const payload =
      kind === "json"
        ? formatted
        : [
            "curl -X POST https://dashboard.zoxa.ai/api/v1/call \\",
            '  -H "X-API-Key: $ZOXA_API_KEY" \\',
            '  -H "Content-Type: application/json" \\',
            `  -d ${shellQuote(JSON.stringify(toRequestBody(draft)))}`,
          ].join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — nothing to do */
    }
  };

  const reset = () => {
    setText(formatted);
    setError(null);
    setOutOfSync(false);
    synced.current = formatted;
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-auto font-mono text-[11px] text-faint">POST /api/v1/call</span>
        <Button size="sm" variant="ghost" icon={AlignLeft} onClick={reset} disabled={!!error}>
          Format
        </Button>
        <Button size="sm" variant="ghost" icon={copied === "json" ? Check : Copy} onClick={() => copy("json")}>
          JSON
        </Button>
        <Button size="sm" variant="ghost" icon={copied === "curl" ? Check : Terminal} onClick={() => copy("curl")}>
          cURL
        </Button>
      </div>

      {error ? (
        <Note tone="err">
          <span className="font-mono">{error}</span> — the form keeps the last valid request.
          {outOfSync && " The form changed since; "}
          <button type="button" onClick={reset} className="ml-1 inline-flex items-center gap-1 underline">
            <Undo2 size={11} /> discard edit
          </button>
        </Note>
      ) : (
        <Note>
          Edits apply live. Keys the form doesn&apos;t know are kept and sent verbatim, so you can probe the server&apos;s
          validation directly.
        </Note>
      )}

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg ring-1 ring-line">
        <CodeMirror
          value={text}
          onChange={onChange}
          extensions={extensions}
          theme="none"
          height="100%"
          basicSetup={{ foldGutter: true, highlightActiveLine: true, bracketMatching: true, autocompletion: false }}
          className="h-full"
        />
      </div>
    </div>
  );
}
