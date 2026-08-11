import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { ensureRedisConnection } from './redis.js';
import { redisKey } from './redisPolicy.js';
import { publishLiveEvent } from './liveEvents.js';

export type NotificationJob = { id: string; channel: 'email' | 'sms' | 'in_app'; tenantId: string; userId: string; to?: string; title: string; body: string; route?: string; type?: 'info' | 'billing' | 'payment' | 'maintenance' | 'announcement'; attempts: number };
const queueKey = redisKey.notificationQueue;
export const createNotificationJob = (job: Omit<NotificationJob, 'id' | 'attempts'>): NotificationJob => ({ ...job, id: randomUUID(), attempts: 0 });

export async function enqueueNotifications(jobs: NotificationJob[]) {
  if (!jobs.length) return;
  const redis = await ensureRedisConnection();
  await redis.rPush(queueKey, jobs.map((job) => JSON.stringify(job)));
}

async function deliver(prisma: PrismaClient, job: NotificationJob) {
  if (job.channel === 'in_app') {
    const notification = await prisma.notification.create({ data: { tenantId: job.tenantId, userId: job.userId, title: job.title, body: job.body, route: job.route, type: job.type ?? 'info' } });
    publishLiveEvent({ type: 'notification.created', tenantId: job.tenantId, userId: job.userId, data: { id: notification.id, title: job.title, body: job.body, route: job.route, type: job.type ?? 'info' } });
    return;
  }
  if (job.channel === 'email' && process.env.GMAIL_SMTP_USER && process.env.GMAIL_APP_PASSWORD && job.to) {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_SMTP_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') } });
    await transporter.sendMail({ from: process.env.GMAIL_FROM || `HomeLink <${process.env.GMAIL_SMTP_USER}>`, to: job.to, subject: job.title, text: job.body });
    return;
  }
  const url = job.channel === 'email' ? process.env.NOTIFICATION_EMAIL_PROVIDER_URL : process.env.NOTIFICATION_SMS_PROVIDER_URL;
  const apiKey = process.env.NOTIFICATION_PROVIDER_API_KEY;
  if (!url || !apiKey || !job.to) throw new Error(`${job.channel} provider is not configured.`);
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ to: job.to, title: job.title, body: job.body }), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`${job.channel} delivery failed.`);
}

export async function drainNotificationQueue(prisma: PrismaClient, max = 20) {
  const redis = await ensureRedisConnection(); let processed = 0;
  while (processed < max) {
    const raw = await redis.lPop(queueKey); if (!raw) break;
    const job = JSON.parse(raw) as NotificationJob;
    try { await deliver(prisma, job); } catch { if (++job.attempts < 3) await redis.rPush(queueKey, JSON.stringify(job)); else await redis.rPush(redisKey.notificationDeadLetter, JSON.stringify(job)); }
    processed++;
  }
  return processed;
}
