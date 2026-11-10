import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// PrismaClient as an injectable singleton. Prisma connects lazily on the first query anyway;
// we start an eager connect so a bad DATABASE_URL shows up in the logs at startup. It is
// deliberately NOT awaited: Nest awaits every onModuleInit before listening, and an
// unreachable database must not stop the gateway from serving /health and /agents.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  onModuleInit(): void {
    this.$connect()
      .then(() => this.logger.log('connected to Postgres'))
      .catch((err: Error) => this.logger.warn(`Postgres not reachable yet: ${err.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
