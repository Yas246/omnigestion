import vine from '@vinejs/vine'

export const cashTransferValidator = vine.create({
  fromRegisterId: vine.number().withoutDecimals().min(1),
  toRegisterId: vine.number().withoutDecimals().min(1),
  amount: vine.number().withoutDecimals().min(1),
  reason: vine.string().trim().maxLength(255).optional(),
})

export const cashMovementValidator = vine.create({
  registerId: vine.number().withoutDecimals().min(1),
  type: vine.enum(['in', 'out']),
  amount: vine.number().withoutDecimals().min(1),
  category: vine.string().trim().maxLength(50).optional(),
  description: vine.string().trim().maxLength(255).optional(),
})
