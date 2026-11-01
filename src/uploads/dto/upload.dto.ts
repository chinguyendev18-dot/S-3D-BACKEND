import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import {
  UPLOAD_PURPOSE_KEYS,
  type UploadPurposeKey,
  type Visibility,
} from '../upload-purposes';

export class CreateUploadDto {
  /** What the file is for: decides who may upload it, its types and size. */
  @ApiProperty({ enum: UPLOAD_PURPOSE_KEYS })
  @IsIn(UPLOAD_PURPOSE_KEYS, { message: 'Loại file tải lên không hợp lệ.' })
  purpose: UploadPurposeKey;

  /** The file's own name; only its extension is kept. */
  @IsString({ message: 'Tên file không hợp lệ.' })
  @IsNotEmpty({ message: 'Thiếu tên file.' })
  @MaxLength(200, { message: 'Tên file tối đa 200 ký tự.' })
  fileName: string;

  /** The type the file will be sent with (the browser's File.type). */
  @IsString({ message: 'Kiểu file không hợp lệ.' })
  @IsNotEmpty({ message: 'Thiếu kiểu file.' })
  @MaxLength(100, { message: 'Kiểu file không hợp lệ.' })
  contentType: string;

  /** Size in bytes, exactly as it will be sent. */
  @Type(() => Number)
  @IsInt({ message: 'Dung lượng file không hợp lệ.' })
  @Min(1, { message: 'File rỗng.' })
  size: number;
}

export class DownloadQueryDto {
  @Matches(/^(public|private)\/[a-z0-9-]+\/[A-Za-z0-9._/-]+$/, {
    message: 'Đường dẫn file không hợp lệ.',
  })
  key: string;
}

export class UploadHeadersDto {
  /** Send it exactly: the upload link is signed for this type. */
  @ApiProperty({ name: 'Content-Type' })
  'Content-Type': string;
}

export class UploadTicketDto {
  /** Keep it: what the product, return request… saves to point at the file. */
  key: string;

  /** PUT the file's bytes here, before expiresAt. */
  uploadUrl: string;

  @ApiProperty({ enum: ['PUT'] })
  method: 'PUT';

  headers: UploadHeadersDto;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;

  @ApiProperty({ enum: ['public', 'private'] })
  visibility: Visibility;

  /** Where anyone can see a public file once uploaded; null for private files. */
  @ApiProperty({ nullable: true, type: String })
  publicUrl: string | null;
}

export class DownloadLinkDto {
  url: string;

  /** null for public files (their link does not expire). */
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  expiresAt: string | null;
}
