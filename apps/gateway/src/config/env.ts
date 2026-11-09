// Typed view of the environment. `validateEnv` runs once at startup (wired through
// ConfigModule.forRoot({ validate })) so a missing or malformed variable fails fast with a
// clear message instead of surfacing as an undefined deep inside a request.

export interface EnvConfig {
  PORT: number;
  AGENT_RUNTIME_GRPC_URL: string;
  DATABASE_URL: string | undefined;
  RABBITMQ_URL: string | undefined;
  MONGO_URL: string | undefined;
  CORS_ORIGIN: string;
  PROTO_PATH: string | undefined;
}

export function validateEnv(raw: Record<string, unknown>): EnvConfig {
  const str = (key: string): string | undefined => {
    const v = raw[key];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  };

  const port = Number(str('PORT') ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got ${String(raw['PORT'])}`);
  }

  return {
    PORT: port,
    AGENT_RUNTIME_GRPC_URL: str('AGENT_RUNTIME_GRPC_URL') ?? 'localhost:50051',
    DATABASE_URL: str('DATABASE_URL'),
    RABBITMQ_URL: str('RABBITMQ_URL'),
    MONGO_URL: str('MONGO_URL'),
    CORS_ORIGIN: str('CORS_ORIGIN') ?? 'http://localhost:3000',
    PROTO_PATH: str('PROTO_PATH'),
  };
}
