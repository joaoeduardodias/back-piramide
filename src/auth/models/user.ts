import { z } from 'zod/v4'

import { roleSchema } from '../roles'

export const userSchema = z.object({
  __typename: z.literal('User').default('User'),
  id: z.string(),
  role: roleSchema,
})

export type User = z.infer<typeof userSchema>
