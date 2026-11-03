require('reflect-metadata');
require('dotenv').config({ quiet: true });
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/src/generated/client/client');
const {
  PrismaService,
} = require('../dist/src/infrastructure/database/prisma.service');
const {
  withDatabaseUser,
} = require('../dist/src/infrastructure/database/database-context');

function createIntegrationDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (
    !connectionString ||
    !['localhost', '127.0.0.1', '::1'].includes(
      new URL(connectionString).hostname,
    )
  ) {
    throw new Error(
      'Integration fixtures require an explicitly configured local PostgreSQL database.',
    );
  }
  // Only setup/assertions use the administrative fixture client. Every service
  // and repository receives PrismaService, which enters fin9_runtime and RLS.
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const runtime = new PrismaService();
  return { db, runtime };
}

module.exports = { createIntegrationDatabase, withDatabaseUser };
