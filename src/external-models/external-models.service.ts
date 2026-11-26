import { Injectable, Logger } from '@nestjs/common';

import type { AuthUser } from '../access/auth-user';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, notFound } from '../common/app-exception';
import { pageArgs, toPage } from '../common/pagination';
import type { RequestMeta } from '../common/request-meta';
import type {
  ExternalModel,
  ExternalModelCheck,
  ExternalModelFile,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MODEL_FOLDER_ROOT, UploadsService } from '../uploads/uploads.service';
import type { DownloadLinkDto } from '../uploads/dto/upload.dto';
import type {
  AddExternalModelFileDto,
  CreateExternalModelDto,
  ExternalModelDetailDto,
  ExternalModelFileDto,
  ExternalModelMediaDto,
  ExternalModelProfileDto,
  ExternalModelQueryDto,
  ExternalModelSummaryDto,
  ExternalModelViewDto,
  LicenseCatalogDto,
  LicenseCheckInputDto,
  LicenseCheckViewDto,
  ModelLookupDto,
  UpdateExternalModelDto,
} from './dto/external-model.dto';
import {
  ACKNOWLEDGEMENTS,
  LICENSES,
  RECHECK_AFTER_DAYS,
  evaluateCheck,
  findLicense,
  sellableState,
  todayInVietnam,
} from './licenses';
import { parseModelUrl } from './model-url';

const SORTABLE = ['checkedAt', 'createdAt', 'title'] as const;

type Row = ExternalModel & {
  checks: Pick<ExternalModelCheck, 'checkedByName'>[];
};

/** What a model keeps in its folder, by kind (see parseKey in uploads.service.ts). */
type FolderKind = 'evidence' | 'files' | 'images';

/**
 * A model's R2 folder: "makerworld-3637922-christmas-sweater-collection". The site and its id
 * make it unique, the name makes it readable in the R2 dashboard.
 */
export function modelFolder(source: string, externalId: string, title: string) {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 50)
    .replace(/^-+|-+$/g, '');
  return [source, externalId, slug].filter(Boolean).join('-');
}

const extensionOf = (key: string) =>
  /.([a-z0-9]+)$/i.exec(key)?.[1]?.toLowerCase() ?? '';

/** The check fields both tables share, once evaluated. */
interface CheckData {
  acknowledgements: string[];
  basis: ExternalModel['basis'];
  evidenceKey: string;
  licenseCode: string;
  membershipUntil: Date | null;
  note: string;
  verdict: ExternalModel['verdict'];
}

const dateOnly = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10) : null;

const labelOf = (code: string) => findLicense(code)?.label ?? code;

/** The profiles column as saved by media(); anything else in it is skipped. */
function profilesOf(value: Prisma.JsonValue): ExternalModelProfileDto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const profile = item as Record<string, unknown>;
    return [
      {
        grams: Number(profile.grams) || 0,
        minutes: Number(profile.minutes) || 0,
        name: typeof profile.name === 'string' ? profile.name : '',
        plates: Number(profile.plates) || 0,
        printers: Array.isArray(profile.printers)
          ? profile.printers.filter((p): p is string => typeof p === 'string')
          : [],
      },
    ];
  });
}

@Injectable()
export class ExternalModelsService {
  private readonly logger = new Logger(ExternalModelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  /** The licences and boxes the admin's form shows: the rules live here, not in the app. */
  catalog(): LicenseCatalogDto {
    return {
      acknowledgements: Object.entries(ACKNOWLEDGEMENTS).map(
        ([key, label]) => ({
          key,
          label,
        }),
      ),
      licenses: LICENSES.map((item) => ({
        code: item.code,
        label: item.label,
        note: item.note,
        requires: [...item.requires],
        sources: [...item.sources],
        verdict: item.verdict,
      })),
      recheckAfterDays: RECHECK_AFTER_DAYS,
    };
  }

  async lookup(url: string): Promise<ModelLookupDto> {
    const parsed = this.parse(url);
    const existing = await this.prisma.externalModel.findUnique({
      select: { id: true },
      where: {
        source_externalId: {
          externalId: parsed.externalId,
          source: parsed.source,
        },
      },
    });
    return { ...parsed, existingId: existing?.id ?? null };
  }

  async list(query: ExternalModelQueryDto) {
    const args = pageArgs(query, SORTABLE, '-checkedAt');
    const where = this.where(query, args.search);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.externalModel.findMany({
        include: { ...this.latestChecker, _count: { select: { files: true } } },
        orderBy: args.orderBy,
        skip: args.skip,
        take: args.take,
        where,
      }),
      this.prisma.externalModel.count({ where }),
    ]);
    return toPage(
      rows.map((row) => this.view(row, row._count.files)),
      total,
      args,
    );
  }

  /** How many models each filter tile holds, for the same site and search as the list. */
  async summary(
    query: ExternalModelQueryDto,
  ): Promise<ExternalModelSummaryDto> {
    const search = query.q?.trim() || undefined;
    const count = (state?: ExternalModelQueryDto['state']) =>
      this.prisma.externalModel.count({
        where: this.where({ ...query, state }, search),
      });
    const [total, sellable, blocked, recheck] = await Promise.all([
      count(undefined),
      count('sellable'),
      count('blocked'),
      count('recheck'),
    ]);
    return { blocked, recheck, sellable, total };
  }

  async get(id: string): Promise<ExternalModelDetailDto> {
    const row = await this.prisma.externalModel.findUnique({
      include: {
        checks: { orderBy: { checkedAt: 'desc' } },
        files: { orderBy: { createdAt: 'desc' } },
      },
      where: { id },
    });
    if (!row) throw this.notFound();
    return {
      ...this.view(row, row.files.length),
      checks: row.checks.map((check) => this.checkView(check)),
      files: row.files.map((file) => this.fileView(file)),
    };
  }

  async create(user: AuthUser, dto: CreateExternalModelDto, meta: RequestMeta) {
    const parsed = this.parse(dto.url);
    const existing = await this.prisma.externalModel.findUnique({
      where: {
        source_externalId: {
          externalId: parsed.externalId,
          source: parsed.source,
        },
      },
    });
    if (existing) {
      throw conflict(
        'EXTERNAL_MODEL.EXISTS',
        `Mẫu này đã có trong danh sách (“${existing.title}”): mở mẫu và bấm Kiểm tra lại.`,
      );
    }
    const creatorName = dto.creatorName?.trim() ?? '';
    const folder = modelFolder(parsed.source, parsed.externalId, dto.title);
    const check = await this.evaluate(user, dto.check, creatorName);
    const media = await this.media(user, dto, [], folder);
    check.evidenceKey = await this.place(folder, 'evidence', check.evidenceKey);
    const now = new Date();

    const row = await this.prisma.externalModel.create({
      data: {
        ...media,
        ...this.latestFields(check, now),
        checks: { create: { ...check, ...this.checker(user), checkedAt: now } },
        creatorName,
        creatorUrl: dto.creatorUrl?.trim() ?? '',
        externalId: parsed.externalId,
        folder,
        source: parsed.source,
        title: dto.title.trim(),
        url: parsed.url,
      },
    });
    await this.record(
      user,
      meta,
      'external_model.created',
      row,
      `Thêm mẫu ngoài “${row.title}” – ${labelOf(check.licenseCode)}: ${this.verdictText(check.verdict)}`,
    );
    return this.get(row.id);
  }

  /** A new look at the licence. Earlier checks stay as they were: they are the history. */
  async addCheck(
    user: AuthUser,
    id: string,
    dto: LicenseCheckInputDto,
    meta: RequestMeta,
  ) {
    const current = await this.prisma.externalModel.findUnique({
      where: { id },
    });
    if (!current) throw this.notFound();
    const check = await this.evaluate(user, dto, current.creatorName);
    check.evidenceKey = await this.place(
      this.folderOf(current),
      'evidence',
      check.evidenceKey,
    );
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.externalModelCheck.create({
        data: { ...check, ...this.checker(user), checkedAt: now, modelId: id },
      }),
      this.prisma.externalModel.update({
        data: {
          ...this.latestFields(check, now),
          folder: this.folderOf(current),
        },
        where: { id },
      }),
    ]);

    const changed = current.licenseCode !== check.licenseCode;
    await this.record(
      user,
      meta,
      'external_model.checked',
      current,
      changed
        ? `Giấy phép “${current.title}” đổi từ ${labelOf(current.licenseCode)} sang ${labelOf(check.licenseCode)}: ${this.verdictText(check.verdict)}`
        : `Kiểm tra lại giấy phép “${current.title}”: ${this.verdictText(check.verdict)}`,
      changed
        ? [
            {
              from: labelOf(current.licenseCode),
              label: 'Giấy phép',
              to: labelOf(check.licenseCode),
            },
          ]
        : undefined,
    );
    return this.get(id);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateExternalModelDto,
    meta: RequestMeta,
  ) {
    const current = await this.prisma.externalModel.findUnique({
      where: { id },
    });
    if (!current) throw this.notFound();
    const creatorName = dto.creatorName ?? current.creatorName;
    const needsCredit =
      current.verdict !== 'blocked' &&
      current.basis === 'license' &&
      findLicense(current.licenseCode)?.requires.includes('attribution');
    if (needsCredit && !creatorName.trim()) {
      throw badRequest(
        'EXTERNAL_MODEL.CREATOR_REQUIRED',
        'Giấy phép của mẫu cần ghi tên tác giả: không để trống tên tác giả.',
      );
    }
    const folder = this.folderOf(current);
    const media = await this.media(user, dto, current.images, folder);
    const row = await this.prisma.externalModel.update({
      data: {
        ...media,
        folder,
        creatorName: dto.creatorName,
        creatorUrl: dto.creatorUrl,
        title: dto.title,
      },
      where: { id },
    });
    await this.record(
      user,
      meta,
      'external_model.updated',
      row,
      `Sửa thông tin mẫu ngoài “${row.title}”`,
    );
    if (media.images) {
      const kept = new Set(media.images);
      await Promise.all(
        current.images
          .filter((key) => !kept.has(key) && key.startsWith('public/'))
          .map((key) => this.removeStored(key)),
      );
    }
    return this.get(id);
  }

  /**
   * Removes the model with its checks and print files, then their photos, screenshots and files
   * from storage. The audit log keeps who removed it and when.
   */
  async remove(user: AuthUser, id: string, meta: RequestMeta) {
    const row = await this.prisma.externalModel.findUnique({
      include: {
        checks: { select: { evidenceKey: true } },
        files: { select: { key: true } },
      },
      where: { id },
    });
    if (!row) throw this.notFound();
    await this.prisma.externalModel.delete({ where: { id } });
    const keys = [
      ...row.images.filter((key) => key.startsWith('public/')),
      ...row.files.map((file) => file.key),
      ...row.checks.map((check) => check.evidenceKey).filter(Boolean),
    ];
    await Promise.all(keys.map((key) => this.removeStored(key)));
    await this.record(
      user,
      meta,
      'external_model.deleted',
      row,
      `Xoá mẫu ngoài “${row.title}” (${row.files.length} tệp in, ${row.checks.length} lần kiểm tra)`,
    );
    return null;
  }

  /** Attaches a print file the person uploaded (POST /uploads, purpose external-model-file). */
  async addFile(
    user: AuthUser,
    id: string,
    dto: AddExternalModelFileDto,
    meta: RequestMeta,
  ) {
    const model = await this.prisma.externalModel.findUnique({ where: { id } });
    if (!model) throw this.notFound();
    const object = await this.uploads.assertUploaded(
      user,
      dto.key,
      'external-model-file',
    );
    const taken = await this.prisma.externalModelFile.findUnique({
      select: { id: true },
      where: { key: dto.key },
    });
    if (taken) {
      throw conflict(
        'EXTERNAL_MODEL.FILE_EXISTS',
        'Tệp này đã được gắn vào một mẫu.',
      );
    }
    const folder = this.folderOf(model);
    const key = await this.place(folder, 'files', dto.key);
    if (!model.folder) {
      await this.prisma.externalModel.update({
        data: { folder },
        where: { id },
      });
    }
    const file = await this.prisma.externalModelFile.create({
      data: {
        fileName: dto.fileName,
        format: extensionOf(key),
        key,
        modelId: id,
        note: dto.note ?? '',
        profileName: dto.profileName ?? '',
        sizeBytes: object.size,
        uploadedById: user.id,
        uploadedByName: user.name || user.email,
      },
    });
    await this.record(
      user,
      meta,
      'external_model.file_added',
      model,
      `Thêm tệp in “${file.fileName}” cho mẫu “${model.title}”`,
    );
    return this.get(id);
  }

  /** Removes a print file from the model, then from storage. */
  async removeFile(
    user: AuthUser,
    id: string,
    fileId: string,
    meta: RequestMeta,
  ) {
    const file = await this.findFile(id, fileId);
    await this.prisma.externalModelFile.delete({ where: { id: file.id } });
    await this.removeStored(file.key);
    await this.record(
      user,
      meta,
      'external_model.file_removed',
      file.model,
      `Xoá tệp in “${file.fileName}” của mẫu “${file.model.title}”`,
    );
    return this.get(id);
  }

  /** A short-lived link that downloads the file under the name it was uploaded with. */
  async fileLink(id: string, fileId: string): Promise<DownloadLinkDto> {
    const file = await this.findFile(id, fileId);
    return this.storage.signDownload(file.key, file.fileName);
  }

  private folderOf(model: ExternalModel) {
    return (
      model.folder || modelFolder(model.source, model.externalId, model.title)
    );
  }

  /**
   * Moves an uploaded file into the model's folder (same bucket: photos stay public, print files
   * and screenshots private) and gives its new key; a key already there, or "", stays as it is.
   */
  private async place(folder: string, kind: FolderKind, key: string) {
    if (!key) return key;
    const [visibility] = key.split('/');
    const home = `${visibility}/${MODEL_FOLDER_ROOT}/${folder}/${kind}/`;
    if (key.startsWith(home)) return key;
    const target = home + key.split('/').pop();
    await this.storage.move(key, target);
    return target;
  }

  /**
   * Files saved before models had folders, moved into them (npm run external-models:folders).
   * Each move is saved at once, so a run stopped halfway can simply be run again. A licence
   * screenshot only changes place: the picture itself, the proof, stays as it was.
   */
  async moveIntoFolders() {
    const rows = await this.prisma.externalModel.findMany({
      include: { checks: true, files: true },
    });
    let moved = 0;
    for (const row of rows) {
      const folder = this.folderOf(row);
      const images = [...row.images];
      for (const [index, key] of row.images.entries()) {
        if (!key.startsWith('public/')) continue;
        const next = await this.place(folder, 'images', key);
        if (next === key) continue;
        images[index] = next;
        moved += 1;
        await this.prisma.externalModel.update({
          data: { images },
          where: { id: row.id },
        });
      }
      if (!row.folder) {
        await this.prisma.externalModel.update({
          data: { folder },
          where: { id: row.id },
        });
      }
      for (const check of row.checks) {
        const next = await this.place(folder, 'evidence', check.evidenceKey);
        if (next === check.evidenceKey) continue;
        moved += 1;
        await this.prisma.externalModelCheck.update({
          data: { evidenceKey: next },
          where: { id: check.id },
        });
      }
      for (const file of row.files) {
        const next = await this.place(folder, 'files', file.key);
        if (next === file.key) continue;
        moved += 1;
        await this.prisma.externalModelFile.update({
          data: { key: next },
          where: { id: file.id },
        });
      }
    }
    return { models: rows.length, moved };
  }

  /** The row is what the app reads; a file left in R2 only costs storage, so a failure is logged. */
  private removeStored(key: string) {
    return this.storage.remove(key).catch((error: unknown) => {
      this.logger.warn(`Could not delete ${key}: ${String(error)}`);
    });
  }

  private async findFile(id: string, fileId: string) {
    const file = await this.prisma.externalModelFile.findFirst({
      include: { model: { select: { id: true, title: true } } },
      where: { id: fileId, modelId: id },
    });
    if (!file) {
      throw notFound('EXTERNAL_MODEL.FILE_NOT_FOUND', 'Không tìm thấy tệp in.');
    }
    return file;
  }

  /**
   * The text, photos and print profiles a form sent, ready to save; fields left out stay as they
   * are. A new photo must really be an uploaded model photo; the ones already saved are kept.
   */
  private async media(
    user: AuthUser,
    dto: ExternalModelMediaDto,
    saved: string[],
    folder: string,
  ) {
    const data: {
      description?: string;
      images?: string[];
      profiles?: Prisma.InputJsonValue;
    } = {};
    if (dto.description !== undefined)
      data.description = dto.description.trim();
    if (dto.images !== undefined) {
      const images = [...new Set(dto.images.map((key) => key.trim()))];
      for (const key of images) {
        if (!saved.includes(key)) {
          await this.uploads.assertUploaded(user, key, 'external-model-image');
        }
      }
      const placed: string[] = [];
      for (const key of images) {
        placed.push(
          saved.includes(key) ? key : await this.place(folder, 'images', key),
        );
      }
      data.images = placed;
    }
    if (dto.profiles !== undefined) {
      data.profiles = dto.profiles.map((profile) => ({
        grams: Math.round(profile.grams * 10) / 10,
        minutes: profile.minutes,
        name: profile.name.trim(),
        plates: profile.plates,
        printers: profile.printers.map((printer) => printer.trim()),
      }));
    }
    return data;
  }

  private parse(url: string) {
    const parsed = parseModelUrl(url);
    if (!parsed) {
      throw badRequest(
        'EXTERNAL_MODEL.URL_UNSUPPORTED',
        'Chỉ nhận link trang mẫu của MakerWorld, Printables hoặc Thingiverse (ví dụ makerworld.com/en/models/123456).',
      );
    }
    return parsed;
  }

  /** The rules of licenses.ts, then the screenshot really uploaded as licence evidence. */
  private async evaluate(
    user: AuthUser,
    dto: LicenseCheckInputDto,
    creatorName: string,
  ): Promise<CheckData> {
    const evidenceKey = dto.evidenceKey?.trim() ?? '';
    const membershipUntil =
      dto.basis === 'membership' ? dto.membershipUntil || null : null;
    const outcome = evaluateCheck(
      {
        acknowledgements: dto.acknowledgements,
        basis: dto.basis,
        creatorName,
        evidenceKey,
        licenseCode: dto.licenseCode,
        membershipUntil,
        note: dto.note,
      },
      todayInVietnam(),
    );
    if (!outcome.ok) {
      throw badRequest('EXTERNAL_MODEL.CHECK_INVALID', outcome.message);
    }
    if (evidenceKey) {
      await this.uploads.assertUploaded(user, evidenceKey, 'license-evidence');
    }
    return {
      // Only the boxes this check asked for: a stray tick proves nothing.
      acknowledgements: outcome.result.required,
      basis: dto.basis,
      evidenceKey,
      licenseCode: dto.licenseCode,
      membershipUntil: membershipUntil
        ? new Date(`${membershipUntil}T00:00:00Z`)
        : null,
      note: dto.note?.trim() ?? '',
      verdict: outcome.result.verdict,
    };
  }

  private latestFields(check: CheckData, checkedAt: Date) {
    return {
      basis: check.basis,
      checkedAt,
      licenseCode: check.licenseCode,
      membershipUntil: check.membershipUntil,
      verdict: check.verdict,
    };
  }

  private checker(user: AuthUser) {
    return { checkedById: user.id, checkedByName: user.name || user.email };
  }

  private readonly latestChecker = {
    checks: {
      orderBy: { checkedAt: 'desc' as const },
      select: { checkedByName: true },
      take: 1,
    },
  };

  /** Search, site and state; "sellable" mirrors sellableState() so the counts agree with it. */
  private where(
    query: ExternalModelQueryDto,
    search?: string,
  ): Prisma.ExternalModelWhereInput {
    const today = new Date(`${todayInVietnam()}T00:00:00Z`);
    const membershipOk: Prisma.ExternalModelWhereInput = {
      OR: [
        { basis: { not: 'membership' } },
        { membershipUntil: { gte: today } },
      ],
    };
    const membershipOver: Prisma.ExternalModelWhereInput = {
      basis: 'membership',
      OR: [{ membershipUntil: null }, { membershipUntil: { lt: today } }],
    };
    const stale = new Date(Date.now() - RECHECK_AFTER_DAYS * 86_400_000);

    const and: Prisma.ExternalModelWhereInput[] = [];
    if (query.source) and.push({ source: query.source });
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { creatorName: { contains: search, mode: 'insensitive' } },
          { externalId: search },
        ],
      });
    }
    if (query.state === 'sellable') {
      and.push({ verdict: { not: 'blocked' } }, membershipOk);
    } else if (query.state === 'blocked') {
      and.push({ OR: [{ verdict: 'blocked' }, membershipOver] });
    } else if (query.state === 'recheck') {
      and.push({
        OR: [{ checkedAt: { lt: stale } }, membershipOver],
        verdict: { not: 'blocked' },
      });
    }
    return and.length ? { AND: and } : {};
  }

  private view(
    row: Row | (ExternalModel & { checks: ExternalModelCheck[] }),
    fileCount: number,
  ) {
    const membershipUntil = dateOnly(row.membershipUntil);
    const state = sellableState({
      basis: row.basis,
      checkedAt: row.checkedAt,
      membershipUntil,
      verdict: row.verdict,
    });
    const license = findLicense(row.licenseCode);
    const view: ExternalModelViewDto = {
      basis: row.basis,
      checkedAt: row.checkedAt.toISOString(),
      checkedByName: row.checks[0]?.checkedByName ?? '',
      createdAt: row.createdAt.toISOString(),
      creatorName: row.creatorName,
      creatorUrl: row.creatorUrl,
      description: row.description,
      externalId: row.externalId,
      fileCount,
      images: row.images.map((key) => ({
        key,
        url: this.storage.mediaUrl(key),
      })),
      id: row.id,
      licenseCode: row.licenseCode,
      licenseLabel: labelOf(row.licenseCode),
      membershipUntil,
      profiles: profilesOf(row.profiles),
      recheckDue: state.recheckDue,
      // A membership or a permission covers the model as it is; the licence's own terms apply otherwise.
      requires:
        row.basis === 'license' && row.verdict !== 'blocked'
          ? [...(license?.requires ?? [])]
          : [],
      sellable: state.sellable,
      source: row.source,
      stateReason: state.reason,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      url: row.url,
      verdict: row.verdict,
    };
    return view;
  }

  private fileView(file: ExternalModelFile): ExternalModelFileDto {
    return {
      createdAt: file.createdAt.toISOString(),
      fileName: file.fileName,
      format: file.format,
      id: file.id,
      note: file.note,
      profileName: file.profileName,
      sizeBytes: file.sizeBytes,
      uploadedByName: file.uploadedByName,
    };
  }

  private checkView(check: ExternalModelCheck): LicenseCheckViewDto {
    return {
      acknowledgements: check.acknowledgements,
      basis: check.basis,
      checkedAt: check.checkedAt.toISOString(),
      checkedByName: check.checkedByName,
      evidenceKey: check.evidenceKey,
      id: check.id,
      licenseCode: check.licenseCode,
      licenseLabel: labelOf(check.licenseCode),
      membershipUntil: dateOnly(check.membershipUntil),
      note: check.note,
      verdict: check.verdict,
    };
  }

  private verdictText(verdict: ExternalModel['verdict']) {
    return verdict === 'allowed'
      ? 'được in bán'
      : verdict === 'limited'
        ? 'được in bán có điều kiện'
        : 'không được in bán';
  }

  private notFound() {
    return notFound('EXTERNAL_MODEL.NOT_FOUND', 'Không tìm thấy mẫu.');
  }

  private record(
    user: AuthUser,
    meta: RequestMeta,
    action: string,
    row: { id: string; title: string },
    summary: string,
    changes?: { from: string; label: string; to: string }[],
  ) {
    return this.audit.record({
      ...meta,
      action,
      actor: user,
      changes,
      summary,
      target: { id: row.id, label: row.title, type: 'external_model' },
    });
  }
}
