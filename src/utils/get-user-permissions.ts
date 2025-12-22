import { defineAbilityFor, userSchema } from '@/auth/ability'
import type { Role } from '@/prisma/generated/enums'

export function getUserPermissions(userId: string, role: Role) {
  const authUser = userSchema.parse({
    id: userId,
    role,
  })

  const ability = defineAbilityFor(authUser)
  return ability
}
