# Architecture Decision Records

Short records in [MADR](https://adr.github.io/madr/) format. One decision per file, numbered,
never edited after acceptance (supersede with a new ADR instead).

| ADR | Title |
| --- | --- |
| [0001](0001-grpc-between-gateway-and-agents.md) | gRPC between the gateway and the agent runtime |
| [0002](0002-rabbitmq-default-kafka-optional.md) | RabbitMQ as the default event bus, Kafka behind the same interface |
| [0003](0003-nest-gateway-python-agents.md) | Nest.js for the gateway, Python for the agents |
| [0004](0004-postgres-checkpoints-and-pgvector-first.md) | Postgres checkpoints and pgvector first; dedicated vector DB later |
| [0005](0005-human-in-the-loop-design.md) | Human-in-the-loop via LangGraph interrupt() and a resumable run |

Template for new records:

```markdown
# ADR-NNNN: Title

- Status: proposed | accepted | superseded by ADR-MMMM
- Date: YYYY-MM-DD
- Deciders: ...

## Context and problem statement
## Decision drivers
## Considered options
## Decision outcome
### Consequences
```
