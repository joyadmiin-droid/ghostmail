const rateLimitMap = new Map();

export function rateLimit({ limit = 30, windowMs = 60 * 1000 } = {}) {
  return function (ip) {
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, { count: 1, start: now });
      return { success: true };
    }

    const data = rateLimitMap.get(ip);

    if (now - data.start > windowMs) {
      rateLimitMap.set(ip, { count: 1, start: now });
      return { success: true };
    }

    if (data.count >= limit) {
      return { success: false };
    }

    data.count += 1;
    return { success: true };
  };
}