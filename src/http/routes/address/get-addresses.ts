import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

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

export async function getAddresses(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/addresses',
    {
      schema: {
        tags: ['Address'],
        summary: 'Get user addresses',
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: z.array(addressSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()

      const addresses = await prisma.address.findMany({
        where: { customerId: userId.sub },
        orderBy: [
          { isDefault: 'desc' },
        ],
      })

      return reply.send(addresses)
    })
}
