import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

export async function setDefaultAddress(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch('/addresses/:id/set-default',
    {
      schema: {
        tags: ['Address'],
        summary: 'Set address as default',
        params: z.object({
          id: z.string().uuid(),
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

      const existingAddress = await prisma.address.findFirst({
        where: {
          id,
          customerId: userId.sub,
        },
      })

      if (!existingAddress) {
        throw new BadRequestError('Address not found')
      }

      await prisma.address.updateMany({
        where: { customerId: userId.sub },
        data: { isDefault: false },
      })

      await prisma.address.update({
        where: { id },
        data: { isDefault: true },
      })

      return reply.status(204).send()
    })
}
