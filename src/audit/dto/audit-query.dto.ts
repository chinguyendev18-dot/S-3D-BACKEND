import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AuditQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'Mã người thực hiện không hợp lệ.' })
  actorId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số dòng phải là số nguyên.' })
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsUUID('all', { message: 'Mã đối tượng không hợp lệ.' })
  targetId?: string;
}
