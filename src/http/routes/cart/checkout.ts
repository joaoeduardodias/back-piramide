import { prisma } from '@/lib/prisma'
import { ProductStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const orderSchema = z
  .object({
    id: z.uuid(),
    customerId: z.uuid().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),

    items: z.array(
      z.object({
        id: z.uuid(),
        orderId: z.uuid(),
        productId: z.uuid(),
        variantId: z.uuid().nullable(),
        quantity: z.number(),
        unitPrice: z.instanceof(Decimal),

        variant: z
          .object({
            id: z.uuid(),
            createdAt: z.date(),
            updatedAt: z.date(),
            productId: z.uuid(),
            sku: z.string().nullable(),
            price: z.instanceof(Decimal).nullable(),
            stock: z.number(),
          })
          .nullable(),

        product: z.object({
          id: z.uuid(),
          createdAt: z.date(),
          updatedAt: z.date(),
          price: z.instanceof(Decimal),
          status: z.enum(ProductStatus),
          name: z.string(),
          description: z.string().nullable(),
          slug: z.string(),
        }),
      }),
    ),

    address: z
      .object({
        id: z.uuid(),
        customerId: z.uuid(),
        number: z.string().nullable(),
        street: z.string(),
        complement: z.string().nullable(),
        district: z.string().nullable(),
        city: z.string(),
        state: z.string(),
        postalCode: z.string(),
        country: z.string(),
        isDefault: z.boolean(),
      })
      .nullable(),
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
          customerId: userId,
        },
      })
      if (!address) {
        throw new BadRequestError('Address not found')
      }

      const cart = await prisma.order.findFirst({
        where: {
          customerId: userId,
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
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          address: true,
        },
      })

      return reply.send(order)
    })
}
