import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  SEED_CATALOG,
  SEED_CONTENT,
  SEED_DISCOUNTS,
  SEED_IMAGES_DIR,
  SEED_SHIPPING,
} from './index';

const unique = (values: string[]) => new Set(values).size === values.length;

/** The fixtures point at each other by id: a typo would only show when a module seeds them. */
describe('seed data', () => {
  const { categories, filaments, materials, products } = SEED_CATALOG;
  const filamentIds = new Set(filaments.map((filament) => filament.id));
  const materialIds = new Set(materials.map((material) => material.id));

  it('has unique ids, skus and slugs', () => {
    expect(unique(products.map((product) => product.id))).toBe(true);
    expect(unique(products.map((product) => product.sku))).toBe(true);
    expect(unique(products.map((product) => product.slug))).toBe(true);
    expect(unique(categories.map((category) => category.slug))).toBe(true);
    expect(unique(SEED_CONTENT.blogPosts.map((post) => post.slug))).toBe(true);
    expect(unique(SEED_DISCOUNTS.map((discount) => discount.code))).toBe(true);
  });

  it('gives every product a known category, materials, colours and photo', () => {
    const categoryIds = new Set(categories.map((category) => category.id));
    for (const product of products) {
      expect(categoryIds.has(product.categoryId)).toBe(true);
      expect(product.print.materials.every((id) => materialIds.has(id))).toBe(
        true,
      );
      expect(product.print.materials).toContain(product.print.defaultMaterial);
      expect(filamentIds.has(product.print.defaultColor)).toBe(true);
      expect(product.print.colors.every((id) => filamentIds.has(id))).toBe(
        true,
      );
      expect(product.price).toBeGreaterThan(0);
      if (product.image)
        expect(
          existsSync(join(SEED_IMAGES_DIR, 'products', product.image)),
        ).toBe(true);
    }
  });

  it('links blog posts and discounts to what exists', () => {
    const blogCategories = new Set(
      SEED_CONTENT.blogCategories.map((c) => c.id),
    );
    expect(
      SEED_CONTENT.blogPosts.every((post) =>
        blogCategories.has(post.categoryId),
      ),
    ).toBe(true);

    const categoryIds = new Set(categories.map((category) => category.id));
    for (const discount of SEED_DISCOUNTS) {
      expect(discount.categoryIds.every((id) => categoryIds.has(id))).toBe(
        true,
      );
      expect(
        discount.materials.every((id) => materialIds.has(id as never)),
      ).toBe(true);
    }
  });

  it('ships to the countries it lists', () => {
    const countries = new Set(
      SEED_SHIPPING.countries.map((country) => country.code),
    );
    expect(
      SEED_SHIPPING.zones.every((zone) =>
        zone.countryCodes.every((c) => countries.has(c)),
      ),
    ).toBe(true);
    expect(
      SEED_SHIPPING.provinces.cities.length +
        SEED_SHIPPING.provinces.provinces.length,
    ).toBe(34);
  });
});
