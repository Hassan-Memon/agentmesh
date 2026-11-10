# 04. Marketing strategy for a one-person, zero-budget company

Marketing with no budget means marketing with proof. Every tactic below costs time, not money.

## The one-line positioning for each product

Write these down, use them everywhere, do not improvise new ones.

- OpenInfer: "One model, any hardware. The OpenAI-compatible runtime that keeps private data on your own machine."
- AgentMesh: "The open agent operating platform. LangGraph agents as microservices, watched live, with humans in the loop."
- IntakeAgent: "Voice-first intake for clinics and law firms. Patients talk, records come out clean, a human approves every one."

## Channel 1: GitHub itself

The repo is the landing page. Your README must have, in this order: one sentence pitch, a screenshot or GIF within the first screen, a three-command quickstart, the architecture diagram, and a "deploy free" section. Pin the three repos on your profile. Add topics. Write a profile README that links them with one line each. Respond to every issue within a day; responsiveness is the signal maintainers are judged by.

## Channel 2: LinkedIn, the recruiter channel

Your target employers are in the US, UK and Gulf, and their recruiters live on LinkedIn.

Headline: "AI Platform Engineer | LangGraph agents as microservices (gRPC, RabbitMQ, Nest, Next) | Open-source: OpenInfer, AgentMesh, IntakeAgent"

Posting cadence: two posts a week for twelve weeks. Formats that work for engineers:

1. The transformation story: "In 2020 I pushed a Django weather app. This week I rebuilt that repo into a voice intake agent that outputs FHIR records. Here is what changed in how I think." People love before and after.
2. The diagram post: one architecture diagram, five bullet points on the trade-offs. Ask a question at the end.
3. The numbers post: a benchmark table from `openinfer bench`. Tokens per second on a free ARM VM versus a cloud API. Numbers get shared.
4. The lesson post: one concept from your `docs/learn/`, rewritten in 150 words. You learn it twice and you look like a teacher, which is what a principal is.
5. The demo video: three minutes, screen recording, your voice. Post natively, not as a link.

## Channel 3: Developer communities

- Hacker News "Show HN" for OpenInfer once it runs a real model on Hugging Face Spaces. Title format: "Show HN: OpenInfer, an OpenAI-compatible runtime that routes requests local or cloud by privacy and cost". Be in the comments for six hours.
- Reddit: r/LocalLLaMA for OpenInfer, r/LangChain for AgentMesh, r/healthIT and r/LawFirm for IntakeAgent (read the rules; those subreddits punish self-promotion, so post as "I built this, what would make it useful to you?").
- The LangChain community: you already contributed to the docs. Open an issue or discussion proposing AgentMesh as a reference deployment. Ask for feedback, not promotion.
- Dev.to and Hashnode: cross-post your long-form articles with canonical links to your own blog if you have one.

## Channel 4: Long-form writing

One substantial article per month. Titles that would do well:

- "I ran the same 7B model on CPU, Apple Metal and a free Oracle ARM VM. Here is the table."
- "Human-in-the-loop is a database state, not a webhook: lessons from building AgentMesh."
- "What a HIPAA technical safeguards table actually asks a developer to build."
- "gRPC versus REST between an API gateway and Python agents: the numbers from my repo."

## Channel 5: Video

A three-minute demo per product. Use OBS, free. Script: problem in 20 seconds, demo in 2 minutes, architecture in 30 seconds, call to action in 10 seconds. Put the video at the top of the README and on LinkedIn.

## Channel 6: Arabic and Urdu content

Nobody else in this category is producing technical content in Arabic. A short Arabic thread or video about IntakeAgent for Gulf clinics reaches decision makers in UAE and KSA who are underserved. This is your unfair advantage; use it from week four.

## Measurement

Track weekly in a simple spreadsheet: GitHub stars, repo clones, LinkedIn profile views, inbound messages, applications sent, interviews booked, demo calls booked. If a channel produces nothing after four weeks of honest effort, drop it and double the one that works.

## What not to do

- Do not buy followers, ads or stars.
- Do not post generic AI opinions. Post what you built and what you measured.
- Do not announce products before the quickstart works. A broken quickstart is the fastest way to lose a visitor forever.
