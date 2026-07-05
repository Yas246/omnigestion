/**
 * Seeds the "quality defaults" a brand-new company needs on day one so the owner
 * can sell / import stock immediately:
 *   - a main warehouse ("Dépôt principal") — holds stock
 *   - a main cash register ("Caisse principale") — books payments
 *   - an invoice counter (prefix FAC) — atomic numbering
 *   - company_settings (one row, JSONB defaults; defaultWarehouseId = main depot)
 *
 * Uses RAW inserts (not Lucid models) so it is independent of the request
 * context: the CompanyScopedModel before:create hook would otherwise overwrite
 * `company_id` with the currently-selected company when bootstrapping a SECOND
 * company via POST /companies. Runs inside the caller's transaction.
 */
export const CompanyBootstrapService = {
  async seedDefaults(tenantId: number, companyId: number, trx: any) {
    const now = new Date()

    const [whRow] = await trx
      .table('warehouses')
      .insert({
        tenant_id: tenantId,
        company_id: companyId,
        name: 'Dépôt principal',
        code: 'MAIN',
        address: null,
        is_main: true,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .returning('id')
    const mainWarehouseId = Number((whRow as any).id)

    await trx.table('cash_registers').insert({
      tenant_id: tenantId,
      company_id: companyId,
      name: 'Caisse principale',
      code: 'MAIN',
      is_main: true,
      is_active: true,
      current_balance: 0,
      created_at: now,
      updated_at: now,
    })

    await trx.table('invoice_counters').insert({
      tenant_id: tenantId,
      company_id: companyId,
      prefix: 'FAC',
      next_number: 1,
    })

    await trx.table('company_settings').insert({
      company_id: companyId,
      invoice: JSON.stringify({ prefix: 'FAC', nextNumber: 1, taxRate: 0, footer: '' }),
      stock: JSON.stringify({ lowStockAlerts: true, defaultWarehouseId: mainWarehouseId }),
      backup: JSON.stringify({}),
      system: JSON.stringify({ currency: 'FCFA' }),
      updated_at: now,
    })

    return { mainWarehouseId }
  },
}
