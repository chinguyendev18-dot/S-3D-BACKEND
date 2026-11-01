/**
 * The demo data every app will show once it reads from the backend, gathered on 2026-10-31 from
 * what each app had on its own:
 * - catalog.json: categories, products and their print settings (storefront S-3D-FRONTEND
 *   lib/s3d-catalog.ts, the list the app also used), materials, filament colours and pricing
 *   (features/products/lib/print-quote.ts), sizes and print areas (admin demo);
 * - content.json: blog (storefront), policies (storefront /api/legal-documents), FAQ and design
 *   templates (admin demo);
 * - shipping.json: countries and zones (admin demo), the 34 provinces (app);
 * - discounts.json: discount codes (admin demo);
 * - images/products: the product photos (storefront public/images/Products/web), to upload to R2.
 *
 * Dates are relative ("days ago", "ends in days") so a fresh seed always looks current. Money is
 * in VND. Each module's seed step (prisma/seed.ts) reads its part from here.
 */
import { join } from 'node:path';

import catalogJson from './catalog.json';
import contentJson from './content.json';
import discountsJson from './discounts.json';
import shippingJson from './shipping.json';

export type MaterialId = 'PETG' | 'PLA' | 'RESIN';

export interface SeedPrintSettings {
  /** Filament ids offered; empty: every filament of the material. */
  colors: string[];
  comparePrice: number | null;
  defaultColor: string;
  defaultHeightMm: number;
  defaultMaterial: MaterialId;
  fixedPrice: number | null;
  materials: MaterialId[];
  maxHeightMm: number;
  /** Size and volume of the model at its original scale. */
  metrics: { size: { x: number; y: number; z: number }; volume: number };
  minHeightMm: number;
  /** co_dinh: fixed price (scaled by height); tu_dong: computed from material and time. */
  priceMode: 'co_dinh' | 'tu_dong';
  upAxis: 'x' | 'y' | 'z';
}

export interface SeedCatalog {
  categories: {
    description: string;
    id: string;
    name: string;
    slug: string;
    sortOrder: number;
  }[];
  filaments: {
    hex: string;
    id: string;
    materials: MaterialId[];
    name: string;
    sortOrder: number;
  }[];
  materials: {
    /** g/cm³ */
    density: number;
    /** Share of the solid volume actually printed. */
    fill: number;
    gramsPerHour: number;
    id: MaterialId;
    label: string;
    pricePerGram: number;
  }[];
  pricing: {
    extraColorFee: number;
    machineRatePerHour: number;
    maxHeightMm: number;
    maxPrintColors: number;
    minHeightMm: number;
    setupFee: number;
  };
  printAreas: {
    code: string;
    heightCm: number;
    id: string;
    isActive: boolean;
    name: string;
    widthCm: number;
  }[];
  products: {
    categoryId: string;
    createdDaysAgo: number;
    description: string;
    id: string;
    /** A file in images/products. */
    image: string | null;
    isActive: boolean;
    /** As shown to customers, e.g. "PLA trắng". */
    material: string;
    name: string;
    oldPrice: number | null;
    price: number;
    print: SeedPrintSettings;
    sku: string;
    slug: string;
    sortOrder: number;
    stock: number;
  }[];
  sizes: {
    code: string;
    heightMm: number;
    id: string;
    isActive: boolean;
    name: string;
    sortOrder: number;
  }[];
}

export interface SeedContent {
  blogCategories: {
    id: string;
    name: string;
    slug: string;
    sortOrder: number;
  }[];
  blogPosts: {
    categoryId: string;
    /** HTML. */
    content: string;
    createdDaysAgo: number;
    description: string;
    id: string;
    image: string | null;
    slug: string;
    title: string;
  }[];
  faq: { answer: string; question: string; sortOrder: number }[];
  /** One HTML document per type: terms_of_service, privacy_policy, cookie_policy… */
  legalDocuments: { content: string; title: string; type: string }[];
  templateCategories: {
    description: string;
    id: string;
    name: string;
    slug: string;
    sortOrder: number;
  }[];
  templates: {
    categoryId: string;
    id: string;
    image: string | null;
    isActive: boolean;
    name: string;
    sortOrder: number;
  }[];
}

export interface SeedShipping {
  countries: { code: string; currency: string; iso3: string; name: string }[];
  provinces: { cities: string[]; provinces: string[] };
  zones: {
    basePrice: number;
    code: string;
    countryCodes: string[];
    estimatedDays: string;
    id: string;
    isActive: boolean;
    name: string;
    sortOrder: number;
  }[];
}

export interface SeedDiscount {
  categoryIds: string[];
  /** Sales channels it is limited to (empty: all). */
  channels: string[];
  code: string;
  description: string;
  /** null: no end. Negative: already ended. */
  endsInDays: number | null;
  id: string;
  isActive: boolean;
  materials: string[];
  maxDiscount: number | null;
  minOrder: number;
  name: string;
  perCustomerLimit: number | null;
  scope: 'all' | 'category' | 'material';
  /** null: already started. */
  startsInDays: number | null;
  type: 'fixed' | 'free_shipping' | 'percent';
  usageLimit: number | null;
  /** Percent for "percent", VND for "fixed". */
  value: number;
}

export const SEED_CATALOG = catalogJson as SeedCatalog;
export const SEED_CONTENT = contentJson as SeedContent;
export const SEED_SHIPPING = shippingJson as SeedShipping;
export const SEED_DISCOUNTS = discountsJson as SeedDiscount[];

/** Where the files named in the fixtures are (product photos: images/products/<image>). */
export const SEED_IMAGES_DIR = join(__dirname, 'images');

/** "N days ago" / "in N days" as a date, from now. */
export const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000);
