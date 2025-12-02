import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

const addressSchema = z.object({
  addresses: z.array(z.object({
    number: z.string().nullable(),
    name: z.string(),
    street: z.string(),
    complement: z.string().nullable(),
    district: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    isDefault: z.boolean(),
    id: z.string(),
  })),
})

export async function getAddressesByUser(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).get('/user/addresses',
    {
      schema: {
        tags: ['Address'],
        summary: 'Get address by User',
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: addressSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()

      const addresses = await prisma.address.findMany({
        select: {
          id: true,
          name: true,
          number: true,
          street: true,
          complement: true,
          district: true,
          city: true,
          state: true,
          postalCode: true,
          isDefault: true,
        },
        where: {
          customerId: userId.sub,
        },
      })

      return reply.send({ addresses })
    })
}
