import { SEED_CATALOG } from '../../prisma/seed-data';
import {
  DEFAULT_PRICING,
  fixedPriceAt,
  heightPresets,
  multiColorFee,
  priceAt,
  quote,
  type MaterialSpec,
} from './pricing';

const PLA = SEED_CATALOG.materials.find(
  (material) => material.id === 'PLA',
) as MaterialSpec;

/** The same numbers the storefront's print-quote.ts gave, so prices do not move with the switch. */
describe('pricing', () => {
  it('scales a fixed price by the printed volume, rounded up to the thousand', () => {
    expect(fixedPriceAt(259_000, 100, 100)).toBe(259_000);
    expect(fixedPriceAt(259_000, 100, 140)).toBe(711_000);
    expect(fixedPriceAt(259_000, 100, 50)).toBe(33_000);
  });

  it('quotes a model from its volume, material and print time', () => {
    const metrics = { size: { x: 100, y: 100, z: 100 }, volume: 500_000 };
    const result = quote(metrics, 'y', 100, PLA, DEFAULT_PRICING);
    // 500 cm³ × 1.24 g/cm³ × 35 % = 217 g; 0.25 h + 217 / 13 h.
    expect(result.grams).toBe(217);
    expect(result.hours).toBeCloseTo(16.9, 1);
    expect(result.price).toBe(
      Math.ceil((20_000 + 217 * 900 + (0.25 + 217 / 13) * 15_000) / 1000) *
        1000,
    );
  });

  it('prices a fixed product without a model, but an automatic one needs it', () => {
    const fixed = {
      defaultHeightMm: 100,
      fixedPrice: 300_000,
      metrics: null,
      priceMode: 'co_dinh' as const,
      upAxis: 'y' as const,
    };
    expect(priceAt(fixed, 100, PLA, DEFAULT_PRICING)).toBe(300_000);
    expect(
      priceAt({ ...fixed, priceMode: 'tu_dong' }, 100, PLA, DEFAULT_PRICING),
    ).toBeNull();
  });

  it('offers five heights around the default, without repeats', () => {
    expect(heightPresets(40, 100, 200)).toEqual([40, 70, 100, 150, 200]);
    expect(heightPresets(100, 100, 100)).toEqual([100]);
  });

  it('charges each colour after the first, up to the changer', () => {
    expect(multiColorFee(1, DEFAULT_PRICING)).toBe(0);
    expect(multiColorFee(3, DEFAULT_PRICING)).toBe(30_000);
    expect(multiColorFee(9, DEFAULT_PRICING)).toBe(45_000);
  });
});
