import { errorResponse, relay, serverApiKey, upstreamFailure, zoxaFetch } from "@/lib/zoxa/server";

/**
 * GET /api/calls/:callId — the post-call report.
 *
 * Fetches `GET /api/v1/calls/{callId}` and, when the call has a transcript,
 * downloads it server-side (the signed storage URL is not CORS-readable from
 * the browser). The transcript URL comes from zoxa's own response, never from
 * the client, so there is no user-controlled fetch target.
 */

const CALL_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TRANSCRIPT_TIMEOUT_MS = 10_000;

export async function GET(_req: Request, ctx: RouteContext<"/api/calls/[callId]">) {
  const { callId } = await ctx.params;
  if (!CALL_ID.test(callId)) return errorResponse(400, "Invalid call id");

  let res: Response;
  try {
    res = await zoxaFetch(serverApiKey(), `/calls/${encodeURIComponent(callId)}`);
  } catch (err) {
    return upstreamFailure(err);
  }
  if (!res.ok) return relay(res);

  const detail = (await res.json()) as { transcript_url?: string | null };
  let transcript: unknown = null;
  if (detail.transcript_url?.startsWith("https://") || detail.transcript_url?.startsWith("http://")) {
    try {
      const t = await fetch(detail.transcript_url, {
        cache: "no-store",
        signal: AbortSignal.timeout(TRANSCRIPT_TIMEOUT_MS),
      });
      // 404 = uploaded later by the completion task (or never) — not an error.
      if (t.ok) transcript = await t.json();
    } catch (err) {
      console.warn(`[report] transcript fetch failed for ${callId}:`, err);
    }
  }
  return Response.json({ detail, transcript }, { headers: { "Cache-Control": "no-store" } });
}
