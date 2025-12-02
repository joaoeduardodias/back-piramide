import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const addressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  complement: z.string().optional(),
  number: z.string().optional(),
  district: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().default('BR'),
  isDefault: z.boolean().default(false),
})

const updateAddressSchema = addressSchema.partial()

export async function updateAddress(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).put('/addresses/:id',
    {
      schema: {
        tags: ['Address'],
        summary: 'Update address',
        params: z.object({
          id: z.uuid(),
        }),
        body: updateAddressSchema,
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
      const updateData = request.body
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

      if (updateData.isDefault) {
        await prisma.address.updateMany({
          where: {
            customerId: userId.sub,
            id: { not: id },
          },
          data: { isDefault: false },
        })
      }

      await prisma.address.update({
        where: { id },
        data: updateData,
      })

      return reply.status(204).send()
    })
}
