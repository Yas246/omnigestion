import User from '#models/user'
import Tenant from '#models/tenant'
import CompanyMembership from '#models/company_membership'
import { createEmployeeValidator, updateEmployeeValidator } from '#validators/employee'
import { AuditService } from '#services/audit_service'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

/**
 * Employee management (owner-only invite). Creating an employee is atomic:
 * user + company_membership + seat increment in one transaction. Respects the
 * tenant's seat limit.
 */
export default class EmployeesController {
  async store(ctx: HttpContext) {
    const owner = ctx.auth.getUserOrFail()
    if (!owner.isOwner) {
      return ctx.response.forbidden({ message: 'Only the owner can invite employees' })
    }
    const companyId = ctx.companyId
    if (!companyId) {
      return ctx.response.badRequest({ message: 'No company selected (provide X-Company-Id)' })
    }

    const data = await ctx.request.validateUsing(createEmployeeValidator)

    const tenant = await Tenant.find(owner.tenantId)
    if (tenant && tenant.seatsUsed >= tenant.seatsLimit) {
      return ctx.response.paymentRequired({
        message: `Seat limit reached (${tenant.seatsLimit}). Upgrade the plan to add more users.`,
      })
    }

    const { user, membership } = await db.transaction(async (trx) => {
      const user = await User.create(
        {
          tenantId: owner.tenantId,
          fullName: data.fullName,
          email: data.email,
          password: data.password,
          position: data.position ?? null,
          phone: data.phone ?? null,
          isOwner: false,
        },
        { client: trx }
      )
      const membership = await CompanyMembership.create(
        {
          tenantId: owner.tenantId,
          userId: user.id,
          companyId,
          permissions: data.permissions ?? [],
        },
        { client: trx }
      )
      // Atomic seat increment (no read-modify-write)
      await Tenant.query({ client: trx }).where('id', owner.tenantId).increment('seats_used', 1)
      return { user, membership }
    })

    await AuditService.log(ctx, {
      action: 'create',
      entity: 'user',
      entityId: user.id,
      after: { email: user.email, companyId },
    })

    // Return the membership id (the /employees resource IS the membership) so
    // the client can update/delete via PUT/DELETE /employees/:id consistently.
    return ctx.response.created({
      id: membership.id,
      userId: user.id,
      companyId,
      permissions: membership.permissions,
      email: user.email,
      fullName: user.fullName,
      position: user.position,
      phone: user.phone,
      isOwner: user.isOwner,
    })
  }

  /** Lists the employees (memberships) of the current company, with their user info. */
  async index(ctx: HttpContext) {
    const companyId = ctx.companyId ?? 0
    const memberships = await CompanyMembership.query()
      .where('tenant_id', ctx.tenantId)
      .where('company_id', companyId)
      .orderBy('created_at', 'desc')

    const userIds = memberships.map((m) => m.userId)
    const users = userIds.length ? await User.query().whereIn('id', userIds) : []
    const userById = new Map(users.map((u) => [u.id, u]))

    return memberships.map((m) => {
      const user = userById.get(m.userId)
      return {
        id: m.id,
        userId: m.userId,
        companyId: m.companyId,
        permissions: m.permissions,
        email: user?.email ?? null,
        fullName: user?.fullName ?? null,
        position: user?.position ?? null,
        phone: user?.phone ?? null,
        isOwner: user?.isOwner ?? false,
      }
    })
  }

  /** Update an employee's profile (fullName), password, and/or permissions. */
  async update(ctx: HttpContext) {
    const owner = ctx.auth.getUserOrFail()
    if (!owner.isOwner) {
      return ctx.response.forbidden({ message: 'Only the owner can manage employees' })
    }
    const companyId = ctx.companyId
    if (!companyId) {
      return ctx.response.badRequest({ message: 'No company selected (provide X-Company-Id)' })
    }

    const membership = await CompanyMembership.query()
      .where('tenant_id', ctx.tenantId)
      .where('company_id', companyId)
      .where('id', ctx.params.id)
      .firstOrFail()
    const user = await User.findOrFail(membership.userId)
    if (user.isOwner) {
      return ctx.response.forbidden({ message: 'Cannot modify the owner account' })
    }

    const data = await ctx.request.validateUsing(updateEmployeeValidator)
    const before = { fullName: user.fullName, permissions: membership.permissions }

    await db.transaction(async (trx) => {
      if (data.fullName !== undefined || data.password || data.position !== undefined || data.phone !== undefined) {
        if (data.fullName !== undefined) user.fullName = data.fullName
        if (data.position !== undefined) user.position = data.position
        if (data.phone !== undefined) user.phone = data.phone
        if (data.password) user.password = data.password
        // useTransaction so the withAuthFinder hash hook + membership JSON
        // prepare hook fire inside the transaction.
        await user.useTransaction(trx).save()
      }
      if (data.permissions !== undefined) {
        membership.permissions = data.permissions
        await membership.useTransaction(trx).save()
      }
    })

    await AuditService.log(ctx, {
      action: 'update',
      entity: 'user',
      entityId: user.id,
      before,
      after: { fullName: user.fullName, permissions: membership.permissions },
    })

    return {
      id: membership.id,
      userId: user.id,
      companyId,
      permissions: membership.permissions,
      email: user.email,
      fullName: user.fullName,
      position: user.position,
      phone: user.phone,
      isOwner: user.isOwner,
    }
  }

  /** Remove an employee's access to the current company (and the user if they
   *  have no other membership). Decrements the tenant seat count atomically. */
  async destroy(ctx: HttpContext) {
    const owner = ctx.auth.getUserOrFail()
    if (!owner.isOwner) {
      return ctx.response.forbidden({ message: 'Only the owner can manage employees' })
    }
    const companyId = ctx.companyId
    if (!companyId) {
      return ctx.response.badRequest({ message: 'No company selected (provide X-Company-Id)' })
    }

    const membership = await CompanyMembership.query()
      .where('tenant_id', ctx.tenantId)
      .where('company_id', companyId)
      .where('id', ctx.params.id)
      .firstOrFail()
    const user = await User.findOrFail(membership.userId)
    if (user.isOwner) {
      return ctx.response.conflict({ message: 'Cannot remove the owner account' })
    }

    await db.transaction(async (trx) => {
      await membership.useTransaction(trx).delete()
      // Drop the user entirely if they no longer have access to any company.
      const remaining = await db
        .from('company_memberships')
        .where('user_id', user.id)
        .count('* as c')
        .first()
      if (Number((remaining as any)?.c ?? 0) === 0) {
        await user.useTransaction(trx).delete()
      }
      await Tenant.query({ client: trx })
        .where('id', owner.tenantId)
        .where('seats_used', '>', 0)
        .decrement('seats_used', 1)
    })

    await AuditService.log(ctx, {
      action: 'delete',
      entity: 'user',
      entityId: user.id,
      before: { email: user.email, companyId },
    })

    return ctx.response.noContent()
  }
}
