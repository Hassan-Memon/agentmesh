// Static data and deterministic "model" output for the in-browser demo backend.
//
// Everything here mirrors the real system so the demo shows the same shapes the gateway
// returns: agent metadata comes from services/agent-runtime/agentmesh_runtime/agents/registry.py,
// the knowledge documents from memory/seed.py, and node summaries follow
// agents/tracing.py:summarize_update. No network, no model: text is composed from the input.
import type { Agent, TokenUsage } from '../types';

export const DEMO_AGENTS: Agent[] = [
  {
    name: 'researcher',
    description: 'Answers questions with retrieval-augmented generation over the pgvector knowledge base.',
    version: '0.1.0',
    capabilities: ['rag', 'pgvector', 'citations'],
    requiresApproval: false,
  },
  {
    name: 'writer',
    description: 'Produces an outline and then a full draft for a requested piece of writing.',
    version: '0.1.0',
    capabilities: ['writing', 'two-step'],
    requiresApproval: false,
  },
  {
    name: 'reviewer',
    description: 'Reviews submitted text, then pauses for a human approve/reject decision before finalizing.',
    version: '0.1.0',
    capabilities: ['review', 'hitl', 'interrupt'],
    requiresApproval: true,
  },
];

const RESEARCH_SYSTEM =
  "You are the AgentMesh research agent. Answer the user's question using only the provided context. Cite sources by their title in square brackets. If the context is insufficient, say so.";
const OUTLINE_SYSTEM =
  'You are the AgentMesh writing agent. Produce a numbered outline (4 to 6 points) for the requested piece. Output only the outline.';
const DRAFT_SYSTEM =
  'You are the AgentMesh writing agent. Write the full draft following the given outline. Plain prose, short paragraphs, no em-dashes.';
const REVIEW_SYSTEM =
  "You are the AgentMesh review agent. Review the submitted text for clarity, correctness and tone. Return JSON only with keys: verdict ('approve' | 'revise'), score (1-10), notes (list of strings).";

interface KnowledgeDoc {
  content: string;
  title: string;
  source: string;
  /** One sentence the synthesized answer can quote. */
  claim: string;
}

const KNOWLEDGE: KnowledgeDoc[] = [
  {
    content:
      'AgentMesh runs each LangGraph agent inside a Python runtime that exposes a gRPC AgentService. The TypeScript gateway calls StartRun and receives a server stream of RunEvent messages.',
    title: 'Architecture: gRPC between gateway and runtime',
    source: 'docs/adr/0001',
    claim: 'Each LangGraph agent runs inside a Python runtime behind a gRPC AgentService, and the gateway consumes a server stream of RunEvents from StartRun',
  },
  {
    content:
      'Every node start, node finish, token usage report, interrupt and completion is published to a RabbitMQ topic exchange named agentmesh.events with routing key run.<run_id>.<type>. Kafka or Redpanda can replace RabbitMQ behind the same bus interface.',
    title: 'Event bus and routing keys',
    source: 'docs/adr/0002',
    claim: 'Every node start, node finish, token report, interrupt and completion is published to the agentmesh.events exchange with routing key run.<run_id>.<type>',
  },
  {
    content:
      'Human-in-the-loop approval uses LangGraph interrupt(). The reviewer agent pauses, the gateway marks the run waiting_approval, and POST /runs/:id/approve resumes the graph from its Postgres checkpoint with Command(resume=...).',
    title: 'Human in the loop',
    source: 'docs/adr/0005',
    claim: 'Approval uses LangGraph interrupt(): the run is marked waiting_approval and POST /runs/:id/approve resumes it from its Postgres checkpoint with Command(resume=...)',
  },
  {
    content:
      'Memory strategy: short-term memory is LangGraph state, episodic memory is the checkpoint history in Postgres, and semantic memory is a pgvector table with an HNSW cosine index. A context budgeter trims messages by token count before every model call.',
    title: 'Memory and context strategy',
    source: 'docs/adr/0004',
    claim: 'Run state lives in LangGraph state, its history in Postgres checkpoints, and long-term knowledge in a pgvector table with an HNSW cosine index',
  },
  {
    content:
      'The dashboard is a Next.js 15 App Router application. Lists are server components that fetch from the gateway REST API; the run detail page is a client component that joins a Socket.IO room and renders RunEvents as a live timeline.',
    title: 'Dashboard',
    source: 'apps/dashboard',
    claim: 'The dashboard joins a Socket.IO room per run and renders RunEvents as a live timeline',
  },
  {
    content:
      'LLM access goes through a provider abstraction. With DEMO_MODE=1 a deterministic stub model answers; otherwise ChatOpenAI with a base_url targets OpenInfer, Ollama, Groq, Gemini or OpenRouter.',
    title: 'LLM providers',
    source: 'services/agent-runtime/agentmesh_runtime/llm.py',
    claim: 'Model access goes through one OpenAI-compatible provider abstraction that targets OpenInfer, Ollama, Groq, Gemini or OpenRouter',
  },
];

// ---------------------------------------------------------------------------- helpers

/** Same heuristic as the runtime's context.estimate_tokens: about four characters per token. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function usageFor(promptParts: string[], completion: string): TokenUsage {
  // A few tokens of chat-template overhead per message, like a real provider reports.
  const prompt = promptParts.reduce((n, p) => n + estimateTokens(p) + 4, 0);
  const out = estimateTokens(completion);
  return { prompt_tokens: prompt, completion_tokens: out, total_tokens: prompt + out };
}

function budgetReport(promptTokens: number): Record<string, number> {
  return { tokens_before: promptTokens, tokens_after: promptTokens, dropped: 0, truncated: 0 };
}

export function firstSentence(text: string, limit = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'the request';
  const cut = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  return cut.length <= limit ? cut : cut.slice(0, limit - 3) + '...';
}

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );
}

/** Small stable hash so the same input always produces the same numbers. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Python's str() of a value, which is what the runtime's node summaries contain. */
function pyRepr(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(', ')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `'${k}': ${pyRepr(v)}`)
      .join(', ')}}`;
  }
  return String(value);
}

function pyStr(value: unknown): string {
  return typeof value === 'string' ? value : pyRepr(value);
}

function short(text: string, limit: number): string {
  return text.length <= limit ? text : text.slice(0, limit - 3) + '...';
}

/** Port of agents/tracing.py:summarize_update. */
export function summarizeUpdate(update: Record<string, unknown>, limit = 240): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(update)) {
    if (key === 'messages' || key === 'usage') continue;
    if (typeof value === 'string') out[key] = short(value, limit);
    else if (Array.isArray(value)) out[key] = `${value.length} item(s)`;
    else if (value && typeof value === 'object') {
      out[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .slice(0, 8)
          .map(([k, v]) => [k, short(pyStr(v), 80)]),
      );
    } else out[key] = short(pyStr(value), limit);
  }
  return out;
}

// ---------------------------------------------------------------------------- agents

export interface NodeResult {
  node: string;
  /** The node's state update, summarised into NODE_FINISHED.payload.summary. */
  update: Record<string, unknown>;
  usage: TokenUsage | null;
  /** Simulated wall time of the node in ms. */
  durationMs: number;
}

export function researcherNodes(input: string): { nodes: NodeResult[]; output: Record<string, unknown> } {
  const q = words(input);
  const seed = hash(input);
  const hits = KNOWLEDGE.map((doc, i) => {
    const overlap = [...words(doc.content + ' ' + doc.title)].filter((w) => q.has(w)).length;
    const jitter = ((seed >> (i * 3)) % 37) / 1000;
    return { doc, score: Math.min(0.93, 0.58 + overlap * 0.045 + jitter) };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((h, i) => ({
      id: `kb-${(hash(h.doc.title) % 9000) + 1000}`,
      content: h.doc.content,
      score: Number(h.score.toFixed(4)),
      metadata: { title: h.doc.title, source: h.doc.source },
      claim: h.doc.claim,
      rank: i,
    }));

  const ctxText = hits.map((h) => `[${h.metadata.title}] ${h.content}`).join('\n\n');
  const prompt = `Context:\n${ctxText}\n\nQuestion: ${input}`;
  const top = hits.slice(0, 3);
  const answer =
    `Summary for: ${firstSentence(input)}\n\n` +
    top.map((h) => `${h.claim} [${h.metadata.title}].`).join(' ') +
    `\n\nThe remaining retrieved passage [${hits[3]?.metadata.title ?? 'none'}] scored lower and was used only as supporting context.`;
  const usage = usageFor([RESEARCH_SYSTEM, prompt], answer);
  const sources = hits.map((h) => ({ title: h.metadata.title, source: h.metadata.source, score: h.score }));
  const output = { answer, sources, budget: budgetReport(usage.prompt_tokens) };

  return {
    output,
    nodes: [
      {
        node: 'retrieve',
        update: { context: hits.map(({ id, content, score, metadata }) => ({ id, content, score, metadata })) },
        usage: null,
        durationMs: 180 + (seed % 140),
      },
      { node: 'synthesize', update: { usage, output }, usage, durationMs: 1900 + (seed % 900) },
    ],
  };
}

export function writerNodes(input: string): { nodes: NodeResult[]; output: Record<string, unknown> } {
  const topic = firstSentence(input).replace(/[.!?]$/, '');
  const seed = hash(input);
  const outline = [
    `1. Why ${topic.charAt(0).toLowerCase() + topic.slice(1)} matters`,
    '2. How it works today, step by step',
    '3. Trade-offs and failure modes',
    '4. What to measure in production',
    '5. Recommendation',
  ].join('\n');
  const outlineUsage = usageFor([OUTLINE_SYSTEM, input], outline);

  const draft = [
    `${topic}.`,
    'Teams reach for this when a quick prototype starts carrying real traffic. The question stops being whether it works and becomes whether you can see what it is doing, recover when it fails and explain its decisions afterwards.',
    'Today the common path is a single service that owns the whole flow. Each step reads the previous result, calls a model or a tool, and writes its own output. That is easy to start with, but every step shares one process, one deploy and one failure domain.',
    'The trade-off is visibility against moving parts. Splitting the flow into explicit steps with typed contracts adds a little latency and some plumbing. In return every step can be traced, retried from a checkpoint and paused for a human when the stakes are high.',
    'Measure what users feel: time to first event, end to end latency, tokens per run and how often a person has to step in. Those four numbers tell you whether the system is getting cheaper and more trustworthy over time.',
    'Recommendation: start with explicit steps and an event stream from day one. It costs little early and saves a rewrite once the first incident review asks what the agent actually did.',
  ].join('\n\n');
  const draftPrompt = `Topic: ${input}\n\nOutline:\n${outline}`;
  const draftUsage = usageFor([DRAFT_SYSTEM, draftPrompt], draft);
  const output = { outline, draft, budget: budgetReport(draftUsage.prompt_tokens) };

  return {
    output,
    nodes: [
      { node: 'outline', update: { outline, usage: outlineUsage }, usage: outlineUsage, durationMs: 900 + (seed % 500) },
      { node: 'draft', update: { draft, usage: draftUsage, output }, usage: draftUsage, durationMs: 2600 + (seed % 1100) },
    ],
  };
}

export function reviewerReview(input: string): { node: NodeResult; review: Record<string, unknown> } {
  const seed = hash(input);
  const sentences = input.split(/(?<=[.!?])\s+/).filter(Boolean);
  const long = sentences.filter((s) => s.split(/\s+/).length > 28).length;
  const score = Math.max(4, Math.min(9, 8 - long + (seed % 2) - (input.length < 80 ? 2 : 0)));
  const notes = [
    sentences.length > 1 ? 'Clear structure with one idea per sentence' : 'A single sentence: add context for a reader who is new to the topic',
    /\d/.test(input) ? 'Numbers are concrete; cite where they come from' : 'Claims would land better with one concrete number or example',
    long > 0 ? `Split ${long} long sentence(s) for readability` : 'Tighten the introduction before publishing',
  ];
  const review = { verdict: score >= 7 ? 'approve' : 'revise', score, notes };
  const usage = usageFor([REVIEW_SYSTEM, input], JSON.stringify(review));
  return { review, node: { node: 'review', update: { review, usage }, usage, durationMs: 1400 + (seed % 700) } };
}

/** Example tasks used for the seeded history (same as the run form's examples). */
export const SEED_INPUTS = {
  researcher: 'How does AgentMesh keep a human in the loop, and where is run state stored?',
  writer: 'Write a short explainer on why a gateway should talk to agent services over gRPC rather than REST.',
  reviewerApproved:
    'Release note: runs now stream every LangGraph node to the dashboard over Socket.IO, and approvals resume from the Postgres checkpoint in under 200 ms.',
  reviewerWaiting:
    'Draft for review: AgentMesh runs each agent as a service and streams every step to the dashboard. Humans approve risky steps before anything is published.',
};
