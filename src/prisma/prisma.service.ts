import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client';

/**
 * The database, through Supabase's transaction pooler (DATABASE_URL). It connects on the first
 * query, so the app (and the tests) start without waiting for the database.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL', '');
    // Supabase signs its TLS certificates with its own CA, which Node does not know: keep the
    // connection encrypted without checking the chain, unless DATABASE_SSL=false.
    const ssl =
      config.get<string>('DATABASE_SSL') === 'false'
        ? false
        : { rejectUnauthorized: false };
    super({ adapter: new PrismaPg({ connectionString, ssl }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
