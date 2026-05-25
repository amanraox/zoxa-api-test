"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useZoxaCall } from "@/hooks/useZoxaCall";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { LiveWaveform } from "@/components/ui/live-waveform";
import type { AgentConfig, ConfigMode, CallPayload } from "@/lib/types";
import {
  Phone,
  PhoneOff,
  Settings2,
  ChevronDown,
  Plus,
  X,
  Mic,
  Bot,
  Sparkles,
  Braces,
  Webhook,
  Variable,
  Volume2,
  Languages,
  Brain,
  Sun,
  Moon,
  Timer,
  Shield,
  AudioLines,
  SlidersHorizontal,
  PhoneForwarded,
  MessageSquare,
  Palette,
  Eye,
  Maximize2,
  Shuffle,
} from "lucide-react";

const Orb = dynamic(() => import("@/components/ui/orb").then((m) => m.Orb), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center">
      <div className="w-24 h-24 rounded-full bg-accent/10 animate-pulse" />
    </div>
  ),
});

const DEFAULT_CONFIG: AgentConfig = {
  systemPrompt:
    "You are a helpful and friendly AI assistant. Keep your responses concise and conversational. You are speaking on a voice call so be natural.",
  firstMessage: "Hey there! How can I help you today?",
  firstMessageInterruptible: false,
  speakFirst: "agent",
  userSpeakFirstTimeout: 3.0,
  agentSpeakFirstDelay: 0.0,
  model: {
    provider: "openai",
    model: "gpt-4.1-mini",
    temperature: 0.7,
    maxTokens: null,
  },
  voice: {
    provider: "cartesia",
    model: "sonic-3.5",
    voiceId: "694f9389-aac1-45b6-b726-9d9369183238",
    speed: null,
    language: null,
    stability: null,
    similarityBoost: null,
    style: null,
  },
  transcriber: {
    provider: "deepgram",
    model: "nova-3-general",
    language: "en",
  },
  endCall: {
    enabled: false,
    prompt: null,
  },
  noiseSuppression: false,
  vad: {
    sensitivity: 0.85,
    silenceThresholdMs: 200,
    startSecs: 0.2,
    minVolume: 0.6,
  },
  turnDetection: {
    strategy: "turn_analyzer",
    smartTurnStopSecs: 2.0,
  },
  interruption: {
    enabled: true,
    minWords: 0,
  },
  callLimits: {
    maxDuration: 610,
    userIdleTimeout: 7,
    userIdlePrompt: "Are you still there?",
    userIdleMaxRetries: 2,
  },
};

type OrbAgentState = "listening" | "thinking" | "talking" | null;

function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-foreground/80 hover:text-foreground hover:bg-white/[0.02] transition-colors"
      >
        <Icon size={14} className="text-muted-foreground" />
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown
          size={14}
          className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 animate-fade-in border-t border-border/40">
          {children}
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{children}</label>;
}

function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{children}</p>;
}

export default function Home() {
  const [dark, setDark] = useState(false);
  const [configMode, setConfigMode] = useState<ConfigMode>("inline");
  const [agentId, setAgentId] = useState("");
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [contextVars, setContextVars] = useState<{ key: string; value: string }[]>([]);
  const [overridesJson, setOverridesJson] = useState("");
  const [showConfig, setShowConfig] = useState(true);
  const [showOrbSettings, setShowOrbSettings] = useState(false);

  // Orb customization
  const [orbSettings, setOrbSettings] = useState({
    idleColors: ["#4a9eed", "#80d0e0"] as [string, string],
    idleColorsLight: ["#2792dc", "#9ce6e6"] as [string, string],
    connectingColors: ["#f59e0b", "#fbbf24"] as [string, string],
    connectingColorsLight: ["#f59e0b", "#fcd34d"] as [string, string],
    connectedColors: ["#2792dc", "#9ce6e6"] as [string, string],
    connectedColorsLight: ["#2792dc", "#9ce6e6"] as [string, string],
    seed: undefined as number | undefined,
    previewState: "none" as "none" | "thinking" | "listening" | "talking",
    previewInputVolume: 0.5,
    previewOutputVolume: 0.5,
    usePreview: false,
    size: 384,
    // Shader tweaks
    timeSpeed: 0.5,
    animSpeedMultiplier: 1.0,
    distortionMin: 0.08,
    distortionMax: 0.25,
    ovalSoftness: 0.6,
    ovalHeightMax: 3.5,
    ovalHeightMin: 2.5,
    ovalWidthBase: 0.5,
    ovalWidthNoise: 0.3,
    ovalAlpha: 0.85,
    ringIntensity: 1.0,
    colorLerpSpeed: 0.08,
    gradientContrast: 0.1,
    morphSpeed: 0.05,
    flowRadiusScale: 0.03,
    flowAnimScale: 0.2,
    ovalRotationAmplitude: 0.5,
    ovalRotationPeriod: 20.0,
  });

  const updateOrb = <K extends keyof typeof orbSettings>(key: K, value: (typeof orbSettings)[K]) =>
    setOrbSettings((s) => ({ ...s, [key]: value }));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Set light on mount
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  const { status, error, callId, startCall, endCall, getInputVolume, getOutputVolume } =
    useZoxaCall();

  const [agentState, setAgentState] = useState<OrbAgentState>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (status !== "connected") {
      setAgentState(status === "connecting" ? "thinking" : null);
      return;
    }
    const tick = () => {
      const input = getInputVolume();
      const output = getOutputVolume();
      if (output > 0.05) setAgentState("talking");
      else if (input > 0.05) setAgentState("listening");
      else setAgentState("thinking");
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [status, getInputVolume, getOutputVolume]);

  const handleStart = useCallback(() => {
    const payload: CallPayload = {};
    if (configMode === "saved") {
      payload.agentId = agentId;
    } else {
      payload.agent = config;
    }
    if (webhookUrl.trim()) payload.webhookUrl = webhookUrl.trim();
    if (contextVars.length > 0) {
      const vars: Record<string, string> = {};
      contextVars.forEach(({ key, value }) => {
        if (key.trim()) vars[key.trim()] = value;
      });
      if (Object.keys(vars).length > 0) payload.contextVariables = vars;
    }
    if (overridesJson.trim()) {
      try { payload.overrides = JSON.parse(overridesJson); } catch { /* skip */ }
    }
    setShowConfig(false);
    startCall(payload);
  }, [configMode, agentId, config, webhookUrl, contextVars, overridesJson, startCall]);

  const handleEnd = useCallback(() => endCall(), [endCall]);

  const updateModel = (field: string, value: string | number) =>
    setConfig((c) => ({ ...c, model: { ...c.model, [field]: value } }));
  const updateVoice = (field: string, value: string) =>
    setConfig((c) => ({ ...c, voice: { ...c.voice, [field]: value } }));
  const updateTranscriber = (field: string, value: string) =>
    setConfig((c) => ({ ...c, transcriber: { ...c.transcriber, [field]: value } }));

  const addContextVar = () => setContextVars((v) => [...v, { key: "", value: "" }]);
  const removeContextVar = (i: number) => setContextVars((v) => v.filter((_, idx) => idx !== i));
  const updateContextVar = (i: number, field: "key" | "value", val: string) =>
    setContextVars((v) => v.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));

  const isActive = status === "connecting" || status === "connected";

  const inputCls =
    "w-full bg-input/50 border border-border/60 rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/50 focus:border-ring/50 transition-all";
  const selectCls =
    "w-full bg-input/50 border border-border/60 rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 focus:border-ring/50 transition-all appearance-none";

  return (
    <div className="flex flex-col flex-1 items-center min-h-screen bg-background">
      {/* Header */}
      <header className="w-full border-b border-border/40 bg-background/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
              <Mic size={14} className="text-background" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Zoxa</span>
            <span className="text-[11px] text-muted-foreground font-mono bg-card px-1.5 py-0.5 rounded border border-border/60">voice</span>
          </div>
          <div className="flex items-center gap-3">
            {isActive && (
              <div className="flex items-center gap-2 text-[13px]">
                <div className={`w-1.5 h-1.5 rounded-full ${status === "connected" ? "bg-success" : "bg-amber-400"} animate-pulse`} />
                <span className="text-muted-foreground">{status === "connected" ? "Live" : "Connecting"}</span>
                {callId && (
                  <code className="text-[10px] text-muted-foreground/50 font-mono">{callId.slice(0, 8)}</code>
                )}
              </div>
            )}
            {!isActive && (
              <button
                onClick={() => setShowConfig((s) => !s)}
                className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-card border border-transparent hover:border-border/60"
              >
                <Settings2 size={14} />
                {showConfig ? "Hide" : "Config"}
              </button>
            )}
            <button
              onClick={() => setDark((d) => !d)}
              className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border/60 transition-colors"
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-5 py-6 flex flex-col lg:flex-row gap-6">
        {/* Config Panel */}
        {showConfig && !isActive && (
          <aside className="w-full lg:w-[440px] shrink-0 animate-fade-in overflow-y-auto max-h-[calc(100vh-100px)] space-y-3 pr-1">
            {/* Mode Toggle */}
            <div className="rounded-xl border border-border/60 bg-card/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bot size={14} className="text-muted-foreground" />
                <span className="text-[13px] font-medium">Agent Source</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-input/30 rounded-lg">
                {(["inline", "saved"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setConfigMode(mode)}
                    className={`px-3 py-2 rounded-md text-[13px] font-medium transition-all ${
                      configMode === mode
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "inline" ? "Inline Config" : "Saved Agent"}
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Agent */}
            {configMode === "saved" && (
              <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3 animate-fade-in">
                <Label>Agent ID (UUID)</Label>
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className={`${inputCls} font-mono text-[12px]`}
                />
                <HelpText>Pre-configured agent from Zoxa dashboard</HelpText>
              </div>
            )}

            {/* Inline Config */}
            {configMode === "inline" && (
              <div className="space-y-3 animate-fade-in">
                {/* Prompts */}
                <Section title="Prompts" icon={Sparkles} defaultOpen={true}>
                  <div className="space-y-1.5">
                    <Label>System Prompt</Label>
                    <textarea
                      value={config.systemPrompt}
                      onChange={(e) => setConfig((c) => ({ ...c, systemPrompt: e.target.value }))}
                      rows={4}
                      className={`${inputCls} resize-y min-h-[80px]`}
                      placeholder="Instructions for the AI agent..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>First Message</Label>
                    <input
                      type="text"
                      value={config.firstMessage}
                      onChange={(e) => setConfig((c) => ({ ...c, firstMessage: e.target.value }))}
                      className={inputCls}
                      placeholder="What the agent says first..."
                    />
                  </div>
                </Section>

                {/* Model */}
                <Section title="LLM Model" icon={Brain} defaultOpen={true}>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Provider</Label>
                      <select value={config.model.provider} onChange={(e) => updateModel("provider", e.target.value)} className={selectCls}>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="groq">Groq</option>
                        <option value="xai">xAI</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Model</Label>
                      <input type="text" value={config.model.model} onChange={(e) => updateModel("model", e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Temperature</Label>
                      <span className="text-[12px] font-mono text-accent">{config.model.temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={config.model.temperature}
                      onChange={(e) => updateModel("temperature", parseFloat(e.target.value))}
                      className="w-full accent-accent h-1.5"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground/50">
                      <span>Precise</span>
                      <span>Balanced</span>
                      <span>Creative</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max Tokens</Label>
                    <input type="number" min="1" max="4000" value={config.model.maxTokens ?? ""} onChange={(e) => setConfig((c) => ({ ...c, model: { ...c.model, maxTokens: e.target.value ? parseInt(e.target.value) : null } }))} className={inputCls} placeholder="Default (no limit)" />
                    <HelpText>1-4000, leave empty for default</HelpText>
                  </div>
                </Section>

                {/* Voice */}
                <Section title="Voice (TTS)" icon={Volume2} defaultOpen={true}>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Provider</Label>
                      <select value={config.voice.provider} onChange={(e) => updateVoice("provider", e.target.value)} className={selectCls}>
                        <option value="cartesia">Cartesia</option>
                        <option value="elevenlabs">ElevenLabs</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Model</Label>
                      <input type="text" value={config.voice.model} onChange={(e) => updateVoice("model", e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Voice ID</Label>
                    <input
                      type="text"
                      value={config.voice.voiceId}
                      onChange={(e) => updateVoice("voiceId", e.target.value)}
                      className={`${inputCls} font-mono text-[12px]`}
                      placeholder="Provider-specific voice identifier"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Speed</Label>
                      <input type="number" min="0.25" max="4" step="0.25" value={config.voice.speed ?? ""} onChange={(e) => setConfig((c) => ({ ...c, voice: { ...c.voice, speed: e.target.value ? parseFloat(e.target.value) : null } }))} className={inputCls} placeholder="Default" />
                      <HelpText>0.25-4.0</HelpText>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Language</Label>
                      <input type="text" value={config.voice.language ?? ""} onChange={(e) => setConfig((c) => ({ ...c, voice: { ...c.voice, language: e.target.value || null } }))} className={inputCls} placeholder="Auto" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Stability</Label>
                      <input type="number" min="0" max="1" step="0.1" value={config.voice.stability ?? ""} onChange={(e) => setConfig((c) => ({ ...c, voice: { ...c.voice, stability: e.target.value ? parseFloat(e.target.value) : null } }))} className={inputCls} placeholder="--" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Similarity</Label>
                      <input type="number" min="0" max="1" step="0.1" value={config.voice.similarityBoost ?? ""} onChange={(e) => setConfig((c) => ({ ...c, voice: { ...c.voice, similarityBoost: e.target.value ? parseFloat(e.target.value) : null } }))} className={inputCls} placeholder="--" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Style</Label>
                      <input type="number" min="0" max="1" step="0.1" value={config.voice.style ?? ""} onChange={(e) => setConfig((c) => ({ ...c, voice: { ...c.voice, style: e.target.value ? parseFloat(e.target.value) : null } }))} className={inputCls} placeholder="--" />
                    </div>
                  </div>
                  <HelpText>Stability, similarity, and style are ElevenLabs-specific settings (0-1)</HelpText>
                </Section>

                {/* Transcriber */}
                <Section title="Transcriber (STT)" icon={Languages} defaultOpen={true}>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Provider</Label>
                      <select value={config.transcriber.provider} onChange={(e) => updateTranscriber("provider", e.target.value)} className={selectCls}>
                        <option value="deepgram">Deepgram</option>
                        <option value="openai">OpenAI</option>
                        <option value="sarvam">Sarvam</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Model</Label>
                      <input type="text" value={config.transcriber.model} onChange={(e) => updateTranscriber("model", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Language</Label>
                      <input type="text" value={config.transcriber.language} onChange={(e) => updateTranscriber("language", e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </Section>

                {/* Conversation Flow */}
                <Section title="Conversation Flow" icon={MessageSquare} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Speak First</Label>
                      <select value={config.speakFirst} onChange={(e) => setConfig((c) => ({ ...c, speakFirst: e.target.value as "agent" | "user" }))} className={selectCls}>
                        <option value="agent">Agent</option>
                        <option value="user">User</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>First Msg Interruptible</Label>
                      <select value={config.firstMessageInterruptible ? "true" : "false"} onChange={(e) => setConfig((c) => ({ ...c, firstMessageInterruptible: e.target.value === "true" }))} className={selectCls}>
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>User Speak First Timeout</Label>
                      <input type="number" min="1" max="5" step="0.5" value={config.userSpeakFirstTimeout} onChange={(e) => setConfig((c) => ({ ...c, userSpeakFirstTimeout: parseFloat(e.target.value) }))} className={inputCls} />
                      <HelpText>1-5 seconds</HelpText>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Agent Speak First Delay</Label>
                      <input type="number" min="0" max="4" step="0.5" value={config.agentSpeakFirstDelay} onChange={(e) => setConfig((c) => ({ ...c, agentSpeakFirstDelay: parseFloat(e.target.value) }))} className={inputCls} />
                      <HelpText>0-4 seconds</HelpText>
                    </div>
                  </div>
                </Section>

                {/* Interruption */}
                <Section title="Interruption" icon={PhoneForwarded} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Enabled</Label>
                      <select value={config.interruption.enabled ? "true" : "false"} onChange={(e) => setConfig((c) => ({ ...c, interruption: { ...c.interruption, enabled: e.target.value === "true" } }))} className={selectCls}>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Min Words</Label>
                      <input type="number" min="0" max="10" value={config.interruption.minWords} onChange={(e) => setConfig((c) => ({ ...c, interruption: { ...c.interruption, minWords: parseInt(e.target.value) } }))} className={inputCls} />
                      <HelpText>0-10, words before interrupt allowed</HelpText>
                    </div>
                  </div>
                </Section>

                {/* Turn Detection */}
                <Section title="Turn Detection" icon={AudioLines} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Strategy</Label>
                      <select value={config.turnDetection.strategy} onChange={(e) => setConfig((c) => ({ ...c, turnDetection: { ...c.turnDetection, strategy: e.target.value as "transcription" | "turn_analyzer" } }))} className={selectCls}>
                        <option value="turn_analyzer">Turn Analyzer</option>
                        <option value="transcription">Transcription</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Smart Turn Stop (s)</Label>
                      <input type="number" min="0.1" max="5" step="0.1" value={config.turnDetection.smartTurnStopSecs} onChange={(e) => setConfig((c) => ({ ...c, turnDetection: { ...c.turnDetection, smartTurnStopSecs: parseFloat(e.target.value) } }))} className={inputCls} />
                      <HelpText>0.1-5 seconds</HelpText>
                    </div>
                  </div>
                </Section>

                {/* VAD */}
                <Section title="Voice Activity Detection" icon={SlidersHorizontal} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Sensitivity</Label>
                      <input type="number" min="0" max="1" step="0.05" value={config.vad.sensitivity} onChange={(e) => setConfig((c) => ({ ...c, vad: { ...c.vad, sensitivity: parseFloat(e.target.value) } }))} className={inputCls} />
                      <HelpText>0-1 (default 0.85)</HelpText>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Silence Threshold (ms)</Label>
                      <input type="number" min="0" max="10000" step="50" value={config.vad.silenceThresholdMs} onChange={(e) => setConfig((c) => ({ ...c, vad: { ...c.vad, silenceThresholdMs: parseInt(e.target.value) } }))} className={inputCls} />
                      <HelpText>0-10000ms (default 200)</HelpText>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Start Secs</Label>
                      <input type="number" min="0.05" max="2" step="0.05" value={config.vad.startSecs} onChange={(e) => setConfig((c) => ({ ...c, vad: { ...c.vad, startSecs: parseFloat(e.target.value) } }))} className={inputCls} />
                      <HelpText>0.05-2s (default 0.2)</HelpText>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Min Volume</Label>
                      <input type="number" min="0" max="1" step="0.05" value={config.vad.minVolume} onChange={(e) => setConfig((c) => ({ ...c, vad: { ...c.vad, minVolume: parseFloat(e.target.value) } }))} className={inputCls} />
                      <HelpText>0-1 (default 0.6)</HelpText>
                    </div>
                  </div>
                </Section>

                {/* Call Limits */}
                <Section title="Call Limits" icon={Timer} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Max Duration (s)</Label>
                      <input type="number" min="10" max="7200" value={config.callLimits.maxDuration} onChange={(e) => setConfig((c) => ({ ...c, callLimits: { ...c.callLimits, maxDuration: parseInt(e.target.value) } }))} className={inputCls} />
                      <HelpText>10-7200s (default 610)</HelpText>
                    </div>
                    <div className="space-y-1.5">
                      <Label>User Idle Timeout (s)</Label>
                      <input type="number" min="3" max="21" value={config.callLimits.userIdleTimeout} onChange={(e) => setConfig((c) => ({ ...c, callLimits: { ...c.callLimits, userIdleTimeout: parseInt(e.target.value) } }))} className={inputCls} />
                      <HelpText>3-21s (default 7)</HelpText>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>User Idle Prompt</Label>
                    <input type="text" value={config.callLimits.userIdlePrompt} onChange={(e) => setConfig((c) => ({ ...c, callLimits: { ...c.callLimits, userIdlePrompt: e.target.value } }))} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>User Idle Max Retries</Label>
                    <input type="number" min="1" max="10" value={config.callLimits.userIdleMaxRetries} onChange={(e) => setConfig((c) => ({ ...c, callLimits: { ...c.callLimits, userIdleMaxRetries: parseInt(e.target.value) } }))} className={inputCls} />
                    <HelpText>1-10 (default 2)</HelpText>
                  </div>
                </Section>

                {/* End Call & Misc */}
                <Section title="End Call & Misc" icon={Shield} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>End Call Tool</Label>
                      <select value={config.endCall.enabled ? "true" : "false"} onChange={(e) => setConfig((c) => ({ ...c, endCall: { ...c.endCall, enabled: e.target.value === "true" } }))} className={selectCls}>
                        <option value="false">Disabled</option>
                        <option value="true">Enabled</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Noise Suppression</Label>
                      <select value={config.noiseSuppression ? "true" : "false"} onChange={(e) => setConfig((c) => ({ ...c, noiseSuppression: e.target.value === "true" }))} className={selectCls}>
                        <option value="false">Off</option>
                        <option value="true">On</option>
                      </select>
                    </div>
                  </div>
                  {config.endCall.enabled && (
                    <div className="space-y-1.5 animate-fade-in">
                      <Label>End Call Prompt</Label>
                      <textarea
                        value={config.endCall.prompt || ""}
                        onChange={(e) => setConfig((c) => ({ ...c, endCall: { ...c.endCall, prompt: e.target.value || null } }))}
                        rows={3}
                        className={`${inputCls} resize-y`}
                        placeholder="Instructions for when the agent should end the call..."
                      />
                    </div>
                  )}
                </Section>
              </div>
            )}

            {/* Call Options */}
            <div className="space-y-3">
              {/* Webhook */}
              <Section title="Webhook" icon={Webhook} defaultOpen={false}>
                <div className="space-y-1.5">
                  <Label>Callback URL</Label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className={inputCls}
                    placeholder="https://your-server.com/webhook"
                  />
                  <HelpText>Receives call.started, call.ended, call.completed events</HelpText>
                </div>
              </Section>

              {/* Context Variables */}
              <Section title="Context Variables" icon={Variable} defaultOpen={false}>
                <HelpText>Key-value pairs for template substitution in prompts</HelpText>
                <div className="space-y-2">
                  {contextVars.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={v.key}
                        onChange={(e) => updateContextVar(i, "key", e.target.value)}
                        className={`${inputCls} flex-1`}
                        placeholder="key"
                      />
                      <input
                        type="text"
                        value={v.value}
                        onChange={(e) => updateContextVar(i, "value", e.target.value)}
                        className={`${inputCls} flex-1`}
                        placeholder="value"
                      />
                      <button
                        onClick={() => removeContextVar(i)}
                        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addContextVar}
                    className="w-full py-2 rounded-lg border border-dashed border-border/60 text-[12px] text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={12} />
                    Add Variable
                  </button>
                </div>
              </Section>

              {/* Overrides */}
              <Section title="Overrides (JSON)" icon={Braces} defaultOpen={false}>
                <HelpText>Per-call setting modifications as raw JSON</HelpText>
                <textarea
                  value={overridesJson}
                  onChange={(e) => setOverridesJson(e.target.value)}
                  rows={4}
                  className={`${inputCls} font-mono text-[11px] resize-y`}
                  placeholder={`{\n  "model": { "temperature": 0.5 },\n  "voice": { "voiceId": "..." }\n}`}
                />
                {overridesJson.trim() &&
                  (() => {
                    try {
                      JSON.parse(overridesJson);
                      return <span className="text-[11px] text-success">Valid JSON</span>;
                    } catch {
                      return <span className="text-[11px] text-destructive">Invalid JSON</span>;
                    }
                  })()}
              </Section>
            </div>

            {/* Orb Settings removed - now a floating panel near orb */}
            {false && (<div>

              {/* Size */}
              <Section title="Size & Shape" icon={Maximize2} defaultOpen={false}>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Orb Size</Label>
                    <span className="text-[12px] font-mono text-foreground/60">{orbSettings.size}px</span>
                  </div>
                  <input type="range" min="200" max="600" step="8" value={orbSettings.size} onChange={(e) => updateOrb("size", parseInt(e.target.value))} className="w-full accent-foreground h-1.5" />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50">
                    <span>200px</span>
                    <span>600px</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Seed (Animation Pattern)</Label>
                  <div className="flex gap-2">
                    <input type="number" min="0" max="999999" value={orbSettings.seed ?? ""} onChange={(e) => updateOrb("seed", e.target.value ? parseInt(e.target.value) : undefined)} className={`${inputCls} flex-1`} placeholder="Random" />
                    <button onClick={() => updateOrb("seed", Math.floor(Math.random() * 999999))} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
                      <Shuffle size={13} />
                    </button>
                  </div>
                  <HelpText>Set a seed for consistent patterns, or leave empty for random</HelpText>
                </div>
              </Section>

              {/* Colors - Dark */}
              <Section title="Colors (Dark Mode)" icon={Palette} defaultOpen={false}>
                <div className="space-y-3">
                  <div>
                    <Label>Idle State</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.idleColors[0]} onChange={(e) => updateOrb("idleColors", [e.target.value, orbSettings.idleColors[1]])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.idleColors[0]} onChange={(e) => updateOrb("idleColors", [e.target.value, orbSettings.idleColors[1]])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.idleColors[1]} onChange={(e) => updateOrb("idleColors", [orbSettings.idleColors[0], e.target.value])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.idleColors[1]} onChange={(e) => updateOrb("idleColors", [orbSettings.idleColors[0], e.target.value])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Connecting State</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.connectingColors[0]} onChange={(e) => updateOrb("connectingColors", [e.target.value, orbSettings.connectingColors[1]])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.connectingColors[0]} onChange={(e) => updateOrb("connectingColors", [e.target.value, orbSettings.connectingColors[1]])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.connectingColors[1]} onChange={(e) => updateOrb("connectingColors", [orbSettings.connectingColors[0], e.target.value])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.connectingColors[1]} onChange={(e) => updateOrb("connectingColors", [orbSettings.connectingColors[0], e.target.value])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Connected State</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.connectedColors[0]} onChange={(e) => updateOrb("connectedColors", [e.target.value, orbSettings.connectedColors[1]])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.connectedColors[0]} onChange={(e) => updateOrb("connectedColors", [e.target.value, orbSettings.connectedColors[1]])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.connectedColors[1]} onChange={(e) => updateOrb("connectedColors", [orbSettings.connectedColors[0], e.target.value])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.connectedColors[1]} onChange={(e) => updateOrb("connectedColors", [orbSettings.connectedColors[0], e.target.value])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              {/* Colors - Light */}
              <Section title="Colors (Light Mode)" icon={Palette} defaultOpen={false}>
                <div className="space-y-3">
                  <div>
                    <Label>Idle State</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.idleColorsLight[0]} onChange={(e) => updateOrb("idleColorsLight", [e.target.value, orbSettings.idleColorsLight[1]])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.idleColorsLight[0]} onChange={(e) => updateOrb("idleColorsLight", [e.target.value, orbSettings.idleColorsLight[1]])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.idleColorsLight[1]} onChange={(e) => updateOrb("idleColorsLight", [orbSettings.idleColorsLight[0], e.target.value])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.idleColorsLight[1]} onChange={(e) => updateOrb("idleColorsLight", [orbSettings.idleColorsLight[0], e.target.value])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Connecting State</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.connectingColorsLight[0]} onChange={(e) => updateOrb("connectingColorsLight", [e.target.value, orbSettings.connectingColorsLight[1]])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.connectingColorsLight[0]} onChange={(e) => updateOrb("connectingColorsLight", [e.target.value, orbSettings.connectingColorsLight[1]])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.connectingColorsLight[1]} onChange={(e) => updateOrb("connectingColorsLight", [orbSettings.connectingColorsLight[0], e.target.value])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.connectingColorsLight[1]} onChange={(e) => updateOrb("connectingColorsLight", [orbSettings.connectingColorsLight[0], e.target.value])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Connected State</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.connectedColorsLight[0]} onChange={(e) => updateOrb("connectedColorsLight", [e.target.value, orbSettings.connectedColorsLight[1]])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.connectedColorsLight[0]} onChange={(e) => updateOrb("connectedColorsLight", [e.target.value, orbSettings.connectedColorsLight[1]])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={orbSettings.connectedColorsLight[1]} onChange={(e) => updateOrb("connectedColorsLight", [orbSettings.connectedColorsLight[0], e.target.value])} className="w-8 h-8 rounded border border-border/60 bg-transparent cursor-pointer" />
                        <input type="text" value={orbSettings.connectedColorsLight[1]} onChange={(e) => updateOrb("connectedColorsLight", [orbSettings.connectedColorsLight[0], e.target.value])} className={`${inputCls} font-mono text-[11px]`} />
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              {/* Live Preview */}
              <Section title="Live Preview" icon={Eye} defaultOpen={false}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Enable Preview Mode</Label>
                    <button
                      onClick={() => updateOrb("usePreview", !orbSettings.usePreview)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${orbSettings.usePreview ? "bg-foreground" : "bg-border"}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-background absolute top-0.5 transition-all ${orbSettings.usePreview ? "left-5.5" : "left-0.5"}`} />
                    </button>
                  </div>
                  <HelpText>Override live audio with manual controls to test orb appearance</HelpText>

                  {orbSettings.usePreview && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="space-y-1.5">
                        <Label>Agent State</Label>
                        <div className="grid grid-cols-4 gap-1 p-1 bg-input/30 rounded-lg">
                          {(["none", "thinking", "listening", "talking"] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => updateOrb("previewState", s)}
                              className={`px-2 py-1.5 rounded text-[11px] font-medium capitalize transition-all ${
                                orbSettings.previewState === s
                                  ? "bg-foreground text-background"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {s === "none" ? "Idle" : s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>Input Volume (Mic)</Label>
                          <span className="text-[11px] font-mono text-foreground/60">{orbSettings.previewInputVolume.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.01" value={orbSettings.previewInputVolume} onChange={(e) => updateOrb("previewInputVolume", parseFloat(e.target.value))} className="w-full accent-foreground h-1.5" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>Output Volume (Agent)</Label>
                          <span className="text-[11px] font-mono text-foreground/60">{orbSettings.previewOutputVolume.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.01" value={orbSettings.previewOutputVolume} onChange={(e) => updateOrb("previewOutputVolume", parseFloat(e.target.value))} className="w-full accent-foreground h-1.5" />
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            </div>)}

            {/* Payload Preview */}
            <details className="rounded-xl border border-border/60 bg-card/50 overflow-hidden group">
              <summary className="px-4 py-3 text-[13px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-2">
                <Braces size={14} />
                <span className="flex-1">Request Preview</span>
                <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
              </summary>
              <pre className="px-4 pb-4 text-[11px] font-mono text-muted-foreground/70 overflow-x-auto whitespace-pre-wrap border-t border-border/40">
                {JSON.stringify(
                  (() => {
                    const p: CallPayload = {};
                    if (configMode === "saved") p.agentId = agentId || "<agent-uuid>";
                    else p.agent = config;
                    if (webhookUrl.trim()) p.webhookUrl = webhookUrl;
                    if (contextVars.some((v) => v.key.trim())) {
                      p.contextVariables = {};
                      contextVars.forEach(({ key, value }) => {
                        if (key.trim()) p.contextVariables![key] = value;
                      });
                    }
                    if (overridesJson.trim()) {
                      try { p.overrides = JSON.parse(overridesJson); } catch { /* skip */ }
                    }
                    return p;
                  })(),
                  null,
                  2
                )}
              </pre>
            </details>
          </aside>
        )}

        {/* Call Area */}
        <section className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
          {/* Orb */}
          <div
            className="relative rounded-full transition-all duration-700 ease-out"
            style={{
              width: orbSettings.size,
              height: orbSettings.size,
              opacity: isActive ? 1 : 0.85,
              transform: isActive ? "scale(1)" : "scale(0.97)",
            }}
          >
            {/* Glow backdrop */}
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-30 transition-all duration-1000"
              style={{
                background: `radial-gradient(circle, ${
                  dark
                    ? (status === "connected" ? orbSettings.connectedColors[0] : orbSettings.idleColors[0])
                    : (status === "connected" ? orbSettings.connectedColorsLight[0] : orbSettings.idleColorsLight[0])
                } 0%, transparent 70%)`,
              }}
            />
            <Orb
              colors={
                orbSettings.usePreview
                  ? (dark ? orbSettings.idleColors : orbSettings.idleColorsLight)
                  : status === "connected"
                    ? (dark ? orbSettings.connectedColors : orbSettings.connectedColorsLight)
                    : status === "connecting"
                      ? (dark ? orbSettings.connectingColors : orbSettings.connectingColorsLight)
                      : (dark ? orbSettings.idleColors : orbSettings.idleColorsLight)
              }
              agentState={
                orbSettings.usePreview
                  ? (orbSettings.previewState === "none" ? null : orbSettings.previewState)
                  : agentState
              }
              seed={orbSettings.seed}
              volumeMode={orbSettings.usePreview ? "manual" : "auto"}
              manualInput={orbSettings.usePreview ? orbSettings.previewInputVolume : undefined}
              manualOutput={orbSettings.usePreview ? orbSettings.previewOutputVolume : undefined}
              getInputVolume={orbSettings.usePreview ? undefined : getInputVolume}
              getOutputVolume={orbSettings.usePreview ? undefined : getOutputVolume}
              shader={{
                timeSpeed: orbSettings.timeSpeed,
                animSpeedMultiplier: orbSettings.animSpeedMultiplier,
                distortionMin: orbSettings.distortionMin,
                distortionMax: orbSettings.distortionMax,
                ovalSoftness: orbSettings.ovalSoftness,
                ovalHeightMax: orbSettings.ovalHeightMax,
                ovalHeightMin: orbSettings.ovalHeightMin,
                ovalWidthBase: orbSettings.ovalWidthBase,
                ovalWidthNoise: orbSettings.ovalWidthNoise,
                ovalAlpha: orbSettings.ovalAlpha,
                ringIntensity: orbSettings.ringIntensity,
                colorLerpSpeed: orbSettings.colorLerpSpeed,
                gradientContrast: orbSettings.gradientContrast,
                morphSpeed: orbSettings.morphSpeed,
                flowRadiusScale: orbSettings.flowRadiusScale,
                flowAnimScale: orbSettings.flowAnimScale,
                ovalRotationAmplitude: orbSettings.ovalRotationAmplitude,
                ovalRotationPeriod: orbSettings.ovalRotationPeriod,
              }}
            />
          </div>

          {/* Orb settings button */}
          {!isActive && (
            <button
              onClick={() => setShowOrbSettings((s) => !s)}
              className={`mt-3 flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all ${
                showOrbSettings
                  ? "border-foreground/20 text-foreground bg-card"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/20"
              }`}
            >
              <Palette size={12} />
              Orb Settings
            </button>
          )}

          {/* Orb Settings Panel - moved to right aside */}
          {false && (
            <div className="hidden">
              <Section title="Size & Shape" icon={Maximize2} defaultOpen={true}>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Orb Size</Label>
                    <span className="text-[12px] font-mono text-foreground/60">{orbSettings.size}px</span>
                  </div>
                  <input type="range" min="200" max="600" step="8" value={orbSettings.size} onChange={(e) => updateOrb("size", parseInt(e.target.value))} className="w-full accent-foreground h-1.5" />
                </div>
                <div className="space-y-1.5">
                  <Label>Seed</Label>
                  <div className="flex gap-2">
                    <input type="number" min="0" max="999999" value={orbSettings.seed ?? ""} onChange={(e) => updateOrb("seed", e.target.value ? parseInt(e.target.value) : undefined)} className={`${inputCls} flex-1`} placeholder="Random" />
                    <button onClick={() => updateOrb("seed", Math.floor(Math.random() * 999999))} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
                      <Shuffle size={13} />
                    </button>
                  </div>
                </div>
              </Section>

              <Section title={dark ? "Colors (Dark)" : "Colors (Light)"} icon={Palette} defaultOpen={true}>
                {([
                  { label: "Idle", darkKey: "idleColors" as const, lightKey: "idleColorsLight" as const },
                  { label: "Connecting", darkKey: "connectingColors" as const, lightKey: "connectingColorsLight" as const },
                  { label: "Connected", darkKey: "connectedColors" as const, lightKey: "connectedColorsLight" as const },
                ] as const).map(({ label, darkKey, lightKey }) => {
                  const key = dark ? darkKey : lightKey;
                  const colors = orbSettings[key];
                  return (
                    <div key={label}>
                      <Label>{label}</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {[0, 1].map((i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <input type="color" value={colors[i]} onChange={(e) => { const next = [...colors] as [string, string]; next[i] = e.target.value; updateOrb(key, next); }} className="w-7 h-7 rounded border border-border/60 bg-transparent cursor-pointer shrink-0" />
                            <input type="text" value={colors[i]} onChange={(e) => { const next = [...colors] as [string, string]; next[i] = e.target.value; updateOrb(key, next); }} className={`${inputCls} font-mono text-[10px]`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </Section>

              <Section title="Shader Tweaks" icon={SlidersHorizontal} defaultOpen={false}>
                {([
                  { label: "Rotation Speed", key: "timeSpeed" as const, min: 0.05, max: 2, step: 0.05, def: 0.5 },
                  { label: "Animation Speed", key: "animSpeedMultiplier" as const, min: 0.1, max: 4, step: 0.1, def: 1.0 },
                  { label: "Distortion Min", key: "distortionMin" as const, min: 0, max: 1, step: 0.01, def: 0.08 },
                  { label: "Distortion Max", key: "distortionMax" as const, min: 0, max: 1, step: 0.01, def: 0.25 },
                  { label: "Oval Softness", key: "ovalSoftness" as const, min: 0, max: 1.5, step: 0.05, def: 0.6 },
                  { label: "Oval Height Max", key: "ovalHeightMax" as const, min: 0.5, max: 8, step: 0.1, def: 3.5 },
                  { label: "Oval Height Min", key: "ovalHeightMin" as const, min: 0.5, max: 8, step: 0.1, def: 2.5 },
                  { label: "Oval Width", key: "ovalWidthBase" as const, min: 0.1, max: 2, step: 0.05, def: 0.5 },
                  { label: "Oval Width Noise", key: "ovalWidthNoise" as const, min: 0, max: 1, step: 0.05, def: 0.3 },
                  { label: "Oval Alpha", key: "ovalAlpha" as const, min: 0, max: 1, step: 0.05, def: 0.85 },
                  { label: "Ring Intensity", key: "ringIntensity" as const, min: 0, max: 3, step: 0.1, def: 1.0 },
                  { label: "Color Blend Speed", key: "colorLerpSpeed" as const, min: 0.01, max: 0.5, step: 0.01, def: 0.08 },
                ] as const).map(({ label, key, min, max, step, def }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label>{label}</Label>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-foreground/60">{(orbSettings[key] as number).toFixed(2)}</span>
                        {orbSettings[key] !== def && (
                          <button onClick={() => updateOrb(key, def)} className="text-[9px] text-muted-foreground hover:text-foreground px-1 rounded border border-border/40">rst</button>
                        )}
                      </div>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={orbSettings[key] as number} onChange={(e) => updateOrb(key, parseFloat(e.target.value))} className="w-full accent-foreground h-1" />
                  </div>
                ))}
                <button
                  onClick={() => setOrbSettings((s) => ({ ...s, timeSpeed: 0.5, animSpeedMultiplier: 1.0, distortionMin: 0.08, distortionMax: 0.25, ovalSoftness: 0.6, ovalHeightMax: 3.5, ovalHeightMin: 2.5, ovalWidthBase: 0.5, ovalWidthNoise: 0.3, ovalAlpha: 0.85, ringIntensity: 1.0, colorLerpSpeed: 0.08 }))}
                  className="w-full py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground border border-border/40 hover:border-border transition-colors"
                >
                  Reset All to Defaults
                </button>
              </Section>

              <Section title="Live Preview" icon={Eye} defaultOpen={false}>
                <div className="flex items-center justify-between">
                  <Label>Preview Mode</Label>
                  <button
                    onClick={() => updateOrb("usePreview", !orbSettings.usePreview)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${orbSettings.usePreview ? "bg-foreground" : "bg-border"}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-background absolute top-0.5 transition-all ${orbSettings.usePreview ? "left-5.5" : "left-0.5"}`} />
                  </button>
                </div>
                {orbSettings.usePreview && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="space-y-1.5">
                      <Label>State</Label>
                      <div className="grid grid-cols-4 gap-1 p-1 bg-input/30 rounded-lg">
                        {(["none", "thinking", "listening", "talking"] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => updateOrb("previewState", st)}
                            className={`px-1 py-1.5 rounded text-[10px] font-medium capitalize transition-all ${
                              orbSettings.previewState === st ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {st === "none" ? "Idle" : st}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label>Input (Mic)</Label>
                        <span className="text-[10px] font-mono text-foreground/60">{orbSettings.previewInputVolume.toFixed(2)}</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.01" value={orbSettings.previewInputVolume} onChange={(e) => updateOrb("previewInputVolume", parseFloat(e.target.value))} className="w-full accent-foreground h-1.5" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label>Output (Agent)</Label>
                        <span className="text-[10px] font-mono text-foreground/60">{orbSettings.previewOutputVolume.toFixed(2)}</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.01" value={orbSettings.previewOutputVolume} onChange={(e) => updateOrb("previewOutputVolume", parseFloat(e.target.value))} className="w-full accent-foreground h-1.5" />
                    </div>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* Waveform when connected */}

          {status === "connected" && (
            <div className="w-full max-w-xs mt-2 animate-fade-in text-accent">
              <LiveWaveform
                active={true}
                barWidth={2}
                barGap={1}
                barRadius={2}
                height={32}
                sensitivity={1.5}
                mode="static"
                fadeEdges={true}
                barColor={dark ? "#a1a1aa" : "#3f3f46"}
              />
            </div>
          )}

          {/* Status */}
          <div className="mt-6 text-center space-y-1.5">
            {status === "idle" && (
              <ShimmeringText
                text="Configure your agent and start a call"
                className="text-sm"
                color={dark ? "#71717a" : "#a1a1aa"}
                shimmerColor={dark ? "#d4d4d8" : "#3f3f46"}
                duration={3}
              />
            )}
            {status === "connecting" && (
              <ShimmeringText
                text="Establishing connection..."
                className="text-sm"
                color={dark ? "#fbbf24" : "#ca8a04"}
                shimmerColor={dark ? "#fde68a" : "#eab308"}
                duration={1.5}
              />
            )}
            {status === "connected" && (
              <div className="space-y-1">
                <p className="text-success text-sm font-medium">Call Active</p>
                <p className="text-muted-foreground text-xs">Speak naturally with your AI agent</p>
              </div>
            )}
            {status === "disconnected" && (
              <p className="text-muted-foreground text-sm">Call ended</p>
            )}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2 max-w-sm">
                <p className="text-destructive text-[13px]">{error}</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="mt-8">
            {!isActive ? (
              <button
                onClick={handleStart}
                disabled={configMode === "saved" && !agentId.trim()}
                className="group flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-foreground text-background hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-[14px] font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-lg"
              >
                <Phone size={18} className="group-hover:rotate-12 transition-transform" />
                Start Call
              </button>
            ) : (
              <button
                onClick={handleEnd}
                className="group flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-destructive hover:bg-red-600 text-white text-[14px] font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-lg shadow-destructive/20"
              >
                <PhoneOff size={18} className="group-hover:-rotate-12 transition-transform" />
                End Call
              </button>
            )}
          </div>
        </section>

        {/* Orb Settings - Right Panel */}
        {showOrbSettings && !isActive && (
          <aside className="w-full lg:w-[340px] shrink-0 animate-fade-in overflow-y-auto max-h-[calc(100vh-100px)] space-y-3 pl-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Palette size={14} className="text-muted-foreground" />
                <span className="text-sm font-medium">Orb Settings</span>
              </div>
              <button onClick={() => setShowOrbSettings(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={14} />
              </button>
            </div>

            <Section title="Size & Shape" icon={Maximize2} defaultOpen={true}>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Orb Size</Label>
                  <span className="text-[12px] font-mono text-foreground/60">{orbSettings.size}px</span>
                </div>
                <input type="range" min="200" max="600" step="8" value={orbSettings.size} onChange={(e) => updateOrb("size", parseInt(e.target.value))} className="w-full accent-foreground h-1.5" />
              </div>
              <div className="space-y-1.5">
                <Label>Seed</Label>
                <div className="flex gap-2">
                  <input type="number" min="0" max="999999" value={orbSettings.seed ?? ""} onChange={(e) => updateOrb("seed", e.target.value ? parseInt(e.target.value) : undefined)} className={`${inputCls} flex-1`} placeholder="Random" />
                  <button onClick={() => updateOrb("seed", Math.floor(Math.random() * 999999))} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
                    <Shuffle size={13} />
                  </button>
                </div>
              </div>
            </Section>

            <Section title={dark ? "Colors (Dark)" : "Colors (Light)"} icon={Palette} defaultOpen={true}>
              {([
                { label: "Idle", darkKey: "idleColors" as const, lightKey: "idleColorsLight" as const },
                { label: "Connecting", darkKey: "connectingColors" as const, lightKey: "connectingColorsLight" as const },
                { label: "Connected", darkKey: "connectedColors" as const, lightKey: "connectedColorsLight" as const },
              ] as const).map(({ label, darkKey, lightKey }) => {
                const key = dark ? darkKey : lightKey;
                const colors = orbSettings[key];
                return (
                  <div key={label}>
                    <Label>{label}</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {[0, 1].map((i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <input type="color" value={colors[i]} onChange={(e) => { const next = [...colors] as [string, string]; next[i] = e.target.value; updateOrb(key, next); }} className="w-7 h-7 rounded border border-border/60 bg-transparent cursor-pointer shrink-0" />
                          <input type="text" value={colors[i]} onChange={(e) => { const next = [...colors] as [string, string]; next[i] = e.target.value; updateOrb(key, next); }} className={`${inputCls} font-mono text-[10px]`} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Section>

            <Section title="Shader Tweaks" icon={SlidersHorizontal} defaultOpen={true}>
              {([
                { label: "Rotation Speed", key: "timeSpeed" as const, min: 0.05, max: 2, step: 0.05, def: 0.5 },
                { label: "Animation Speed", key: "animSpeedMultiplier" as const, min: 0.1, max: 4, step: 0.1, def: 1.0 },
                { label: "Distortion Min", key: "distortionMin" as const, min: 0, max: 1, step: 0.01, def: 0.08 },
                { label: "Distortion Max", key: "distortionMax" as const, min: 0, max: 1, step: 0.01, def: 0.25 },
                { label: "Oval Softness", key: "ovalSoftness" as const, min: 0, max: 1.5, step: 0.05, def: 0.6 },
                { label: "Oval Height Max", key: "ovalHeightMax" as const, min: 0.5, max: 8, step: 0.1, def: 3.5 },
                { label: "Oval Height Min", key: "ovalHeightMin" as const, min: 0.5, max: 8, step: 0.1, def: 2.5 },
                { label: "Oval Width", key: "ovalWidthBase" as const, min: 0.1, max: 2, step: 0.05, def: 0.5 },
                { label: "Oval Width Noise", key: "ovalWidthNoise" as const, min: 0, max: 1, step: 0.05, def: 0.3 },
                { label: "Oval Alpha", key: "ovalAlpha" as const, min: 0, max: 1, step: 0.05, def: 0.85 },
                { label: "Ring Intensity", key: "ringIntensity" as const, min: 0, max: 3, step: 0.1, def: 1.0 },
                { label: "Color Blend Speed", key: "colorLerpSpeed" as const, min: 0.01, max: 0.5, step: 0.01, def: 0.08 },
                { label: "Gradient Contrast", key: "gradientContrast" as const, min: 0, max: 1, step: 0.05, def: 0.1 },
                { label: "Morph Speed", key: "morphSpeed" as const, min: 0, max: 0.3, step: 0.005, def: 0.05 },
                { label: "Flow Depth", key: "flowRadiusScale" as const, min: 0, max: 0.15, step: 0.005, def: 0.03 },
                { label: "Flow Anim Scale", key: "flowAnimScale" as const, min: 0, max: 1, step: 0.05, def: 0.2 },
                { label: "Petal Rotation Amp", key: "ovalRotationAmplitude" as const, min: 0, max: 2, step: 0.05, def: 0.5 },
                { label: "Petal Rotation Period", key: "ovalRotationPeriod" as const, min: 2, max: 60, step: 1, def: 20 },
              ] as const).map(({ label, key, min, max, step, def }) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Label>{label}</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono text-foreground/60">{(orbSettings[key] as number).toFixed(2)}</span>
                      {orbSettings[key] !== def && (
                        <button onClick={() => updateOrb(key, def)} className="text-[9px] text-muted-foreground hover:text-foreground px-1 rounded border border-border/40">rst</button>
                      )}
                    </div>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={orbSettings[key] as number} onChange={(e) => updateOrb(key, parseFloat(e.target.value))} className="w-full accent-foreground h-1" />
                </div>
              ))}
              <button
                onClick={() => setOrbSettings((prev) => ({ ...prev, timeSpeed: 0.5, animSpeedMultiplier: 1.0, distortionMin: 0.08, distortionMax: 0.25, ovalSoftness: 0.6, ovalHeightMax: 3.5, ovalHeightMin: 2.5, ovalWidthBase: 0.5, ovalWidthNoise: 0.3, ovalAlpha: 0.85, ringIntensity: 1.0, colorLerpSpeed: 0.08, gradientContrast: 0.1, morphSpeed: 0.05, flowRadiusScale: 0.03, flowAnimScale: 0.2, ovalRotationAmplitude: 0.5, ovalRotationPeriod: 20.0 }))}
                className="w-full py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground border border-border/40 hover:border-border transition-colors"
              >
                Reset All to Defaults
              </button>
            </Section>

            <Section title="Live Preview" icon={Eye} defaultOpen={false}>
              <div className="flex items-center justify-between">
                <Label>Preview Mode</Label>
                <button
                  onClick={() => updateOrb("usePreview", !orbSettings.usePreview)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${orbSettings.usePreview ? "bg-foreground" : "bg-border"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-background absolute top-0.5 transition-all ${orbSettings.usePreview ? "left-5.5" : "left-0.5"}`} />
                </button>
              </div>
              {orbSettings.usePreview && (
                <div className="space-y-3 animate-fade-in">
                  <div className="space-y-1.5">
                    <Label>State</Label>
                    <div className="grid grid-cols-4 gap-1 p-1 bg-input/30 rounded-lg">
                      {(["none", "thinking", "listening", "talking"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => updateOrb("previewState", st)}
                          className={`px-1 py-1.5 rounded text-[10px] font-medium capitalize transition-all ${
                            orbSettings.previewState === st ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {st === "none" ? "Idle" : st}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label>Input (Mic)</Label>
                      <span className="text-[10px] font-mono text-foreground/60">{orbSettings.previewInputVolume.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.01" value={orbSettings.previewInputVolume} onChange={(e) => updateOrb("previewInputVolume", parseFloat(e.target.value))} className="w-full accent-foreground h-1.5" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label>Output (Agent)</Label>
                      <span className="text-[10px] font-mono text-foreground/60">{orbSettings.previewOutputVolume.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.01" value={orbSettings.previewOutputVolume} onChange={(e) => updateOrb("previewOutputVolume", parseFloat(e.target.value))} className="w-full accent-foreground h-1.5" />
                  </div>
                </div>
              )}
            </Section>
          </aside>
        )}
      </main>
    </div>
  );
}
