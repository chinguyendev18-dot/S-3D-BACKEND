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
import { UploadsService } from '../uploads/uploads.service';
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
    const check = await this.evaluate(user, dto.check, creatorName);
    const media = await this.media(user, dto, []);
    const now = new Date();

    const row = await this.prisma.externalModel.create({
      data: {
        ...media,
        ...this.latestFields(check, now),
        checks: { create: { ...check, ...this.checker(user), checkedAt: now } },
        creatorName,
        creatorUrl: dto.creatorUrl?.trim() ?? '',
        externalId: parsed.externalId,
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
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.externalModelCheck.create({
        data: { ...check, ...this.checker(user), checkedAt: now, modelId: id },
      }),
      this.prisma.externalModel.update({
        data: this.latestFields(check, now),
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
    const media = await this.media(user, dto, current.images);
    const row = await this.prisma.externalModel.update({
      data: {
        ...media,
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
    return this.get(id);
  }

  /** Attaches a print file the person uploaded (POST /uploads, purpose external-model-file). */
  async addFile(
    user: AuthUser,
    id: string,
    dto: AddExternalModelFileDto,
    meta: RequestMeta,
  ) {
    const model = await this.prisma.externalModel.findUnique({
      select: { id: true, title: true },
      where: { id },
    });
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
    const file = await this.prisma.externalModelFile.create({
      data: {
        fileName: dto.fileName,
        format: extensionOf(dto.key),
        key: dto.key,
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
    // The row is what the app reads; a file left in R2 only costs storage, so a failure here is logged.
    await this.storage.remove(file.key).catch((error: unknown) => {
      this.logger.warn(`Could not delete ${file.key}: ${String(error)}`);
    });
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
      data.images = images;
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
