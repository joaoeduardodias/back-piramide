import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { CouponType } from '@/prisma/generated/enums'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const paramsSchema = z.object({
  id: z.uuid(),
})

export async function getCouponById(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).get('/coupons/:id', {
    schema: {
      tags: ['Coupon'],
      summary: 'Get coupon by id',
      params: paramsSchema,
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          coupon: z.object({
            id: z.uuid(),
            code: z.string(),
            type: z.enum(CouponType),
            value: z.number(),
            minOrderValue: z.number().nullable(),
            maxUses: z.number().nullable(),
            usedCount: z.number(),
            expiresAt: z.date().nullable(),
            isActive: z.boolean(),
            createdAt: z.date(),
            usages: z.array(z.object({
              id: z.string(),
              couponId: z.string(),
              userId: z.string(),
              usedAt: z.date(),
            })),
          }),

        }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params

    const coupon = await prisma.coupon.findUnique({
      where: { id },
      select: {
        code: true,
        createdAt: true,
        expiresAt: true,
        isActive: true,
        maxUses: true,
        minOrderValue: true,
        id: true,
        type: true,
        usages: true,
        usedCount: true,
        value: true,
      },
    })

    if (!coupon) {
      throw new BadRequestError('Cupom não encontrado.')
    }

    return reply.send({ coupon })
  })
}
