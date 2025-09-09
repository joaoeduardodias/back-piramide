import { z } from 'zod/v4'

export const categorySchema = z.object({
  __typename: z.literal('Category').default('Category'),
  id: z.string(),
})

export type Category = z.infer<typeof categorySchema>
