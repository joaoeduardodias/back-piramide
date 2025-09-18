import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

export async function deleteAddress(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete('/addresses/:id',
    {
      schema: {
        tags: ['Address'],
        summary: 'Delete address',
        params: z.object({
          id: z.uuid(),
        }),
        security: [
          { bearerAuth: [] },
        ],
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = await request.getCurrentUserId()

      const existingAddress = await prisma.address.findFirst({
        where: {
          id,
          customerId: userId,
        },
      })

      if (!existingAddress) {
        throw new BadRequestError('Address not found')
      }
      const ordersUsingAddress = await prisma.order.findFirst({
        where: { addressId: id },
      })

      if (ordersUsingAddress) {
        throw new BadRequestError(
          'Cannot delete address that is being used in orders')
      }

      await prisma.address.delete({
        where: { id },
      })

      return reply.status(204).send()
    })
}
