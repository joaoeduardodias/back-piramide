import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const validateCouponSchema = z.object({
  code: z.string(),
  orderTotal: z.number().positive(),
  productIds: z.array(z.uuid()).min(1),
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
      const { code, orderTotal, productIds } = request.body
      const { sub: userId } = await request.getCurrentUserId()

      const coupon = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
        include: { usages: true, products: true },
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
      if (coupon.scope === 'PRODUCTS') {
        const allowedProductIds = new Set(
          coupon.products.map(p => p.productId),
        )

        const hasValidProduct = productIds.some(id =>
          allowedProductIds.has(id),
        )

        if (!hasValidProduct) {
          throw new BadRequestError(
            'Este cupom não é válido para os produtos selecionados.',
          )
        }
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
