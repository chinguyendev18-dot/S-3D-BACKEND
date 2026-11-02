import type { Product, ProductCategory } from '../generated/prisma/client';
import type { PrintOptionsDto } from './dto/print-options.dto';
import type {
  ProductColorDto,
  ProductSizeOptionDto,
  ProductVariantDto,
  ProductViewDto,
} from './dto/product-view.dto';
import {
  heightPresets,
  priceAt,
  type ModelMetrics,
  type PricedProduct,
  type UpAxis,
} from './pricing';

export type ProductRow = Product & { category: ProductCategory | null };

export interface ViewContext {
  /** Stored picture / file → the link to show (StorageService.mediaUrl). */
  media: (stored: string) => string;
  options: PrintOptionsDto;
  staff: boolean;
  /** Every colour × height with its price: product pages only (lists would be heavy). */
  withVariants: boolean;
}

const asMetrics = (value: unknown): ModelMetrics | null => {
  const metrics = value as ModelMetrics | null;
  return metrics && typeof metrics.volume === 'number' && metrics.size
    ? metrics
    : null;
};

export function pricedProduct(product: Product): PricedProduct {
  return {
    defaultHeightMm: product.defaultHeightMm,
    fixedPrice: product.fixedPrice,
    metrics: asMetrics(product.metrics),
    priceMode: product.priceMode,
    upAxis: product.upAxis as UpAxis,
  };
}

/** The filament colours a customer can pick for a material: the product's list, else all of it. */
export function colorsFor(
  product: Pick<Product, 'colors'>,
  material: string,
  options: PrintOptionsDto,
): ProductColorDto[] {
  return options.filaments
    .filter(
      (filament) =>
        filament.materials.includes(material) &&
        (!product.colors.length || product.colors.includes(filament.id)),
    )
    .map((filament) => ({
      hexCode: filament.hex,
      id: filament.id,
      label: filament.name,
      name: filament.name,
    }));
}

function sizesOf(product: Product): ProductSizeOptionDto[] {
  return heightPresets(
    product.minHeightMm,
    product.defaultHeightMm,
    product.maxHeightMm,
  ).map((heightMm, index) => ({
    heightMm,
    id: `h${heightMm}`,
    label: `${heightMm} mm`,
    name: `${heightMm} mm`,
    sortOrder: index,
  }));
}

/**
 * One product as every app reads it: the storefront's catalogue fields (productColors, sizes,
 * variants, template) and the admin editor's fields (status, colors as ids,
 * longDescription, the model…) side by side.
 */
export function productView(row: ProductRow, ctx: ViewContext): ProductViewDto {
  const { media, options } = ctx;
  const thumbnail = row.thumbnail ? media(row.thumbnail) : '';
  const images = row.images.map(media);
  const gallery = [...new Set([thumbnail, ...images].filter(Boolean))];
  const metrics = asMetrics(row.metrics);
  const category = row.category
    ? { id: row.category.id, name: row.category.name, slug: row.category.slug }
    : null;
  const productColors = colorsFor(row, row.defaultMaterial, options);
  const sizes = sizesOf(row);

  let variants: ProductVariantDto[] | undefined;
  if (ctx.withVariants) {
    const material = options.materials.find(
      (item) => item.id === row.defaultMaterial,
    );
    const priced = pricedProduct(row);
    variants = productColors.flatMap((color) =>
      sizes.map((size) => ({
        colorId: color.id,
        id: `${row.id}-${row.defaultMaterial}-${color.id}-${size.id}`,
        imageUrl: thumbnail,
        isAvailable: row.stock > 0,
        price: priceAt(priced, size.heightMm, material, options.pricing),
        sizeId: size.id,
        sku: `${row.sku}-${color.id.toUpperCase()}-${size.id.toUpperCase()}`,
        stock: row.stock,
      })),
    );
  }

  return {
    category,
    categoryId: row.categoryId,
    categoryName: category?.name ?? '',
    colors: row.colors,
    comparePrice: row.oldPrice,
    createdAt: row.createdAt.toISOString(),
    defaultColor: row.defaultColor,
    defaultHeightMm: row.defaultHeightMm,
    defaultMaterial: row.defaultMaterial,
    description: row.shortDesc,
    designId: row.designId,
    featured: row.featured,
    fixedPrice: row.fixedPrice,
    gallery,
    id: row.id,
    imageUrl: thumbnail,
    images,
    isActive: row.status === 'dang_ban',
    longDescription: row.description,
    material: row.material,
    materials: row.materials,
    maxHeightMm: row.maxHeightMm,
    meshyPrompt: row.meshyPrompt,
    metrics,
    minHeightMm: row.minHeightMm,
    modelFileName: row.modelFileName,
    modelSource: row.modelSource,
    modelUrl: row.modelUrl ? media(row.modelUrl) : '',
    name: row.name,
    oldPrice: row.oldPrice,
    price: row.price,
    priceMode: row.priceMode,
    productCategory: category,
    productCategoryId: row.categoryId,
    productColors,
    remainingQuantity: row.stock,
    shortDesc: row.shortDesc,
    sizes,
    sku: row.sku,
    slug: row.slug,
    sortOrder: row.sortOrder,
    status: row.status,
    stock: row.stock,
    tags: row.tags,
    template: {
      colors: row.colors,
      comparePrice: row.oldPrice,
      defaultColor: row.defaultColor,
      defaultHeightMm: row.defaultHeightMm,
      defaultMaterial: row.defaultMaterial,
      fixedPrice: row.fixedPrice,
      materials: row.materials,
      maxHeightMm: row.maxHeightMm,
      metrics,
      minHeightMm: row.minHeightMm,
      priceMode: row.priceMode,
      upAxis: row.upAxis as UpAxis,
    },
    thumbnail,
    updatedAt: row.updatedAt.toISOString(),
    upAxis: row.upAxis as UpAxis,
    ...(variants ? { variants } : {}),
    ...(ctx.staff ? { workshopNote: row.workshopNote } : {}),
  };
}
