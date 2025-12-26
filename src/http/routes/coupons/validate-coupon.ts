import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const validateCouponSchema = z.object({
  code: z.string(),
  orderTotal: z.number().positive(),
})

export async function validateCoupon(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth)
    .post('/coupons/validate', {
      schema: {
        tags: ['Coupon'],
        summary: 'Validate coupon',
        body: validateCouponSchema,
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            discount: z.number(),
            finalTotal: z.number(),
          }),
        },
      },
    }, async (request, reply) => {
      const { code, orderTotal } = request.body
      const { sub: userId } = await request.getCurrentUserId()

      const coupon = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
        include: { usages: true },
      })

      if (!coupon || !coupon.isActive) {
        throw new BadRequestError('Cupom inválido.')
      }

      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        throw new BadRequestError('Cupom expirado.')
      }

      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        throw new BadRequestError('Máximo de usos do cupom atingido.')
      }

      const alreadyUsed = coupon.usages.some(u => u.userId === userId)
      if (alreadyUsed) {
        throw new BadRequestError('Você já usou este cupom.')
      }

      if (coupon.minOrderValue && orderTotal < Number(coupon.minOrderValue)) {
        throw new BadRequestError('Valor mínimo não atingido.')
      }

      let discount = 0

      if (coupon.type === 'PERCENT') {
        discount = Math.floor((orderTotal * coupon.value) / 100)
      } else {
        discount = coupon.value
      }
      return reply.send({
        discount,
        finalTotal: Math.max(orderTotal - discount, 0),
      })
    })
}
