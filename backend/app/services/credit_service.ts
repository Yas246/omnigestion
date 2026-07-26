import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import { CashService } from '#services/cash_service'
import { AuditService } from '#services/audit_service'

/**
 * Credit payments. `addClientPayment` is a single transaction with FOR UPDATE:
 * lock credit → validate amount <= remaining → update amount_paid/remaining/
 * status → record payment → cash 'in' (+ register balance) → decrement the
 * client's denormalized current_credit. Audit written in-tx.
 */
const now = () => new Date()

export interface PaymentInput {
  amount: number
  paymentMode?: string | null
  notes?: string | null
}

export const CreditService = {
  async addClientPayment(ctx: HttpContext, creditId: number, input: PaymentInput) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    if (input.amount <= 0) throw new Error('Payment amount must be positive')

    return db.transaction(async (trx) => {
      const credit: any = await trx
        .from('client_credits')
        .where('id', creditId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .forUpdate()
        .first()
      if (!credit) throw new Error('Client credit not found')
      if (credit.status === 'cancelled') throw new Error('Cannot pay a cancelled credit')
      if (credit.status === 'paid') throw new Error('Credit is already fully paid')

      const remaining = Number(credit.remaining_amount)
      if (input.amount > remaining) {
        throw new Error(`Payment exceeds remaining amount (${remaining})`)
      }

      const newPaid = Number(credit.amount_paid) + input.amount
      const newRemaining = remaining - input.amount
      const newStatus = newRemaining === 0 ? 'paid' : 'partial'

      await trx
        .from('client_credits')
        .where('id', credit.id)
        .update({
          amount_paid: newPaid,
          remaining_amount: newRemaining,
          status: newStatus,
          updated_at: now(),
        })

      await trx.table('client_credit_payments').insert({
        tenant_id: tenantId,
        company_id: companyId,
        client_credit_id: credit.id,
        amount: input.amount,
        payment_mode: input.paymentMode ?? 'cash',
        notes: input.notes ?? null,
        user_id: ctx.auth.user?.id ?? null,
        created_at: now(),
      })

      await CashService.recordCashIn(trx, ctx, {
        amount: input.amount,
        category: 'credit_payment',
        description: `Credit payment — ${credit.invoice_number ?? `credit #${credit.id}`}`,
        referenceType: 'client_credit',
        referenceId: credit.id,
      })

      if (credit.client_id) {
        await trx
          .from('clients')
          .where('id', credit.client_id)
          .where('tenant_id', tenantId)
          .where('company_id', companyId)
          .update({ current_credit: trx.raw('GREATEST(0, current_credit - ?)', [input.amount]), updated_at: now() })
      }

      await AuditService.log(
        ctx,
        {
          action: 'create',
          entity: 'client_credit_payment',
          entityId: credit.id,
          after: { paid: input.amount, remaining: newRemaining, status: newStatus },
        },
        { client: trx }
      )

      return { creditId: credit.id, paid: input.amount, remaining: newRemaining, status: newStatus }
    })
  },

  /** Create a manual client credit (opening balance / adjustment) atomically:
   *  credit row + clients.current_credit increment + audit, all in ONE tx so a
   *  failure can't leave the client balance out of sync with the credit record. */
  async createManualCredit(
    ctx: HttpContext,
    input: {
      clientId?: number | null
      clientName?: string | null
      amount: number
      date?: Date | string | null
      dueDate?: Date | string | null
      notes?: string | null
    },
  ) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const amount = Number(input.amount) || 0
    if (amount <= 0) throw new Error('Credit amount must be positive')

    const date = input.date ? new Date(input.date) : now()
    const dueDate = input.dueDate ? new Date(input.dueDate) : null

    return db.transaction(async (trx) => {
      const inserted = await trx
        .table('client_credits')
        .insert({
          tenant_id: tenantId,
          company_id: companyId,
          client_id: input.clientId ?? null,
          client_name: input.clientName ?? '',
          invoice_id: null,
          invoice_number: null,
          amount,
          amount_paid: 0,
          remaining_amount: amount,
          status: 'active',
          date,
          due_date: dueDate,
          notes: input.notes ?? null,
          created_at: now(),
          updated_at: now(),
        })
        .returning('id')
      const creditId = (inserted[0] as any).id

      if (input.clientId) {
        await trx
          .from('clients')
          .where('id', input.clientId)
          .where('tenant_id', tenantId)
          .where('company_id', companyId)
          .update({ current_credit: trx.raw('current_credit + ?', [amount]), updated_at: now() })
      }

      await AuditService.log(
        ctx,
        {
          action: 'create',
          entity: 'client_credit',
          entityId: creditId,
          after: { amount, clientId: input.clientId ?? null },
        },
        { client: trx },
      )
      return { id: creditId, amount, status: 'active' }
    })
  },

  /** Mirror of addClientPayment for supplier credits, but cash goes OUT. */
  async addSupplierPayment(ctx: HttpContext, creditId: number, input: PaymentInput) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    if (input.amount <= 0) throw new Error('Payment amount must be positive')

    return db.transaction(async (trx) => {
      const credit: any = await trx
        .from('supplier_credits')
        .where('id', creditId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .forUpdate()
        .first()
      if (!credit) throw new Error('Supplier credit not found')
      if (credit.status === 'cancelled') throw new Error('Cannot pay a cancelled credit')
      if (credit.status === 'paid') throw new Error('Credit is already fully paid')

      const remaining = Number(credit.remaining_amount)
      if (input.amount > remaining) throw new Error(`Payment exceeds remaining amount (${remaining})`)

      const newPaid = Number(credit.amount_paid) + input.amount
      const newRemaining = remaining - input.amount
      const newStatus = newRemaining === 0 ? 'paid' : 'partial'

      await trx.from('supplier_credits').where('id', credit.id).update({
        amount_paid: newPaid, remaining_amount: newRemaining, status: newStatus, updated_at: now(),
      })

      await trx.table('supplier_credit_payments').insert({
        tenant_id: tenantId, company_id: companyId, supplier_credit_id: credit.id,
        amount: input.amount, payment_mode: input.paymentMode ?? 'cash', notes: input.notes ?? null,
        user_id: ctx.auth.user?.id ?? null, created_at: now(),
      })

      await CashService.recordCashOut(trx, ctx, {
        amount: input.amount, category: 'supplier_payment',
        description: `Supplier payment — ${credit.purchase_number ?? `credit #${credit.id}`}`,
        referenceType: 'supplier_credit', referenceId: credit.id,
      })

      if (credit.supplier_id) {
        await trx.from('suppliers').where('id', credit.supplier_id).where('tenant_id', tenantId).where('company_id', companyId).update({
          current_debt: trx.raw('GREATEST(0, current_debt - ?)', [input.amount]), updated_at: now(),
        })
      }

      await AuditService.log(
        ctx,
        { action: 'create', entity: 'supplier_credit_payment', entityId: credit.id, after: { paid: input.amount, remaining: newRemaining, status: newStatus } },
        { client: trx }
      )
      return { creditId: credit.id, paid: input.amount, remaining: newRemaining, status: newStatus }
    })
  },
}
