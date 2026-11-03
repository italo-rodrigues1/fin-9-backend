// Run the full persistence regression suite in a disposable local database.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function main() {
  const target = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
    throw new Error(
      'Security validation only permits a local PostgreSQL server.',
    );
  }
  const database = `fin9_security_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString: target.href });
  await admin.connect();
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    target.pathname = `/${database}`;
    const fixture = new Client({ connectionString: target.href });
    await fixture.connect();
    try {
      const migrations = path.resolve(__dirname, '../prisma/migrations');
      for (const directory of readdirSync(migrations, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))) {
        await fixture.query(
          readFileSync(
            path.join(migrations, directory.name, 'migration.sql'),
            'utf8',
          ),
        );
      }
    } finally {
      await fixture.end();
    }
    for (const args of [
      [
        '--test',
        '--test-concurrency=1',
        'test/security.integration.cjs',
        'test/p1.integration.cjs',
        'test/p2.integration.cjs',
        'test/p3.integration.cjs',
        'test/account-removal.integration.cjs',
        'test/google-auth.integration.cjs',
      ],
      [
        '--experimental-vm-modules',
        'node_modules/jest/bin/jest.js',
        '--config',
        './test/jest-e2e.json',
        '--runInBand',
      ],
    ]) {
      const code = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, {
          cwd: path.resolve(__dirname, '..'),
          stdio: 'inherit',
          windowsHide: true,
          env: {
            ...process.env,
            DATABASE_URL: target.href,
            DIRECT_URL: target.href,
          },
        });
        child.once('error', reject);
        child.once('exit', (exitCode) => resolve(exitCode ?? 1));
      });
      if (code !== 0) {
        process.exitCode = code;
        break;
      }
    }
  } finally {
    try {
      // The name is generated above, and CREATE DATABASE succeeded in this run.
      if (created)
        await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
