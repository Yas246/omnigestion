/**
 * Multi-tenant + authorization request context.
 *
 * `tenancy_middleware` resolves the authenticated user's tenant, the company
 * they operate in, and their effective permissions, then stores them on the
 * HttpContext. Models / middleware / services read them from ctx.
 */
declare module '@adonisjs/core/http' {
  export interface HttpContext {
    tenantId: number
    companyId: number | null
    /** Tenant owner flag — owners bypass the permission matrix (full access). */
    isOwner: boolean
    /** Employee's permissions for the current company (null for owners). */
    userPermissions: Array<{ module: string; actions: string[] }> | null
  }
}
