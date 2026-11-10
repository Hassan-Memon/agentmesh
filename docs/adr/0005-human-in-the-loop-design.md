# ADR-0005: Human-in-the-loop via LangGraph interrupt() and a resumable run

- Status: accepted
- Date: 2026-11-09
- Deciders: Hassan Memon

## Context and problem statement

Some agent steps should not complete without a person saying yes: publishing text, sending a
message, changing a record. The pause can last seconds or days. How do we model "wait for a
human" so that it survives process restarts, is visible in the dashboard, and is simple for
agent authors?

## Decision drivers

- The waiting run must not hold a thread, a connection, or a process.
- Approval must be auditable (who, when, what did they see).
- Agent authors should write one line, not a state machine.
- The dashboard needs to know a run is waiting and what to show.

## Considered options

1. Custom "pending approvals" table polled by the runtime.
2. LangGraph `interrupt()` with a persistent checkpointer, resumed via `Command(resume=...)`.
3. Two separate graphs (before approval, after approval) glued together by the gateway.

## Decision outcome

Chosen option: **option 2**.

The `reviewer` agent's `human_approval` node calls
`interrupt({...prompt, review, submission_preview})`. LangGraph persists a checkpoint and the
graph stops. The run engine sees the `__interrupt__` update, marks the run
`WAITING_APPROVAL`, emits an `INTERRUPT` RunEvent whose payload is the prompt, and returns.
The gRPC stream ends. Nothing is held open.

Later, `POST /runs/:id/approve {approved, feedback}` makes the gateway call `ResumeRun`. The
engine invokes the same graph with `Command(resume={"approved":..., "feedback":...})` and
the thread id. LangGraph replays `human_approval`; this time `interrupt()` returns the
decision and the graph continues to `finalize`. A `RESUMED` event precedes the rest.

Because the LangGraph thread id is the run id, the resume can happen in a different runtime
process, as long as it shares the Postgres checkpointer.

### Consequences

Good:

- One line in the agent, no custom state machine, and the pause costs nothing while waiting.
- The interrupt payload is a normal event: it is on the bus, in the event log, and in the
  `Run.interrupt` column for the dashboard's approval card.
- Rejection is first-class: the graph receives `approved=false` plus feedback and can branch.
  The run ends `REJECTED` and the feedback is in the output.

Bad:

- Code before `interrupt()` in the same node runs twice (once before the pause, once on
  resume). Keep interrupt nodes side-effect free above the call; do work in the next node.
- An in-memory checkpointer loses waiting runs on restart. That is acceptable for tests and
  demos; production must set `DATABASE_URL`.
- Who approved is currently a free-form `approved_by` field in the resume payload. Real
  identity arrives with authentication on the gateway (out of scope for the MVP).

## Rejected options

Option 1 reinvents what the checkpointer already provides and adds a polling loop. Option 3
spreads a single logical workflow across two definitions and makes the "what came before"
context awkward to carry across.
