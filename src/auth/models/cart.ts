import { z } from 'zod/v4'

export const cartSchema = z.object({
  __typename: z.literal('Cart').default('Cart'),
  id: z.string(),
  userId: z.string(),
})

export type Cart = z.infer<typeof cartSchema>
