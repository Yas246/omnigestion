import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Lightweight in-memory rate limiter for public auth endpoints (login / signup
 * / store-auth / checkout). Blocks brute-force and basic abuse.
 *
 * Per-IP sliding window. Stateless + dependency-free: sufficient for the current
 * single-process deployment. Upgrade path = @adonisjs/limiter on Redis once the
 * app runs multiple instances (the window would then be shared across workers).
 *
 * Applied as a named middleware: `middleware.throttle(rate, periodSeconds)`.
 */
const buckets = new Map<string, number[]>()

export default class ThrottleMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options?: { rate?: number; period?: number },
  ) {
    const rate = Number(options?.rate ?? 10)
    const periodSeconds = Number(options?.period ?? 60)
    const ip = ctx.request.ip() || 'unknown'
    const now = Date.now()
    const windowMs = periodSeconds * 1000

    const hits = (buckets.get(ip) ?? []).filter((t) => now - t < windowMs)
    if (hits.length >= rate) {
      ctx.response.tooManyRequests({
        message: 'Trop de requêtes. Réessayez dans un instant.',
        retryAfter: periodSeconds,
      })
      return
    }
    hits.push(now)
    buckets.set(ip, hits)
    return next()
  }
}
