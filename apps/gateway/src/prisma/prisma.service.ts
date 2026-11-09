import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// PrismaClient as an injectable singleton. Prisma connects lazily on the first query; we
// attempt an eager connect so a bad DATABASE_URL shows up in the logs at startup, but we do
// not crash: the gateway can still serve /health and /agents without Postgres.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('connected to Postgres');
    } catch (err) {
      this.logger.warn(`Postgres not reachable yet: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
