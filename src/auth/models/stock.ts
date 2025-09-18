import { z } from 'zod/v4'

export const stockSchema = z.object({
  __typename: z.literal('Stock').default('Stock'),
  id: z.string(),
  userId: z.string(),
})

export type Product = z.infer<typeof stockSchema>
