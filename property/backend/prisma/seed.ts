import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../src/password.js';

const prisma = new PrismaClient();
const demoPassword = 'HomeLink123!';

const demoUsers: Array<{ email: string; fullName: string; role: UserRole }> = [
  { email: 'superadmin@homelink.mn', fullName: 'Ерөнхий админ', role: UserRole.super_admin },
  { email: 'manager@homelink.mn', fullName: 'Бат-Эрдэнэ', role: UserRole.manager },
  { email: 'nyarav@homelink.mn', fullName: 'Сараа', role: UserRole.accountant },
  { email: 'staff@homelink.mn', fullName: 'Дорж', role: UserRole.staff },
  { email: 'resident@homelink.mn', fullName: 'Оршин суугч', role: UserRole.resident },
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'evergreen-residence' },
    update: { name: 'Evergreen Residence' },
    create: { name: 'Evergreen Residence', slug: 'evergreen-residence' },
  });
  const passwordHash = await hashPassword(demoPassword);

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        tenantId: user.role === UserRole.super_admin ? null : tenant.id,
        building: user.role === UserRole.resident ? 'A' : null,
        apartment: user.role === UserRole.resident ? '1203' : null,
        isActive: true,
      },
      create: {
        ...user,
        passwordHash,
        tenantId: user.role === UserRole.super_admin ? null : tenant.id,
        building: user.role === UserRole.resident ? 'A' : null,
        apartment: user.role === UserRole.resident ? '1203' : null,
      },
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('Unable to seed the database.', error instanceof Error ? error.message : '');
    await prisma.$disconnect();
    process.exit(1);
  });
