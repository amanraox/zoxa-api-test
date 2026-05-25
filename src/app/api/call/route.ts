import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ZOXA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ZOXA_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json();

  const res = await fetch("https://dashboard.zoxa.ai/api/v1/call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  // Build the authenticated audio WebSocket URL
  // Zoxa returns audioUrl as relative path: /api/v1/ws/audio/{callId}
  const baseWsUrl = "wss://dashboard.zoxa.ai";
  let audioUrl: string;

  if (data.audioUrl) {
    const rawUrl = data.audioUrl as string;
    const fullUrl = rawUrl.startsWith("ws") ? rawUrl : `${baseWsUrl}${rawUrl}`;
    if (fullUrl.includes("api_key=")) {
      audioUrl = fullUrl;
    } else {
      const separator = fullUrl.includes("?") ? "&" : "?";
      audioUrl = `${fullUrl}${separator}api_key=${apiKey}`;
    }
  } else {
    // Fallback: construct from callId
    audioUrl = `${baseWsUrl}/api/v1/ws/audio/${data.callId}?api_key=${apiKey}`;
  }

  return NextResponse.json({
    ...data,
    audioUrl,
  });
}
