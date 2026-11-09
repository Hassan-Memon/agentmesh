// Entry point. Nest builds the dependency graph from AppModule, then we attach HTTP-level
// concerns (CORS, validation) and listen. Socket.IO shares the same HTTP server.
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);

  app.enableCors({ origin: config.corsOrigins, credentials: true });
  // whitelist + transform: unknown body fields are stripped, payloads become DTO instances.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  await app.listen(config.port);
  Logger.log(`gateway listening on :${config.port} (runtime gRPC at ${config.agentRuntimeGrpcUrl})`, 'Bootstrap');
}

void bootstrap();
