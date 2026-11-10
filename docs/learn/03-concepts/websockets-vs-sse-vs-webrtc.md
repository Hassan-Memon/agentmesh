# WebSockets vs SSE vs WebRTC

**In one line:** all three push data to a browser without polling; they differ in direction,
transport and what they are built for.

## The three, compared

| | WebSocket | Server-Sent Events | WebRTC |
| --- | --- | --- | --- |
| Direction | Both ways | Server to client only | Peer to peer, both ways |
| Transport | TCP, upgraded from HTTP/1.1 | Plain HTTP response that never ends | UDP (SRTP/SCTP), via STUN/TURN |
| Payload | Text or binary frames | UTF-8 text events | Audio, video, arbitrary data channels |
| Reconnect | You implement (Socket.IO does it) | Built into the browser `EventSource` | Complex renegotiation |
| Proxies and CDNs | Need WebSocket support (most have it) | Works anywhere HTTP streams work | Needs STUN/TURN servers |
| Best for | Interactive apps, rooms, presence | Feeds, logs, LLM token streams | Calls, screen share, low-latency media |

## What AgentMesh uses and why

The dashboard uses **WebSockets via Socket.IO** (`apps/gateway/src/ws/runs.gateway.ts`,
`apps/dashboard/src/lib/socket.ts`). The deciding factor is rooms: a client says `join
<run_id>` and receives only that run's events, while a `run.activity` broadcast reaches
everyone on the runs list. Socket.IO adds reconnection with backoff, automatic fallback to
long-polling when a corporate proxy blocks WebSockets, and acknowledgements. Writing that
yourself on raw `ws` is a week of work you do not need.

The upstream link, runtime to gateway, is **gRPC server streaming**, which is HTTP/2 framing
rather than any of the three above. Browsers cannot do raw gRPC, which is why the gateway
re-emits.

## When SSE would have been enough

If the dashboard only ever watched one run per page and never sent anything over the live
channel (approvals go over REST anyway), SSE would do: one `GET /runs/:id/events/stream`
that writes `data: {...}\n\n` lines. It is simpler to operate, caches and proxies love it,
and the browser reconnects for free with `Last-Event-ID`. The runs list's live refresh and
multi-room semantics tipped the balance to Socket.IO, but SSE is a legitimate ADR-sized
alternative and a good exercise (see `05-run-it-yourself.md`).

For streaming LLM tokens to a browser, SSE is the industry default (OpenAI's API uses it).
If AgentMesh later streams tokens from a node, an SSE endpoint per run is the natural shape.

## When WebRTC

WebRTC is for media and for peer-to-peer data where a server hop would add too much latency.
A voice-first intake product (product 3 in this portfolio) records audio in the browser; the
MVP there ships audio chunks over a WebSocket because it is simpler to build and to run
through a server-side transcriber, and moves to WebRTC when sub-200 ms conversational
latency matters. For a dashboard of JSON events, WebRTC is the wrong tool.

## Operational notes

- WebSockets are long-lived connections; a load balancer must support them (sticky sessions
  are not required with Socket.IO if you add the Redis adapter, which is why Redis is in
  compose).
- Free PaaS tiers may idle-kill connections after a minute. Socket.IO's heartbeat
  (`pingInterval`) and reconnect handle it transparently; the UI shows "reconnecting".
- Always dedupe on the client. Reconnects and at-least-once delivery mean the same event can
  arrive twice. `live-run.tsx` keys on `seq`.

## Try it

In the browser dev tools Network tab, filter by WS, open a run page and watch the frames:
a `join` message out, `run.event` frames in. Then kill the gateway container and watch
Socket.IO retry with increasing delays.
