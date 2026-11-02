/**
 * The shop's catalogue from prisma/seed-data: materials, filament colours, pricing, categories,
 * print areas (printer beds) and products. Rows that exist are left as they are (the admin may have
 * edited them); only missing ones are added.
 */
import { Prisma } from '../../src/generated/prisma/client';
import { daysFromNow, SEED_CATALOG } from '../seed-data';
import { prisma } from '../seed-tools';
import { imagesGoToR2, productPhoto } from './images';

/** The first products of the list are the shop's highlights. */
const FEATURED = 6;

export async function seedCatalog() {
  const { categories, filaments, materials, pricing, printAreas, products } =
    SEED_CATALOG;

  for (const material of materials) {
    await prisma.printMaterial.upsert({
      create: { ...material, sortOrder: materials.indexOf(material) },
      update: {},
      where: { id: material.id },
    });
  }
  for (const filament of filaments) {
    await prisma.filament.upsert({
      create: filament,
      update: {},
      where: { id: filament.id },
    });
  }
  await prisma.setting.upsert({
    create: {
      key: 'print_pricing',
      value: pricing as unknown as Prisma.InputJsonValue,
    },
    update: {},
    where: { key: 'print_pricing' },
  });
  for (const category of categories) {
    await prisma.productCategory.upsert({
      create: category,
      update: {},
      where: { id: category.id },
    });
  }
  for (const [index, area] of printAreas.entries()) {
    await prisma.printArea.upsert({
      create: { ...area, sortOrder: index },
      update: {},
      where: { id: area.id },
    });
  }

  let added = 0;
  for (const product of products) {
    if (await prisma.product.findUnique({ where: { id: product.id } }))
      continue;
    const photo = await productPhoto(product.image);
    const { print } = product;
    await prisma.product.create({
      data: {
        categoryId: product.categoryId,
        colors: print.colors,
        createdAt: daysFromNow(-product.createdDaysAgo),
        defaultColor: print.defaultColor,
        defaultHeightMm: print.defaultHeightMm,
        defaultMaterial: print.defaultMaterial,
        description: `<p>${product.description}</p>`,
        featured: product.sortOrder <= FEATURED,
        fixedPrice: print.fixedPrice,
        id: product.id,
        images: photo ? [photo] : [],
        material: product.material,
        materials: print.materials,
        maxHeightMm: print.maxHeightMm,
        meshyPrompt: product.name,
        metrics: print.metrics as unknown as Prisma.InputJsonValue,
        minHeightMm: print.minHeightMm,
        name: product.name,
        oldPrice: product.oldPrice,
        price: product.price,
        priceMode: print.priceMode,
        shortDesc: product.description,
        sku: product.sku,
        slug: product.slug,
        sortOrder: product.sortOrder,
        status: product.isActive ? 'dang_ban' : 'an',
        stock: product.stock,
        thumbnail: photo,
        upAxis: print.upAxis,
      },
    });
    added += 1;
  }
  console.log(
    `Danh mục: ${categories.length} nhóm, ${materials.length} vật liệu, ${filaments.length} màu nhựa, ` +
      `${printAreas.length} bàn in; sản phẩm: thêm ${added}/${products.length}.`,
  );
  if (!imagesGoToR2())
    console.log(
      '  Chưa có R2 trong .env: ảnh sản phẩm dùng tạm ảnh có sẵn của website.',
    );
}
