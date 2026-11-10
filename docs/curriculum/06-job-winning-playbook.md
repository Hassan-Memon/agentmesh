# 06. The job-winning playbook: using the products to land principal and lead roles

## Rewrite the CV around the products

Add a section at the very top, right after the summary, called "Products I built and run". Three lines, one per product, each with the live URL and one number:

- AgentMesh: open agent platform, LangGraph agents as gRPC microservices behind a Nest.js gateway, RabbitMQ or Kafka bus, Next.js live dashboard, Postgres and pgvector, human-in-the-loop as persisted state. Live demo and 5 ADRs.
- OpenInfer: OpenAI-compatible inference runtime across CPU, Metal, CUDA, ROCm and NPU with a privacy and cost router; benchmarks published.
- IntakeAgent: voice intake for clinics and law firms producing FHIR R4 bundles and Clio matters, PHI kept on local inference, HIPAA safeguards documented.

New headline: "AI Platform Engineer | Agentic systems, microservices and real-time dashboards | Python, LangGraph, Node, Nest, Next, gRPC, RabbitMQ, Postgres".

Move the teaching role to a separate "Other experience" line. Keep it; it shows communication skill, but it should not interrupt the engineering timeline.

## Addressing the "10+ years" requirement honestly

You have about six years including the internship. Do not inflate it. In the cover note, redirect the conversation from years to evidence: "I have six years of production Python and I have shipped the exact architecture you describe as open source: gRPC service boundaries, a message bus, a Nest gateway and a Next dashboard, with LangGraph agents and HITL. Here is the repo and the live demo." Many companies write 10+ as a filter for seniority of judgment, not a calendar count. Your ADRs are the judgment.

## The application package for the SalesTeq-style role

1. CV with the products section.
2. A 150-word note mapping their bullets to your repos. Example for this JD: "gRPC and message brokers: AgentMesh proto and bus package. Vector plus NoSQL plus Postgres: AgentMesh memory layer. RTC and agent dashboards: the live run monitor. LangGraph memory and context strategy: the budgeting util and checkpoint ADR. Healthcare and legal: IntakeAgent with FHIR and Clio. AWS: documented cost model, deployed on free tiers by choice."
3. The three-minute demo video link.
4. A link to one long-form article.

## Interview preparation by round

Screening call: have the 2-minute version of each product ready (the `docs/learn/04-interview-talk-track.md` in each repo). Lead with the architecture, follow with one number, end with what you would do next.

System design round: use the drill in the system design masterclass. Draw AgentMesh from memory. Be ready for "why not Kafka first", "how do you handle a crashed agent mid-run", "how do you stop PHI reaching the cloud", "what breaks at 10x". The ADRs answer all four.

Coding round: expect Node or TypeScript questions because the JD leads with them. Spend the 12 weeks writing the gateway and dashboard code yourself after reading the generated version: delete a module and rewrite it. You must be able to explain Nest dependency injection and Next.js server versus client components without notes.

Leadership round: talk about ADRs as a team practice, about code review standards you would set (tests required, small PRs, contract changes reviewed by both sides), and about mentoring. Your teaching experience is a real asset here: you have taught international learners a difficult subject. Say so.

## Salary and location

The posted range for the target role is 2,500 to 3,500 USD per month take-home. Ask for the top of the range and justify it with the products. For UAE roles, principal-level AI engineers earn considerably more; use Pakistani remote roles as a floor, not a ceiling. Always ask whether the role is contract or employee and who pays taxes and fees.

## Volume and tracking

Apply to ten roles a week for twelve weeks, mixing US remote, UK remote, UAE relocation and KSA relocation. Track in a spreadsheet: company, role, date, link to the version of the CV used, outcome. Expect a 5 to 10 percent response rate on cold applications and far higher on warm introductions, so spend at least a third of your effort on introductions through LinkedIn and your network.

## The mindset shift

You said you are "old in this era". The industry does not reward age or youth; it rewards evidence. Three live products with tests, CI, ADRs and users are more evidence than most ten-year engineers have. Build, measure, write, repeat.
