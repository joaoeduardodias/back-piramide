import { z } from 'zod/v4'

export const roleSchema = z.union([
  z.literal('ADMIN'),
  z.literal('MANAGER'),
  z.literal('EDITOR'),
  z.literal('CUSTOMER'),
  z.literal('GUEST'),
])

export type Role = z.infer<typeof roleSchema>
