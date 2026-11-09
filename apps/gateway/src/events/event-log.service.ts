// Persists the per-run event log. MongoDB when MONGO_URL is set (append-heavy, schemaless
// documents are a natural fit), otherwise the Postgres `RunEvent` table via Prisma (JSONB).
// Both paths upsert on (runId, seq) so redelivered bus messages are harmless.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Collection, MongoClient } from 'mongodb';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RunEventDto } from './run-event';

type EventDoc = RunEventDto & { _id?: unknown };

@Injectable()
export class EventLogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventLogService.name);
  private mongo: MongoClient | null = null;
  private collection: Collection<EventDoc> | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get backend(): 'mongodb' | 'postgres' {
    return this.collection ? 'mongodb' : 'postgres';
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.mongoUrl;
    if (!url) {
      this.logger.log('event log: Postgres JSONB (MONGO_URL not set)');
      return;
    }
    try {
      this.mongo = new MongoClient(url, { serverSelectionTimeoutMS: 3_000 });
      await this.mongo.connect();
      this.collection = this.mongo.db().collection<EventDoc>('run_events');
      await this.collection.createIndex({ runId: 1, seq: 1 }, { unique: true });
      this.logger.log('event log: MongoDB');
    } catch (err) {
      this.logger.warn(`MongoDB unavailable (${(err as Error).message}); falling back to Postgres`);
      this.mongo = null;
      this.collection = null;
    }
  }

  async append(event: RunEventDto): Promise<void> {
    if (this.collection) {
      await this.collection.updateOne(
        { runId: event.runId, seq: event.seq },
        { $setOnInsert: event },
        { upsert: true },
      );
      return;
    }
    await this.prisma.runEvent.upsert({
      where: { runId_seq: { runId: event.runId, seq: event.seq } },
      create: {
        runId: event.runId,
        seq: event.seq,
        type: event.type,
        node: event.node || null,
        timestamp: new Date(event.timestamp),
        payload: event.payload as Prisma.InputJsonValue,
        usage: event.usage ? (event.usage as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      update: {},
    });
  }

  async list(runId: string): Promise<RunEventDto[]> {
    if (this.collection) {
      const docs = await this.collection.find({ runId }).sort({ seq: 1 }).toArray();
      return docs.map(({ _id: _ignored, ...rest }) => rest);
    }
    const rows = await this.prisma.runEvent.findMany({ where: { runId }, orderBy: { seq: 'asc' } });
    return rows.map((r) => ({
      runId: r.runId,
      agent: '',
      type: r.type as RunEventDto['type'],
      node: r.node ?? '',
      seq: r.seq,
      timestamp: r.timestamp.toISOString(),
      payload: (r.payload as Record<string, unknown>) ?? {},
      usage: (r.usage as RunEventDto['usage']) ?? null,
      metadata: {},
    }));
  }

  async onModuleDestroy(): Promise<void> {
    await this.mongo?.close();
  }
}
