# Security Policy

## Supported versions

AgentMesh is pre-1.0. Only the `main` branch receives fixes.

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private
vulnerability reporting on this repository ("Security" tab, "Report a vulnerability").
You will get an acknowledgement within 72 hours and a fix or mitigation plan within
14 days for confirmed issues.

## Scope and threat model

The MVP is designed to run on a trusted network (a laptop, a private VPC, or a free
tier PaaS behind HTTPS). It currently does not ship:

- authentication or multi-tenant authorisation on the gateway REST and WebSocket APIs
- TLS on the internal gRPC link (use a private network or a service mesh)
- prompt-injection hardening beyond the human-in-the-loop approval step

Do not expose the gateway or runtime directly to the public internet without an
authenticating reverse proxy in front of it.

## Secrets

All secrets are read from environment variables. `.env` is git-ignored and only
`.env.example` is committed. CI runs with `DEMO_MODE=1` and needs no keys.
