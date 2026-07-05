import vine from '@vinejs/vine'

const item = vine.object({
  productId: vine.number().withoutDecimals().min(1),
  quantity: vine.number().withoutDecimals().min(1),
  unitPrice: vine.number().withoutDecimals().min(0),
  isWholesale: vine.boolean().optional(),
})

/** Mobile Money / bank payment details shared by create + update. */
const paymentFields = {
  mobileNumber: vine.string().trim().maxLength(40).optional(),
  bankName: vine.string().trim().maxLength(100).optional(),
  accountNumber: vine.string().trim().maxLength(60).optional(),
  transactionNumber: vine.string().trim().maxLength(100).optional(),
}

export const createInvoiceValidator = vine.create({
  clientId: vine.number().withoutDecimals().min(1).optional(),
  clientName: vine.string().trim().maxLength(150).optional(),
  items: vine.array(item).minLength(1),
  warehouseId: vine.number().withoutDecimals().min(1).optional(),
  paymentMethod: vine.enum(['cash', 'bank', 'mobile', 'credit']).optional(),
  paidAmount: vine.number().withoutDecimals().min(0).optional(),
  discount: vine.number().withoutDecimals().min(0).optional(),
  taxRate: vine.number().withoutDecimals().min(0).max(100).optional(),
  notes: vine.string().trim().maxLength(500).optional(),
  saleDate: vine.string().optional(),
  ...paymentFields,
})

/** Full invoice edit (items + metadata + payment details). */
export const updateInvoiceValidator = vine.create({
  clientId: vine.number().withoutDecimals().min(1).optional(),
  clientName: vine.string().trim().maxLength(150).optional(),
  items: vine.array(item).minLength(1),
  paymentMethod: vine.enum(['cash', 'bank', 'mobile', 'credit']).optional(),
  paidAmount: vine.number().withoutDecimals().min(0).optional(),
  discount: vine.number().withoutDecimals().min(0).optional(),
  taxRate: vine.number().withoutDecimals().min(0).max(100).optional(),
  notes: vine.string().trim().maxLength(500).optional(),
  saleDate: vine.string().optional(),
  ...paymentFields,
})
