import { buildAudioSocketUrl, errorResponse, relay, serverApiKey, upstreamFailure, zoxaFetch } from "@/lib/zoxa/server";

/**
 * POST /api/call — create a raw-PCM WebSocket call.
 *
 * The body is forwarded to `POST /api/v1/call` exactly as the console built it
 * (including any raw edits), so this exercises the public contract verbatim.
 * On success the response gains `wsUrl`: the absolute, authenticated socket URL.
 */

const MAX_BODY_BYTES = 512 * 1024;

export async function POST(req: Request) {
  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) return errorResponse(413, "Request body too large");
  try {
    JSON.parse(body);
  } catch {
    return errorResponse(400, "Request body is not valid JSON");
  }

  let apiKey: string;
  let res: Response;
  try {
    apiKey = serverApiKey();
    res = await zoxaFetch(apiKey, "/call", { method: "POST", body });
  } catch (err) {
    return upstreamFailure(err);
  }
  if (!res.ok) return relay(res);

  const data = (await res.json()) as { callId?: string; audioUrl?: string };
  if (!data.callId || !data.audioUrl) {
    return errorResponse(502, "zoxa returned no callId/audioUrl — is the transport websocket?");
  }
  return Response.json({ ...data, wsUrl: buildAudioSocketUrl(apiKey, data.audioUrl) }, { status: res.status });
}
