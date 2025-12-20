import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const paramsSchema = z.object({
  id: z.uuid(),
})

export async function deleteCoupon(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth)
    .delete('/coupons/:id', {
      schema: {
        tags: ['Coupon'],
        summary: 'Delete coupon',
        params: paramsSchema,
        security: [{ bearerAuth: [] }],
      },
    }, async (request, reply) => {
      const { id } = request.params

      const coupon = await prisma.coupon.findUnique({ where: { id } })
      if (!coupon) {
        throw new BadRequestError('Cupom não encontrado.')
      }

      try {
        await prisma.coupon.delete({ where: { id } })

        return reply.status(204).send()
      } catch {
        throw new BadRequestError('Erro ao deletar cupom.')
      }
    })
}
