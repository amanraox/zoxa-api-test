/** Whether the server has a zoxa API key configured. Never returns any of it. */
export function GET() {
  return Response.json(
    { configured: Boolean(process.env.ZOXA_API_KEY?.trim()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
