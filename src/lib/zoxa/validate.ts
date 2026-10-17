/**
 * Client-side pre-flight. Mirrors the server's hard rules closely enough to
 * catch the obvious before a round-trip; the server stays authoritative
 * (use "Validate on server" for the real verdict).
 */

import {
  DEFAULT_STT_MODELS,
  DEFAULT_TTS_MODELS,
  MAX_MESSAGE_VARIANTS,
  RESERVED_TOOL_NAMES,
  TOOL_NAME_RE,
  XAI_VOICES,
  languageName,
  sanitizeToolName,
} from "./catalog";
import type { AgentConfig, AvailableModel } from "./types";

export interface Issue {
  path: string;
  message: string;
  level: "error" | "warning";
}

const isHttpUrl = (v: unknown) => typeof v === "string" && /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v);

function coverage(models: AvailableModel[], type: "stt" | "tts", provider: string, model: string) {
  return models.find((m) => m.type === type && m.provider === provider && m.id === model)?.languages ?? null;
}

export function validateAgent(cfg: AgentConfig, models: AvailableModel[] | undefined): Issue[] {
  const issues: Issue[] = [];
  const err = (path: string, message: string) => issues.push({ path, message, level: "error" });
  const warn = (path: string, message: string) => issues.push({ path, message, level: "warning" });

  if (!cfg.name?.trim()) err("name", "Agent name is required");
  else if (cfg.name.length > 120) err("name", "Agent name must be at most 120 characters");
  if (!cfg.llm?.model?.trim()) err("llm.model", "Pick an LLM model");
  if (!cfg.systemPrompt?.trim()) warn("systemPrompt", "System prompt is empty");

  if (cfg.maxCallDurationS % 10 !== 0) err("maxCallDurationS", "Max call duration must be a multiple of 10");

  const lists: Array<[string, string[] | undefined]> = [
    ["greeting.firstMessages", cfg.greeting?.firstMessages],
    ["userIdleMessages", cfg.userIdleMessages],
  ];
  for (const [path, list] of lists) {
    if ((list?.filter((m) => m.trim()).length ?? 0) > MAX_MESSAGE_VARIANTS) {
      err(path, `At most ${MAX_MESSAGE_VARIANTS} messages`);
    }
  }

  if (models && cfg.languages?.length) {
    const sttModel = cfg.stt.model ?? DEFAULT_STT_MODELS[cfg.stt.provider];
    const ttsModel = cfg.tts.model ?? DEFAULT_TTS_MODELS[cfg.tts.provider];
    for (const [type, provider, model] of [
      ["stt", cfg.stt.provider, sttModel],
      ["tts", cfg.tts.provider, ttsModel],
    ] as const) {
      const langs = coverage(models, type, provider, model);
      if (!langs) continue;
      const missing = cfg.languages.filter((l) => !langs.includes(l));
      if (missing.length) {
        err(
          `${type}.model`,
          `${model} does not support ${missing.map(languageName).join(", ")}`,
        );
      }
    }
  }
  if (cfg.stt?.provider === "assemblyai" && cfg.languages.length > 10) {
    err("languages", "AssemblyAI supports at most 10 languages per agent");
  }

  const c = cfg.stt?.cartesia;
  if (cfg.stt?.provider === "cartesia" && c && !(c.turnEndThreshold < c.turnEagerEndThreshold && c.turnEagerEndThreshold < c.turnStartThreshold)) {
    err("stt.cartesia", "Cartesia thresholds must satisfy end < eager end < start");
  }
  if (cfg.tts?.provider === "xai" && cfg.tts.voice && !(XAI_VOICES as readonly string[]).includes(cfg.tts.voice)) {
    err("tts.voice", `xAI voice must be one of ${XAI_VOICES.join(", ")}`);
  }

  if (cfg.webhook && !isHttpUrl(cfg.webhook.url)) err("webhook.url", "Webhook URL must be http(s)");

  const seen = new Set<string>();
  let hasEndCall = false;
  (cfg.tools ?? []).forEach((tool, i) => {
    const at = `tools[${i}]`;
    if (typeof tool === "string") {
      if (!tool.trim()) err(at, "Saved tool reference is empty");
      return;
    }
    const name = tool.name ?? (tool.type === "endCall" ? "end_call" : "");
    if (!TOOL_NAME_RE.test(name)) err(`${at}.name`, "Name: 1–64 chars, letters, digits, _ or -");
    if (RESERVED_TOOL_NAMES.includes(name) && tool.type !== "endCall") err(`${at}.name`, `"${name}" is reserved`);
    const key = sanitizeToolName(name);
    if (seen.has(key)) err(`${at}.name`, `Duplicate tool name "${name}"`);
    seen.add(key);

    switch (tool.type) {
      case "function":
        if (!isHttpUrl(tool.config.server.url) && !tool.config.server.url.includes("{{")) {
          err(`${at}.config.server.url`, "URL must start with http:// or https://");
        }
        break;
      case "query":
        if (!tool.config.knowledgeBases.length) err(`${at}.config.knowledgeBases`, "Add at least one knowledge base");
        tool.config.knowledgeBases.forEach((kb, k) => {
          if (!kb.name.trim() || !kb.description.trim()) err(`${at}.config.knowledgeBases[${k}]`, "Knowledge base needs a name and description");
          if (!kb.documentIds.length) err(`${at}.config.knowledgeBases[${k}].documentIds`, "Select at least one document");
        });
        break;
      case "endCall":
        hasEndCall = true;
        if (tool.config.messageType === "custom" && !tool.config.customMessages?.some((m) => m.trim())) {
          err(`${at}.config.customMessages`, "Custom farewell needs at least one message");
        }
        if (tool.config.messageType === "audio" && !tool.config.audioRecordingId) {
          err(`${at}.config.audioRecordingId`, "Audio farewell needs a recording id");
        }
        break;
      case "transferCall":
        if (!tool.config.destination.trim()) err(`${at}.config.destination`, "Destination is required");
        warn(at, "Transfers only work on phone calls — this web call will reject it at runtime");
        break;
      case "testTool":
        break;
    }
  });
  if (!hasEndCall) warn("tools", "No end-call tool — the server will add the default one");

  return issues;
}
