import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from './env';

// A thin typed facade over Nest's ConfigService so the rest of the app never touches
// string keys. Inject `AppConfigService` and read properties.
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get agentRuntimeGrpcUrl(): string {
    return this.config.get('AGENT_RUNTIME_GRPC_URL', { infer: true });
  }

  get databaseUrl(): string | undefined {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get rabbitmqUrl(): string | undefined {
    return this.config.get('RABBITMQ_URL', { infer: true });
  }

  get mongoUrl(): string | undefined {
    return this.config.get('MONGO_URL', { infer: true });
  }

  get corsOrigins(): string[] {
    return this.config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  get protoPath(): string | undefined {
    return this.config.get('PROTO_PATH', { infer: true });
  }
}
