import { z } from 'zod/v4'
import { orderSchema } from '../models/order'

export const orderSubject = z.tuple([
  z.union([
    z.literal('manage'),
    z.literal('create'),
    z.literal('get'),
    z.literal('update'),
    z.literal('delete'),
  ]),
  z.union([z.literal('Order'), orderSchema]),
])

export type OrderSubject = z.infer<typeof orderSubject>
