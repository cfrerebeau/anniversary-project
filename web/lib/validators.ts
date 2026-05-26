import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().email()

export const accessSchema = z.object({
  email: emailSchema,
})

export const inviteSchema = z.object({
  email: emailSchema,
  first_name: z.string().trim().min(1).max(80),
})

export const cagnotteMessageSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  amount_cents: z.coerce.number().int().min(0).max(1_000_000).optional(),
  message: z.string().trim().max(1000).optional().default(''),
})

export const quizQuestionSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(8, 'La question est un peu courte.')
      .max(280, 'Trop long pour un quiz.'),
    options: z
      .array(z.string().trim().min(1, 'Réponse vide.').max(120))
      .min(2, 'Il faut au moins deux options.')
      .max(4, 'Pas plus de quatre.'),
    correct_index: z.coerce.number().int().min(0),
  })
  .refine((d) => d.correct_index < d.options.length, {
    message: 'La bonne réponse pointe en dehors des options.',
    path: ['correct_index'],
  })
  .refine((d) => new Set(d.options.map((o) => o.toLowerCase())).size === d.options.length, {
    message: 'Deux options identiques.',
    path: ['options'],
  })

export const photoBucketKeySchema = z.enum(['souvenirs', 'event'])

// Pas de cap dans `photoSignSchema` : la limite est par-bucket et appliquée
// dans la route après lecture de `bucket`. Si on cappait ici on rejetterait
// faussement les vidéos event > 50 MB.
export const photoSignSchema = z.object({
  filename: z.string().min(1).max(200),
  content_type: z.string().regex(/^(image|video)\//),
  size_bytes: z.number().int().positive().max(200 * 1024 * 1024),
  bucket: photoBucketKeySchema,
})

export const photoProcessSchema = z.object({
  storage_path: z.string().min(1).max(400),
  caption: z.string().trim().max(280).optional().default(''),
  content_type: z.string().min(1),
  size_bytes: z.number().int().positive(),
  bucket: photoBucketKeySchema,
  upload_nonce: z.string().regex(/^[a-f0-9]{64}$/),
  upload_nonce_exp: z.number().int().positive(),
})
