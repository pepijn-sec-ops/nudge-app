const buckets = new Map();

function getClientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (xf) return xf;
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function createRateLimiter({
  windowMs,
  max,
  message = 'Too many requests. Please try again later.',
}) {
  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = `${req.method}:${req.baseUrl || ''}:${req.path}:${getClientIp(req)}`;
    const hit = buckets.get(key);
    if (!hit || hit.expiresAt <= now) {
      buckets.set(key, { count: 1, expiresAt: now + windowMs });
      next();
      return;
    }

    hit.count += 1;
    if (hit.count > max) {
      const retryAfter = Math.max(1, Math.ceil((hit.expiresAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}

