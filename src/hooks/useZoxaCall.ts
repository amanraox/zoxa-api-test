"use client";

import { useState, useRef, useCallback } from "react";
import type { CallPayload, CallStatus } from "@/lib/types";

const SAMPLE_RATE = 16000;

export function useZoxaCall() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const statusRef = useRef<CallStatus>("idle");
  const endingRef = useRef(false);

  const getInputVolume = useCallback(() => {
    if (!inputAnalyserRef.current) return 0;
    const data = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
    inputAnalyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
    return Math.min(avg / 128, 1);
  }, []);

  const getOutputVolume = useCallback(() => {
    if (!outputAnalyserRef.current) return 0;
    const data = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
    outputAnalyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
    return Math.min(avg / 128, 1);
  }, []);

  const cleanup = useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;
    console.log("[Zoxa] Cleaning up");
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    try { workletNodeRef.current?.disconnect(); } catch {}
    workletNodeRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    try { playbackCtxRef.current?.close(); } catch {}
    playbackCtxRef.current = null;
    inputAnalyserRef.current = null;
    outputAnalyserRef.current = null;
    nextPlayTimeRef.current = 0;
    endingRef.current = false;
  }, []);

  const endCall = useCallback(() => {
    cleanup();
    statusRef.current = "disconnected";
    setStatus("disconnected");
    setCallId(null);
  }, [cleanup]);

  const startCall = useCallback(
    async (payload: CallPayload) => {
      try {
        setError(null);
        setTranscript([]);
        statusRef.current = "connecting";
        setStatus("connecting");
        endingRef.current = false;

        // Step 1: Create call
        const callRes = await fetch("/api/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!callRes.ok) {
          const errData = await callRes.json();
          console.error("[Zoxa] Call creation failed:", errData);
          throw new Error(errData.error || errData.message || errData.detail || `Call creation failed (${callRes.status})`);
        }

        const callData = await callRes.json();
        console.log("[Zoxa] Call created:", { callId: callData.callId, transport: callData.transport, hasAudioUrl: !!callData.audioUrl });
        const { callId: newCallId, audioUrl } = callData;

        if (!newCallId) throw new Error("No callId returned from Zoxa API");
        if (!audioUrl) throw new Error("No audioUrl returned from Zoxa API");
        setCallId(newCallId);

        // Step 2: Get microphone
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: SAMPLE_RATE,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micStreamRef.current = micStream;

        // Audio context for mic capture — let browser pick native sample rate
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        const micSource = audioCtx.createMediaStreamSource(micStream);

        // Input volume analyser
        const inputAnalyser = audioCtx.createAnalyser();
        inputAnalyser.fftSize = 256;
        micSource.connect(inputAnalyser);
        inputAnalyserRef.current = inputAnalyser;

        // Playback context
        const playbackCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
        playbackCtxRef.current = playbackCtx;

        const outputAnalyser = playbackCtx.createAnalyser();
        outputAnalyser.fftSize = 256;
        outputAnalyser.connect(playbackCtx.destination);
        outputAnalyserRef.current = outputAnalyser;

        // Step 3: Connect WebSocket
        const wsUrl = audioUrl.startsWith("ws") ? audioUrl : `wss://dashboard.zoxa.ai${audioUrl}`;
        console.log("[Zoxa] Connecting WebSocket to:", wsUrl.replace(/api_key=[^&]+/, "api_key=***"));

        const ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        // Create promise for WS connection
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("WebSocket connection timed out")), 10000);

          ws.onopen = () => {
            clearTimeout(timeout);
            console.log("[Zoxa] WebSocket connected — starting audio stream");
            statusRef.current = "connected";
            setStatus("connected");

            // Start mic capture and resampling to 16kHz PCM Int16
            const bufferSize = 4096;
            const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
            workletNodeRef.current = processor;

            // Resample from audioCtx.sampleRate to 16000
            const nativeSR = audioCtx.sampleRate;
            const ratio = SAMPLE_RATE / nativeSR;

            processor.onaudioprocess = (e) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const inputData = e.inputBuffer.getChannelData(0);

              // Resample
              const outputLen = Math.floor(inputData.length * ratio);
              const pcm = new Int16Array(outputLen);
              for (let i = 0; i < outputLen; i++) {
                const srcIdx = i / ratio;
                const idx = Math.floor(srcIdx);
                const frac = srcIdx - idx;
                const s0 = inputData[idx] || 0;
                const s1 = inputData[Math.min(idx + 1, inputData.length - 1)] || 0;
                const sample = s0 + (s1 - s0) * frac;
                const clamped = Math.max(-1, Math.min(1, sample));
                pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
              }
              ws.send(pcm.buffer);
            };

            micSource.connect(processor);
            processor.connect(audioCtx.destination);
            resolve();
          };

          ws.onerror = (ev) => {
            clearTimeout(timeout);
            console.error("[Zoxa] WebSocket error:", ev);
            reject(new Error("WebSocket connection failed"));
          };
        });

        // Handle incoming audio/events
        ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            // Binary: PCM audio from AI
            const pcmData = new Int16Array(event.data);
            if (pcmData.length === 0) return;

            const float32 = new Float32Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
              float32[i] = pcmData[i] / 0x7FFF;
            }

            const buffer = playbackCtx.createBuffer(1, float32.length, SAMPLE_RATE);
            buffer.getChannelData(0).set(float32);
            const source = playbackCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAnalyser);

            const now = playbackCtx.currentTime;
            const startTime = Math.max(now + 0.01, nextPlayTimeRef.current);
            source.start(startTime);
            nextPlayTimeRef.current = startTime + buffer.duration;
          } else {
            try {
              const msg = JSON.parse(event.data);
              console.log("[Zoxa] Event:", msg.type, msg.payload);

              if (msg.type === "rtf-user-transcription" && msg.payload?.text) {
                if (msg.payload.final) {
                  setTranscript((t) => [...t, { role: "user", text: msg.payload.text }]);
                }
              } else if (msg.type === "rtf-bot-text" && msg.payload?.text) {
                setTranscript((t) => [...t, { role: "assistant", text: msg.payload.text }]);
              } else if (msg.type === "error") {
                console.error("[Zoxa] Server error:", msg);
                setError(msg.payload?.message || msg.message || "Server error");
              }
            } catch {
              // non-JSON text
            }
          }
        };

        ws.onclose = (ev) => {
          console.log("[Zoxa] WebSocket closed:", ev.code, ev.reason);
          if (statusRef.current === "connected") {
            cleanup();
            statusRef.current = "disconnected";
            setStatus("disconnected");
            setCallId(null);
          }
        };

        ws.onerror = () => {
          // already handled above during connection, this handles runtime errors
          if (statusRef.current === "connected") {
            setError("WebSocket connection lost");
            endCall();
          }
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start call";
        console.error("[Zoxa] Error:", message);
        setError(message);
        statusRef.current = "error";
        setStatus("error");
        cleanup();
      }
    },
    [cleanup, endCall]
  );

  return {
    status,
    error,
    callId,
    transcript,
    startCall,
    endCall,
    getInputVolume,
    getOutputVolume,
  };
}
