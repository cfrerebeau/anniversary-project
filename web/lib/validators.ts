import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().email()

export const accessSchema = z.object({
  email: emailSchema,
})

export const cagnotteMessageSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  amount_cents: z.coerce.number().int().min(0).max(1_000_000).optional(),
  message: z.string().trim().max(1000).optional().default(''),
})

export const anecdoteSchema = z.object({
  title: z.string().trim().max(120).optional().default(''),
  story: z.string().trim().min(20, 'Encore quelques mots…').max(4000),
  since: z
    .enum(['<1 an', '1-5 ans', '5-15 ans', 'la vie'])
    .optional(),
})

export const photoSignSchema = z.object({
  filename: z.string().min(1).max(200),
  content_type: z.string().regex(/^(image|video)\//),
  size_bytes: z.number().int().positive().max(50 * 1024 * 1024),
})

export const photoProcessSchema = z.object({
  storage_path: z.string().min(1).max(400),
  caption: z.string().trim().max(280).optional().default(''),
  content_type: z.string().min(1),
  size_bytes: z.number().int().positive(),
})
