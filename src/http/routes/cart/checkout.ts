import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const orderSchema = z.object({
  id: z.string(),
  items: z.array(z.object({
    product: z.object({
      id: z.string(),
      name: z.string(),
    }),
  })),
}).nullable()

export async function checkout(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/cart/checkout',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Checkout cart',
        body: z.object({
          addressId: z.uuid('Invalid address ID'),
        }),
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: orderSchema,
        },
      },
    },
    async (request, reply) => {
      const { addressId } = request.body
      const userId = await request.getCurrentUserId()
      const address = await prisma.address.findFirst({
        where: {
          id: addressId,
          customerId: userId.sub,
        },
      })
      if (!address) {
        throw new BadRequestError('Address not found')
      }

      const cart = await prisma.order.findFirst({
        where: {
          customerId: userId.sub,
          status: 'PENDING',
        },
        include: {
          items: {
            include: {
              variant: true,
            },
          },
        },
      })

      if (!cart || cart.items.length === 0) {
        throw new BadRequestError('Cart is empty')
      }

      for (const item of cart.items) {
        if (item.variant && item.variant.stock < item.quantity) {
          throw new BadRequestError(
            `Insufficient stock for product variant ${item.variant.id}`)
        }
      }

      await prisma.$transaction(async (tx) => {
        for (const item of cart.items) {
          if (item.variant) {
            await tx.productVariant.update({
              where: { id: item.variant.id },
              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            })
          }
        }

        await tx.order.update({
          where: { id: cart.id },
          data: {
            status: 'CONFIRMED',
            addressId,
          },
        })
      })

      const order = await prisma.order.findUnique({
        where: { id: cart.id },
        select: {
          id: true,
          items: {
            select: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        // include: {
        //   items: {
        //     include: {
        //       product: true,
        //       variant: true,
        //     },
        //   },
        //   address: true,
        // },
      })

      return reply.send(order)
    })
}
