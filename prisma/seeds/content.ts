/**
 * Blog, policies, FAQ, shipping and discount codes from prisma/seed-data. Like the
 * catalogue: missing rows are added, existing ones (maybe edited in the admin) are left alone.
 */
import {
  daysFromNow,
  SEED_CONTENT,
  SEED_DISCOUNTS,
  SEED_SHIPPING,
} from '../seed-data';
import { prisma } from '../seed-tools';
import { productPhoto } from './images';

export async function seedContent() {
  const { blogCategories, blogPosts, faq, legalDocuments } = SEED_CONTENT;

  for (const category of blogCategories) {
    await prisma.blogCategory.upsert({
      create: {
        id: category.id,
        index: category.sortOrder,
        name: category.name,
        slug: category.slug,
      },
      update: {},
      where: { id: category.id },
    });
  }
  for (const [index, post] of blogPosts.entries()) {
    if (await prisma.blogPost.findUnique({ where: { id: post.id } })) continue;
    await prisma.blogPost.create({
      data: {
        categoryId: post.categoryId,
        content: post.content,
        createdAt: daysFromNow(-post.createdDaysAgo),
        description: post.description,
        id: post.id,
        index: index + 1,
        slug: post.slug,
        thumbnail: await productPhoto(post.image),
        title: post.title,
      },
    });
  }

  // Each policy page starts as one section holding the storefront's full text.
  for (const document of legalDocuments) {
    await prisma.legalDocument.upsert({
      create: {
        content: document.content,
        id: `legal-${document.type}`,
        sortOrder: 0,
        title: document.title,
        type: document.type,
      },
      update: {},
      where: { id: `legal-${document.type}` },
    });
  }
  for (const entry of faq) {
    await prisma.legalDocument.upsert({
      create: {
        content: entry.answer,
        id: `faq-${entry.sortOrder}`,
        sortOrder: entry.sortOrder,
        title: entry.question,
        type: 'faq',
      },
      update: {},
      where: { id: `faq-${entry.sortOrder}` },
    });
  }
  console.log(
    `Nội dung: ${blogPosts.length} bài viết, ` +
      `${legalDocuments.length} trang chính sách, ${faq.length} câu hỏi thường gặp.`,
  );
}

export async function seedShipping() {
  for (const country of SEED_SHIPPING.countries) {
    await prisma.country.upsert({
      create: country,
      update: {},
      where: { code: country.code },
    });
  }
  for (const zone of SEED_SHIPPING.zones) {
    await prisma.shippingZone.upsert({
      create: {
        code: zone.code,
        countryCodes: zone.countryCodes,
        estimatedDays: zone.estimatedDays,
        firstItemPrice: zone.basePrice,
        id: zone.id,
        isActive: zone.isActive,
        name: zone.name,
        sortOrder: zone.sortOrder,
      },
      update: {},
      where: { id: zone.id },
    });
  }
  console.log(
    `Vận chuyển: ${SEED_SHIPPING.countries.length} quốc gia, ${SEED_SHIPPING.zones.length} vùng giao hàng.`,
  );
}

export async function seedDiscounts() {
  for (const discount of SEED_DISCOUNTS) {
    await prisma.discount.upsert({
      create: {
        categoryIds: discount.categoryIds,
        channels: discount.channels,
        code: discount.code,
        description: discount.description,
        endsAt:
          discount.endsInDays === null
            ? null
            : daysFromNow(discount.endsInDays),
        id: discount.id,
        isActive: discount.isActive,
        materials: discount.materials,
        maxDiscount: discount.maxDiscount ?? 0,
        minOrder: discount.minOrder,
        name: discount.name,
        perCustomerLimit: discount.perCustomerLimit ?? 0,
        scope: discount.scope,
        startsAt:
          discount.startsInDays === null
            ? null
            : daysFromNow(discount.startsInDays),
        type: discount.type,
        usageLimit: discount.usageLimit ?? 0,
        value: discount.value,
      },
      update: {},
      where: { code: discount.code },
    });
  }
  console.log(`Mã giảm giá: ${SEED_DISCOUNTS.length} mã.`);
}
