import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

export async function clearCart(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete('/cart',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Clear cart',
        security: [
          { bearerAuth: [] },
        ],
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()
      const cart = await prisma.order.findFirst({
        where: {
          customerId: userId.sub,
          status: 'PENDING',
        },
      })

      if (!cart) {
        throw new BadRequestError('Cart not found')
      }

      await prisma.orderItem.deleteMany({
        where: { orderId: cart.id },
      })

      return reply.status(204).send()
    })
}
