import { Injectable } from '@nestjs/common';

import { badRequest, notFound } from '../common/app-exception';
import type { PageQueryDto } from '../common/dto/page-query.dto';
import { pageArgs, toPage } from '../common/pagination';
import type { Country, Prisma, ShippingZone } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CountryViewDto,
  CreateZoneDto,
  ShippingZoneViewDto,
  UpdateZoneDto,
} from './shipping.dto';

const countryView = (country: Country): CountryViewDto => ({
  code: country.code,
  currency: country.currency,
  id: country.code,
  iso2: country.code,
  iso3: country.iso3,
  name: country.name,
});

/** Countries the shop delivers to and the zones it prices delivery by. */
@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  async countries(query: PageQueryDto) {
    const args = pageArgs(query, ['name', 'code'], 'name');
    const where: Prisma.CountryWhereInput = args.search
      ? {
          OR: [
            { name: { contains: args.search, mode: 'insensitive' } },
            { code: { equals: args.search.toUpperCase() } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.country.findMany({
        orderBy: args.orderBy,
        skip: args.skip,
        take: args.take,
        where,
      }),
      this.prisma.country.count({ where }),
    ]);
    return toPage(rows.map(countryView), total, args);
  }

  async zones(query: PageQueryDto) {
    const args = pageArgs(
      query,
      ['sortOrder', 'name', 'firstItemPrice', 'createdAt'],
      'sortOrder',
    );
    const where: Prisma.ShippingZoneWhereInput = args.search
      ? { name: { contains: args.search, mode: 'insensitive' } }
      : {};
    const [rows, total, countries] = await Promise.all([
      this.prisma.shippingZone.findMany({
        orderBy: [args.orderBy, { createdAt: 'asc' }],
        skip: args.skip,
        take: args.take,
        where,
      }),
      this.prisma.shippingZone.count({ where }),
      this.countryMap(),
    ]);
    return toPage(
      rows.map((row) => this.zoneView(row, countries)),
      total,
      args,
    );
  }

  async zone(id: string) {
    const row = await this.prisma.shippingZone.findUnique({ where: { id } });
    if (!row) throw this.missing();
    return this.zoneView(row, await this.countryMap());
  }

  async createZone(dto: CreateZoneDto) {
    const row = await this.prisma.shippingZone.create({
      data: {
        additionalItemPrice: dto.additionalItemPrice ?? 0,
        code: dto.code?.trim() ?? '',
        countryCodes: await this.knownCountries(dto.countryIds),
        estimatedDays: dto.estimatedDays?.trim() ?? '',
        firstItemPrice: dto.firstItemPrice ?? 0,
        isActive: dto.isActive ?? true,
        name: dto.name.trim(),
        sortOrder: await this.prisma.shippingZone.count(),
        type: dto.type ?? 'country',
      },
    });
    return this.zoneView(row, await this.countryMap());
  }

  async updateZone(id: string, dto: UpdateZoneDto) {
    await this.zone(id);
    const row = await this.prisma.shippingZone.update({
      data: {
        additionalItemPrice: dto.additionalItemPrice,
        code: dto.code?.trim(),
        countryCodes: dto.countryIds
          ? await this.knownCountries(dto.countryIds)
          : undefined,
        estimatedDays: dto.estimatedDays?.trim(),
        firstItemPrice: dto.firstItemPrice,
        isActive: dto.isActive,
        name: dto.name?.trim(),
        type: dto.type,
      },
      where: { id },
    });
    return this.zoneView(row, await this.countryMap());
  }

  async removeZone(id: string) {
    await this.zone(id);
    await this.prisma.shippingZone.delete({ where: { id } });
    return null;
  }

  private zoneView(
    zone: ShippingZone,
    countries: Map<string, Country>,
  ): ShippingZoneViewDto {
    return {
      additionalItemPrice: zone.additionalItemPrice,
      basePrice: zone.firstItemPrice,
      code: zone.code,
      countries: zone.countryCodes
        .map((code) => countries.get(code))
        .filter((country): country is Country => Boolean(country))
        .map(countryView),
      countryIds: zone.countryCodes,
      createdAt: zone.createdAt.toISOString(),
      currency: 'VND',
      estimatedDays: zone.estimatedDays,
      firstItemPrice: zone.firstItemPrice,
      id: zone.id,
      isActive: zone.isActive,
      name: zone.name,
      productId: '',
      sortOrder: zone.sortOrder,
      type: zone.type,
      updatedAt: zone.updatedAt.toISOString(),
    };
  }

  private async countryMap() {
    const rows = await this.prisma.country.findMany();
    return new Map(rows.map((country) => [country.code, country]));
  }

  private async knownCountries(ids: string[]) {
    const codes = [...new Set(ids.map((id) => id.trim().toUpperCase()))];
    const found = await this.prisma.country.findMany({
      where: { code: { in: codes } },
    });
    const missing = codes.filter(
      (code) => !found.some((country) => country.code === code),
    );
    if (missing.length)
      throw badRequest(
        'SHIPPING.UNKNOWN_COUNTRY',
        `Không có quốc gia: ${missing.join(', ')}.`,
      );
    return codes;
  }

  private missing() {
    return notFound(
      'SHIPPING_ZONE.NOT_FOUND',
      'Không tìm thấy vùng giao hàng.',
    );
  }
}
