import { Injectable } from '@nestjs/common';

import { badRequest, conflict } from '../common/app-exception';
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

  /** What makes no sense on its own: repeated ids, a colour of an unknown material, heights the wrong way round. */
  private checkInput(input: PrintOptionsDto) {
    const repeated = (ids: string[]) =>
      ids.find((id, index) => ids.indexOf(id) !== index);
    const material = repeated(input.materials.map((item) => item.id));
    if (material)
      throw badRequest(
        'PRINT_OPTIONS.INVALID',
        `Vật liệu ${material} bị trùng mã.`,
      );
    const filament = repeated(input.filaments.map((item) => item.id));
    if (filament)
      throw badRequest(
        'PRINT_OPTIONS.INVALID',
        `Màu nhựa ${filament} bị trùng mã.`,
      );
    const known = new Set(input.materials.map((item) => item.id));
    for (const item of input.filaments) {
      const unknown = item.materials.filter((id) => !known.has(id));
      if (unknown.length)
        throw badRequest(
          'PRINT_OPTIONS.INVALID',
          `Màu “${item.name}” dùng vật liệu không có: ${unknown.join(', ')}.`,
        );
    }
    for (const id of known)
      if (!input.filaments.some((item) => item.materials.includes(id)))
        throw badRequest(
          'PRINT_OPTIONS.INVALID',
          `Vật liệu ${id} chưa có màu nhựa nào.`,
        );
    if (input.pricing.minHeightMm >= input.pricing.maxHeightMm)
      throw badRequest(
        'PRINT_OPTIONS.INVALID',
        'Chiều cao nhỏ nhất phải nhỏ hơn chiều cao lớn nhất.',
      );
  }

  /**
   * What the products on the shelves still need: a material, a colour or a height range taken away
   * would leave them with prices and pickers that no longer work. Named, so it can be sorted out.
   */
  private async checkProducts(input: PrintOptionsDto) {
    const materials = new Set(input.materials.map((item) => item.id));
    const filaments = new Set(input.filaments.map((item) => item.id));
    const { maxHeightMm: top, minHeightMm: bottom } = input.pricing;
    const products = await this.prisma.product.findMany({
      select: {
        colors: true,
        defaultColor: true,
        defaultMaterial: true,
        materials: true,
        maxHeightMm: true,
        minHeightMm: true,
        name: true,
      },
    });
    const names = (list: typeof products) =>
      `${list
        .slice(0, 3)
        .map((product) => `“${product.name}”`)
        .join(', ')}${list.length > 3 ? ` và ${list.length - 3} sản phẩm khác` : ''}`;

    const missing = (id: string, usedBy: typeof products, what: string) => {
      if (usedBy.length)
        throw conflict(
          'PRINT_OPTIONS.IN_USE',
          `Chưa bỏ được ${what} ${id}: ${names(usedBy)} đang dùng. Đổi các sản phẩm đó trước.`,
        );
    };
    for (const id of new Set(
      products.flatMap((product) => [
        ...product.materials,
        product.defaultMaterial,
      ]),
    ))
      if (!materials.has(id))
        missing(
          id,
          products.filter(
            (product) =>
              product.defaultMaterial === id || product.materials.includes(id),
          ),
          'vật liệu',
        );
    for (const id of new Set(
      products.flatMap((product) => [...product.colors, product.defaultColor]),
    ))
      if (id && !filaments.has(id))
        missing(
          id,
          products.filter(
            (product) =>
              product.defaultColor === id || product.colors.includes(id),
          ),
          'màu nhựa',
        );
    const outside = products.filter(
      (product) => product.minHeightMm < bottom || product.maxHeightMm > top,
    );
    if (outside.length)
      throw conflict(
        'PRINT_OPTIONS.IN_USE',
        `Khoảng chiều cao ${bottom}–${top} mm chưa đủ cho ${names(outside)}. Đổi các sản phẩm đó trước.`,
      );
  }

  /** Replaces the lists and numbers; what is left out of the lists is switched off, not deleted. */
  async replace(input: PrintOptionsDto) {
    this.checkInput(input);
    await this.checkProducts(input);
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
