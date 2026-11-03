import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations need a direct or session connection, not a transaction pooler.
    url: process.env.DIRECT_URL?.trim() || env('DATABASE_URL'),
  },
});
