# The Curriculum: from "I never built something for myself" to principal-level engineer and founder

This folder teaches the four things you asked for, using your own three products as the case studies:

1. Architecture (how to decide what boxes exist and where the lines go)
2. System design (how it behaves under load, failure, and growth)
3. Market worth (what these products could be worth, and how to value them honestly)
4. Marketing and selling (how to get the first users, the first customers, and the job offers)

The live products are at github.com/Hassan-Memon/agentmesh, github.com/Hassan-Memon/openinfer and github.com/Hassan-Memon/intakeagent. Each repo also has its own `docs/learn/` with lessons tied to its code. Read this folder for the cross-cutting view, and each repo's `docs/learn/` for the hands-on view.

## How the three products fit together

```
          users / clinics / law firms / employers
                        |
              +---------v----------+
              |    IntakeAgent     |   vertical product (the one that earns money first)
              +---------+----------+
                        | uses agents and memory
              +---------v----------+
              |     AgentMesh      |   horizontal platform (the one that proves architecture skill)
              +---------+----------+
                        | all LLM calls
              +---------v----------+
              |     OpenInfer      |   infrastructure (the one that proves depth and gets stars)
              +--------------------+
```

The stack is deliberate. Infrastructure gets GitHub stars and respect from senior engineers. Platforms get interviews. Vertical products get customers. You need all three, in that order of difficulty to sell, and the reverse order of difficulty to build.

## The 12-week schedule

| Week | Build | Learn | Market |
|---|---|---|---|
| 1 | Run all three locally, read every ADR | 01-architecture-principles | Write LinkedIn headline, pin repos |
| 2 | Deploy OpenInfer to Hugging Face Spaces | 02-system-design, chapters 1 to 3 | Post 1: "I rebuilt my 2020 repos into..." |
| 3 | Deploy AgentMesh dashboard to Vercel, gateway to Render | 02-system-design, chapters 4 to 6 | Post 2: architecture diagram thread |
| 4 | Deploy IntakeAgent demo | 03-market-and-worth | Record a 3-minute demo video |
| 5 | Add one real integration (Groq STT) | 04-marketing-strategy | Submit to 3 newsletters and Hacker News "Show HN" |
| 6 | Add Kafka profile run and a load test | 05-selling-strategy | First 10 cold outreach messages to clinics |
| 7 | Write first long-form blog post | 06-job-winning-playbook | Apply to 10 target roles with repo links |
| 8 | Fix the issues users reported | Re-read ADRs and write 2 new ones | Second post with real numbers |
| 9 to 12 | Pilot with one clinic or firm, or one open-source contributor | Teach someone else one concept per week | Weekly post, weekly 10 applications |

## Rules for yourself

- Ship something visible every week. Visibility compounds. Perfection does not.
- Write down every decision as an ADR before you make it. Interviewers hire people who can explain trade-offs.
- Never say "I built a chatbot." Say "I built an agent platform with gRPC service boundaries, an event bus, Postgres checkpoints and a live dashboard, and here is the URL."
- Measure. Tokens per second, p95 latency, cost per intake, time to first byte. Numbers are the language of principals.
