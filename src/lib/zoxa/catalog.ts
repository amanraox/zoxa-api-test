/**
 * Static catalog data that the API does not serve: display labels, the
 * language registry names, schema defaults and tool seeds. Model availability
 * and per-model language coverage come live from `GET /agents/models/available`.
 */

import type {
  AgentConfig,
  EndCallTool,
  FunctionTool,
  InlineTool,
  InlineToolType,
  QueryTool,
  STTProvider,
  TTSProvider,
  TestTool,
  TransferCallTool,
} from "./types";

const PROVIDER_LABELS: Record<string, string> = {
  soniox: "Soniox",
  flux: "Deepgram Flux",
  assemblyai: "AssemblyAI",
  elevenlabs: "ElevenLabs",
  cartesia: "Cartesia",
  smallest: "Smallest",
  sarvam: "Sarvam",
  xai: "xAI",
  inworld: "Inworld",
  openai: "OpenAI",
  qwen: "Qwen",
  google: "Google",
  anthropic: "Anthropic",
};

export const providerLabel = (id: string) => PROVIDER_LABELS[id] ?? id;

/** Picker order + names — mirrors `api/schemas/languages.py` LANGUAGES. */
export const LANGUAGES: ReadonlyArray<{ id: string; name: string }> = [
  { id: "en", name: "English" },
  { id: "hi", name: "Hindi" },
  { id: "gu", name: "Gujarati" },
  { id: "ta", name: "Tamil" },
  { id: "te", name: "Telugu" },
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
  { id: "ja", name: "Japanese" },
  { id: "de", name: "German" },
  { id: "zh", name: "Mandarin Chinese" },
  { id: "ar", name: "Arabic" },
  { id: "pt", name: "Portuguese" },
  { id: "ru", name: "Russian" },
  { id: "mr", name: "Marathi" },
  { id: "bn", name: "Bengali" },
  { id: "kn", name: "Kannada" },
  { id: "ml", name: "Malayalam" },
  { id: "pa", name: "Punjabi" },
  { id: "ur", name: "Urdu" },
  { id: "id", name: "Indonesian" },
  { id: "or", name: "Odia" },
  { id: "ne", name: "Nepali" },
];

export const languageName = (id: string) => LANGUAGES.find((l) => l.id === id)?.name ?? id;

/** Platform built-ins — always win over saved/call-time values. */
export const SYSTEM_VARIABLES = [
  "current_time",
  "current_day",
  "current_date",
  "current_timezone",
  "user_number",
  "agent_number",
] as const;

export const normalizeVariable = (name: string) => name.trim().toLowerCase().replaceAll(" ", "_");
export const isSystemVariable = (name: string) =>
  (SYSTEM_VARIABLES as readonly string[]).includes(normalizeVariable(name));

/** Every `{{token}}` in a text, de-duplicated by normalized name, in order. */
export function extractVariables(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const key = normalizeVariable(m[1]);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(m[1].trim());
    }
  }
  return out;
}

export const DEFAULT_STT_MODELS: Record<STTProvider, string> = {
  soniox: "stt-rt-v5",
  flux: "flux-general-en",
  assemblyai: "universal-3-6-pro",
  sarvam: "saaras:v3",
  cartesia: "ink-2",
};

export const DEFAULT_TTS_MODELS: Record<TTSProvider, string> = {
  elevenlabs: "eleven_v4_turbo",
  cartesia: "sonic-3.6",
  smallest: "lightning_v3.1",
  sarvam: "bulbul:v3",
  inworld: "inworld-tts-2",
  xai: "xai-tts",
};

export const DEFAULT_TTS_VOICES: Record<TTSProvider, string> = {
  elevenlabs: "7qBNUtXRGP0jPi0H4r8k",
  cartesia: "c63361f8-d142-4c62-8da7-8f8149d973d6",
  smallest: "sophia",
  sarvam: "ishita",
  xai: "eve",
  inworld: "Ashley",
};

/** xAI's TTS voices are a fixed set; the server rejects anything else. */
export const XAI_VOICES = ["ara", "eve", "leo", "rex", "sal"] as const;

/** Eleven v3 / v4 run on Text-to-Dialogue, which reads only `stability`. */
export const isElevenDialogueModel = (model: string | null | undefined) =>
  !!model && (model.startsWith("eleven_v3") || model.startsWith("eleven_v4"));

/** OpenAI models that ignore temperature (the factory never sends it). */
export const temperatureApplies = (provider: string, model: string) =>
  !(provider === "openai" && (["gpt-5", "gpt-5-mini", "gpt-5-nano"].includes(model) || model.startsWith("o")));

export const RESERVED_TOOL_NAMES = ["end_call", "retrieve_from_knowledge_base", "safe_calculator"];
export const TOOL_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;
/** The LLM-function form the runner registers — uniqueness is checked on this. */
export const sanitizeToolName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
export const MAX_MESSAGE_VARIANTS = 5;

export const DEFAULT_END_CALL_DESCRIPTION =
  "End the call when the user says goodbye, asks to stop, or the conversation is clearly finished.";

export const TOOL_TYPE_META: Record<InlineToolType, { label: string; blurb: string }> = {
  function: { label: "HTTP function", blurb: "Calls your API with LLM-filled parameters" },
  query: { label: "Knowledge base", blurb: "Retrieves from uploaded documents" },
  endCall: { label: "End call", blurb: "Lets the agent hang up with a farewell" },
  transferCall: { label: "Transfer call", blurb: "Phone calls only — rejected on web calls" },
  testTool: { label: "Test tool", blurb: "Simulated tool with a delay and canned outcome" },
};

export function newTool(type: InlineToolType, existingNames: string[]): InlineTool {
  const unique = (base: string) => {
    const taken = new Set(existingNames.map(sanitizeToolName));
    let name = base;
    for (let i = 2; taken.has(sanitizeToolName(name)); i++) name = `${base}_${i}`;
    return name;
  };
  switch (type) {
    case "function":
      return {
        type,
        name: unique("lookup_order"),
        description: "Look up an order by its id.",
        config: {
          server: { url: "https://", method: "POST", headers: null, timeout_ms: 10000 },
          parameters: {
            type: "object",
            properties: { order_id: { type: "string", description: "The order id" } },
            required: ["order_id"],
          },
          async: false,
          messages: [],
          messagesOrder: "random",
        },
      } satisfies FunctionTool;
    case "query":
      return {
        type,
        name: unique("search_docs"),
        description: "Search the knowledge base.",
        config: {
          knowledgeBases: [{ name: "docs", description: "Product documentation", documentIds: [] }],
          messages: [],
          messagesOrder: "random",
          timeout: 5,
        },
      } satisfies QueryTool;
    case "endCall":
      return {
        type,
        name: unique("end_call"),
        description: DEFAULT_END_CALL_DESCRIPTION,
        config: { messageType: "custom", customMessages: ["Goodbye!"], audioRecordingId: null },
      } satisfies EndCallTool;
    case "transferCall":
      return {
        type,
        name: unique("transfer_to_human"),
        description: "Transfer the caller to a human agent when they ask for one.",
        config: { destination: "+1", customMessage: null, timeout: 30, recordTransfer: true },
      } satisfies TransferCallTool;
    case "testTool":
      return {
        type,
        name: unique("check_availability"),
        description: "Call this when the user asks whether a slot is available.",
        config: {
          delaySeconds: 6,
          outcome: "success",
          responseText: "",
          messages: ["Let me check that for you."],
          messagesOrder: "random",
        },
      } satisfies TestTool;
  }
}

const browserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
};

/** A complete config carrying every schema default — the "New agent" seed. */
export function createDefaultAgent(): AgentConfig {
  return {
    name: "Console test agent",
    description: "",
    languages: ["en"],
    systemPrompt:
      "You are {{agent_name}}, a friendly voice assistant. Keep replies short and conversational — this is a live phone-style call.\n\nThe caller's name is {{customer_name}}.",
    timezone: browserTimezone(),
    greeting: {
      firstMessages: ["Hey {{customer_name}}! How can I help you today?"],
      interruptible: false,
      speakFirst: "agent",
      agentDelayS: 0,
      userTimeoutS: 3,
    },
    llm: { provider: "openai", model: "gpt-4.1", temperature: 1, maxTokens: 251, prewarm: true },
    stt: {
      provider: "soniox",
      model: null,
      interruptionMinWords: 0,
      soniox: { contextTerms: "", endpointSensitivity: 0.3, endpointLatencyAdjustmentLevel: 2, maxEndpointDelayMs: 2000 },
      flux: { eotThreshold: 0.7, eotTimeoutMs: 2000, keyterms: "" },
      assemblyai: { mode: "balanced", keyterms: "", voiceFocus: "near-field", voiceFocusThreshold: 0.9 },
      sarvam: { mode: "transcribe", highVadSensitivity: false },
      cartesia: {
        turnStartThreshold: 0.8,
        turnEagerEndThreshold: 0.4,
        turnEndThreshold: 0.2,
        turnEndTimeoutMs: 2000,
        keyterms: "",
      },
    },
    tts: {
      provider: "elevenlabs",
      model: null,
      voice: null,
      elevenlabs: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0,
        useSpeakerBoost: true,
        speed: 1,
        autoMode: true,
        applyTextNormalization: "auto",
      },
      cartesia: { speed: 1, volume: 1.5 },
      smallest: { speed: 1 },
      sarvam: { pace: 1, temperature: 0.6 },
      xai: { speed: 1, optimizeStreamingLatency: 0, textNormalization: false },
      inworld: { speakingRate: 1, temperature: 1 },
    },
    noiseGate: { enabled: true, model: "voice-focus", enhancementLevel: 0.8 },
    backgroundSound: { enabled: false, sound: "library", volume: 0.08 },
    taskSound: { enabled: false, sound: "typing", volume: 0.35, startAfterMs: 800 },
    acknowledgeSounds: {
      enabled: false,
      words: "hmm, hm hmm, okay",
      wordOrder: "round-robin",
      volume: 1,
      thresholdS: 3,
      probability: 0.8,
    },
    fillerWords: { enabled: false, words: "so, yeah, okay", wordOrder: "round-robin", thresholdMs: 300, probability: 0.75 },
    maxCallDurationS: 610,
    userIdleTimeoutS: 7,
    userIdleMessages: ["Are you still there?"],
    userIdleMaxRetries: 2,
    tools: [
      {
        type: "endCall",
        name: "end_call",
        description: DEFAULT_END_CALL_DESCRIPTION,
        config: { messageType: "custom", customMessages: ["Goodbye!"], audioRecordingId: null },
      },
    ],
    voicemailDetection: true,
    webhook: null,
    enableSummarization: false,
    recordInProviderConsole: null,
    contextVariables: { agent_name: "Zoxa" },
  };
}

/**
 * The server's own defaults for an omitted key (what Pydantic fills in).
 * The form reads through these so a key removed in the raw editor displays
 * what the server will actually use — never the "new agent" sample content.
 */
export function schemaDefaults(): AgentConfig {
  const seed = createDefaultAgent();
  return {
    ...seed,
    name: "",
    systemPrompt: "",
    timezone: "Asia/Kolkata",
    greeting: { ...seed.greeting, firstMessages: [] },
    llm: { ...seed.llm, model: "", temperature: 1 },
    tools: [],
    contextVariables: {},
  };
}
