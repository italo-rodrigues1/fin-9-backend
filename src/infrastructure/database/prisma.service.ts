import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/client/client';

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

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly connectionTarget: string;

  constructor() {
    const connectionString = getDatabaseUrl();
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });

    this.connectionTarget = describeDatabaseTarget(connectionString);
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log(
        `Connected to ${this.connectionTarget} using @prisma/adapter-pg`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to connect to ${this.connectionTarget} using @prisma/adapter-pg`,
      );

      if (message.includes('ENETUNREACH')) {
        this.logger.error(
          'Network unreachable while opening the PostgreSQL socket. If this only happens on Render, verify whether DATABASE_URL resolves to an IPv6 address there and prefer an IPv4-compatible or pooler connection string.',
        );
        this.logger.error(
          'For Supabase, try the Supavisor pooler URL with sslmode=require.',
        );
      }

      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
