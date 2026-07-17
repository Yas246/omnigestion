import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Shared cash helpers used by transactional services (Credits, and later Cash/
 * Purchases). All methods run ON the caller's transaction client (`trx`).
 */
const now = () => new Date()

export const CashService = {
  async getOrCreateMainRegister(trx: any, tenantId: number, companyId: number) {
    let reg = await trx
      .from('cash_registers')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .where('is_main', true)
      .first()
    if (!reg) {
      await trx.table('cash_registers').insert({
        tenant_id: tenantId,
        company_id: companyId,
        name: 'Caisse principale',
        code: 'MAIN',
        is_main: true,
        is_active: true,
        current_balance: 0,
        created_at: now(),
        updated_at: now(),
      })
      reg = await trx
        .from('cash_registers')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('is_main', true)
        .first()
    }
    return reg
  },

  /**
   * Records a cash 'in' movement and atomically increments the register balance.
   * Returns the cash_register_id used.
   */
  async recordCashIn(
    trx: any,
    ctx: HttpContext,
    payload: {
      amount: number
      category: string
      description: string
      referenceType: string
      referenceId: number
      registerId?: number | null
    }
  ): Promise<number> {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId as number
    const reg = payload.registerId
      ? { id: payload.registerId }
      : await this.getOrCreateMainRegister(trx, tenantId, companyId)
    const cashRegisterId = Number(reg.id)
    const userId = ctx.auth.user?.id ?? null
    const userName = ctx.auth.user?.fullName ?? null

    await trx.table('cash_movements').insert({
      tenant_id: tenantId,
      company_id: companyId,
      cash_register_id: cashRegisterId,
      type: 'in',
      amount: payload.amount,
      category: payload.category,
      description: payload.description,
      reference_type: payload.referenceType,
      reference_id: payload.referenceId,
      target_cash_register_id: null,
      user_id: userId,
      user_name: userName,
      created_at: now(),
    })
    // Lock the register row so concurrent balance writes serialize (matches transfer/recordMovement).
    await trx.from('cash_registers').where('id', cashRegisterId).forUpdate().first()
    await trx
      .from('cash_registers')
      .where('id', cashRegisterId)
      .update({ current_balance: trx.raw('current_balance + ?', [payload.amount]), updated_at: now() })
    return cashRegisterId
  },

  /** Records a cash 'out' movement and atomically decrements the register balance. */
  async recordCashOut(
    trx: any,
    ctx: HttpContext,
    payload: {
      amount: number
      category: string
      description: string
      referenceType: string
      referenceId: number
      registerId?: number | null
    }
  ): Promise<number> {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId as number
    const reg = payload.registerId
      ? { id: payload.registerId }
      : await this.getOrCreateMainRegister(trx, tenantId, companyId)
    const cashRegisterId = Number(reg.id)
    const userId = ctx.auth.user?.id ?? null
    const userName = ctx.auth.user?.fullName ?? null

    await trx.table('cash_movements').insert({
      tenant_id: tenantId,
      company_id: companyId,
      cash_register_id: cashRegisterId,
      type: 'out',
      amount: payload.amount,
      category: payload.category,
      description: payload.description,
      reference_type: payload.referenceType,
      reference_id: payload.referenceId,
      target_cash_register_id: null,
      user_id: userId,
      user_name: userName,
      created_at: now(),
    })
    await trx.from('cash_registers').where('id', cashRegisterId).forUpdate().first()
    await trx
      .from('cash_registers')
      .where('id', cashRegisterId)
      .update({ current_balance: trx.raw('current_balance - ?', [payload.amount]), updated_at: now() })
    return cashRegisterId
  },

  /** Transfer funds between two registers of the same company (own transaction). */
  async transfer(
    ctx: HttpContext,
    input: { fromRegisterId: number; toRegisterId: number; amount: number; reason?: string | null }
  ) {
    if (input.amount <= 0) throw new Error('Amount must be positive')
    if (input.fromRegisterId === input.toRegisterId) throw new Error('Source and target must differ')
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId as number

    return db.transaction(async (trx) => {
      const from = await trx
        .from('cash_registers')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('id', input.fromRegisterId)
        .forUpdate()
        .first()
      if (!from) throw new Error('Source register not found')
      const fromBefore = Number(from.current_balance)
      if (fromBefore < input.amount) throw new Error('Insufficient balance in source register')

      const to = await trx
        .from('cash_registers')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('id', input.toRegisterId)
        .forUpdate()
        .first()
      if (!to) throw new Error('Target register not found')
      const toBefore = Number(to.current_balance)

      await trx.from('cash_registers').where('id', from.id).update({ current_balance: trx.raw('current_balance - ?', [input.amount]), updated_at: now() })
      await trx.from('cash_registers').where('id', to.id).update({ current_balance: trx.raw('current_balance + ?', [input.amount]), updated_at: now() })

      const userId = ctx.auth.user?.id ?? null
      const userName = ctx.auth.user?.fullName ?? null
      await trx.table('cash_movements').insert({
        tenant_id: tenantId, company_id: companyId, cash_register_id: from.id, type: 'out', amount: input.amount,
        category: 'transfer', description: input.reason ?? `Transfer to register #${to.id}`,
        reference_type: 'cash_transfer', reference_id: to.id, target_cash_register_id: to.id,
        user_id: userId, user_name: userName, created_at: now(),
      })
      await trx.table('cash_movements').insert({
        tenant_id: tenantId, company_id: companyId, cash_register_id: to.id, type: 'in', amount: input.amount,
        category: 'transfer', description: input.reason ?? `Transfer from register #${from.id}`,
        reference_type: 'cash_transfer', reference_id: from.id, target_cash_register_id: null,
        user_id: userId, user_name: userName, created_at: now(),
      })

      return {
        from: { before: fromBefore, after: fromBefore - input.amount },
        to: { before: toBefore, after: toBefore + input.amount },
      }
    })
  },

  /** Manual cash in/out (deposit / expense) on a register (own transaction). */
  async recordMovement(
    ctx: HttpContext,
    input: { registerId: number; type: 'in' | 'out'; amount: number; category?: string | null; description?: string | null }
  ) {
    if (input.type !== 'in' && input.type !== 'out') throw new Error('Type must be in or out')
    if (input.amount <= 0) throw new Error('Amount must be positive')
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId as number

    return db.transaction(async (trx) => {
      const reg = await trx
        .from('cash_registers')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('id', input.registerId)
        .forUpdate()
        .first()
      if (!reg) throw new Error('Register not found')
      const before = Number(reg.current_balance)
      if (input.type === 'out' && before < input.amount) throw new Error('Insufficient balance')

      const delta = input.type === 'in' ? input.amount : -input.amount
      await trx.from('cash_registers').where('id', reg.id).update({ current_balance: trx.raw('current_balance + ?', [delta]), updated_at: now() })
      await trx.table('cash_movements').insert({
        tenant_id: tenantId, company_id: companyId, cash_register_id: reg.id, type: input.type, amount: input.amount,
        category: input.category ?? (input.type === 'in' ? 'deposit' : 'expense'),
        description: input.description ?? null, reference_type: 'manual', reference_id: null,
        target_cash_register_id: null, user_id: ctx.auth.user?.id ?? null, user_name: ctx.auth.user?.fullName ?? null,
        created_at: now(),
      })
      return { before, after: before + delta }
    })
  },
}
