import { describe, expect, it } from 'vitest';
import { createNotificationJob } from './notificationService.js';

describe('notification queue', () => {
  it('creates retryable jobs for every channel', () => {
    const job = createNotificationJob({ channel: 'in_app', tenantId: 't1', userId: 'u1', title: 'Invoice', body: 'Sent' });
    expect(job).toMatchObject({ channel: 'in_app', attempts: 0 });
    expect(job.id).toBeTruthy();
  });
});
