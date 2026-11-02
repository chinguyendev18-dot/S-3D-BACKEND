import { Injectable } from '@nestjs/common';

import { conflict, notFound } from '../common/app-exception';
import type { PrintArea } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePrintAreaDto,
  PrintAreaViewDto,
  UpdatePrintAreaDto,
} from './dto/print-area.dto';

const view = (area: PrintArea): PrintAreaViewDto => ({
  code: area.code,
  height: area.heightCm,
  heightCm: area.heightCm,
  id: area.id,
  isActive: area.isActive,
  label: area.name,
  name: area.name,
  sortOrder: area.sortOrder,
  unit: 'cm',
  width: area.widthCm,
  widthCm: area.widthCm,
});

const missing = () =>
  notFound('PRINT_AREA.NOT_FOUND', 'Không tìm thấy bàn in.');

/** The printers' build areas (bed, resin tray): what limits the size of one printed piece. */
@Injectable()
export class PrintAreasService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.printArea.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(view);
  }

  async create(dto: CreatePrintAreaDto) {
    await this.ensureFreeCode(dto.code);
    return view(
      await this.prisma.printArea.create({
        data: {
          ...dto,
          code: dto.code.toUpperCase(),
          sortOrder: dto.sortOrder ?? (await this.prisma.printArea.count()),
        },
      }),
    );
  }

  async update(id: string, dto: UpdatePrintAreaDto) {
    const current = await this.prisma.printArea.findUnique({ where: { id } });
    if (!current) throw missing();
    if (dto.code && dto.code.toUpperCase() !== current.code)
      await this.ensureFreeCode(dto.code);
    return view(
      await this.prisma.printArea.update({
        data: { ...dto, code: dto.code?.toUpperCase() },
        where: { id },
      }),
    );
  }

  async remove(id: string) {
    await this.prisma.printArea.delete({ where: { id } }).catch(() => {
      throw missing();
    });
    return null;
  }

  private async ensureFreeCode(code: string) {
    const upper = code.toUpperCase();
    if (await this.prisma.printArea.findUnique({ where: { code: upper } }))
      throw conflict('CATALOG.CODE_TAKEN', `Mã "${upper}" đã được dùng.`);
  }
}
