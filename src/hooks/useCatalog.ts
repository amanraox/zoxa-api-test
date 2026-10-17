"use client";

import { zoxa } from "@/lib/zoxa/client";
import type { TTSProvider } from "@/lib/zoxa/types";

import { useResource } from "./useResource";

export const useModels = () => useResource("models", zoxa.listModels);

export const useVoices = (provider: TTSProvider, model: string | null) =>
  useResource(`voices:${provider}:${model ?? ""}`, () => zoxa.listVoices(provider, model));

export const useSavedTools = () => useResource("tools", zoxa.listTools);

export const useTemplates = (enabled: boolean) => useResource(enabled ? "templates" : null, zoxa.listTemplates);
