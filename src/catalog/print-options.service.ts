import { Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PrintOptionsDto } from './dto/print-options.dto';
import { DEFAULT_PRICING, type PrintPricing } from './pricing';

const PRICING_KEY = 'print_pricing';

/** Read on every product answer: kept a little while, dropped as soon as it is edited. */
const CACHE_MS = 30_000;

/**
 * Materials, filament colours and pricing numbers: what every price and colour picker is built
 * from. Edited as a whole (PUT /print-options) from the admin.
 */
@Injectable()
export class PrintOptionsService {
  private cache: { at: number; options: PrintOptionsDto } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<PrintOptionsDto> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS)
      return this.cache.options;

    const [materials, filaments, setting] = await Promise.all([
      this.prisma.printMaterial.findMany({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        where: { isActive: true },
      }),
      this.prisma.filament.findMany({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        where: { isActive: true },
      }),
      this.prisma.setting.findUnique({ where: { key: PRICING_KEY } }),
    ]);
    const options: PrintOptionsDto = {
      filaments: filaments.map(({ hex, id, materials, name, sortOrder }) => ({
        hex,
        id,
        materials,
        name,
        sortOrder,
      })),
      materials: materials.map(
        ({
          density,
          fill,
          gramsPerHour,
          id,
          label,
          pricePerGram,
          sortOrder,
        }) => ({
          density,
          fill,
          gramsPerHour,
          id,
          label,
          pricePerGram,
          sortOrder,
        }),
      ),
      pricing: {
        ...DEFAULT_PRICING,
        ...((setting?.value as Partial<PrintPricing> | null) ?? {}),
      },
    };
    this.cache = { at: Date.now(), options };
    return options;
  }

  /** Replaces the lists and numbers; what is left out of the lists is switched off, not deleted. */
  async replace(input: PrintOptionsDto) {
    await this.prisma.$transaction([
      this.prisma.printMaterial.updateMany({
        data: { isActive: false },
        where: {
          id: { notIn: input.materials.map((material) => material.id) },
        },
      }),
      ...input.materials.map(({ id, ...material }, index) =>
        this.prisma.printMaterial.upsert({
          create: {
            id,
            ...material,
            isActive: true,
            sortOrder: material.sortOrder ?? index,
          },
          update: {
            ...material,
            isActive: true,
            sortOrder: material.sortOrder ?? index,
          },
          where: { id },
        }),
      ),
      this.prisma.filament.updateMany({
        data: { isActive: false },
        where: {
          id: { notIn: input.filaments.map((filament) => filament.id) },
        },
      }),
      ...input.filaments.map(({ id, ...filament }, index) =>
        this.prisma.filament.upsert({
          create: {
            id,
            ...filament,
            isActive: true,
            sortOrder: filament.sortOrder ?? index,
          },
          update: {
            ...filament,
            isActive: true,
            sortOrder: filament.sortOrder ?? index,
          },
          where: { id },
        }),
      ),
      this.prisma.setting.upsert({
        create: {
          key: PRICING_KEY,
          value: input.pricing as unknown as Prisma.InputJsonValue,
        },
        update: { value: input.pricing as unknown as Prisma.InputJsonValue },
        where: { key: PRICING_KEY },
      }),
    ]);
    this.cache = null;
    return this.get();
  }
}
