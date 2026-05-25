export interface ModelConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number | null;
}

export interface VoiceConfig {
  provider: string;
  model: string;
  voiceId: string;
  speed: number | null;
  language: string | null;
  stability: number | null;
  similarityBoost: number | null;
  style: number | null;
}

export interface TranscriberConfig {
  provider: string;
  model: string;
  language: string;
}

export interface EndCallConfig {
  enabled: boolean;
  prompt: string | null;
}

export interface VadConfig {
  sensitivity: number;
  silenceThresholdMs: number;
  startSecs: number;
  minVolume: number;
}

export interface TurnDetectionConfig {
  strategy: "transcription" | "turn_analyzer";
  smartTurnStopSecs: number;
}

export interface InterruptionConfig {
  enabled: boolean;
  minWords: number;
}

export interface CallLimitsConfig {
  maxDuration: number;
  userIdleTimeout: number;
  userIdlePrompt: string;
  userIdleMaxRetries: number;
}

export interface WebhookConfig {
  url: string | null;
  headers: Record<string, string> | null;
  enableSummarization: boolean;
}

export interface AgentConfig {
  systemPrompt: string;
  firstMessage: string;
  firstMessageInterruptible: boolean;
  speakFirst: "agent" | "user";
  userSpeakFirstTimeout: number;
  agentSpeakFirstDelay: number;
  model: ModelConfig;
  voice: VoiceConfig;
  transcriber: TranscriberConfig;
  endCall: EndCallConfig;
  noiseSuppression: boolean;
  vad: VadConfig;
  turnDetection: TurnDetectionConfig;
  interruption: InterruptionConfig;
  callLimits: CallLimitsConfig;
}

export interface CallPayload {
  agentId?: string;
  agent?: AgentConfig;
  overrides?: Record<string, unknown>;
  contextVariables?: Record<string, string>;
  webhookUrl?: string;
}

export interface CallResponse {
  callId: string;
  signalingUrl: string;
  status: string;
}

export type CallStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";
export type ConfigMode = "inline" | "saved";
