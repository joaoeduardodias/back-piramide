import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const addressSchema = z.object({
  number: z.string().nullable(),
  street: z.string(),
  complement: z.string().nullable(),
  district: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
  isDefault: z.boolean(),
  id: z.string(),
  customerId: z.string(),
})

export async function getAddressById(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/addresses/:id',
    {
      schema: {
        tags: ['Address'],
        summary: 'Get address by ID',
        params: z.object({
          id: z.uuid(),
        }),
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: addressSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const userId = await request.getCurrentUserId()

      const address = await prisma.address.findFirst({
        where: {
          id,
          customerId: userId,
        },
      })

      if (!address) {
        throw new BadRequestError('Address not found')
      }

      return reply.send(address)
    })
}
