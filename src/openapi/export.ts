/**
 * `npm run openapi`: writes openapi.json at the repo root, the file Admin, Web, Xưởng and App
 * generate their API types from (`yarn api:types` there). Runs on the built code, where the
 * Swagger CLI plugin has added the DTOs' fields; no database or network is touched.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { buildOpenApi } from './openapi';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  const prefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(prefix);
  const document = buildOpenApi(app, prefix);
  const file = join(__dirname, '..', '..', 'openapi.json');
  writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
  console.log(
    `openapi.json: ${Object.keys(document.paths).length} đường dẫn, ${Object.keys(document.components?.schemas ?? {}).length} kiểu dữ liệu.`,
  );
  await app.close();
}

void main();
