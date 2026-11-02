/**
 * `npm run db:seed`: every step below, in order. Run again at any time: what exists stays.
 * One step only: `npm run db:seed -- --only=accounts` (several: --only=roles,accounts).
 *
 * The demo data the apps show (catalogue, blog, policies, shipping zones, discounts) comes from
 * prisma/seed-data/ (see index.ts there); product photos are put on R2.
 */
import { prisma, seedRoles } from './seed-tools';
import { seedAccounts } from './seeds/accounts';
import { seedCatalog } from './seeds/catalog';
import { seedContent, seedDiscounts, seedShipping } from './seeds/content';

interface SeedStep {
  name: string;
  run: () => Promise<void>;
  /** Left out unless asked for by name, or when this says so. */
  skip?: () => boolean;
}

const STEPS: SeedStep[] = [
  {
    name: 'roles',
    run: async () => {
      await seedRoles();
      console.log('Vai trò: đã có đủ vai trò mặc định.');
    },
  },
  {
    name: 'accounts',
    run: seedAccounts,
    skip: () => process.env.SEED_SAMPLE_ACCOUNTS === 'false',
  },
  { name: 'catalog', run: seedCatalog },
  { name: 'content', run: seedContent },
  { name: 'shipping', run: seedShipping },
  { name: 'discounts', run: seedDiscounts },
];

function chosenSteps() {
  const only = process.argv
    .find((arg) => arg.startsWith('--only='))
    ?.slice('--only='.length)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (!only?.length) return STEPS.filter((step) => !step.skip?.());

  const unknown = only.filter(
    (name) => !STEPS.some((step) => step.name === name),
  );
  if (unknown.length) {
    throw new Error(
      `Không có bước seed: ${unknown.join(', ')}. Các bước: ${STEPS.map((step) => step.name).join(', ')}.`,
    );
  }
  return STEPS.filter((step) => only.includes(step.name));
}

async function main() {
  for (const step of chosenSteps()) {
    console.log(`== ${step.name}`);
    await step.run();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
