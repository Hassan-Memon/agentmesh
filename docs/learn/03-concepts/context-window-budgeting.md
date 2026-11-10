# Context-window budgeting

**In one line:** a model accepts a fixed number of tokens per call; budgeting is deciding,
before every call, which messages fit and which get trimmed or dropped, so you never hit
the limit by accident and never pay for tokens that do not help.

## Why it matters more for agents

A chatbot has one growing conversation. An agent has a system prompt, the user task,
retrieved documents, intermediate drafts, tool results and possibly earlier runs' memories.
Left alone, the message list grows until the provider returns a 400 ("maximum context length
exceeded") halfway through a run, or until each call costs several times what it should.
Budgeting makes the failure impossible and the cost predictable.

## The policy in this repo

`services/agent-runtime/agentmesh_runtime/context.py`, `trim_messages_to_budget()`:

1. **System messages always survive.** They carry the instructions; dropping them changes the
   agent's behaviour, which is worse than losing history.
2. **Newest first.** Walk the remaining messages from newest to oldest, keep each one while it
   fits in the budget. Old context is the least likely to matter.
3. **Truncate rather than drop the newest message.** If even the latest user message does not
   fit, cut it from the front and prepend a marker. The model must always see the current
   turn.

It returns the trimmed list and a `BudgetReport` (tokens before/after, dropped, truncated).
Every agent call goes through `ask()` in `agents/common.py`, which applies the budget and
returns the report; the `researcher` and `writer` put it in their output so you can see it on
the dashboard.

## Counting tokens

Tokens are not words. `estimate_tokens()` uses tiktoken's `cl100k_base` encoding when it is
installed (it comes with `langchain-openai`), otherwise `len(text) // 4`, which is within
about 15 percent for English. Exactness matters less than consistency: the budget is a
safety margin below the real window, not the window itself. `CONTEXT_BUDGET_TOKENS` defaults
to 6000, comfortably under every model we target (8k for small local models, 128k for most
hosted ones).

Per-message overhead is counted as 4 tokens, following OpenAI's own cookbook estimate for
the role and separator framing.

## What this policy does not do

- **Summarisation.** Instead of dropping old messages you can replace them with a model-
  written summary. Better fidelity, extra cost and latency. Natural next step for long
  multi-turn agents.
- **Relevance ranking.** Retrieved documents could be ranked by score and the lowest cut
  first, independent of age. The researcher already asks for only `k=4` documents, which is a
  simpler form of the same idea.
- **Output budgeting.** `max_tokens` on the completion side is left to provider defaults.

## Where the three memories meet

ADR-0004 names three memory tiers. Budgeting is the valve between them and the model:

- Short-term (graph state) is what gets trimmed.
- Episodic (checkpoints) keeps the untrimmed history, so nothing is lost; it is just not sent.
- Semantic (pgvector) is how old information gets back in: not by scrolling the chat, but by
  retrieving the relevant piece when it is needed.

## Observability

`TOKEN_USAGE` events carry the provider-reported `prompt_tokens` and `completion_tokens` per
node (`usage_from_message` in `llm.py`), and the run's total lands on the `DONE` event and in
the `Run.usage` column. Compare `prompt_tokens` to `budget.tokens_after` and you can see the
estimator's error in production and tune it.

## Try it

`uv run pytest tests/test_context.py -v` covers the three rules. Then lower
`CONTEXT_BUDGET_TOKENS=300` in `.env`, start a `researcher` run, and look at the `budget`
block in the output: `dropped` and `truncated` stop being zero.
