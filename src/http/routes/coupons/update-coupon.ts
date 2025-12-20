import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const updateCouponSchema = z.object({
  code: z.string().optional(),
  value: z.number().positive().optional(),
  minOrderValue: z.number().positive().nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
})

const paramsSchema = z.object({
  id: z.uuid(),
})

export async function updateCoupon(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).put('/coupons/:id', {
    schema: {
      tags: ['Coupon'],
      summary: 'Update coupon',
      params: paramsSchema,
      body: updateCouponSchema,
      security: [{ bearerAuth: [] }],
      response: {
        204: z.null(),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params
    const {
      code,
      expiresAt,
      isActive,
      maxUses,
      minOrderValue,
      value,
    } = request.body

    const coupon = await prisma.coupon.findUnique({ where: { id } })
    if (!coupon) {
      throw new BadRequestError('Cupom não encontrado.')
    }

    try {
      await prisma.coupon.update({
        where: { id },
        data: {
          code,
          expiresAt,
          isActive,
          maxUses,
          minOrderValue,
          value,
        },
      })

      return reply.status(204).send()
    } catch {
      throw new BadRequestError('Falha ao atualizar cupom')
    }
  })
}
