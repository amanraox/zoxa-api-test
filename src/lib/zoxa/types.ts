/**
 * zoxa public API types.
 *
 * `AgentConfig` mirrors the server's Pydantic schema (`api/schemas/agent_config.py`)
 * field-for-field. The wire format is camelCase and the server validates with
 * `extra="forbid"`, so an unknown key is a 400 — never invent fields here.
 * Ranges are documented inline; the editor controls enforce them.
 */

export type STTProvider = "soniox" | "flux" | "assemblyai" | "sarvam" | "cartesia";
export type TTSProvider = "elevenlabs" | "cartesia" | "smallest" | "sarvam" | "xai" | "inworld";
export type LLMProvider = "openai" | "qwen" | "google" | "anthropic";

export const STT_PROVIDERS: STTProvider[] = ["soniox", "flux", "assemblyai", "sarvam", "cartesia"];
export const TTS_PROVIDERS: TTSProvider[] = ["elevenlabs", "cartesia", "smallest", "sarvam", "xai", "inworld"];
export const LLM_PROVIDERS: LLMProvider[] = ["openai", "anthropic", "google", "qwen"];

/* ───────────────────────────── Audio layer ───────────────────────────── */

export interface NoiseGateConfig {
  enabled: boolean;
  model: "voice-focus" | "noise-suppression";
  enhancementLevel: number; // 0–1
}

export interface BackgroundSoundConfig {
  enabled: boolean;
  sound: "crowd" | "library" | "restaurant" | "supermarket";
  volume: number; // 0.02–0.20
}

export interface TaskSoundConfig {
  enabled: boolean;
  sound: "typing" | "page-turn";
  volume: number; // 0.05–0.60
  startAfterMs: number; // 0–5000
}

export interface AcknowledgeSoundsConfig {
  enabled: boolean;
  words: string;
  wordOrder: "random" | "round-robin";
  volume: number; // 0.1–1.5
  thresholdS: number; // 2–15
  probability: number; // 0.05–1
}

export interface FillerWordsConfig {
  enabled: boolean;
  words: string;
  wordOrder: "random" | "round-robin";
  thresholdMs: number; // 100–3000
  probability: number; // 0.05–1
}

/* ──────────────────────────────── STT ──────────────────────────────── */

export interface SonioxSTTConfig {
  contextTerms: string;
  endpointSensitivity: number; // -1–1
  endpointLatencyAdjustmentLevel: number; // 0–3
  maxEndpointDelayMs: number; // 500–3000
}

export interface FluxSTTConfig {
  eotThreshold: number; // 0.5–0.9
  eotTimeoutMs: number; // 500–60000
  keyterms: string;
}

export interface AssemblyAISTTConfig {
  mode: "balanced" | "min_latency" | "max_accuracy";
  keyterms: string;
  voiceFocus: "off" | "near-field" | "far-field";
  voiceFocusThreshold: number; // 0–1
}

export interface SarvamSTTConfig {
  mode: "transcribe" | "verbatim" | "translit" | "codemix";
  highVadSensitivity: boolean;
}

export interface CartesiaSTTConfig {
  turnStartThreshold: number; // 0.5–0.9
  turnEagerEndThreshold: number; // 0.3–0.8 (accepted, inactive)
  turnEndThreshold: number; // 0.05–0.5
  turnEndTimeoutMs: number; // 640–11200
  keyterms: string;
}

export interface STTConfig {
  provider: STTProvider;
  model: string | null;
  interruptionMinWords: number; // 0–10
  soniox: SonioxSTTConfig;
  flux: FluxSTTConfig;
  assemblyai: AssemblyAISTTConfig;
  sarvam: SarvamSTTConfig;
  cartesia: CartesiaSTTConfig;
}

/* ──────────────────────────────── LLM ──────────────────────────────── */

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number; // 0–2 (Anthropic clamped to 1)
  maxTokens: number; // 1–4096
  prewarm: boolean;
}

/* ──────────────────────────────── TTS ──────────────────────────────── */

export interface ElevenLabsTTSConfig {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number; // 0.7–1.2
  autoMode: boolean;
  applyTextNormalization: "auto" | "on" | "off";
}

export interface CartesiaTTSConfig {
  speed: number; // 0.6–1.5
  volume: number; // 0.5–2
}

export interface SmallestTTSConfig {
  speed: number; // 0.5–2
}

export interface SarvamTTSConfig {
  pace: number; // 0.5–2
  temperature: number; // 0.01–1
}

export interface XAITTSConfig {
  speed: number; // 0.7–1.5
  optimizeStreamingLatency: number; // 0–2
  textNormalization: boolean;
}

export interface InworldTTSConfig {
  speakingRate: number; // 0.5–1.5
  temperature: number; // 0.01–2
}

export interface TTSConfig {
  provider: TTSProvider;
  model: string | null;
  voice: string | null;
  elevenlabs: ElevenLabsTTSConfig;
  cartesia: CartesiaTTSConfig;
  smallest: SmallestTTSConfig;
  sarvam: SarvamTTSConfig;
  xai: XAITTSConfig;
  inworld: InworldTTSConfig;
}

/* ─────────────────────────────── Tools ─────────────────────────────── */

export type MessagesOrder = "random" | "in-order";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpServerConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string> | null;
  /** snake_case on the wire — HttpServerConfig has no camelCase alias. 1000–30000. */
  timeout_ms?: number;
}

export interface FunctionToolConfig {
  server: HttpServerConfig;
  parameters?: Record<string, unknown> | null;
  async?: boolean;
  messages?: string[];
  messagesOrder?: MessagesOrder;
}

export interface KnowledgeBaseEntry {
  name: string;
  description: string;
  documentIds: string[];
}

export interface QueryToolConfig {
  knowledgeBases: KnowledgeBaseEntry[];
  messages?: string[];
  messagesOrder?: MessagesOrder;
  timeout?: number; // 1–30
}

export interface EndCallToolConfig {
  messageType: "custom" | "audio" | "none";
  customMessages?: string[];
  audioRecordingId?: string | null;
}

export interface TransferCallToolConfig {
  destination: string;
  customMessage?: string | null;
  timeout?: number; // 5–300
  recordTransfer?: boolean;
}

export interface TestToolConfig {
  delaySeconds: number; // 0.5–30
  outcome: "success" | "failure";
  responseText: string;
  messages: string[];
  messagesOrder?: MessagesOrder;
}

export interface FunctionTool { type: "function"; name: string; description?: string; config: FunctionToolConfig }
export interface QueryTool { type: "query"; name: string; description?: string; config: QueryToolConfig }
export interface EndCallTool { type: "endCall"; name?: string; description?: string; config: EndCallToolConfig }
export interface TransferCallTool { type: "transferCall"; name: string; description?: string; config: TransferCallToolConfig }
export interface TestTool { type: "testTool"; name: string; description?: string; config: TestToolConfig }

export type InlineTool = FunctionTool | QueryTool | EndCallTool | TransferCallTool | TestTool;
export type InlineToolType = InlineTool["type"];
/** A tools[] entry: an inline tool, or a bare UUID reference to a saved tool. */
export type AgentTool = InlineTool | string;

/* ───────────────────────────── Envelope ───────────────────────────── */

export interface GreetingConfig {
  firstMessages: string[]; // ≤5, [] → LLM improvises
  interruptible: boolean;
  speakFirst: "agent" | "user";
  agentDelayS: number; // 0–4
  userTimeoutS: number; // 1–5
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string> | null;
}

export interface AgentConfig {
  name: string; // 1–120
  description: string;
  languages: string[]; // ordered; [0] = primary
  systemPrompt: string;
  timezone: string;
  greeting: GreetingConfig;
  llm: LLMConfig;
  stt: STTConfig;
  tts: TTSConfig;
  noiseGate: NoiseGateConfig;
  backgroundSound: BackgroundSoundConfig;
  taskSound: TaskSoundConfig;
  acknowledgeSounds: AcknowledgeSoundsConfig;
  fillerWords: FillerWordsConfig;
  maxCallDurationS: number; // 10–7200, multiple of 10
  userIdleTimeoutS: number; // 3–25
  userIdleMessages: string[]; // ≤5
  userIdleMaxRetries: number; // 1–5
  tools: AgentTool[];
  voicemailDetection: boolean;
  webhook: WebhookConfig | null;
  enableSummarization: boolean;
  recordInProviderConsole: boolean | null;
  contextVariables: Record<string, string>;
}

/* ─────────────────────────── API responses ─────────────────────────── */

export interface AgentEnvelope {
  uuid: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  config: AgentConfig;
}

export interface AgentListResponse {
  agents: AgentEnvelope[];
  total: number;
  limit: number;
  offset: number;
}

export interface AgentTemplate {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  system_prompt: string;
  config: Partial<AgentConfig>;
}

export interface AvailableModel {
  id: string;
  type: "llm" | "stt" | "tts";
  provider: string;
  name: string;
  is_default: boolean;
  languages: string[] | null;
}

export interface VoiceInfo {
  voice_id: string;
  name: string;
  description?: string | null;
  accent?: string | null;
  gender?: string | null;
  language?: string | null;
  preview_url?: string | null;
}

export interface SavedTool {
  id: number;
  tool_uuid: string;
  name: string;
  description?: string | null;
  category: string;
  status: string;
}

export interface KbDocument {
  document_uuid: string;
  filename: string;
  processing_status: string;
  total_chunks: number;
}

/** The POST /call body for the raw-PCM WebSocket transport. */
export interface CallRequestBody {
  transport?: "websocket";
  agent?: AgentConfig | Record<string, unknown>;
  agentId?: string;
  contextVariables?: Record<string, string>;
  [extra: string]: unknown;
}

export interface CreateCallResponse {
  callId: string;
  audioUrl: string;
  transport: string;
  status: string;
  /** Added by the local proxy: the absolute, authenticated audio socket URL. */
  wsUrl: string;
}

export interface CallTurn {
  turnNo: number;
  durationMs?: number | null;
  wasInterrupted: boolean;
  userToBotMs?: number | null;
  llmTtfbMs?: number | null;
  ttsTtfbMs?: number | null;
  sttTtfbMs?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  llmModel?: string | null;
  toolCallCount: number;
  llmCostUsd?: number | null;
}

export interface CallRecording {
  url?: string;
  kind?: string;
  [k: string]: unknown;
}

export interface CallDetail {
  callId: string;
  transport: string;
  status: string;
  endedReason?: string | null;
  connectionStatus?: string | null;
  agentName?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  createdAt: string;
  cost?: number | null;
  costBreakdown?: Record<string, unknown> | null;
  configSnapshot: Record<string, unknown>;
  contextVariables?: Record<string, unknown> | null;
  recordings?: CallRecording[] | null;
  transcript_url?: string | null;
  usageInfo?: Record<string, unknown> | null;
  analysis?: Record<string, unknown> | null;
  latencySummary?: Record<string, unknown> | null;
  tags: string[];
  turns: CallTurn[];
}

export interface CallReport {
  detail: CallDetail;
  /** Transcript document fetched server-side from `transcript_url`, if any. */
  transcript: unknown | null;
}
