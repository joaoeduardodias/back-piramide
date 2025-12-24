import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const couponIdParamsSchema = z.object({
  id: z.uuid('Invalid coupon ID format'),
})

export async function updateStatusCoupon(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth)
    .patch('/coupons/:id/status',
      {
        schema: {
          tags: ['Coupons'],
          summary: 'Cancel coupon',
          params: couponIdParamsSchema,
          security: [
            { bearerAuth: [] },
          ],
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { id } = request.params
        const existingCoupon = await prisma.coupon.findUnique({
          where: { id },
        })

        if (!existingCoupon) {
          throw new BadRequestError('Coupon not found.')
        }

        try {
          await prisma.coupon.update({
            where: { id },
            data: { isActive: !existingCoupon.isActive },
          })

          return reply.send()
        } catch {
          throw new BadRequestError('Failed to alter status coupon.')
        }
      },
    )
}
