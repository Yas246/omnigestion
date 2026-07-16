import vine from '@vinejs/vine'

export const createAiReportValidator = vine.create({
  title: vine.string().trim().minLength(1).maxLength(200),
  periodLabel: vine.string().trim().minLength(1).maxLength(120),
  periodStart: vine.string().trim().maxLength(20).optional(),
  periodEnd: vine.string().trim().maxLength(20).optional(),
  content: vine.string().minLength(1),
  model: vine.string().trim().maxLength(60).optional(),
})
