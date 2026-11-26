/**
 * `npm run external-models:folders`
 * Moves the photos, print files and licence screenshots of MakerWorld / Printables models saved
 * before models had R2 folders into external-models/<folder>/… . Safe to run again.
 */
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { ExternalModelsService } from '../src/external-models/external-models.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const result = await app.get(ExternalModelsService).moveIntoFolders();
    console.log(
      `Đã xem ${result.models} mẫu, chuyển ${result.moved} file vào thư mục của mẫu.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
