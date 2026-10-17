import "server-only";

/**
 * Server-side access to the zoxa public API.
 *
 * The API key lives in the server environment (`ZOXA_API_KEY` — `.env.local`
 * locally, Project Settings → Environment Variables on Vercel) and is attached
 * here, so it never ships in the client bundle. The only place it leaves the
 * server is the authenticated audio WebSocket URL: browser WebSocket
 * handshakes cannot carry headers, so zoxa documents `?api_key=` for browsers.
 */

export const ZOXA_ORIGIN = "https://dashboard.zoxa.ai";
export const ZOXA_API_BASE = `${ZOXA_ORIGIN}/api/v1`;

const UPSTREAM_TIMEOUT_MS = 30_000;
export class MissingKeyError extends Error {}

/** The server's zoxa API key. Throws when it isn't configured. */
export function serverApiKey(): string {
  const key = process.env.ZOXA_API_KEY?.trim();
  if (!key) throw new MissingKeyError();
  return key;
}

/** Fetch a zoxa API path (relative to /api/v1) with the server's key. */
export async function zoxaFetch(apiKey: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", apiKey);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${ZOXA_API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
}

/** The absolute, authenticated audio socket URL for an `audioUrl` path. */
export function buildAudioSocketUrl(apiKey: string, audioUrl: string): string {
  const url = new URL(audioUrl, ZOXA_ORIGIN.replace(/^http/, "ws"));
  url.protocol = "wss:";
  url.searchParams.set("api_key", apiKey);
  return url.toString();
}

/** JSON error response in the same `{detail}` shape zoxa uses. */
export function errorResponse(status: number, detail: unknown): Response {
  return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Map a thrown error (missing key, timeout, network) to a client-safe response. */
export function upstreamFailure(err: unknown): Response {
  if (err instanceof MissingKeyError) {
    return errorResponse(500, "ZOXA_API_KEY is not configured on the server.");
  }
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return errorResponse(504, "zoxa API timed out");
  }
  console.error("[zoxa proxy] upstream request failed:", err instanceof Error ? err.message : err);
  return errorResponse(502, "Could not reach the zoxa API");
}

/** Relay an upstream response body + status to the browser verbatim. */
export async function relay(res: Response): Promise<Response> {
  if (res.status === 204) return new Response(null, { status: 204 });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}
