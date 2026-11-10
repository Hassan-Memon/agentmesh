# 03. Market worth: what these products could be worth, and how to say it honestly

You asked for products that challenge Nvidia, Apple, Huawei and OpenAI. Here is the grounded version of that ambition, and the numbers behind it. The figures below are reasoned estimates for planning, not audited market research. Verify them before you put them in a pitch deck, and cite sources when you do.

## The honest framing of "challenge the giants"

You do not compete with Nvidia by making chips. You compete with Nvidia's moat, which is CUDA lock-in. Every developer who runs a model on a non-Nvidia device through OpenInfer is one less reason to buy an Nvidia card. You do not compete with Apple by making phones; you compete with the idea that on-device intelligence must be closed. You do not compete with OpenAI's models; you compete with OpenAI's platform by making agent orchestration vendor-neutral so no one is locked into one model provider. This is exactly how Linux challenged Unix vendors and how Postgres challenged Oracle. Open, neutral, self-hostable. That positioning is believable from one engineer in Karachi; "faster than an H100" is not.

## Product by product

### OpenInfer (infrastructure, open source)

Who pays: companies that must keep data on premises (healthcare, legal, government, Gulf sovereign-cloud mandates) and companies that want to cut cloud inference bills.

Market context: the broader market for AI inference infrastructure is measured in the tens of billions of dollars a year and growing fast. The slice you address is "inference routing and local serving software", where the names are vLLM, Ollama, LiteLLM, LM Studio, and NVIDIA NIM. LiteLLM reached a venture-backed company from an open-source router; Ollama raised venture funding from a local runner. That tells you the category is fundable.

How it makes money: open core. The router and server are free. Paid tiers: multi-tenant control plane, SSO, audit logs, SLA support, managed fleet of edge boxes. Realistic pricing: 500 to 5,000 USD per month per deployment for enterprise support.

Honest valuation path: the asset value in year one is attention, not revenue. 1,000 GitHub stars and 50 production users makes you hireable at principal level anywhere and makes the project acquirable by a larger platform. Revenue is a year two conversation.

### AgentMesh (platform, open source)

Who pays: engineering teams building agent products who do not want to be locked into a single vendor's agent runtime, and regulated companies who cannot send agent state to a third party.

Market context: "agent orchestration platform" is a new and crowded category. Vendor platforms (OpenAI, Google, Anthropic), frameworks (LangGraph Platform, CrewAI, AutoGen), and workflow tools (Temporal, n8n, Inngest). Your differentiation is the specific combination: LangGraph native, microservice boundaries over gRPC, event bus, HITL as persisted state, Nest and Next front door. Nobody ships that as one coherent open repo today.

How it makes money: a hosted control plane (the dashboard and gateway as a service, agents stay in the customer's cloud), 99 to 999 USD per month by seats and runs. Consulting: you implement it for a client at 80 to 150 USD per hour from Pakistan to US clients, which is itself a 100,000 USD per year business for one person.

### IntakeAgent (vertical SaaS)

Who pays: small and medium clinics, DME suppliers, and law firms. This is the product with real near-term revenue.

Market context and unit economics:

| Metric | Healthcare (US small clinic) | Legal (US small firm) |
|---|---|---|
| Number of potential buyers | Roughly 200,000 physician practices in the US | Roughly 400,000 law firms in the US, most under 10 lawyers |
| Current cost of intake | Front desk or intake coordinator, 35,000 to 50,000 USD per year, often part of a role | Intake specialist or paralegal time, similar range |
| Willingness to pay | 200 to 800 USD per month per location | 300 to 1,500 USD per month per firm |
| Comparable products | Existing voice AI for clinics, patient intake form tools | Legal intake and CRM tools, including Clio's own intake product |

Serviceable obtainable market for a one-person company in 18 months: 30 to 100 paying locations. At 400 USD per month average, that is 12,000 to 40,000 USD per month of recurring revenue. In SaaS terms that is a company worth several hundred thousand to a few million dollars at typical revenue multiples, and more importantly it is a salary from your own product.

Gulf angle: UAE and KSA clinics and law firms are digitising fast, both countries have personal data laws that favour local processing, and Arabic voice intake is a real gap. You speak native Arabic and Urdu and build voice AI. That combination is rare. Use it.

## How to talk about worth in interviews and pitches

- To an employer: "These are open-source products with real users; here are the stars, the deployments, the issues people filed." Worth equals proof of competence.
- To a customer: "This saves one intake coordinator's time per location and produces cleaner records; here is a pilot price." Worth equals savings.
- To an investor, if ever: "Infrastructure gets adoption, the platform gets teams, the vertical gets revenue; here is the funnel between them." Worth equals the system.

Never quote a market size you cannot source. Quote your own numbers instead: your latency, your cost per intake, your users.
