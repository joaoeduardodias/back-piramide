import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

export async function removeFromCart(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete('/cart/items/:id',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Remove item from cart',
        params: z.object({
          id: z.uuid(),
        }),
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
      const userId = await request.getCurrentUserId()

      const cartItem = await prisma.orderItem.findFirst({
        where: {
          id,
          order: {
            customerId: userId,
            status: 'PENDING',
          },
        },
      })

      if (!cartItem) {
        throw new BadRequestError('Cart item not found')
      }

      await prisma.orderItem.delete({
        where: { id },
      })

      return reply.status(204).send()
    })
}
