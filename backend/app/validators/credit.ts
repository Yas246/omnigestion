import vine from '@vinejs/vine'

export const addPaymentValidator = vine.create({
  amount: vine.number().withoutDecimals().min(1),
  paymentMode: vine.enum(['cash', 'bank', 'mobile']).optional(),
  notes: vine.string().trim().maxLength(255).optional(),
})
