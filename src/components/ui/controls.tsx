"use client";

import { ChevronDown, CircleHelp, Plus, RotateCcw, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { jsonEqual } from "@/lib/path";
import { cn } from "@/lib/utils";

/* ───────────────────────────── Buttons ───────────────────────────── */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:opacity-90",
  accent: "bg-accent text-accent-fg hover:brightness-110 shadow-[0_0_0_1px_var(--accent),0_8px_24px_-8px_var(--accent)]",
  secondary: "bg-panel-2 text-fg ring-1 ring-line hover:ring-line-strong",
  ghost: "text-muted hover:text-fg hover:bg-panel-2",
  danger: "bg-err/10 text-err ring-1 ring-err/30 hover:bg-err/15",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; icon?: ComponentType<{ size?: number }> }
>(function Button({ variant = "secondary", size = "md", icon: Icon, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all select-none",
        "disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
        size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={size === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
});

export function IconButton({
  icon: Icon,
  label,
  className,
  size = 15,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ComponentType<{ size?: number }>; label: string; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors",
        "hover:bg-panel-2 hover:text-fg disabled:opacity-40 disabled:pointer-events-none",
        "focus-visible:outline-2 focus-visible:outline-accent",
        className,
      )}
      {...rest}
    >
      <Icon size={size} />
    </button>
  );
}

/* ───────────────────────────── Field shell ───────────────────────────── */

export function Help({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <CircleHelp size={12} className="text-faint transition-colors group-hover:text-muted" aria-hidden />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg bg-fg px-2.5 py-2 text-[11.5px] leading-snug font-normal normal-case tracking-normal text-bg opacity-0 shadow-xl transition-opacity group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function Field({
  label,
  help,
  hint,
  error,
  right,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  help?: string;
  hint?: ReactNode;
  error?: string | null;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || right) && (
        <div className="flex min-h-4 items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[12px] font-medium text-fg/85">
              {label}
              {help && <Help text={help} />}
            </label>
          )}
          {right}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-[11.5px] text-err">{error}</p>
      ) : hint ? (
        <p className="text-[11.5px] leading-snug text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-lg bg-input px-3 text-[13px] text-fg ring-1 ring-line placeholder:text-faint transition-shadow " +
  "focus:outline-none focus:ring-accent/70 disabled:opacity-50";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(
  function TextInput({ className, mono, ...rest }, ref) {
    return <input ref={ref} className={cn(inputBase, "h-9", mono && "font-mono text-[12px]", className)} {...rest} />;
  },
);

export function TextArea({
  className,
  mono,
  minRows = 3,
  maxRows = 24,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean; minRows?: number; maxRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Auto-grow between minRows and maxRows.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const max = line * maxRows + 16;
    el.style.height = `${Math.max(line * minRows + 16, Math.min(el.scrollHeight, max))}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [rest.value, minRows, maxRows]);
  return (
    <textarea
      ref={ref}
      className={cn(inputBase, "resize-none py-2 leading-relaxed", mono && "font-mono text-[12px]", className)}
      {...rest}
    />
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
  disabled,
  id,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean; note?: string }>;
  onChange: (v: T) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(inputBase, "h-9 appearance-none pr-8")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
            {o.note ? ` — ${o.note}` : ""}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-faint" />
    </div>
  );
}

/* ───────────────────────────── Choice controls ───────────────────────────── */

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40",
        checked ? "bg-accent" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "inline-block h-[14px] w-[14px] rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[17px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

export function ToggleRow({
  label,
  help,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  help?: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-fg/85">
          {label}
          {help && <Help text={help} />}
        </div>
        {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-faint">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  size = "md",
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" className={cn("flex rounded-lg bg-input p-0.5 ring-1 ring-line", disabled && "opacity-50")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md px-2 font-medium whitespace-nowrap transition-all",
            size === "sm" ? "h-6 text-[11.5px]" : "h-8 text-[12px]",
            value === o.value ? "bg-panel text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────── Slider ───────────────────────────── */

const decimals = (step: number) => (step >= 1 ? 0 : Math.min(3, String(step).split(".")[1]?.length ?? 0));

export function Slider({
  label,
  help,
  hint,
  value,
  min,
  max,
  step,
  unit,
  defaultValue,
  onChange,
  disabled,
  minLabel,
  maxLabel,
}: {
  label: string;
  help?: string;
  hint?: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  defaultValue?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  minLabel?: string;
  maxLabel?: string;
}) {
  const id = useId();
  const dp = decimals(step);
  const [text, setText] = useState(value.toFixed(dp));
  const [editing, setEditing] = useState(false);
  const shown = editing ? text : Number.isFinite(value) ? value.toFixed(dp) : "";
  const pct = ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;

  const commit = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const snapped = Math.round((Math.min(max, Math.max(min, n)) - min) / step) * step + min;
    onChange(Number(snapped.toFixed(dp)));
  };

  return (
    <Field
      label={label}
      help={help}
      hint={hint}
      htmlFor={id}
      right={
        <div className="flex items-center gap-1">
          {defaultValue !== undefined && Math.abs(value - defaultValue) > step / 2 && (
            <IconButton
              icon={RotateCcw}
              size={11}
              label={`Reset to ${defaultValue}`}
              className="h-5 w-5"
              onClick={() => onChange(defaultValue)}
              disabled={disabled}
            />
          )}
          <input
            aria-label={`${label} value`}
            value={shown}
            disabled={disabled}
            inputMode="decimal"
            onFocus={() => {
              setText(value.toFixed(dp));
              setEditing(true);
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => {
              commit(e.target.value);
              setEditing(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="h-6 w-16 rounded-md bg-input px-1.5 text-right font-mono text-[11.5px] text-fg ring-1 ring-line focus:outline-none focus:ring-accent/70"
          />
          {unit && <span className="font-mono text-[11px] text-faint">{unit}</span>}
        </div>
      }
    >
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : min}
        disabled={disabled}
        onChange={(e) => onChange(Number(Number(e.target.value).toFixed(dp)))}
        className="range w-full"
        style={{ ["--pct" as string]: `${pct}%` }}
      />
      {(minLabel || maxLabel) && (
        <div className="flex justify-between font-mono text-[10px] text-faint">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </Field>
  );
}

/* ───────────────────────────── Lists ───────────────────────────── */

export function MessageList({
  values,
  onChange,
  max = 5,
  placeholder,
  addLabel = "Add variant",
  emptyHint,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  max?: number;
  placeholder?: string;
  addLabel?: string;
  emptyHint?: string;
}) {
  return (
    <div className="space-y-1.5">
      {values.length === 0 && emptyHint && <p className="text-[11.5px] text-faint italic">{emptyHint}</p>}
      {values.map((v, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="mt-2.5 w-4 shrink-0 text-right font-mono text-[10px] text-faint">{i + 1}</span>
          <TextArea
            value={v}
            minRows={1}
            maxRows={6}
            placeholder={placeholder}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <IconButton icon={X} label="Remove" size={13} onClick={() => onChange(values.filter((_, j) => j !== i))} />
        </div>
      ))}
      {values.length < max && (
        <button
          type="button"
          onClick={() => onChange([...values, ""])}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-[12px] text-muted border border-dashed border-line transition-colors hover:text-fg hover:border-line-strong"
        >
          <Plus size={13} /> {addLabel}
          <span className="font-mono text-[10px] text-faint">
            {values.length}/{max}
          </span>
        </button>
      )}
    </div>
  );
}

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  addLabel = "Add",
  keyHint,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  keyHint?: (key: string) => string | null;
}) {
  // Rows are kept locally so a half-typed duplicate/empty key isn't lost.
  const [rows, setRows] = useState<Array<[string, string]>>(() => Object.entries(value ?? {}));
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (!jsonEqual(value ?? {}, lastEmitted.current ?? {})) {
      lastEmitted.current = value;
      setRows(Object.entries(value ?? {}));
    }
  }, [value]);

  const emit = (next: Array<[string, string]>) => {
    setRows(next);
    const obj: Record<string, string> = {};
    for (const [k, v] of next) if (k.trim() && !(k in obj)) obj[k] = v;
    lastEmitted.current = obj;
    onChange(obj);
  };

  return (
    <div className="space-y-1.5">
      {rows.map(([k, v], i) => {
        const warn = keyHint?.(k) ?? (k.trim() && rows.findIndex(([kk]) => kk === k) !== i ? "Duplicate key" : null);
        return (
          <div key={i}>
            <div className="flex items-center gap-1.5">
              <TextInput
                mono
                value={k}
                placeholder={keyPlaceholder}
                onChange={(e) => emit(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))}
                className="w-[42%]"
              />
              <TextInput
                value={v}
                placeholder={valuePlaceholder}
                onChange={(e) => emit(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))}
              />
              <IconButton icon={X} label="Remove" size={13} onClick={() => emit(rows.filter((_, j) => j !== i))} />
            </div>
            {warn && <p className="mt-1 pl-1 text-[11px] text-warn">{warn}</p>}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => setRows([...rows, ["", ""]])}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-[12px] text-muted border border-dashed border-line transition-colors hover:text-fg hover:border-line-strong"
      >
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  );
}

/* ───────────────────────────── Containers ───────────────────────────── */

export function Section({
  id,
  title,
  icon: Icon,
  summary,
  badge,
  defaultOpen = false,
  children,
}: {
  id?: string;
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  summary?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="scroll-mt-4 rounded-xl bg-panel ring-1 ring-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-muted ring-1 ring-line">
          <Icon size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-fg">
            {title}
            {badge}
          </span>
          {summary && <span className="mt-0.5 block truncate text-[11.5px] text-faint">{summary}</span>}
        </span>
        <ChevronDown size={15} className={cn("shrink-0 text-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-4 border-t border-line px-4 pt-4 pb-4">{children}</div>}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "ok" | "warn" | "err" | "info";
  className?: string;
}) {
  const tones = {
    neutral: "bg-panel-2 text-muted ring-line",
    accent: "bg-accent/12 text-accent ring-accent/30",
    ok: "bg-ok/10 text-ok ring-ok/30",
    warn: "bg-warn/10 text-warn ring-warn/30",
    err: "bg-err/10 text-err ring-err/30",
    info: "bg-info/10 text-info ring-info/30",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md px-1.5 font-mono text-[10.5px] font-medium tracking-tight ring-1",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Note({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "err" | "info" }) {
  const tones = {
    neutral: "bg-panel-2 text-muted ring-line",
    warn: "bg-warn/8 text-warn ring-warn/25",
    err: "bg-err/8 text-err ring-err/25",
    info: "bg-info/8 text-info ring-info/25",
  };
  return <div className={cn("rounded-lg px-3 py-2 text-[11.5px] leading-relaxed ring-1", tones[tone])}>{children}</div>;
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: ReadonlyArray<{ value: T; label: ReactNode; count?: number }>;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "relative flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors",
            value === t.value ? "bg-panel-2 text-fg ring-1 ring-line" : "text-muted hover:text-fg",
          )}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="font-mono text-[10px] text-faint">{t.count > 999 ? "999+" : t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
