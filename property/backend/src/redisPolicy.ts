const prefix = 'homelink:v1';

export const redisTtl = {
  sessionMetadata: 5 * 60,
  jobMetadata: 24 * 60 * 60,
  loginFailures: 15 * 60,
  workerLock: 60,
} as const;

export const redisKey = {
  session: (userId: string, familyId: string) => `${prefix}:session:${userId}:${familyId}`,
  rateLimit: (name: string, identityHash: string) => `${prefix}:rate:${name}:${identityHash}`,
  loginFailures: (identityHash: string) => `${prefix}:login-fail:${identityHash}`,
  loginLock: (identityHash: string) => `${prefix}:login-lock:${identityHash}`,
  backgroundQueue: `${prefix}:queue:background`,
  backgroundDeadLetter: `${prefix}:queue:background:dead`,
  notificationQueue: `${prefix}:queue:notification`,
  notificationDeadLetter: `${prefix}:queue:notification:dead`,
  jobMetadata: (jobId: string) => `${prefix}:job:${jobId}`,
  workerLock: `${prefix}:lock:background-worker`,
} as const;
