import { SEED_CATALOG } from '../../prisma/seed-data';
import type { PrintOptionsDto } from './dto/print-options.dto';
import { productView, type ProductRow } from './product-view';
import { DEFAULT_PRICING } from './pricing';

const options: PrintOptionsDto = {
  filaments: SEED_CATALOG.filaments,
  materials: SEED_CATALOG.materials,
  pricing: DEFAULT_PRICING,
};

const row = (patch: Partial<ProductRow> = {}): ProductRow => ({
  category: {
    createdAt: new Date(),
    description: '',
    id: 'cat-gift',
    name: 'Quà tặng',
    slug: 'qua-tang',
    sortOrder: 1,
    updatedAt: new Date(),
  },
  categoryId: 'cat-gift',
  colors: [],
  createdAt: new Date('2026-10-01T00:00:00Z'),
  defaultColor: 'trang',
  defaultHeightMm: 100,
  defaultMaterial: 'PLA',
  description: '<p>Đèn ngủ</p>',
  designId: '',
  featured: false,
  fixedPrice: 289_000,
  id: 'prd-102',
  images: ['public/product-image/seed/den.webp'],
  material: 'PLA trắng',
  materials: ['PLA', 'PETG'],
  maxHeightMm: 200,
  meshyPrompt: '',
  metrics: null,
  minHeightMm: 40,
  modelFileName: '',
  modelSource: 'tai_len',
  modelUrl: '',
  name: 'Đèn ngủ mèo ôm trăng',
  oldPrice: 339_000,
  price: 289_000,
  priceMode: 'co_dinh',
  shortDesc: 'Đèn LED ấm',
  sku: 'S3D-GF-102',
  slug: 'den-ngu-meo-om-trang',
  sortOrder: 2,
  status: 'dang_ban',
  stock: 46,
  tags: [],
  thumbnail: 'public/product-image/seed/den.webp',
  upAxis: 'y',
  updatedAt: new Date('2026-10-02T00:00:00Z'),
  workshopNote: 'In nằm',
  ...patch,
});

const media = (stored: string) =>
  stored.startsWith('public/') ? `https://files.s-3d.vn/${stored}` : stored;

describe('productView', () => {
  it('gives the storefront its colours, heights and prices, and the admin its fields', () => {
    const view = productView(row(), {
      media,
      options,
      staff: false,
      withVariants: true,
    });
    expect(view).toMatchObject({
      colors: [],
      description: 'Đèn LED ấm',
      imageUrl: 'https://files.s-3d.vn/public/product-image/seed/den.webp',
      isActive: true,
      longDescription: '<p>Đèn ngủ</p>',
      productCategoryId: 'cat-gift',
      template: { fixedPrice: 289_000, priceMode: 'co_dinh' },
    });
    // Every PLA colour, as the product allows all of them.
    expect(view.productColors.map((color) => color.id)).toEqual(
      SEED_CATALOG.filaments
        .filter((filament) => filament.materials.includes('PLA'))
        .map((filament) => filament.id),
    );
    expect(view.sizes.map((size) => size.id)).toEqual([
      'h40',
      'h70',
      'h100',
      'h150',
      'h200',
    ]);
    const variant = view.variants?.find(
      (item) => item.colorId === 'trang' && item.sizeId === 'h100',
    );
    expect(variant?.price).toBe(289_000);
    expect(view.gallery).toHaveLength(1);
    expect(view.workshopNote).toBeUndefined();
  });

  it('keeps colours to the product list, lists without variants, and shows staff the workshop note', () => {
    const view = productView(row({ colors: ['den', 'do'] }), {
      media,
      options,
      staff: true,
      withVariants: false,
    });
    expect(view.productColors.map((color) => color.id)).toEqual(['den', 'do']);
    expect(view.variants).toBeUndefined();
    expect(view.workshopNote).toBe('In nằm');
  });
});
