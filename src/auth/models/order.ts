import { z } from 'zod/v4'

export const orderSchema = z.object({
  __typename: z.literal('Order').default('Order'),
  id: z.string(),
  userId: z.string(),
})

export type Order = z.infer<typeof orderSchema>
