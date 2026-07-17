import type { ApplicationService } from '@adonisjs/core/types'
import env from '#start/env'

/**
 * Production safety net: refuse to boot if the configuration is insecure.
 * Catches the common "copied dev env to prod" mistake before the server starts.
 * Only active in production — never interferes with local development.
 */
export default class SecurityCheckProvider {
  constructor(protected app: ApplicationService) {}

  async boot() {
    if (env.get('NODE_ENV') !== 'production') return

    const appKey = env.get('APP_KEY')
    const dbPassword = env.get('DB_PASSWORD')
    const problems: string[] = []

    if (!appKey || String(appKey).length < 16) {
      problems.push('APP_KEY is missing or too short — generate a strong secret (node ace generate:key).')
    }
    if (!dbPassword || dbPassword === 'root') {
      problems.push('DB_PASSWORD is the default "root" (or empty) — set a strong database password.')
    }

    if (problems.length) {
      console.error('\n[FATAL] Refusing to boot in production with insecure configuration:')
      for (const p of problems) console.error('  - ' + p)
      console.error('')
      throw new Error('Insecure production configuration — aborting boot.')
    }
  }
}
