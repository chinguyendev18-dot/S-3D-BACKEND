/**
 * The workshop's print pricing, moved here from the storefront and the admin
 * (features/products/lib/print-quote.ts, productTemplate.ts) so the shop, the app and checkout
 * all price a print the same way, with the numbers kept in the database (GET /print-options).
 */

export type UpAxis = 'x' | 'y' | 'z';

export interface PrintPricing {
  /** Each colour beyond the first: filament changes, purge waste and setup (VND). */
  extraColorFee: number;
  machineRatePerHour: number;
  maxHeightMm: number;
  /** At most this many filament colours in one print (the printer's colour changer). */
  maxPrintColors: number;
  minHeightMm: number;
  setupFee: number;
}

export const DEFAULT_PRICING: PrintPricing = {
  extraColorFee: 15_000,
  machineRatePerHour: 15_000,
  maxHeightMm: 250,
  maxPrintColors: 4,
  minHeightMm: 20,
  setupFee: 20_000,
};

export interface MaterialSpec {
  /** g/cm³ */
  density: number;
  /** Share of the solid volume actually printed (walls + infill / hollowing). */
  fill: number;
  gramsPerHour: number;
  id: string;
  label: string;
  pricePerGram: number;
}

export interface ModelMetrics {
  /** Size of the model at its original scale, in model units. */
  size: { x: number; y: number; z: number };
  /** Enclosed volume at the original scale, in model units³. */
  volume: number;
}

export interface Quote {
  dims: { x: number; y: number; z: number };
  grams: number;
  hours: number;
  price: number;
}

/** The parts of a product its price depends on. */
export interface PricedProduct {
  defaultHeightMm: number;
  fixedPrice: number | null;
  metrics: ModelMetrics | null;
  priceMode: 'co_dinh' | 'tu_dong';
  upAxis: UpAxis;
}

const roundUpThousand = (value: number) => Math.ceil(value / 1000) * 1000;

/** Print quote for a model scaled to `heightMm`. */
export function quote(
  metrics: ModelMetrics,
  upAxis: UpAxis,
  heightMm: number,
  material: MaterialSpec,
  pricing: PrintPricing,
): Quote {
  const factor = heightMm / (metrics.size[upAxis] || 1);
  const volumeMm3 = metrics.volume * factor ** 3;
  const grams = (volumeMm3 / 1000) * material.density * material.fill;
  const hours = 0.25 + grams / material.gramsPerHour;
  const raw =
    pricing.setupFee +
    grams * material.pricePerGram +
    hours * pricing.machineRatePerHour;

  return {
    dims: {
      x: metrics.size.x * factor,
      y: metrics.size.y * factor,
      z: metrics.size.z * factor,
    },
    grams: Math.round(grams * 10) / 10,
    hours: Math.round(hours * 10) / 10,
    price: roundUpThousand(raw),
  };
}

/** Fixed price for the default height, scaled by printed volume for another height. */
export function fixedPriceAt(
  fixedPrice: number,
  defaultHeightMm: number,
  heightMm: number,
) {
  return roundUpThousand(fixedPrice * (heightMm / defaultHeightMm) ** 3);
}

/**
 * The customer's price at a height: the fixed price (scaled), or the formula for the material.
 * null when an automatic price has no model to measure.
 */
export function priceAt(
  product: PricedProduct,
  heightMm: number,
  material: MaterialSpec | undefined,
  pricing: PrintPricing,
) {
  if (product.priceMode === 'co_dinh' && product.fixedPrice) {
    return fixedPriceAt(product.fixedPrice, product.defaultHeightMm, heightMm);
  }
  if (!product.metrics || !material) return null;
  return quote(product.metrics, product.upAxis, heightMm, material, pricing)
    .price;
}

/** Heights offered as quick picks (the product page also has a slider). */
export function heightPresets(
  minHeightMm: number,
  defaultHeightMm: number,
  maxHeightMm: number,
) {
  return [
    ...new Set([
      minHeightMm,
      Math.round((minHeightMm + defaultHeightMm) / 2),
      defaultHeightMm,
      Math.round((defaultHeightMm + maxHeightMm) / 2),
      maxHeightMm,
    ]),
  ];
}

export function multiColorFee(colorCount: number, pricing: PrintPricing) {
  return (
    Math.max(0, Math.min(pricing.maxPrintColors, colorCount) - 1) *
    pricing.extraColorFee
  );
}
