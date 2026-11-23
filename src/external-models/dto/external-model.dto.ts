import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PageQueryDto } from '../../common/dto/page-query.dto';
import {
  ACKNOWLEDGEMENTS,
  CHECK_BASES,
  LICENSE_VERDICTS,
  MODEL_SOURCES,
  type CheckBasis,
  type LicenseVerdict,
  type ModelSource,
} from '../licenses';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const ACK_KEYS = Object.keys(ACKNOWLEDGEMENTS);

/** Photos kept per model: enough for a gallery, small enough to copy in one go. */
export const MAX_IMAGES = 12;

/** "Sellable" = may be printed for sale today; "recheck" = the last look is old or a membership ran out. */
export const MODEL_STATES = ['sellable', 'blocked', 'recheck'] as const;

export class ExternalModelQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(MODEL_SOURCES)
  source?: ModelSource;

  @IsOptional()
  @IsIn(MODEL_STATES, { message: 'Trạng thái lọc không hợp lệ.' })
  state?: (typeof MODEL_STATES)[number];
}

export class LookupQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'Dán link mẫu.' })
  @MaxLength(500)
  url: string;
}

/** One look at the licence, as the admin's form sends it. */
export class LicenseCheckInputDto {
  @ApiProperty({ enum: CHECK_BASES })
  @IsIn(CHECK_BASES, { message: 'Chọn cơ sở được phép in bán.' })
  basis: CheckBasis;

  /** A code of GET /external-models/licenses. */
  @IsString()
  @IsNotEmpty({ message: 'Chọn giấy phép của mẫu.' })
  @MaxLength(60)
  licenseCode: string;

  /** The boxes ticked (keys of the licence rules: seen_on_source, attribution…). */
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(ACK_KEYS, { each: true, message: 'Xác nhận không hợp lệ.' })
  acknowledgements: string[];

  /** YYYY-MM-DD, for a creator membership. */
  @IsOptional()
  @Matches(/^$|^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày hết hạn không hợp lệ.' })
  membershipUntil?: string;

  /** Key from POST /uploads (purpose license-evidence). */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  evidenceKey?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: 'Ghi chú tối đa 1000 ký tự.' })
  note?: string;
}

/** One print profile of the model's page (MakerWorld calls them "Tệp in"). */
export class ExternalModelProfileDto {
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name: string;

  /** Print time the site predicts. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  minutes: number;

  /** Filament, all plates together; 0 when the site does not say. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100_000)
  grams: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  plates: number;

  /** Printers it was made for (A1, P1S, X1 Carbon…). */
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  printers: string[];
}

/** What the shop shows of a model: its text, photos and print profiles. */
export class ExternalModelMediaDto {
  /** Plain text; the admin turns the site's HTML into text first. */
  @IsOptional()
  @IsString()
  @MaxLength(20_000, { message: 'Mô tả tối đa 20.000 ký tự.' })
  description?: string;

  /** R2 keys from POST /uploads (purpose external-model-image), the cover first. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IMAGES, { message: `Tối đa ${MAX_IMAGES} ảnh.` })
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExternalModelProfileDto)
  profiles?: ExternalModelProfileDto[];
}

/** Name, creator and media: the licence changes through a new check, which keeps the history. */
export class UpdateExternalModelDto extends ExternalModelMediaDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên mẫu.' })
  @MaxLength(200, { message: 'Tên mẫu tối đa 200 ký tự.' })
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  creatorName?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^$|^https?:\/\/\S+$/i, { message: 'Link tác giả không hợp lệ.' })
  @MaxLength(500)
  creatorUrl?: string;
}

export class CreateExternalModelDto extends ExternalModelMediaDto {
  /** The model's page on MakerWorld, Printables or Thingiverse. */
  @IsString()
  @IsNotEmpty({ message: 'Dán link mẫu.' })
  @MaxLength(500)
  url: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên mẫu.' })
  @MaxLength(200, { message: 'Tên mẫu tối đa 200 ký tự.' })
  title: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  creatorName?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^$|^https?:\/\/\S+$/i, { message: 'Link tác giả không hợp lệ.' })
  @MaxLength(500)
  creatorUrl?: string;

  @ValidateNested()
  @Type(() => LicenseCheckInputDto)
  check: LicenseCheckInputDto;
}

export class LicenseOptionDto {
  code: string;
  label: string;
  @ApiProperty({ enum: LICENSE_VERDICTS })
  verdict: LicenseVerdict;
  @ApiProperty({
    enum: ['attribution', 'no_modification', 'share_alike'],
    isArray: true,
  })
  requires: string[];
  @ApiProperty({ enum: MODEL_SOURCES, isArray: true })
  sources: ModelSource[];
  note: string;
}

export class AcknowledgementOptionDto {
  key: string;
  label: string;
}

export class LicenseCatalogDto {
  licenses: LicenseOptionDto[];
  acknowledgements: AcknowledgementOptionDto[];
  /** Days after which a check should be done again. */
  recheckAfterDays: number;
}

export class ModelLookupDto {
  @ApiProperty({ enum: MODEL_SOURCES })
  source: ModelSource;
  externalId: string;
  url: string;
  /** The model already in the list, if someone added it before. */
  @ApiProperty({ nullable: true, type: String })
  existingId: string | null;
}

export class LicenseCheckViewDto {
  id: string;
  licenseCode: string;
  licenseLabel: string;
  @ApiProperty({ enum: LICENSE_VERDICTS })
  verdict: LicenseVerdict;
  @ApiProperty({ enum: CHECK_BASES })
  basis: CheckBasis;
  @ApiProperty({ format: 'date', nullable: true, type: String })
  membershipUntil: string | null;
  /** Open with GET /uploads/download?key=…; "" when none was attached. */
  evidenceKey: string;
  note: string;
  acknowledgements: string[];
  checkedByName: string;
  @ApiProperty({ format: 'date-time' })
  checkedAt: string;
}

export class ExternalModelSummaryDto {
  total: number;
  sellable: number;
  blocked: number;
  /** Old checks and memberships that ran out (some are also counted as blocked). */
  recheck: number;
}

export class ExternalModelImageDto {
  /** R2 key, sent back unchanged to keep the photo when saving. */
  key: string;
  url: string;
}

export class ExternalModelViewDto {
  id: string;
  @ApiProperty({ enum: MODEL_SOURCES })
  source: ModelSource;
  externalId: string;
  url: string;
  title: string;
  creatorName: string;
  creatorUrl: string;
  description: string;
  /** The cover first. */
  @ApiProperty({ type: () => [ExternalModelImageDto] })
  images: ExternalModelImageDto[];
  @ApiProperty({ type: () => [ExternalModelProfileDto] })
  profiles: ExternalModelProfileDto[];
  licenseCode: string;
  licenseLabel: string;
  @ApiProperty({ enum: LICENSE_VERDICTS })
  verdict: LicenseVerdict;
  @ApiProperty({ enum: CHECK_BASES })
  basis: CheckBasis;
  @ApiProperty({ format: 'date', nullable: true, type: String })
  membershipUntil: string | null;
  /** May be printed for sale today. */
  sellable: boolean;
  /** Why not, or what to look at again; "" when all is well. */
  stateReason: string;
  recheckDue: boolean;
  /** Conditions the shop keeps while selling (credit the creator…). */
  @ApiProperty({
    enum: ['attribution', 'no_modification', 'share_alike'],
    isArray: true,
  })
  requires: string[];
  checkedByName: string;
  @ApiProperty({ format: 'date-time' })
  checkedAt: string;
  @ApiProperty({ format: 'date-time' })
  createdAt: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class ExternalModelDetailDto extends ExternalModelViewDto {
  /** Newest first. */
  @ApiProperty({ type: () => [LicenseCheckViewDto] })
  checks: LicenseCheckViewDto[];
}
