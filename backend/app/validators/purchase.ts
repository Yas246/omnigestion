import vine from '@vinejs/vine'

const item = vine.object({
  productId: vine.number().withoutDecimals().min(1),
  quantity: vine.number().withoutDecimals().min(1),
  unitPrice: vine.number().withoutDecimals().min(0),
})

export const createPurchaseValidator = vine.create({
  supplierId: vine.number().withoutDecimals().min(1).optional(),
  supplierName: vine.string().trim().maxLength(150).optional(),
  items: vine.array(item).minLength(1).maxLength(200),
  warehouseId: vine.number().withoutDecimals().min(1).optional(),
  paymentMethod: vine.enum(['cash', 'bank', 'mobile', 'credit']).optional(),
  paidAmount: vine.number().withoutDecimals().min(0).optional(),
  discount: vine.number().withoutDecimals().min(0).optional(),
  taxRate: vine.number().withoutDecimals().min(0).max(100).optional(),
  notes: vine.string().trim().maxLength(500).optional(),
})
