import { randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';

const counters = new Map<string, { count: number; durationMs: number }>();
const normalizePath = (path: string) => path.replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ':id').replace(/\/\d+(?=\/|$)/g, '/:id').replace(/[^a-zA-Z0-9_./:-]/g, '_');

export const observabilityMiddleware: RequestHandler = (req, res, next) => {
  const started = performance.now();
  const incoming = req.header('traceparent')?.match(/^00-([0-9a-f]{32})-[0-9a-f]{16}-0[01]$/i);
  const traceId = incoming?.[1].toLowerCase() ?? randomBytes(16).toString('hex');
  res.locals.traceId = traceId;
  res.setHeader('traceparent', `00-${traceId}-${randomBytes(8).toString('hex')}-01`);
  res.on('finish', () => {
    const durationMs = performance.now() - started;
    const key = `${req.method}|${normalizePath(req.path)}|${res.statusCode}`;
    const metric = counters.get(key) ?? { count: 0, durationMs: 0 };
    metric.count++; metric.durationMs += durationMs; counters.set(key, metric);
  });
  next();
};

export function prometheusMetrics() {
  const lines = ['# HELP homelink_http_requests_total HTTP requests.', '# TYPE homelink_http_requests_total counter', '# HELP homelink_http_request_duration_ms_sum Total request duration.', '# TYPE homelink_http_request_duration_ms_sum counter'];
  for (const [key, value] of counters) {
    const [method, path, status] = key.split('|');
    const labels = `method="${method}",path="${path}",status="${status}"`;
    lines.push(`homelink_http_requests_total{${labels}} ${value.count}`, `homelink_http_request_duration_ms_sum{${labels}} ${value.durationMs.toFixed(3)}`);
  }
  lines.push(`homelink_process_uptime_seconds ${process.uptime().toFixed(3)}`);
  return `${lines.join('\n')}\n`;
}

export function reportError(payload: Record<string, unknown>) {
  const url = process.env.ERROR_MONITOR_URL;
  if (!url) return;
  void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.ERROR_MONITOR_TOKEN ? { Authorization: `Bearer ${process.env.ERROR_MONITOR_TOKEN}` } : {}) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(3000) }).catch(() => undefined);
}
