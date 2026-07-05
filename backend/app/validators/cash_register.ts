import vine from '@vinejs/vine'

export const createCashRegisterValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(150),
  code: vine.string().trim().maxLength(50).optional(),
  isMain: vine.boolean().optional(),
})

export const updateCashRegisterValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(150).optional(),
  code: vine.string().trim().maxLength(50).optional(),
  isMain: vine.boolean().optional(),
  isActive: vine.boolean().optional(),
})
