import { defineConfig } from 'prisma/config';

// The CLI does not read .env by itself. On a server the variables come from the host instead.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    // Migrations need a session connection (port 5432); the app itself uses the pooler.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
