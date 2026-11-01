import { ApiProperty } from '@nestjs/swagger';

/** Every refused request answers with this (see common/http-exception.filter.ts). */
export class ApiErrorDto {
  @ApiProperty({ enum: [false] })
  success: false;

  statusCode: number;

  /** Vietnamese, ready to show. */
  message: string;

  /** Stable code the apps branch on, e.g. AUTH.LOGIN.NOT_VERIFIED. */
  messageCode: string;

  /** Validation errors per field. */
  @ApiProperty({
    additionalProperties: { items: { type: 'string' }, type: 'array' },
    required: false,
    type: Object,
  })
  details?: Record<string, string[]>;
}
