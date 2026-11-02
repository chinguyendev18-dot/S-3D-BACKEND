import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { AppException } from '../common/app-exception';

/** A link to upload one file: valid for this long, for exactly the announced type and size. */
const UPLOAD_LINK_SECONDS = 10 * 60;

export interface SignedLink {
  expiresAt: string;
  url: string;
}

/**
 * Files on Cloudflare R2 (S3 API). The apps never hold R2 keys: they upload and download with
 * links signed here. Objects under `public/` go to R2_PUBLIC_BUCKET, the bucket opened to the
 * internet (R2_PUBLIC_URL); everything else stays in R2_BUCKET, which is never made public: R2
 * opens a whole bucket at once, so private files must not share one with public images. Without
 * R2_PUBLIC_BUCKET both live in R2_BUCKET, and public files are read through GET /files/... here.
 */
@Injectable()
export class StorageService {
  readonly bucket: string;
  readonly publicBucket: string;
  private readonly client: S3Client | null;
  private readonly publicBase: string;
  private readonly downloadSeconds: number;

  constructor(config: ConfigService) {
    const account = config.get<string>('R2_ACCOUNT_ID', '');
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID', '');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY', '');
    this.bucket = config.get<string>('R2_BUCKET', 's3d-files');
    this.publicBucket =
      config.get<string>('R2_PUBLIC_BUCKET', '') || this.bucket;
    this.downloadSeconds = Number(config.get('R2_SIGNED_URL_TTL', 900)) || 900;

    const prefix = config.get<string>('API_PREFIX', 'api/v1');
    const apiUrl = config
      .get<string>(
        'PUBLIC_API_URL',
        `http://localhost:${config.get<string>('PORT', '4000')}/${prefix}`,
      )
      .replace(/\/$/, '');
    this.publicBase = (
      config.get<string>('R2_PUBLIC_URL', '') || `${apiUrl}/files`
    ).replace(/\/$/, '');

    this.client =
      account && accessKeyId && secretAccessKey
        ? new S3Client({
            credentials: { accessKeyId, secretAccessKey },
            endpoint: `https://${account}.r2.cloudflarestorage.com`,
            region: 'auto',
          })
        : null;
  }

  /** Where a public object can be read by anyone. */
  publicUrl(key: string) {
    return `${this.publicBase}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  /**
   * What to keep in the database for a picture or file a screen sends back: the R2 key when it is
   * one of our public files (so a new public domain later changes every link at once), otherwise
   * the value as given (an outside URL, or a path of the apps' own pictures).
   */
  toStored(value: string) {
    const trimmed = value.trim();
    const prefix = `${this.publicBase}/`;
    if (!trimmed.startsWith(prefix)) return trimmed;
    return trimmed
      .slice(prefix.length)
      .split('/')
      .map((part) => decodeURIComponent(part))
      .join('/');
  }

  /** The link to show for a stored value: R2 keys become public URLs, the rest stays. */
  mediaUrl(stored: string) {
    return stored.startsWith('public/') ? this.publicUrl(stored) : stored;
  }

  /** The browser / app PUTs the file to this link, with this Content-Type and size only. */
  async signUpload(
    key: string,
    contentType: string,
    size: number,
  ): Promise<SignedLink> {
    const command = new PutObjectCommand({
      Bucket: this.bucketFor(key),
      ContentLength: size,
      ContentType: contentType,
      Key: key,
    });
    const url = await getSignedUrl(this.s3(), command, {
      expiresIn: UPLOAD_LINK_SECONDS,
      // Signed, not just announced: another type or size is refused by R2.
      signableHeaders: new Set(['content-length', 'content-type']),
    });
    return { expiresAt: this.expiry(UPLOAD_LINK_SECONDS), url };
  }

  /** A link to read one object for a short while (private files, or public ones without a domain). */
  async signDownload(key: string, fileName?: string): Promise<SignedLink> {
    const command = new GetObjectCommand({
      Bucket: this.bucketFor(key),
      Key: key,
      ...(fileName
        ? {
            ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          }
        : {}),
    });
    const url = await getSignedUrl(this.s3(), command, {
      expiresIn: this.downloadSeconds,
    });
    return { expiresAt: this.expiry(this.downloadSeconds), url };
  }

  /** Size and type of an object, or null when it is not there (not uploaded yet, or removed). */
  async describe(key: string) {
    try {
      const head = await this.s3().send(
        new HeadObjectCommand({ Bucket: this.bucketFor(key), Key: key }),
      );
      return {
        contentType: head.ContentType ?? '',
        size: head.ContentLength ?? 0,
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') return null;
      throw error;
    }
  }

  async remove(key: string) {
    await this.s3().send(
      new DeleteObjectCommand({ Bucket: this.bucketFor(key), Key: key }),
    );
  }

  /** The bucket a key lives in: public/… in the public bucket, the rest in the private one. */
  bucketFor(key: string) {
    return key.startsWith('public/') ? this.publicBucket : this.bucket;
  }

  /** How long a download link from signDownload stays valid. */
  get downloadTtlSeconds() {
    return this.downloadSeconds;
  }

  private s3() {
    if (!this.client) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'STORAGE.NOT_CONFIGURED',
        'Chưa cấu hình nơi lưu file (R2). Vui lòng báo quản trị viên.',
      );
    }
    return this.client;
  }

  private expiry(seconds: number) {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }
}
