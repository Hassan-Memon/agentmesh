# Prisma

**In one line:** Prisma is a TypeScript ORM where you write the schema in its own language,
generate a fully typed client from it, and manage the database with versioned SQL migrations.

## Coming from SQLAlchemy / Django ORM

Django's `models.py` defines tables as classes; migrations are generated from model changes.
Prisma is the same workflow with the schema in `prisma/schema.prisma` instead of Python, and
with one important difference: the query client is *generated* from the schema, so
`prisma.run.findUnique({ where: { id } })` returns a `Run` type with exactly the columns you
declared, and a typo in a field name is a compile error.

## Reading the schema

`apps/gateway/prisma/schema.prisma`:

```prisma
model Run {
  id        String    @id
  status    RunStatus @default(QUEUED)
  output    Json?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  events    RunEvent[]
}
```

- `@id` is the primary key. We supply UUIDs ourselves because the id doubles as the LangGraph
  thread id.
- `Json?` becomes `jsonb` in Postgres. We use it for agent-specific output, interrupt payloads
  and event payloads, which are deliberately schemaless.
- `@updatedAt` is maintained by the client, not a database trigger.
- `events RunEvent[]` plus the `@relation` on the other side defines the foreign key.
- `@@unique([runId, seq])` creates a compound unique index; it is what lets the event log
  `upsert` idempotently.

Enums become Postgres enums; the generated client exports `RunStatus.WAITING_APPROVAL` as a
constant you can use in TypeScript.

## The three commands

1. `npx prisma generate` builds the client into `node_modules/@prisma/client`. Run it after
   every schema change and after `npm ci` (CI and the Dockerfile do).
2. `npx prisma migrate dev --name add_thing` (local, needs a database) diffs the schema
   against the database and writes a SQL file under `prisma/migrations/`. The initial
   migration in this repo was produced offline with
   `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.
3. `npx prisma migrate deploy` applies pending migrations in production. The gateway's Docker
   `CMD` runs it before starting Node.

Migrations are plain SQL you can read and review. Open
`prisma/migrations/20261109000000_init/migration.sql` to see what the schema became.

## Using the client in Nest

`src/prisma/prisma.service.ts` extends `PrismaClient` and is registered as a global provider,
so any service can inject it. The first query opens the connection pool; `onModuleInit`
tries an eager connect so misconfiguration is logged at startup rather than on the first
request.

Typical calls in `runs.service.ts`:

```ts
await this.prisma.run.create({ data: { id, agent, input, status: RunStatus.QUEUED } });
await this.prisma.run.update({ where: { id }, data: { status: RunStatus.COMPLETED, output } });
await this.prisma.run.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
```

For `Json` columns Prisma wants `Prisma.InputJsonValue`; to store an explicit SQL `NULL`
you pass `Prisma.JsonNull` (a plain `null` would mean "do not touch this field" in an
update). You will see both in `event-log.service.ts`.

## Testing without a database

The unit tests substitute `PrismaService` with a plain object of `jest.fn()`s
(`runs.service.spec.ts`). Because the service depends on the injected instance and not on a
global, no database or test container is needed. Integration tests against a real Postgres
would be the next layer.

## Gotchas

- `prisma generate` downloads a query engine binary on first run; CI needs network for it.
- `BigInt` ids (used for `RunEvent.id`) are JavaScript `bigint`, which `JSON.stringify`
  cannot serialise. The gateway never returns that column directly.
- Prisma pools connections per process. On Neon's free tier use the pooled connection string.
