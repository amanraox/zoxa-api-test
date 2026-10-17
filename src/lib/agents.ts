/** Building agents from zoxa's agent templates. */

import type { AgentConfig, AgentTemplate } from "./zoxa/types";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = deepMerge(out[k], v);
  return out as T;
}

/**
 * A template is a partial config seed; zoxa substitutes `{{agentName}}`
 * client-side into the prompt and openers (same as the dashboard does).
 */
export function agentFromTemplate(t: AgentTemplate, base: AgentConfig): AgentConfig {
  const name = t.name;
  const sub = (s: string) => s.replaceAll("{{agentName}}", name);
  const merged = deepMerge(base, t.config);
  return {
    ...merged,
    name,
    description: t.description,
    systemPrompt: sub(t.system_prompt),
    greeting: { ...merged.greeting, firstMessages: (merged.greeting.firstMessages ?? []).map(sub) },
    contextVariables: (t.config.contextVariables as Record<string, string> | undefined) ?? {},
  };
}
