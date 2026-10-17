import type { NextRequest } from "next/server";

import { errorResponse, relay, serverApiKey, upstreamFailure, zoxaFetch } from "@/lib/zoxa/server";

/**
 * Allowlisted pass-through to the zoxa public API.
 *
 * Only the read-only catalog routes and server-side validation this console
 * needs are reachable; anything else is a 404. In particular the organization's
 * agent CRUD is NOT exposed: the console runs on one server-side key with no
 * login, so visitors' agents live in their own browsers instead. Call creation
 * and the post-call report have dedicated routes.
 */

type Method = "GET" | "POST";

const ALLOWED: ReadonlyArray<{ method: Method; pattern: RegExp; upstream?: (p: string) => string }> = [
  { method: "GET", pattern: /^agents\/templates$/ },
  { method: "GET", pattern: /^agents\/models\/available$/ },
  // Server-side validation only — resolves a config without saving or calling.
  { method: "POST", pattern: /^agents\/preview-snapshot$/ },
  // FastAPI mounts the tools list at "/tools/" (trailing slash).
  { method: "GET", pattern: /^tools$/, upstream: () => "tools/" },
  { method: "GET", pattern: /^knowledge-base\/documents$/ },
  { method: "GET", pattern: /^user\/configurations\/voices\/[a-z]+$/ },
];

const MAX_BODY_BYTES = 512 * 1024;

async function handle(req: NextRequest, ctx: RouteContext<"/api/zoxa/[...path]">, method: Method) {
  const { path } = await ctx.params;
  const joined = path.join("/");
  const rule = ALLOWED.find((r) => r.method === method && r.pattern.test(joined));
  if (!rule) return errorResponse(404, `Route not available: ${method} /${joined}`);

  let body: string | undefined;
  if (method === "POST") {
    body = await req.text();
    if (body.length > MAX_BODY_BYTES) return errorResponse(413, "Request body too large");
  }

  const upstreamPath = `/${rule.upstream ? rule.upstream(joined) : joined}${req.nextUrl.search}`;
  try {
    return await relay(await zoxaFetch(serverApiKey(), upstreamPath, { method, body }));
  } catch (err) {
    return upstreamFailure(err);
  }
}

export const GET = (req: NextRequest, ctx: RouteContext<"/api/zoxa/[...path]">) => handle(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: RouteContext<"/api/zoxa/[...path]">) => handle(req, ctx, "POST");
