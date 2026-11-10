# Nest.js: modules, providers and dependency injection

**In one line:** Nest is an opinionated Node framework where you declare classes and their
dependencies, and the framework constructs and wires them for you.

## Coming from FastAPI

FastAPI has `Depends()`: a function parameter that FastAPI fills in. Nest has the same idea
applied to classes and taken further: every service is a class, its constructor lists what it
needs, and a container builds the whole graph once at startup.

```ts
@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grpc: AgentGrpcClient,
    private readonly events: EventLogService,
  ) {}
}
```

You never write `new RunsService(...)`. Nest reads the constructor parameter types (that is
what `emitDecoratorMetadata` in `tsconfig.json` enables), finds a provider for each, and
injects singletons. Look at `apps/gateway/src/runs/runs.service.ts`.

## The three building blocks

**Providers** are injectable classes: services, repositories, clients. `@Injectable()` marks
them. `AgentGrpcClient`, `PrismaService`, `EventLogService`, `BusState` are providers.

**Controllers** map HTTP routes to methods. `@Controller('runs')` plus `@Post()` and
`@Get(':id')` in `runs.controller.ts`. Parameters are pulled with `@Body()`, `@Param()`,
`@Query()`. Controllers stay thin and call a service.

**Modules** group providers and controllers and define visibility. `RunsModule` declares its
controller and service and *imports* `GrpcModule`, `EventLogModule`, `WsModule`, `BusModule`
to gain access to what those modules *export*. A provider not exported is private to its
module. `@Global()` on `PrismaModule` and `AppConfigModule` makes their exports available
everywhere, which is right for cross-cutting infrastructure.

`AppModule` (`app.module.ts`) is the root that imports everything.

## Lifecycle hooks

Classes can implement `OnModuleInit` and `OnModuleDestroy`. `RabbitMqConsumerService.
onModuleInit` starts consuming; `PrismaService.onModuleDestroy` disconnects.
`app.enableShutdownHooks()` in `main.ts` makes Nest call them on SIGTERM so Docker stops are
clean.

## Pipes, DTOs and validation

`main.ts` installs a global `ValidationPipe({ whitelist: true, transform: true })`. A request
body is converted into the DTO class declared on the parameter and validated with the
`class-validator` decorators on it (`runs/dto/start-run.dto.ts`). Unknown fields are
stripped; failures become a 400 with a list of messages. This is Pydantic's job in FastAPI,
done with decorators.

`ParseUUIDPipe` on `@Param('id')` rejects non-UUID ids before the service runs.

## Gateways (WebSockets)

`@WebSocketGateway({ namespace: 'runs' })` turns a class into a Socket.IO namespace handler.
`@SubscribeMessage('join')` methods handle client messages; `@WebSocketServer()` injects the
server for emitting. `ws/runs.gateway.ts` is a provider like any other, so `RunsService` and
the bus consumer can inject it and call `emitRunEvent`.

## Testing with the DI container

`@nestjs/testing` builds a module with substitutions:

```ts
Test.createTestingModule({
  providers: [RunsService, { provide: PrismaService, useValue: prismaMock }, ...],
}).compile();
```

`runs.service.spec.ts` replaces every I/O dependency with a mock this way and tests the
real wiring and logic. This is the main payoff of DI: tests do not monkeypatch imports.

## Config

`@nestjs/config` loads `.env` files and exposes `ConfigService`. We wrap it in
`AppConfigService` with typed getters and validate at startup in `config/env.ts`, so the
rest of the code never reads `process.env`.

## Mental model

Think of Nest modules as Python packages with an explicit `__all__`, providers as module-level
singletons you never instantiate yourself, and decorators as the metadata FastAPI gets from
type hints. Once that clicks, the rest is Express underneath.
