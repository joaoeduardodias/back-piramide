import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const createCouponSchema = z.object({
  code: z.string().min(1).transform(v => v.toUpperCase()),
  type: z.enum(['PERCENT', 'FIXED']),
  isActive: z.boolean().default(true),
  value: z.number().positive(),
  minOrderValue: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.coerce.date().optional(),
})

export async function createCoupon(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/coupons', {
    schema: {
      tags: ['Coupon'],
      summary: 'Create coupon',
      body: createCouponSchema,
      security: [{ bearerAuth: [] }],
      response: {
        201: z.object({
          couponId: z.uuid(),
        }),
      },
    },
  }, async (request, reply) => {
    const {
      code,
      type,
      value,
      expiresAt,
      maxUses,
      minOrderValue,
      isActive,
    } = request.body

    const existing = await prisma.coupon.findUnique({
      where: { code },
    })

    if (existing) {
      throw new BadRequestError('Cupom já existente.')
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        type,
        value,
        expiresAt,
        maxUses,
        isActive,
        minOrderValue,
      },
    })

    return reply.status(201).send({
      couponId: coupon.id,
    })
  })
}
