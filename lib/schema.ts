import { z } from 'zod'

export const ParsedRowSchema = z.object({
  clientName: z.string(),
  planNumber: z.string(),
  feeType: z.string(),
  grossAmount: z.number(),
  paymentDate: z.string(),
  platformName: z.string(),
})

export const ValidatedRowSchema = ParsedRowSchema.extend({
  confidence: z.number().min(0).max(1),
  flagged: z.boolean(),
})

export type ParsedRow = z.infer<typeof ParsedRowSchema>
export type ValidatedRow = z.infer<typeof ValidatedRowSchema>
