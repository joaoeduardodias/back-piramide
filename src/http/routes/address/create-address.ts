import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

const addressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  name: z.string('Name is required'),
  complement: z.string().optional(),
  number: z.string().optional(),
  district: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  isDefault: z.boolean().default(false),
})

export async function createAddress(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).post('/address',
    {
      schema: {
        tags: ['Address'],
        summary: 'Create address',
        body: addressSchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          201: z.object({
            addressId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const {
        street,
        complement,
        number,
        district,
        city,
        state,
        postalCode,
        isDefault,
        name,
      } = request.body

      const userId = await request.getCurrentUserId()
      let defaultAddress = isDefault
      const existingAddresses = await prisma.address.count({
        where: { customerId: userId.sub },
      })

      if (existingAddresses === 0) {
        defaultAddress = true
      }

      if (defaultAddress) {
        await prisma.address.updateMany({
          where: { customerId: userId.sub },
          data: { isDefault: false },
        })
      }

      const address = await prisma.address.create({
        data: {
          customerId: userId.sub,
          name,
          street,
          complement,
          number,
          district,
          city,
          state,
          postalCode,
          isDefault: defaultAddress,
        },
      })

      return reply.status(201).send({
        addressId: address.id,
      })
    })
}
