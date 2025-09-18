import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const orderIdParamsSchema = z.object({
  id: z.uuid('Invalid order ID format'),
})

const responseOrderSchema = z.object({
  id: z.uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  total: z.number(),
  itemsCount: z.number(),
  addressId: z.uuid().nullable(),
  customer: z
    .object({
      id: z.uuid(),
      email: z.email(),
      name: z.string().nullable(),
    }).nullable(),
  items: z.array(
    z.object({
      id: z.uuid(),
      productId: z.uuid(),
      orderId: z.uuid(),
      variantId: z.uuid().nullable(),
      quantity: z.number(),
      unitPrice: z.instanceof(Decimal),
      product: z.object({
        id: z.uuid(),
        name: z.string(),
        slug: z.string(),
        price: z.instanceof(Decimal),
      }),
      variant: z
        .object({
          id: z.uuid(),
          price: z.instanceof(Decimal).nullable(),
          sku: z.string().nullable(),
        }).nullable(),
    }),
  ),
  address: z.object({
    id: z.uuid(),
    customerId: z.uuid(),
    street: z.string(),
    number: z.string().nullable(),
    complement: z.string().nullable(),
    district: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
    isDefault: z.boolean(),
  }).nullable(),
})

export async function updateStatusOrderToCancel(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch('/orders/:id/cancel',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Cancel order',
        params: orderIdParamsSchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: responseOrderSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const existingOrder = await prisma.order.findUnique({
        where: { id },
      })

      if (!existingOrder) {
        throw new BadRequestError('Order not found.')
      }

      if (existingOrder.status === 'DELIVERED') {
        throw new BadRequestError('Cannot cancel order with status DELIVERED.')
      }

      if (existingOrder.status === 'CANCELLED') {
        throw new BadRequestError('Order is already cancelled.')
      }

      try {
        const order = await prisma.order.update({
          where: { id },
          data: { status: 'CANCELLED' },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            address: true,
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    price: true,
                  },
                },
                variant: {
                  select: {
                    id: true,
                    sku: true,
                    price: true,
                  },
                },
              },
            },
          },
        })
        const total = order.items.reduce((sum, item) => {
          return sum + (Number(item.unitPrice) * item.quantity)
        }, 0)

        const orderWithTotal = {
          ...order,
          total,
          itemsCount: order.items.length,
        }

        return reply.send(orderWithTotal)
      } catch {
        throw new BadRequestError('Failed to cancel order.')
      }
    },
  )
}
