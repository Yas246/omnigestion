import vine from '@vinejs/vine'

export const createCompanyValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(150),
  businessSector: vine.enum(['commerce', 'commerce_and_services']).optional(),
  currency: vine.string().trim().maxLength(10).optional(),
  taxId: vine.string().trim().maxLength(50).optional(),
  ifu: vine.string().trim().maxLength(50).optional(),
  rccm: vine.string().trim().maxLength(50).optional(),
  phone: vine.string().trim().maxLength(30).optional(),
  email: vine.string().trim().email().maxLength(254).optional(),
  address: vine.string().trim().maxLength(255).optional(),
})
