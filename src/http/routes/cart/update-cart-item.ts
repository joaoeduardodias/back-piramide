import { prisma } from '@/lib/prisma'
import { ProductStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
})
const updatedItemSchema = z.object({
  product: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    status: z.enum(ProductStatus),
    createdAt: z.date(),
    updatedAt: z.date(),
    price: z.instanceof(Decimal),
    slug: z.string(),
  }),
  variant: z
    .object({
      id: z.string(),
      productId: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
      sku: z.string().nullable(),
      price: z.instanceof(Decimal).nullable(),
      stock: z.number(),
    })
    .nullable(),
  quantity: z.number(),
  id: z.string(),
  orderId: z.string(),
  productId: z.string(),
  variantId: z.string().nullable(),
  unitPrice: z.instanceof(Decimal),
})
export async function updateCartItem(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put('/cart/items/:id',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Update cart item quantity',
        params: z.object({
          id: z.uuid(),
        }),
        body: updateCartItemSchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: updatedItemSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { quantity } = request.body
      const userId = await request.getCurrentUserId()

      const cartItem = await prisma.orderItem.findFirst({
        where: {
          id,
          order: {
            customerId: userId.sub,
            status: 'PENDING',
          },
        },
        include: {
          variant: true,
        },
      })

      if (!cartItem) {
        throw new BadRequestError('Cart item not found')
      }

      if (cartItem.variant && cartItem.variant.stock < quantity) {
        throw new BadRequestError('Insufficient stock')
      }

      const updatedItem = await prisma.orderItem.update({
        where: { id },
        data: { quantity },
        include: {
          product: true,
          variant: true,
        },
      })

      return reply.send(updatedItem)
    })
}
