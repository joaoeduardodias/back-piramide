import { defineAbilityFor, userSchema } from '@/auth/ability'
import type { Role } from '@prisma/client'

export function getUserPermissions(userId: string, role: Role) {
  const authUser = userSchema.parse({
    id: userId,
    role,
  })

  const ability = defineAbilityFor(authUser)
  return ability
}
