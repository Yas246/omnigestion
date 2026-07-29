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
    // Catch the classic "dev .env copied to prod" mistake: a deployment reached
    // via HTTPS must run in production mode, otherwise CORS opens to all origins
    // with credentials, cookies are non-Secure, and error stacks leak DB details.
    const appUrl = String(env.get('APP_URL') ?? '')
    const nodeEnv = env.get('NODE_ENV')
    if (appUrl.startsWith('https://') && nodeEnv !== 'production') {
      console.error(
        `\n[FATAL] Refusing to boot: APP_URL (${appUrl}) is HTTPS but NODE_ENV=${nodeEnv}. Set NODE_ENV=production in production.\n`
      )
      throw new Error(
        'Insecure production configuration — NODE_ENV must be production when APP_URL is HTTPS.'
      )
    }

    if (nodeEnv !== 'production') return

    // APP_KEY is declared as Env.schema.secret() in env.ts, so env.get() returns
    // a Secret wrapper whose String form is "[REDACTED]" (length 10) — that would
    // always trip the <16 check. Read the RAW value via process.env instead.
    const appKey = process.env.APP_KEY ?? ''
    const dbPassword = env.get('DB_PASSWORD')
    const problems: string[] = []

    if (appKey.length < 16) {
      problems.push(
        'APP_KEY is missing or too short — generate a strong secret (node ace generate:key).'
      )
    }
    if (!dbPassword || dbPassword === 'root') {
      problems.push(
        'DB_PASSWORD is the default "root" (or empty) — set a strong database password.'
      )
    }

    if (problems.length) {
      console.error('\n[FATAL] Refusing to boot in production with insecure configuration:')
      for (const p of problems) console.error('  - ' + p)
      console.error('')
      throw new Error('Insecure production configuration — aborting boot.')
    }
  }
}
