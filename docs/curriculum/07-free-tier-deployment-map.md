# 07. Free-tier deployment map

Everything below is free at the time of writing (November 2026 plan). Free tiers change; check each provider's pricing page before relying on it, and keep the local `docker compose up` path as the one that always works.

## The map

| Component | Provider | Free tier shape | Watch out for |
|---|---|---|---|
| Next.js dashboards (AgentMesh, IntakeAgent) | Vercel Hobby | Generous bandwidth, serverless functions, custom domain | Non-commercial use terms on Hobby; move to Pro when you have paying customers |
| Nest.js gateway, FastAPI backends | Render free web service | 750 instance hours per month | Spins down after 15 minutes idle, cold start 30 to 60 seconds; add a free uptime pinger or accept it for demos |
| Python agent runtime, OpenInfer with a real model | Oracle Cloud Always Free | Up to 4 ARM cores and 24 GB RAM across VMs, 200 GB block storage | Capacity in popular regions runs out; try several regions; keep the account in good standing |
| OpenInfer public demo | Hugging Face Spaces (Docker) | 2 vCPU, 16 GB RAM, sleeps when idle | CPU only; run the echo backend or a 0.5B GGUF |
| Postgres with pgvector | Neon free | 0.5 GB storage, scales to zero | Cold start on first query after idle; connection pooling via the pooled endpoint |
| Postgres alternative | Supabase free | 500 MB, pauses after a week of inactivity | Pausing breaks demos; Neon is safer for portfolio |
| RabbitMQ | CloudAMQP Little Lemur | Shared instance, message and connection limits | Fine for demos, not for load tests |
| Kafka | Redpanda in Docker locally | Unlimited locally | Hosted Kafka free tiers are scarce; document Kafka as a local profile |
| MongoDB | MongoDB Atlas M0 | 512 MB | Shared cluster, fine for event logs in demos |
| Redis | Upstash free | Daily command limit | Use for caching and rate limits only |
| Vector DB (optional) | Qdrant Cloud | 1 GB cluster | Only when you outgrow pgvector; the ADR says when |
| Cloud LLM | Groq free, Google Gemini free, OpenRouter free models | Rate limited | Router fallback chain handles limits; never rely on one |
| Speech to text | Groq Whisper (free tier), faster-whisper locally | Rate limited or CPU-bound | Local for PHI, cloud for demos |
| CI and container registry | GitHub Actions and GHCR | 2,000 minutes per month on free, unlimited for public repos | Keep CI under 5 minutes per run |
| Domains | Your own or Vercel subdomains | Vercel and Render give subdomains free | Buy one domain when you start selling; it is the only recommended spend |

## Recommended topology per product

AgentMesh: dashboard on Vercel, gateway on Render, agent runtime on Oracle Always Free (so it has the memory for embeddings), Postgres on Neon, RabbitMQ on CloudAMQP, Mongo on Atlas optional.

OpenInfer: public demo on Hugging Face Spaces with the echo or 0.5B model, real benchmarks on Oracle Always Free ARM with llama.cpp, cloud backends via Groq and Gemini free keys.

IntakeAgent: frontend on Vercel, backend on Render, Postgres on Neon, STT via Groq free for demos and faster-whisper on Oracle for anything with PHI, LLM via OpenInfer on Oracle with the private tag.

## AWS, for the interview

The target job wants AWS. You do not need to pay for it to speak about it. OpenInfer's `docs/aws-cost-model.md` lays out EC2 instance choices and costs for inference; AgentMesh's deploy guide maps each component to its AWS equivalent (Render to ECS or App Runner, Neon to RDS, CloudAMQP to Amazon MQ or SQS, Vercel to CloudFront plus S3 or Amplify). Learn that mapping; it is exactly what the interviewer wants to hear. If the AWS free tier credits are available to a new account when you read this, deploy the gateway once for a week to have done it for real, then tear it down.

## A rule for free tiers

One failing free service should never take the demo down. The router has fallbacks, the compose file runs everything locally, and DEMO_MODE needs no keys. Before any demo or interview, run the local stack as the backup.

## Cloudflare Workers: one address pattern for every product

A Workers address is `<worker-name>.<account-subdomain>.workers.dev`. Each account has exactly one account subdomain, so set it to your name once and every product sits under it:

| Product | Address | What runs there |
|---|---|---|
| TrueRate | truerate.hassan-memon.workers.dev | The whole app |
| AgentMesh | agentmesh.hassan-memon.workers.dev | Next.js dashboard via the OpenNext Cloudflare adapter |
| IntakeAgent | intakeagent.hassan-memon.workers.dev | Next.js frontend via the OpenNext Cloudflare adapter |
| OpenInfer | openinfer.hassan-memon.workers.dev | Landing page and benchmark table, linking to the live demo on Hugging Face Spaces |

The free Workers plan runs JavaScript for short requests only. It cannot host the Python services, the gRPC runtime, or anything that holds a long connection to RabbitMQ, so those stay on Render, Hugging Face Spaces and Oracle Always Free as shown above. Changing the account subdomain moves every existing worker, so update old links on your CV and profiles when you do it.

When you can spend about 10 USD a year, buy one domain and add it to Cloudflare for free. Addresses like agentmesh.hassanmemon.dev and api.agentmesh.hassanmemon.dev then cover the frontends and the backends under one name.
