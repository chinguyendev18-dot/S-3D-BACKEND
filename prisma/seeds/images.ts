/**
 * The demo pictures (prisma/seed-data/images) put on R2, in the public bucket, so every app shows
 * the same photos from the same links. Without R2 settings they stay the storefront's own files
 * (/images/Products/web/…), which the website and the admin can show but the phone app cannot.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { SEED_IMAGES_DIR } from '../seed-data';

/** Made on first use: .env is read by seed-tools, which may be imported after this file. */
let r2: { bucket: string; client: S3Client } | null | undefined;

function storage() {
  if (r2 !== undefined) return r2;
  const { R2_ACCESS_KEY_ID, R2_ACCOUNT_ID, R2_SECRET_ACCESS_KEY } = process.env;
  r2 =
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
      ? {
          bucket:
            process.env.R2_PUBLIC_BUCKET ||
            process.env.R2_BUCKET ||
            's3d-files',
          client: new S3Client({
            credentials: {
              accessKeyId: R2_ACCESS_KEY_ID,
              secretAccessKey: R2_SECRET_ACCESS_KEY,
            },
            endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            region: 'auto',
          }),
        }
      : null;
  return r2;
}

const uploaded = new Map<string, string>();

/** The stored value for a product photo: its R2 key once uploaded (once per run and per file). */
export async function productPhoto(file: string | null) {
  if (!file) return '';
  const target = storage();
  if (!target) return `/images/Products/web/${file}`;
  const { bucket, client } = target;

  const known = uploaded.get(file);
  if (known) return known;

  const key = `public/product-image/seed/${file}`;
  const exists = await client
    .send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    .then(
      () => true,
      () => false,
    );
  if (!exists) {
    await client.send(
      new PutObjectCommand({
        Body: readFileSync(join(SEED_IMAGES_DIR, 'products', file)),
        Bucket: bucket,
        // Seed files never change under the same name.
        CacheControl: 'public, max-age=31536000, immutable',
        ContentType: file.endsWith('.png') ? 'image/png' : 'image/webp',
        Key: key,
      }),
    );
  }
  uploaded.set(file, key);
  return key;
}

export const imagesGoToR2 = () => Boolean(storage());
