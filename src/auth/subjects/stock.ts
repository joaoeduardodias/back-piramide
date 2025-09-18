import { z } from 'zod/v4'
import { stockSchema } from '../models/stock'

export const stockSubject = z.tuple([
  z.union([
    z.literal('manage'),
    z.literal('get'),
  ]),
  z.union([z.literal('Stock'), stockSchema]),
])

export type StockSubject = z.infer<typeof stockSubject>
