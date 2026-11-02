import { AppException } from '../common/app-exception';
import type { PrismaService } from '../prisma/prisma.service';
import type { PrintOptionsDto } from './dto/print-options.dto';
import { PrintOptionsService } from './print-options.service';

const options = (): PrintOptionsDto => ({
  filaments: [
    { hex: '#FFFFFF', id: 'trang', materials: ['PLA'], name: 'Trắng' },
    { hex: '#000000', id: 'den', materials: ['PLA'], name: 'Đen' },
  ],
  materials: [
    {
      density: 1.24,
      fill: 0.35,
      gramsPerHour: 13,
      id: 'PLA',
      label: 'Nhựa PLA',
      pricePerGram: 900,
    },
  ],
  pricing: {
    extraColorFee: 15000,
    machineRatePerHour: 15000,
    maxHeightMm: 200,
    maxPrintColors: 8,
    minHeightMm: 40,
    setupFee: 20000,
  },
});

const product = {
  colors: ['trang'],
  defaultColor: 'trang',
  defaultMaterial: 'PLA',
  materials: ['PLA'],
  maxHeightMm: 200,
  minHeightMm: 40,
  name: 'Mèo chibi',
};

function service(products = [product]) {
  const $transaction = jest.fn(() => Promise.resolve([]));
  const prisma = {
    $transaction,
    filament: {
      findMany: jest.fn(() => Promise.resolve([])),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    printMaterial: {
      findMany: jest.fn(() => Promise.resolve([])),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    product: { findMany: jest.fn(() => Promise.resolve(products)) },
    setting: {
      findUnique: jest.fn(() => Promise.resolve(null)),
      upsert: jest.fn(),
    },
  };
  return {
    $transaction,
    options: new PrintOptionsService(prisma as unknown as PrismaService),
  };
}

const refused = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (problem: unknown) => problem,
  );
  expect(error).toBeInstanceOf(AppException);
  return (error as AppException).getStatus();
};

describe('PrintOptionsService.replace', () => {
  it('saves a whole, consistent set', async () => {
    const { $transaction, options: service_ } = service();
    await service_.replace(options());
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it('refuses a colour of a material that does not exist', async () => {
    const input = options();
    input.filaments[0].materials = ['KHONG_CO'];
    expect(await refused(service().options.replace(input))).toBe(400);
  });

  it('refuses a material without any colour', async () => {
    const input = options();
    input.materials.push({ ...input.materials[0], id: 'PETG', label: 'PETG' });
    expect(await refused(service().options.replace(input))).toBe(400);
  });

  it('refuses repeated ids', async () => {
    const input = options();
    input.filaments.push({ ...input.filaments[0] });
    expect(await refused(service().options.replace(input))).toBe(400);
  });

  it('refuses heights the wrong way round', async () => {
    const input = options();
    input.pricing.minHeightMm = 300;
    expect(await refused(service().options.replace(input))).toBe(400);
  });

  it('keeps a colour a product still uses', async () => {
    const input = options();
    input.filaments = input.filaments.filter((item) => item.id !== 'trang');
    const { $transaction, options: service_ } = service();
    expect(await refused(service_.replace(input))).toBe(409);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('keeps a material a product still uses', async () => {
    const input = options();
    input.materials[0].id = 'PETG';
    input.filaments.forEach((item) => (item.materials = ['PETG']));
    expect(await refused(service().options.replace(input))).toBe(409);
  });

  it('keeps the height range products need', async () => {
    const input = options();
    input.pricing.maxHeightMm = 150;
    expect(await refused(service().options.replace(input))).toBe(409);
  });

  it('lets a colour nobody uses go', async () => {
    const input = options();
    input.filaments = input.filaments.filter((item) => item.id !== 'den');
    const { $transaction, options: service_ } = service();
    await service_.replace(input);
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});
