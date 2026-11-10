# Next.js App Router and server components

**In one line:** in the App Router, a file's location under `src/app/` is its URL, and a
component runs on the server by default unless you opt it into the browser with
`'use client'`.

## Files are routes

| File | URL |
| --- | --- |
| `src/app/page.tsx` | `/` |
| `src/app/agents/page.tsx` | `/agents` |
| `src/app/runs/page.tsx` | `/runs` |
| `src/app/runs/new/page.tsx` | `/runs/new` |
| `src/app/runs/[id]/page.tsx` | `/runs/<id>` |
| `src/app/layout.tsx` | wraps every page (nav, theme, fonts) |
| `src/app/not-found.tsx` | rendered by `notFound()` |

`[id]` is a dynamic segment. In Next 15 `params` and `searchParams` are Promises, hence
`const { id } = await params;`.

## Server components (the default)

`src/app/runs/page.tsx` is an `async` function that calls `api.runs()` directly. That code
runs on the server (Node), never in the browser. Benefits:

- No client JavaScript for the page shell and data fetching.
- Secrets could be used here (we do not need any; the gateway is public to the browser).
- The HTML arrives already filled, which is fast on slow devices.

Constraints: no `useState`, no `useEffect`, no event handlers, no browser APIs. A server
component can render client components and pass them serialisable props, which is exactly
what `runs/page.tsx` does: it fetches the list and hands it to `<RunsTable initialRuns=...>`.

`export const dynamic = 'force-dynamic'` tells Next not to pre-render the page at build time
(the data changes constantly, and the gateway is not running during `npm run build`). Every
request renders fresh. The fetch helper also sets `cache: 'no-store'` for the same reason.

## Client components

`'use client'` at the top of a file marks it and everything it imports as browser code.
`components/live-run.tsx` needs a WebSocket, React state and effects, so it is a client
component. It receives the server-rendered snapshot as props and takes over.

The split pattern you will reuse everywhere: server component fetches and renders static
structure; client component handles interaction and live updates. `runs/[id]/page.tsx` plus
`live-run.tsx` is the clearest example.

## Why the snapshot plus live pattern

If the run detail page were only a client component, the first paint would be empty while
the browser fetched. If it were only a server component, it could not update. Doing both
means the page is complete on arrival and then stays current.

## Theming without flicker

`layout.tsx` injects a tiny inline script that reads `localStorage` and sets
`data-theme` on `<html>` before React hydrates. CSS variables in `globals.css` switch on
that attribute. `suppressHydrationWarning` on `<html>` tells React the attribute may differ
between server and client, which is expected. `components/theme-toggle.tsx` starts with
`null` state and reads the attribute in an effect for the same reason.

## Tailwind v4

No `tailwind.config.js`. `globals.css` does `@import 'tailwindcss'` and declares design
tokens under `@theme inline`, mapping CSS variables to utility names (`bg-surface`,
`text-muted`, `border-line`). Change the variables and both themes follow.

## Environment variables

Only variables prefixed `NEXT_PUBLIC_` reach the browser bundle, and they are inlined at
build time. That is why the Dockerfile passes `NEXT_PUBLIC_GATEWAY_URL` as a build arg and
why Vercel needs it set before building.

## Deployment shape

`next.config.ts` sets `output: 'standalone'`, producing a self-contained `server.js` in
`.next/standalone` for the Docker image. On Vercel you set none of this; it detects Next.

## Try it

Rename `RunsTable` to drop `'use client'` and run `npm run build`. The error about
`useState` in a server component is the fastest way to internalise the boundary.
