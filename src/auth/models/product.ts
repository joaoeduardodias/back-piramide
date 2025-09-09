import { z } from 'zod/v4'

export const productSchema = z.object({
  __typename: z.literal('Product').default('Product'),
  id: z.string(),
  userId: z.string(),
})

export type Product = z.infer<typeof productSchema>
