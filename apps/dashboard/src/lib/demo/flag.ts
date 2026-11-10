// NEXT_PUBLIC_* values are inlined at build time, so this is a constant in both the server
// and the browser bundle. Set NEXT_PUBLIC_DEMO_MODE=1 to swap the gateway for the in-browser
// simulation in ./engine.ts (used by the Cloudflare Workers demo, see docs/deploy.md).
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === '1';
