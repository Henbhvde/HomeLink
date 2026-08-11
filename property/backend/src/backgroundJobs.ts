import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { z } from 'zod';
import type { invoiceGenerationSchema } from './validation.js';
import { ensureRedisConnection } from './redis.js';
import { redisKey, redisTtl } from './redisPolicy.js';
import { generateInvoices } from './transactionService.js';
import { drainNotificationQueue } from './notificationService.js';

type InvoiceInput = z.input<typeof invoiceGenerationSchema>;
type InvoiceJob = { id: string; type: 'invoice_run'; tenantId: string; input: InvoiceInput; attempts: number };
const queue = redisKey.backgroundQueue;
export const shouldMarkOverdue = (status: string, dueAt: Date, now = new Date()) => status === 'sent' && dueAt < now;

export async function enqueueInvoiceRun(tenantId: string, input: InvoiceInput) {
  const job: InvoiceJob = { id: randomUUID(), type: 'invoice_run', tenantId, input, attempts: 0 };
  const redis = await ensureRedisConnection(); await redis.rPush(queue, JSON.stringify(job)); await redis.set(redisKey.jobMetadata(job.id), JSON.stringify({ status: 'queued', tenantId }), { EX: redisTtl.jobMetadata });
  return job.id;
}

export async function runBackgroundJobs(prisma: PrismaClient) {
  const redis = await ensureRedisConnection(); const lockToken = randomUUID();
  if (!await redis.set(redisKey.workerLock, lockToken, { NX: true, EX: redisTtl.workerLock })) return 0;
  let processed = 0;
  try {
    await prisma.$executeRaw`UPDATE "Invoice" SET "status"=CAST('overdue' AS "InvoiceStatus"),"updatedAt"=NOW() WHERE "status"=CAST('sent' AS "InvoiceStatus") AND "dueAt"<NOW()`;
    processed += await drainNotificationQueue(prisma);
    for (let index = 0; index < 5; index++) {
      const raw = await redis.lPop(queue); if (!raw) break; const job = JSON.parse(raw) as InvoiceJob;
      await redis.set(redisKey.jobMetadata(job.id), JSON.stringify({ status: 'running', tenantId: job.tenantId }), { EX: redisTtl.jobMetadata });
      try { const ids = await generateInvoices(prisma, job.tenantId, job.input); await redis.set(redisKey.jobMetadata(job.id), JSON.stringify({ status: 'completed', tenantId: job.tenantId, invoiceIds: ids }), { EX: redisTtl.jobMetadata }); }
      catch (error) { job.attempts++; if (job.attempts < 3) { await redis.rPush(queue, JSON.stringify(job)); await redis.set(redisKey.jobMetadata(job.id), JSON.stringify({ status: 'retrying', tenantId: job.tenantId }), { EX: redisTtl.jobMetadata }); } else { await redis.rPush(redisKey.backgroundDeadLetter, JSON.stringify(job)); await redis.set(redisKey.jobMetadata(job.id), JSON.stringify({ status: 'failed', tenantId: job.tenantId, message: error instanceof Error ? error.message : 'Job failed' }), { EX: redisTtl.jobMetadata }); } }
      processed++;
    }
    return processed;
  } finally { if (await redis.get(redisKey.workerLock) === lockToken) await redis.del(redisKey.workerLock); }
}

export async function getBackgroundJobStatus(id: string, tenantId: string) { const redis = await ensureRedisConnection(); const raw = await redis.get(redisKey.jobMetadata(id)); if (!raw) return null; const status = JSON.parse(raw) as { tenantId: string }; return status.tenantId === tenantId ? status : null; }
