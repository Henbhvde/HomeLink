import 'dotenv/config';
import { PrismaClient, TenantAccessStatus, SubscriptionStatus } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.POSTGRES_URL ? process.env.POSTGRES_URL.replace('localhost', '127.0.0.1') : undefined,
    },
  },
});

async function main() {
  await prisma.$connect();
  console.log('Connected to Postgres.');

  const filePath = process.env.DATA_FILE ?? join(process.cwd(), 'data', 'homelink-data.json');
  console.log(`Reading JSON store from: ${filePath}`);

  const raw = await readFile(filePath, 'utf8');
  const store = JSON.parse(raw);

  const tenants = store.platformTenants || [];
  const buildings = store.scopes?.['manager-buildings'] || [];

  console.log(`Found ${tenants.length} tenants and ${buildings.length} buildings to migrate.`);

  // 1. Migrate Tenants & Subscriptions
  for (const t of tenants) {
    let status: TenantAccessStatus = TenantAccessStatus.active;
    if (t.status === 'pending') status = TenantAccessStatus.pending;
    else if (t.status === 'trial') status = TenantAccessStatus.trial;
    else if (t.status === 'overdue') status = TenantAccessStatus.overdue;
    else if (t.status === 'read_only') status = TenantAccessStatus.read_only;
    else if (t.status === 'rejected') status = TenantAccessStatus.rejected;

    const tenant = await prisma.tenant.upsert({
      where: { slug: t.id },
      update: {
        name: t.name,
        status: status,
      },
      create: {
        id: t.id,
        name: t.name,
        slug: t.id,
        status: status,
      },
    });

    // Map Subscription Status
    let subStatus: SubscriptionStatus = SubscriptionStatus.active;
    if (t.status === 'trial') subStatus = SubscriptionStatus.trialing;
    else if (t.status === 'overdue') subStatus = SubscriptionStatus.past_due;

    await prisma.subscription.upsert({
      where: { tenantId: tenant.id },
      update: {
        plan: t.plan,
        status: subStatus,
        currentPeriodStart: t.createdAt ? new Date(t.createdAt) : undefined,
        currentPeriodEnd: t.trialEndsAt ? new Date(t.trialEndsAt) : undefined,
      },
      create: {
        tenantId: tenant.id,
        plan: t.plan,
        status: subStatus,
        currentPeriodStart: t.createdAt ? new Date(t.createdAt) : undefined,
        currentPeriodEnd: t.trialEndsAt ? new Date(t.trialEndsAt) : undefined,
      },
    });
  }
  console.log('Tenants and Subscriptions migrated successfully.');

  // 2. Migrate Buildings, Entrances, Floors, and Units (associated with the 'evergreen' tenant)
  const targetTenantId = 'evergreen';
  const tenantExists = await prisma.tenant.findUnique({ where: { slug: targetTenantId } });

  if (tenantExists) {
    for (const b of buildings) {
      const building = await prisma.building.upsert({
        where: {
          tenantId_code: {
            tenantId: tenantExists.id,
            code: b.code,
          },
        },
        update: {
          name: b.name,
          address: b.detail || null,
        },
        create: {
          tenantId: tenantExists.id,
          name: b.name,
          code: b.code,
          address: b.detail || null,
        },
      });

      // Generate Entrances, Floors, Units
      const totalEntrances = b.entrances || 1;
      const totalFloors = b.floors || 1;
      const totalApartments = b.apartments || 0;

      let unitsCreated = 0;
      const apartmentsPerFloor = Math.ceil(totalApartments / (totalEntrances * totalFloors)) || 1;

      for (let eIdx = 1; eIdx <= totalEntrances; eIdx++) {
        const entranceName = `Орц ${eIdx}`;
        const entrance = await prisma.entrance.upsert({
          where: {
            buildingId_name: {
              buildingId: building.id,
              name: entranceName,
            },
          },
          update: {},
          create: {
            tenantId: tenantExists.id,
            buildingId: building.id,
            name: entranceName,
          },
        });

        for (let fIdx = 1; fIdx <= totalFloors; fIdx++) {
          const floor = await prisma.floor.upsert({
            where: {
              entranceId_number: {
                entranceId: entrance.id,
                number: fIdx,
              },
            },
            update: {},
            create: {
              tenantId: tenantExists.id,
              entranceId: entrance.id,
              number: fIdx,
            },
          });

          for (let uIdx = 1; uIdx <= apartmentsPerFloor; uIdx++) {
            if (unitsCreated >= totalApartments) break;
            const unitNumber = `${fIdx}${String(uIdx).padStart(2, '0')}`;
            await prisma.unit.upsert({
              where: {
                floorId_number: {
                  floorId: floor.id,
                  number: unitNumber,
                },
              },
              update: {},
              create: {
                tenantId: tenantExists.id,
                floorId: floor.id,
                number: unitNumber,
              },
            });
            unitsCreated++;
          }
        }
      }
    }
    console.log('Buildings, Entrances, Floors, and Units migrated successfully.');
  }

  // 3. Populate AppState table for backward compatibility
  await prisma.appState.upsert({
    where: { key: 'platform-tenants' },
    update: { value: tenants },
    create: { key: 'platform-tenants', value: tenants },
  });

  await prisma.appState.upsert({
    where: { key: 'evergreen:manager-buildings' },
    update: { value: buildings },
    create: { key: 'evergreen:manager-buildings', value: buildings },
  });
  console.log('AppState values populated successfully for backward compatibility.');

  console.log('Data migration completed successfully!');
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('Migration failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
