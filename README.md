# zoxa console

A third-party test console for the zoxa public API: build an agent, talk to it
over the raw-PCM WebSocket transport, and inspect everything the server sends.

```bash
cp .env.example .env.local   # set ZOXA_API_KEY (an org API key, zsk_…)
npm install
npm run dev                  # http://localhost:3037
```

The zoxa API key lives only in the server environment and never reaches the
browser bundle. Everything a visitor creates stays **in their own browser**
(localStorage, `zoxa-console:*` keys): saved agents, the current draft, recent
calls and display preferences. Visitors never see each other's agents and
nothing is written to the zoxa organization's agent list. Agents can be
exported/imported as JSON from **My agents**; the eraser icon in the header
clears everything stored in that browser.

### Deploy (Vercel)

1. Import the repo in Vercel.
2. Project Settings → Environment Variables → add `ZOXA_API_KEY`.
3. Deploy.

There is no login, so anyone with the URL can place calls billed to that key's
organization. Use Vercel Deployment Protection (or keep the URL private) if
that matters.

## What it covers

- **Agent config**: every `AgentConfig` field (identity, ordered languages,
  timezone, prompt, `{{variables}}`, greeting, LLM, voice + voice browser,
  transcriber, noise gate, human-feel audio, call rules, webhook) with live
  catalog data from `GET /agents/models/available` and the voices endpoint.
- **Tools**: HTTP function (with JSON-Schema parameter builder), knowledge-base
  query, test tool, end call, transfer call, and saved-tool UUID references.
- **Raw request**: the exact `POST /api/v1/call` body, editable in both
  directions. Unknown keys are sent verbatim to probe server validation.
- **Validate**: local pre-flight plus `POST /agents/preview-snapshot`, which
  returns the config the runner would use, with no call placed.
- **My agents** (this browser): save, update, duplicate, delete, export/import
  JSON, plus zoxa's templates. Calls use them as inline agents; a zoxa agent can
  also be called by its UUID.
- **Call**: inline config or `agentId`, mic picker, mute, volume; live
  transcript, full event log, latency and transport metrics, and the post-call
  record from `GET /calls/{callId}` (status, cost, recording, transcript, turns).
- **Orbs**: Halo, Liquid, Nebula, Pulse (WebGL2 shaders driven by real levels,
  spectrum and call state) plus the classic ElevenLabs orb; six palettes or
  custom colours.

## Architecture

- `src/app/api/*`: server routes that attach `ZOXA_API_KEY`. Only read-only
  catalog routes and validation are proxied (the org's agent CRUD is not).
  `POST /api/call` returns the authenticated `wss://` URL (browser sockets can't
  send headers, so zoxa takes `?api_key=`); audio then flows browser → zoxa.
- `src/lib/localAgents.ts`, `src/lib/draft.ts`: everything a visitor saves,
  in localStorage.
- `src/lib/call/session.ts`: framework-free call lifecycle (create, socket,
  audio, events, teardown).
- `src/lib/audio/*`: AudioWorklets. Capture uses an anti-aliased resampler
  to 16 kHz PCM-16 in 20 ms frames. Playback runs a 24 kHz jitter buffer with
  latency capping.
- `src/lib/draft.ts`: the editor state is the request body; the form and raw
  editor round-trip through it.
