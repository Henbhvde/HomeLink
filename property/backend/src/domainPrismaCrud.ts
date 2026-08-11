import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

type Row = Record<string, unknown>;
type DomainAdapter = {
  list(prisma: PrismaClient, tenantId: string): Promise<unknown[]>;
  replace(prisma: PrismaClient, tenantId: string, rows: unknown[]): Promise<unknown[]>;
};

const asRows = (value: unknown) => Array.isArray(value) ? value.filter((item): item is Row => typeof item === 'object' && item !== null && !Array.isArray(item)) : [];
const text = (row: Row, key: string, fallback = '') => String(row[key] ?? fallback);
const optionalText = (row: Row, key: string) => row[key] === undefined || row[key] === null || row[key] === '' ? null : String(row[key]);
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const money = (value: unknown) => Math.round(numberValue(value) * 100) / 100;
const now = () => new Date();
const statusMap = (value: string, map: Record<string, string>, fallback: string) => map[value] ?? map[value.toLowerCase()] ?? fallback;
const meterType = (value: string) => value.toLowerCase().includes('water') || value.includes('Ус') || value.includes('Ñ') ? 'water' : 'electricity';
const maintenancePriority = (value: string) => statusMap(value, { urgent: 'urgent', high: 'high', normal: 'normal', low: 'low', 'Яаралтай': 'urgent', 'Өндөр': 'high', 'Дунд': 'normal', 'Энгийн': 'normal', 'Бага': 'low' }, 'normal');
const maintenanceStatus = (value: string) => statusMap(value.replace(/[_\s-]/g, '').toLowerCase(), { open: 'open', submitted: 'open', assigned: 'assigned', inprogress: 'in_progress', done: 'resolved', resolved: 'resolved', closed: 'closed', 'шинэ': 'open', 'хүлээнавсан': 'assigned', 'ажиллажбайгаа': 'in_progress', 'ажиллажбайна': 'in_progress', 'дууссан': 'resolved', 'хаагдсан': 'closed' }, 'open');
const workOrderStatus = (value: string) => statusMap(value.replace(/[_\s-]/g, '').toLowerCase(), { assigned: 'assigned', inprogress: 'in_progress', done: 'completed', completed: 'completed' }, 'assigned');
async function ensureBuilding(prisma: PrismaClient, tenantId: string, code: string) {
  const id = `building-${tenantId}-${code}`;
  await prisma.$executeRaw`INSERT INTO "Building" ("id","tenantId","name","code","createdAt","updatedAt") VALUES (${id},${tenantId},${`${code} байр`},${code},NOW(),NOW()) ON CONFLICT ("tenantId","code") DO UPDATE SET "name"=EXCLUDED."name","updatedAt"=NOW()`;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Building" WHERE "tenantId"=${tenantId} AND "code"=${code} LIMIT 1`;
  return rows[0]?.id ?? id;
}

async function ensureUnit(prisma: PrismaClient, tenantId: string, label: string) {
  const [code = 'A', number = label || '0001'] = label.includes('-') ? label.split('-', 2) : ['A', label || '0001'];
  const buildingId = await ensureBuilding(prisma, tenantId, code);
  const entranceName = '1';
  await prisma.$executeRaw`INSERT INTO "Entrance" ("id","tenantId","buildingId","name","createdAt","updatedAt") VALUES (${`entrance-${buildingId}-1`},${tenantId},${buildingId},${entranceName},NOW(),NOW()) ON CONFLICT ("buildingId","name") DO UPDATE SET "updatedAt"=NOW()`;
  const entrances = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Entrance" WHERE "buildingId"=${buildingId} AND "name"=${entranceName} LIMIT 1`;
  const entranceId = entrances[0].id;
  const floorNumber = Math.max(1, Number.parseInt(number.slice(0, -2), 10) || 1);
  await prisma.$executeRaw`INSERT INTO "Floor" ("id","tenantId","entranceId","number","createdAt","updatedAt") VALUES (${`floor-${entranceId}-${floorNumber}`},${tenantId},${entranceId},${floorNumber},NOW(),NOW()) ON CONFLICT ("entranceId","number") DO UPDATE SET "updatedAt"=NOW()`;
  const floors = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Floor" WHERE "entranceId"=${entranceId} AND "number"=${floorNumber} LIMIT 1`;
  const floorId = floors[0].id;
  await prisma.$executeRaw`INSERT INTO "Unit" ("id","tenantId","floorId","number","status","createdAt","updatedAt") VALUES (${`unit-${tenantId}-${code}-${number}`},${tenantId},${floorId},${number},CAST('occupied' AS "UnitStatus"),NOW(),NOW()) ON CONFLICT ("floorId","number") DO UPDATE SET "status"=CAST('occupied' AS "UnitStatus"),"updatedAt"=NOW()`;
  const units = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "Unit"."id" FROM "Unit" JOIN "Floor" ON "Floor"."id"="Unit"."floorId" JOIN "Entrance" ON "Entrance"."id"="Floor"."entranceId" JOIN "Building" ON "Building"."id"="Entrance"."buildingId" WHERE "Building"."tenantId"=${tenantId} AND "Building"."code"=${code} AND "Unit"."number"=${number} LIMIT 1`;
  return units[0].id;
}

const adapters: Record<string, DomainAdapter> = {
  'manager-buildings': {
    async list(prisma, tenantId) {
      return prisma.$queryRaw`SELECT "Building"."id","Building"."tenantId","Building"."name","Building"."code",COUNT(DISTINCT "Entrance"."id")::int AS "entrances",COUNT(DISTINCT "Floor"."id")::int AS "floors",COUNT(DISTINCT "Unit"."id")::int AS "apartments",COALESCE("Building"."address",'') AS "detail",'Идэвхтэй' AS "status" FROM "Building" LEFT JOIN "Entrance" ON "Entrance"."buildingId"="Building"."id" LEFT JOIN "Floor" ON "Floor"."entranceId"="Entrance"."id" LEFT JOIN "Unit" ON "Unit"."floorId"="Floor"."id" WHERE "Building"."tenantId"=${tenantId} GROUP BY "Building"."id" ORDER BY "Building"."code"`;
    },
    async replace(prisma, tenantId, rows) {
      const items = asRows(rows);
      await prisma.$transaction(async (tx) => {
        for (const row of items) await tx.$executeRaw`INSERT INTO "Building" ("id","tenantId","name","code","address","createdAt","updatedAt") VALUES (${text(row, 'id', randomUUID())},${tenantId},${text(row, 'name', text(row, 'code', 'Building'))},${text(row, 'code', text(row, 'id', randomUUID()))},${optionalText(row, 'detail')},NOW(),NOW()) ON CONFLICT ("tenantId","code") DO UPDATE SET "name"=EXCLUDED."name","address"=EXCLUDED."address","updatedAt"=NOW()`;
      });
      return this.list(prisma, tenantId);
    },
  },
  'meter-readings': {
    async list(prisma, tenantId) {
      return prisma.$queryRaw`SELECT "MeterReading"."id","MeterReading"."tenantId",CONCAT("Building"."code",'-',"Unit"."number") AS "unit",'' AS "resident","Meter"."type"::text AS "type","MeterReading"."previousValue"::float AS "previous","MeterReading"."currentValue"::float AS "current","MeterReading"."usage"::float AS "averageUsage","MeterReading"."status"::text AS "status","MeterReading"."note" AS "issue","MeterReading"."photoUrl" AS "proofName" FROM "MeterReading" JOIN "Meter" ON "Meter"."id"="MeterReading"."meterId" JOIN "Unit" ON "Unit"."id"="Meter"."unitId" JOIN "Floor" ON "Floor"."id"="Unit"."floorId" JOIN "Entrance" ON "Entrance"."id"="Floor"."entranceId" JOIN "Building" ON "Building"."id"="Entrance"."buildingId" WHERE "MeterReading"."tenantId"=${tenantId} ORDER BY "MeterReading"."readAt" DESC`;
    },
    async replace(prisma, tenantId, rows) {
      const items = asRows(rows);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM "MeterReading" WHERE "tenantId"=${tenantId}`;
        for (const row of items) {
          const unitId = await ensureUnit(tx as unknown as PrismaClient, tenantId, text(row, 'unit', 'A-0001'));
          const type = meterType(text(row, 'type'));
          const serial = `${unitId}-${type}`;
          await tx.$executeRaw`INSERT INTO "Meter" ("id","tenantId","unitId","serialNumber","type","isActive","createdAt","updatedAt") VALUES (${`meter-${serial}`},${tenantId},${unitId},${serial},CAST(${type} AS "MeterType"),TRUE,NOW(),NOW()) ON CONFLICT ("tenantId","serialNumber") DO UPDATE SET "isActive"=TRUE,"updatedAt"=NOW()`;
          const meters = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Meter" WHERE "tenantId"=${tenantId} AND "serialNumber"=${serial} LIMIT 1`;
          const previous = numberValue(row.previous);
          const current = numberValue(row.current, previous);
          await tx.$executeRaw`INSERT INTO "MeterReading" ("id","tenantId","meterId","previousValue","currentValue","usage","status","readAt","photoUrl","note","createdAt","updatedAt") VALUES (${text(row, 'id', randomUUID())},${tenantId},${meters[0].id},${previous},${current},${Math.max(0, current - previous)},CAST(${statusMap(text(row, 'status'), { approved: 'approved', pending: 'pending', flagged: 'flagged', missing: 'pending' }, 'pending')} AS "MeterReadingStatus"),${now()},${optionalText(row, 'proofName')},${optionalText(row, 'issue')},NOW(),NOW())`;
        }
      });
      return this.list(prisma, tenantId);
    },
  },
  'billing-invoices': {
    async list(prisma, tenantId) {
      return prisma.$queryRaw`SELECT "Invoice"."id","Invoice"."tenantId",CONCAT("Building"."code",'-',"Unit"."number") AS "unit",COALESCE("User"."fullName",'') AS "resident","Invoice"."totalAmount"::text AS "amount",TO_CHAR("Invoice"."dueAt",'YYYY.MM.DD') AS "due","Invoice"."status"::text AS "status" FROM "Invoice" JOIN "Unit" ON "Unit"."id"="Invoice"."unitId" JOIN "Floor" ON "Floor"."id"="Unit"."floorId" JOIN "Entrance" ON "Entrance"."id"="Floor"."entranceId" JOIN "Building" ON "Building"."id"="Entrance"."buildingId" LEFT JOIN "ResidentProfile" ON "ResidentProfile"."id"="Invoice"."residentProfileId" LEFT JOIN "User" ON "User"."id"="ResidentProfile"."userId" WHERE "Invoice"."tenantId"=${tenantId} ORDER BY "Invoice"."createdAt" DESC`;
    },
    async replace(prisma, tenantId, rows) {
      const items = asRows(rows);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM "Invoice" WHERE "tenantId"=${tenantId} AND "status"=CAST('draft' AS "InvoiceStatus")`;
        for (const row of items) {
          const unitId = await ensureUnit(tx as unknown as PrismaClient, tenantId, text(row, 'unit', 'A-0001'));
          const total = money(row.amount);
          const id = text(row, 'id', randomUUID());
          await tx.$executeRaw`INSERT INTO "Invoice" ("id","tenantId","unitId","number","status","periodStart","periodEnd","dueAt","subtotal","taxAmount","totalAmount","createdAt","updatedAt") VALUES (${id},${tenantId},${unitId},${id},CAST(${statusMap(text(row, 'status'), { due: 'sent', paid: 'paid', overdue: 'overdue', draft: 'draft', approved: 'approved' }, 'draft')} AS "InvoiceStatus"),NOW(),NOW(),NOW(),${total},0,${total},NOW(),NOW()) ON CONFLICT ("tenantId","number") DO UPDATE SET "status"=EXCLUDED."status","totalAmount"=EXCLUDED."totalAmount","subtotal"=EXCLUDED."subtotal","updatedAt"=NOW()`;
        }
      });
      return this.list(prisma, tenantId);
    },
  },
  'payment-records': {
    async list(prisma, tenantId) {
      return prisma.$queryRaw`SELECT "id","tenantId","reference","method","status"::text AS "status","amount"::text AS "amount","paidAt" FROM "Payment" WHERE "tenantId"=${tenantId} ORDER BY "createdAt" DESC`;
    },
    async replace(prisma, tenantId, rows) {
      const items = asRows(rows);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM "Payment" WHERE "tenantId"=${tenantId}`;
        for (const row of items) await tx.$executeRaw`INSERT INTO "Payment" ("id","tenantId","reference","method","status","amount","paidAt","createdAt","updatedAt") VALUES (${text(row, 'id', randomUUID())},${tenantId},${text(row, 'reference', text(row, 'id', randomUUID()))},${text(row, 'method', 'manual')},CAST(${statusMap(text(row, 'status'), { confirmed: 'confirmed', paid: 'confirmed', pending: 'pending', failed: 'failed' }, 'confirmed')} AS "PaymentStatus"),${money(row.amount)},${now()},NOW(),NOW())`;
      });
      return this.list(prisma, tenantId);
    },
  },
  'maintenance-requests': {
    async list(prisma, tenantId) {
      const requests = await prisma.maintenanceRequest.findMany({
        where: { tenantId }, orderBy: { createdAt: 'desc' },
        include: {
          requesterProfile: { include: { user: { select: { fullName: true, email: true } } } },
          unit: { include: { floor: { include: { entrance: { include: { building: true } } } } } },
          workOrders: { orderBy: { createdAt: 'desc' }, take: 1, include: { assignee: { select: { fullName: true, email: true } } } },
        },
      });
      return requests.map((request) => {
        const workOrder = request.workOrders[0];
        let details: Row = {};
        if (workOrder?.notes?.trim().startsWith('{')) try { details = JSON.parse(workOrder.notes) as Row; } catch { details = {}; }
        return {
          id: request.id, tenantId, title: request.title, description: request.description,
          resident: request.requesterProfile?.user.fullName || request.requesterProfile?.user.email || 'СӨХ · нийтийн эзэмшил',
          priority: request.priority === 'urgent' ? 'Яаралтай' : request.priority === 'high' ? 'Өндөр' : request.priority === 'low' ? 'Бага' : 'Дунд',
          status: request.status === 'open' ? 'Шинэ' : request.status === 'assigned' ? 'Хүлээн авсан' : request.status === 'in_progress' ? 'Ажиллаж байгаа' : 'Дууссан',
          unit: text(details, 'location') || (request.unit ? `${request.unit.floor.entrance.building.code}-${request.unit.number}` : 'Нийтийн эзэмшил'),
          assignee: workOrder?.assignee?.fullName || workOrder?.assignee?.email || (!workOrder?.assignee && workOrder?.notes && !workOrder.notes.trim().startsWith('{') ? workOrder.notes : 'Оноогоогүй'),
          date: request.createdAt.toISOString().slice(0, 10), response: text(details, 'response'), completionReport: text(details, 'completionReport'), cost: numberValue(details.cost), attachment: text(details, 'attachment') || undefined,
        };
      });
    },
    async replace(prisma, tenantId, rows) {
      const items = asRows(rows);
      await prisma.$transaction(async (tx) => {
        for (const row of items) {
          const requestedId = text(row, 'id');
          const found = requestedId ? await tx.maintenanceRequest.findFirst({ where: { id: requestedId, tenantId }, select: { id: true, unitId: true, status: true, requesterProfile: { select: { userId: true } }, workOrders: { orderBy: { createdAt: 'desc' }, take: 1, select: { notes: true } } } }) : null;
          const id = found?.id ?? randomUUID();
          const unitLabel = text(row, 'unit');
          const managerTask = text(row, 'resident').startsWith('Менежер') || Boolean(found && !found.requesterProfile);
          const unitId = found?.unitId ?? (!managerTask && unitLabel && unitLabel !== 'Нийтийн эзэмшил' ? await ensureUnit(tx as unknown as PrismaClient, tenantId, unitLabel) : null);
          const assignee = text(row, 'assignee');
          const hasAssignee = Boolean(assignee && assignee !== 'Оноогоогүй');
          const status = hasAssignee ? (maintenanceStatus(text(row, 'status')) === 'open' ? 'assigned' : maintenanceStatus(text(row, 'status'))) : maintenanceStatus(text(row, 'status'));
          const description = text(row, 'description', found ? '' : 'СӨХ-өөс үүсгэсэн ажлын даалгавар');
          if (found) await tx.$executeRaw`UPDATE "MaintenanceRequest" SET "title"=${text(row, 'title', 'Засварын хүсэлт')},"description"=CASE WHEN ${description}='' THEN "description" ELSE ${description} END,"priority"=CAST(${maintenancePriority(text(row, 'priority'))} AS "MaintenancePriority"),"status"=CAST(${status} AS "MaintenanceStatus"),"resolvedAt"=CASE WHEN ${status} IN ('resolved','closed') THEN COALESCE("resolvedAt",NOW()) ELSE NULL END,"updatedAt"=NOW() WHERE "id"=${id} AND "tenantId"=${tenantId}`;
          else await tx.$executeRaw`INSERT INTO "MaintenanceRequest" ("id","tenantId","unitId","title","description","priority","status","createdAt","updatedAt") VALUES (${id},${tenantId},${unitId},${text(row, 'title', 'Засварын хүсэлт')},${description},CAST(${maintenancePriority(text(row, 'priority'))} AS "MaintenancePriority"),CAST(${status} AS "MaintenanceStatus"),NOW(),NOW())`;
          const assigneeUser = assignee && assignee !== 'Оноогоогүй' ? await tx.user.findFirst({ where: { tenantId, role: 'staff', isActive: true, OR: [{ fullName: assignee }, { email: assignee }] }, select: { id: true } }) : null;
          if (managerTask || assigneeUser || text(row, 'response') || text(row, 'completionReport') || numberValue(row.cost) || text(row, 'attachment')) {
            const notes = JSON.stringify({ response: text(row, 'response'), completionReport: text(row, 'completionReport'), cost: numberValue(row.cost), attachment: text(row, 'attachment'), location: managerTask ? unitLabel : '' });
            const workStatus = status === 'in_progress' ? 'in_progress' : status === 'resolved' || status === 'closed' ? 'completed' : 'assigned';
            await tx.$executeRaw`INSERT INTO "WorkOrder" ("id","tenantId","maintenanceRequestId","assigneeId","status","notes","createdAt","updatedAt") VALUES (${`wo-${id}`},${tenantId},${id},${assigneeUser?.id ?? null},CAST(${workStatus} AS "WorkOrderStatus"),${notes},NOW(),NOW()) ON CONFLICT ("id") DO UPDATE SET "assigneeId"=EXCLUDED."assigneeId","status"=EXCLUDED."status","notes"=EXCLUDED."notes","startedAt"=CASE WHEN EXCLUDED."status"=CAST('in_progress' AS "WorkOrderStatus") THEN COALESCE("WorkOrder"."startedAt",NOW()) ELSE "WorkOrder"."startedAt" END,"completedAt"=CASE WHEN EXCLUDED."status"=CAST('completed' AS "WorkOrderStatus") THEN COALESCE("WorkOrder"."completedAt",NOW()) ELSE NULL END,"updatedAt"=NOW()`;
          }
          if (found?.requesterProfile?.userId) {
            let previousResponse = '';
            const previousNotes = found.workOrders[0]?.notes;
            if (previousNotes?.trim().startsWith('{')) try { previousResponse = text(JSON.parse(previousNotes) as Row, 'response'); } catch { previousResponse = ''; }
            const response = text(row, 'response');
            if (found.status !== status || response !== previousResponse) {
              const body = response || `Таны хүсэлтийн төлөв “${text(row, 'status')}” болж шинэчлэгдлээ.`;
              await tx.notification.create({ data: { tenantId, userId: found.requesterProfile.userId, type: 'maintenance', title: 'Засварын хүсэлт шинэчлэгдлээ', body, route: '/resident' } });
            }
          }
        }
      });
      return this.list(prisma, tenantId);
    },
  },
  'resident-service-tickets': {
    async list(prisma, tenantId) {
      return prisma.$queryRaw`SELECT "id","title",COALESCE("description",'') AS "detail","priority"::text AS "category",TO_CHAR("createdAt",'YYYY.MM.DD') AS "createdAt",CASE WHEN "status" IN (CAST('resolved' AS "MaintenanceStatus"),CAST('closed' AS "MaintenanceStatus")) THEN 'done' WHEN "status"=CAST('in_progress' AS "MaintenanceStatus") THEN 'inProgress' WHEN "status"=CAST('assigned' AS "MaintenanceStatus") THEN 'assigned' ELSE 'submitted' END AS "status",FALSE AS "hasPhoto" FROM "MaintenanceRequest" WHERE "tenantId"=${tenantId} ORDER BY "createdAt" DESC`;
    },
    async replace(prisma, tenantId, rows) {
      const items = asRows(rows);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM "MaintenanceRequest" WHERE "tenantId"=${tenantId}`;
        for (const row of items) await tx.$executeRaw`INSERT INTO "MaintenanceRequest" ("id","tenantId","title","description","priority","status","createdAt","updatedAt") VALUES (${text(row, 'id', randomUUID())},${tenantId},${text(row, 'title', 'Request')},${text(row, 'detail')},CAST(${maintenancePriority(text(row, 'category'))} AS "MaintenancePriority"),CAST(${maintenanceStatus(text(row, 'status'))} AS "MaintenanceStatus"),NOW(),NOW())`;
      });
      return this.list(prisma, tenantId);
    },
  },
  'staff-work-orders': {
    async list(prisma, tenantId) {
      return prisma.$queryRaw`SELECT COALESCE(wo."id",CONCAT('wo-',mr."id")) AS "id",mr."title",COALESCE(CONCAT(b."code",'-',u."number"),'') AS "unit",COALESCE(CONCAT(b."name",' � ',u."number"),'') AS "place",mr."priority"::text AS "priority",TO_CHAR(mr."createdAt",'YYYY.MM.DD') AS "createdAt",'' AS "image",CASE WHEN COALESCE(wo."status"::text,'assigned')='completed' THEN 'done' ELSE COALESCE(wo."status"::text,'assigned') END AS "status",mr."description",wo."notes" AS "completionImage" FROM "MaintenanceRequest" mr LEFT JOIN "WorkOrder" wo ON wo."maintenanceRequestId"=mr."id" LEFT JOIN "Unit" u ON u."id"=mr."unitId" LEFT JOIN "Floor" f ON f."id"=u."floorId" LEFT JOIN "Entrance" e ON e."id"=f."entranceId" LEFT JOIN "Building" b ON b."id"=e."buildingId" WHERE mr."tenantId"=${tenantId} AND mr."status" IN (CAST('assigned' AS "MaintenanceStatus"),CAST('in_progress' AS "MaintenanceStatus"),CAST('resolved' AS "MaintenanceStatus")) ORDER BY mr."createdAt" DESC`;
    },
    async replace(prisma, tenantId, rows) {
      const items = asRows(rows);
      await prisma.$transaction(async (tx) => {
        for (const row of items) {
          const workOrderId = text(row, 'id');
          const found = await tx.$queryRaw<Array<{ id: string }>>`SELECT mr."id" FROM "MaintenanceRequest" mr LEFT JOIN "WorkOrder" wo ON wo."maintenanceRequestId"=mr."id" WHERE mr."tenantId"=${tenantId} AND (wo."id"=${workOrderId} OR CONCAT('wo-',mr."id")=${workOrderId}) LIMIT 1`;
          const requestId = found[0]?.id;
          if (!requestId) continue;
          const status = workOrderStatus(text(row, 'status'));
          await tx.$executeRaw`UPDATE "MaintenanceRequest" SET "status"=CAST(${status === 'completed' ? 'resolved' : status} AS "MaintenanceStatus"),"resolvedAt"=CASE WHEN ${status}='completed' THEN NOW() ELSE "resolvedAt" END,"updatedAt"=NOW() WHERE "tenantId"=${tenantId} AND "id"=${requestId}`;
          await tx.$executeRaw`INSERT INTO "WorkOrder" ("id","tenantId","maintenanceRequestId","status","notes","createdAt","updatedAt") VALUES (${workOrderId},${tenantId},${requestId},CAST(${status} AS "WorkOrderStatus"),${optionalText(row, 'completionImage')},NOW(),NOW()) ON CONFLICT ("id") DO UPDATE SET "status"=EXCLUDED."status","notes"=EXCLUDED."notes","startedAt"=CASE WHEN EXCLUDED."status"=CAST('in_progress' AS "WorkOrderStatus") THEN NOW() ELSE "WorkOrder"."startedAt" END,"completedAt"=CASE WHEN EXCLUDED."status"=CAST('completed' AS "WorkOrderStatus") THEN NOW() ELSE "WorkOrder"."completedAt" END,"updatedAt"=NOW()`;
        }
      });
      return this.list(prisma, tenantId);
    },
  },  'maintenance-announcements': {
    async list(prisma, tenantId) {
      return prisma.$queryRaw`SELECT "id","tenantId","title","body" AS "content","audience"::text AS "audience",TO_CHAR(COALESCE("publishedAt","createdAt"),'YYYY.MM.DD') AS "scheduledFor",0 AS "readCount",0 AS "recipientCount",ARRAY[]::text[] AS "readers" FROM "Announcement" WHERE "tenantId"=${tenantId} ORDER BY "createdAt" DESC`;
    },
    async replace(prisma, tenantId, rows) {
      const items = asRows(rows);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM "Announcement" WHERE "tenantId"=${tenantId}`;
        for (const row of items) await tx.$executeRaw`INSERT INTO "Announcement" ("id","tenantId","title","body","audience","publishedAt","createdAt","updatedAt") VALUES (${text(row, 'id', randomUUID())},${tenantId},${text(row, 'title', 'Announcement')},${text(row, 'content')},CAST('all' AS "AnnouncementAudience"),NOW(),NOW(),NOW())`;
      });
      return this.list(prisma, tenantId);
    },
  },
};

export const getDomainPrismaAdapter = (scope: string) => adapters[scope];


