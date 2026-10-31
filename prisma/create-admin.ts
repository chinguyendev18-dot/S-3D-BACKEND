/**
 * `npm run auth:create-admin -- --email you@example.com --password "..." [--name "Tên"]`
 * Creates a super admin, or gives an existing account that role and this password: the way back
 * in when nobody can sign in to the admin site any more.
 */
import { ensureAccount, prisma, seedRoles } from './seed-tools';

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1]?.trim() ?? '') : '';
}

async function main() {
  const email = arg('email').toLowerCase();
  const password = arg('password');
  if (!email || password.length < 6) {
    console.error('Cần --email và --password (ít nhất 6 ký tự).');
    process.exitCode = 1;
    return;
  }

  await seedRoles();
  const result = await ensureAccount(
    {
      email,
      kind: 'staff',
      name: arg('name') || 'Quản trị S-3D',
      password,
      roleKey: 'super_admin',
    },
    true,
  );
  console.log(`${result.status}: ${email} là Quản trị hệ thống.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
