import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { AuthUser } from '../access/auth-user';
import { canUseApp } from '../access/permissions';
import { badRequest, forbidden, notFound } from '../common/app-exception';
import { RateLimiter } from '../common/rate-limiter';
import { StorageService } from '../storage/storage.service';
import type {
  CreateUploadDto,
  DownloadLinkDto,
  UploadTicketDto,
} from './dto/upload.dto';
import {
  UPLOAD_PURPOSES,
  type UploadPurpose,
  type UploadPurposeKey,
} from './upload-purposes';

const MINUTE = 60_000;
/** Upload links per person: plenty for a product gallery, not for filling the bucket. */
const UPLOAD_LIMIT = [60, 15 * MINUTE] as const;

const MB = 1024 * 1024;

const extensionOf = (fileName: string) =>
  /\.([a-z0-9]+)$/i.exec(fileName.trim())?.[1]?.toLowerCase() ?? '';

/** "image/PNG; charset=…" → "image/png" */
const baseType = (contentType: string) =>
  contentType.split(';')[0].trim().toLowerCase();

/**
 * Where a file goes:
 * - public/<purpose>/<yyyy>/<mm>/<uuid>.<ext>: product photos, avatars… readable by anyone;
 * - private/<purpose>/<userId>/<uuid>.<ext>: models, artwork, return photos… readable by their
 *   owner and by staff, through short-lived links.
 */
export function parseKey(key: string) {
  const [visibility, purpose, owner] = key.split('/');
  const known = purpose in UPLOAD_PURPOSES;
  if (!known || (visibility !== 'public' && visibility !== 'private'))
    return null;
  return {
    owner: visibility === 'private' ? owner : null,
    purpose: purpose as UploadPurposeKey,
    visibility,
  } as const;
}

const isStaff = (user: AuthUser) =>
  canUseApp(user.permissions, 'admin') ||
  canUseApp(user.permissions, 'workshop');

@Injectable()
export class UploadsService {
  constructor(
    private readonly storage: StorageService,
    private readonly limiter: RateLimiter,
  ) {}

  /** A signed link to upload one file, after checking who sends what. */
  async createUpload(
    user: AuthUser,
    dto: CreateUploadDto,
  ): Promise<UploadTicketDto> {
    const purpose: UploadPurpose = UPLOAD_PURPOSES[dto.purpose];
    if (
      purpose.allowed !== 'anyone' &&
      !purpose.allowed.some((key) => user.permissions.includes(key))
    ) {
      throw forbidden(
        `Bạn không có quyền tải lên ${purpose.label.toLowerCase()}.`,
      );
    }

    const extension = extensionOf(dto.fileName);
    const contentType = baseType(dto.contentType);
    const accepted = purpose.types[extension];
    if (!accepted?.includes(contentType)) {
      throw badRequest(
        'UPLOAD.TYPE_NOT_ALLOWED',
        `${purpose.label} chỉ nhận file ${Object.keys(purpose.types).join(', ')}.`,
      );
    }
    if (dto.size > purpose.maxBytes) {
      throw badRequest(
        'UPLOAD.TOO_LARGE',
        `${purpose.label} tối đa ${Math.round(purpose.maxBytes / MB)} MB.`,
      );
    }
    this.limiter.consume(`upload:${user.id}`, ...UPLOAD_LIMIT);

    const now = new Date();
    const folder =
      purpose.visibility === 'public'
        ? `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
        : user.id;
    const key = `${purpose.visibility}/${dto.purpose}/${folder}/${randomUUID()}.${extension}`;
    const link = await this.storage.signUpload(key, contentType, dto.size);

    return {
      expiresAt: link.expiresAt,
      headers: { 'Content-Type': contentType },
      key,
      method: 'PUT',
      publicUrl:
        purpose.visibility === 'public' ? this.storage.publicUrl(key) : null,
      uploadUrl: link.url,
      visibility: purpose.visibility,
    };
  }

  /** A link to open a file: public ones as they are, private ones for their owner and staff. */
  async downloadLink(user: AuthUser, key: string): Promise<DownloadLinkDto> {
    const parsed = parseKey(key);
    if (!parsed) throw notFound('UPLOAD.NOT_FOUND', 'Không tìm thấy file.');
    if (parsed.visibility === 'public')
      return { expiresAt: null, url: this.storage.publicUrl(key) };

    if (parsed.owner !== user.id && !isStaff(user)) {
      throw forbidden('Bạn không có quyền xem file này.');
    }
    return this.storage.signDownload(key);
  }

  /** GET /files/…: where a public file is read while R2 has no public domain. */
  async publicLink(key: string) {
    const parsed = parseKey(key);
    if (parsed?.visibility !== 'public')
      throw notFound('UPLOAD.NOT_FOUND', 'Không tìm thấy file.');
    return (await this.storage.signDownload(key)).url;
  }

  /**
   * For the modules that save a key (a product's photo, a return's pictures): the file is of that
   * purpose, belongs to this person (private files) and was really uploaded.
   */
  async assertUploaded(user: AuthUser, key: string, purpose: UploadPurposeKey) {
    const parsed = parseKey(key);
    if (
      !parsed ||
      parsed.purpose !== purpose ||
      (parsed.owner !== null && parsed.owner !== user.id && !isStaff(user))
    ) {
      throw badRequest('UPLOAD.INVALID_KEY', 'File đính kèm không hợp lệ.');
    }
    const object = await this.storage.describe(key);
    if (!object) {
      throw badRequest(
        'UPLOAD.MISSING',
        'File chưa tải lên xong. Vui lòng tải lại.',
      );
    }
    return object;
  }
}
