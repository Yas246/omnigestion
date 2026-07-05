import CashRegister from '#models/cash_register'
import { createCashRegisterValidator, updateCashRegisterValidator } from '#validators/cash_register'
import { AuditService } from '#services/audit_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class CashRegistersController {
  async index(ctx: HttpContext) {
    const registers = await CashRegister.forContext(ctx)
      .where('isActive', true)
      .orderBy('isMain', 'desc')
      .orderBy('createdAt', 'asc')
    return registers.map((r) => r.toJSON())
  }

  async show(ctx: HttpContext) {
    const register = await CashRegister.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    return register.toJSON()
  }

  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(createCashRegisterValidator)
    // A company has at most one main register: demote any existing main first.
    if (data.isMain) {
      await CashRegister.query()
        .where('tenant_id', ctx.tenantId)
        .where('company_id', ctx.companyId ?? 0)
        .where('is_main', true)
        .update({ isMain: false })
    }
    const register = await CashRegister.create(data)
    await AuditService.log(ctx, { action: 'create', entity: 'cash_register', entityId: register.id, after: register.toJSON() })
    return ctx.response.created(register.toJSON())
  }

  async update(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(updateCashRegisterValidator)
    const register = await CashRegister.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const before = register.toJSON()
    register.merge(data)
    if (data.isMain) {
      await CashRegister.query()
        .where('tenant_id', ctx.tenantId)
        .where('company_id', ctx.companyId ?? 0)
        .where('is_main', true)
        .whereNot('id', register.id)
        .update({ isMain: false })
    }
    await register.save()
    await AuditService.log(ctx, { action: 'update', entity: 'cash_register', entityId: register.id, before, after: register.toJSON() })
    return register.toJSON()
  }

  async destroy(ctx: HttpContext) {
    const register = await CashRegister.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    if (register.isMain) {
      return ctx.response.conflict({ message: 'Cannot delete the main cash register' })
    }
    if (Number(register.currentBalance) !== 0) {
      return ctx.response.conflict({ message: 'Cannot delete a register with a non-zero balance' })
    }
    const before = register.toJSON()
    await register.delete()
    await AuditService.log(ctx, { action: 'delete', entity: 'cash_register', entityId: register.id, before })
    return ctx.response.noContent()
  }
}
