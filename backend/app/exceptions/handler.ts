import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  async handle(error: any, ctx: HttpContext) {
    // In production, never leak internal error details on 500-class errors.
    // 4xx errors (validation, not-found, etc.) keep their message — they are
    // actionable for the client. Raw error.message on 500s can leak DB schema,
    // SQL fragments, or stack internals.
    if (app.inProduction) {
      const status = error.status || (error.code ? Number(error.code) : 500)
      if (status >= 500) {
        ctx.response.status(status).json({
          message: 'Une erreur interne est survenue. Veuillez réessayer.',
        })
        return
      }
    }
    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
