import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

export async function getCoupons(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).get('/coupons', {
    schema: {
      tags: ['Coupon'],
      summary: 'List coupons',
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          coupons: z.array(z.object({
            id: z.uuid(),
            code: z.string(),
            type: z.enum(['PERCENT', 'FIXED']),
            value: z.number(),
            isActive: z.boolean(),
            usedCount: z.number(),
            maxUses: z.number().nullable(),
            expiresAt: z.date().nullable(),
            createdAt: z.date(),
          })),
        }),
      },
    },
  }, async (_, reply) => {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ coupons })
  })
}
