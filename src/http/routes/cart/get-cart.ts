import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { ProductStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { z } from 'zod'
import { BadRequestError } from '../_errors/bad-request-error'

const responseDataSchema = z.object({
  total: z.number(),
  items: z.array(
    z.object({
      product: z.object({
        images: z.array(
          z.object({
            id: z.uuid(),
            createdAt: z.date(),
            sortOrder: z.number(),
            productId: z.uuid(),
            url: z.url(),
            alt: z.string().nullable(),
            optionValueId: z.uuid().nullable(),
          }),
        ),
        id: z.uuid(),
        status: z.enum(ProductStatus),
        createdAt: z.date(),
        updatedAt: z.date(),
        name: z.string(),
        slug: z.string(),
        description: z.string().nullable(),
        price: z.instanceof(Decimal),
      }),
      variant: z.object({
        optionValues: z.array(
          z.object({
            optionValue: z.object({
              option: z.object({
                id: z.uuid(),
                name: z.string(),
                productId: z.uuid(),
              }),
              id: z.uuid(),
              value: z.string(),
              optionId: z.uuid(),
            }),
            id: z.uuid(),
            variantId: z.uuid(),
            optionValueId: z.uuid(),
          }),
        ),
        id: z.uuid(),
        productId: z.uuid(),
        createdAt: z.date(),
        updatedAt: z.date(),
        sku: z.string().nullable(),
        price: z.instanceof(Decimal).nullable(),
        stock: z.number(),
      }).nullable(),
      id: z.uuid(),
      orderId: z.uuid(),
      productId: z.uuid(),
      variantId: z.uuid().nullable(),
      quantity: z.number(),
      unitPrice: z.instanceof(Decimal),
    }),
  ),
  addressId: z.uuid().nullable(),
})

export async function getCart(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/cart',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Get user cart',
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: responseDataSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await request.getCurrentUserId()

      const cart = await prisma.order.findFirst({
        where: {
          customerId: userId,
          status: 'PENDING',
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    take: 1,
                    orderBy: { sortOrder: 'asc' },
                  },
                },
              },
              variant: {
                include: {
                  optionValues: {
                    include: {
                      optionValue: {
                        include: {
                          option: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      if (!cart) {
        throw new BadRequestError('Cart clean')
      }

      const total = cart.items.reduce((sum, item) => {
        return sum + (Number(item.unitPrice) * item.quantity)
      }, 0)

      return reply.send({
        ...cart,
        total,
      })
    })
}
