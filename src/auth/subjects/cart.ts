import { z } from 'zod/v4'
import { cartSchema } from '../models/cart'

export const cartSubject = z.tuple([
  z.union([
    z.literal('manage'),
    z.literal('create'),
    z.literal('get'),
    z.literal('update'),
    z.literal('delete'),
  ]),
  z.union([z.literal('Cart'), cartSchema]),
])

export type CartSubject = z.infer<typeof cartSubject>
