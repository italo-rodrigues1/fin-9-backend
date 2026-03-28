import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  return databaseUrl;
}

function describeDatabaseTarget(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    const protocol = parsed.protocol.replace(':', '');
    const port = parsed.port || '5432';

    return `${protocol}://${parsed.hostname}:${port}${parsed.pathname}`;
  } catch {
    return '[invalid DATABASE_URL]';
  }
}

function shouldUsePgAdapter(): boolean {
  return process.env.PRISMA_USE_PG_ADAPTER !== 'false';
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly connectionTarget: string;
  private readonly pgAdapterEnabled: boolean;

  constructor() {
    const connectionString = getDatabaseUrl();
    const pgAdapterEnabled = shouldUsePgAdapter();

    if (pgAdapterEnabled) {
      const adapter = new PrismaPg({ connectionString });
      super({ adapter });
    } else {
      super();
    }

    this.connectionTarget = describeDatabaseTarget(connectionString);
    this.pgAdapterEnabled = pgAdapterEnabled;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log(
        `Connected to ${this.connectionTarget} using ${this.pgAdapterEnabled ? '@prisma/adapter-pg' : 'Prisma engine'}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to connect to ${this.connectionTarget} using ${this.pgAdapterEnabled ? '@prisma/adapter-pg' : 'Prisma engine'}`,
      );

      if (message.includes('ENETUNREACH')) {
        this.logger.error(
          'Network unreachable while opening the PostgreSQL socket. If this only happens on Render, verify whether DATABASE_URL resolves to an IPv6 address there and prefer an IPv4-compatible or pooler connection string.',
        );
        this.logger.error(
          'For Supabase, try the Supavisor pooler URL with sslmode=require. You can also set PRISMA_USE_PG_ADAPTER=false to test the default Prisma engine against the same DATABASE_URL.',
        );
      }

      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
