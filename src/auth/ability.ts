import type { CreateAbility, MongoAbility } from '@casl/ability'
import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import { z } from 'zod/v4'

import type { User } from './models/user'
import { permissions } from './permissions'
import { cartSubject } from './subjects/cart'
import { categorySubject } from './subjects/category'
import { orderSubject } from './subjects/order'
import { productSubject } from './subjects/product'
import { stockSubject } from './subjects/stock'
import { userSubject } from './subjects/user'

export * from './models/cart'
export * from './models/category'
export * from './models/order'
export * from './models/product'
export * from './models/user'
export * from './roles'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const appAbilitiesSchema = z.union([
  cartSubject,
  categorySubject,
  orderSubject,
  productSubject,
  userSubject,
  stockSubject,
  z.tuple([z.literal('manage'), z.literal('all')]),
])

type AppAbilities = z.infer<typeof appAbilitiesSchema>

export type AppAbility = MongoAbility<AppAbilities>
export const createAppAbility = createMongoAbility as CreateAbility<AppAbility>

export function defineAbilityFor(user: User) {
  const builder = new AbilityBuilder(createAppAbility)
  if (typeof permissions[user.role] !== 'function') {
    throw new Error(`Permissions for role ${user.role} not found`)
  }

  permissions[user.role](user, builder)

  const ability = builder.build({
    detectSubjectType(subject) {
      return subject.__typename
    },
  })
  ability.can = ability.can.bind(ability)
  ability.cannot = ability.cannot.bind(ability)
  return ability
}
