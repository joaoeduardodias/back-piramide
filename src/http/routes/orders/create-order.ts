import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { OrderStatus, PaymentMethod } from '@/prisma/generated/enums'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const orderItemSchema = z.object({
  productId: z.uuid('Invalid product ID format'),
  variantId: z.uuid('Invalid variant ID format').optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().positive('Unit price must be positive'),
})

const createOrderSchema = z.object({
  status: z.enum(OrderStatus).default('PENDING'),
  paymentMethod: z.enum(PaymentMethod),
  addressId: z.uuid('Invalid address ID format').optional(),
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
})

export async function createOrder(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).post(
    '/orders',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Create a order',
        body: createOrderSchema,
        security: [{ bearerAuth: [] }],
        response: {
          201: z.object({
            orderId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const user = await request.getCurrentUserId()
      const { status, addressId, items, paymentMethod } = request.body

      if (addressId) {
        const address = await prisma.address.findUnique({
          where: { id: addressId },
        })

        if (!address) {
          throw new BadRequestError('Address not found.')
        }
      }

      const productIds = items.map(item => item.productId)

      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      })

      const uniqueProductIds = [...new Set(productIds)]

      if (products.length !== uniqueProductIds.length) {
        throw new BadRequestError('One or more products not found.')
      }

      const variantIds = items
        .filter(item => item.variantId)
        .map(item => item.variantId!)

      let variants: { id: string; productId: string; stock: number }[] = []

      if (variantIds.length > 0) {
        variants = await prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            productId: true,
            stock: true,
          },
        })

        if (variants.length !== variantIds.length) {
          throw new BadRequestError('One or more product variants not found.')
        }

        for (const item of items) {
          if (item.variantId) {
            const variant = variants.find(v => v.id === item.variantId)
            if (variant && variant.productId !== item.productId) {
              throw new BadRequestError(
                `Variant ${item.variantId} does
                 not belong to product ${item.productId}.`,
              )
            }
          }
        }

        const quantitiesByVariant = items.reduce<Record<string, number>>(
          (acc, item) => {
            if (item.variantId) {
              acc[item.variantId] = (acc[item.variantId] ?? 0) + item.quantity
            }
            return acc
          },
          {},
        )

        for (const [variantId, totalQuantity] of Object.entries(
          quantitiesByVariant,
        )) {
          const variant = variants.find(v => v.id === variantId)

          if (!variant) {
            throw new BadRequestError(
              `Variant ${variantId} not found for stock validation.`,
            )
          }

          if (variant.stock < totalQuantity) {
            throw new BadRequestError(
              `Insufficient stock for variant ${variantId}.
               Available: ${variant.stock}, requested: ${totalQuantity}.`,
            )
          }
        }
      }

      try {
        const order = await prisma.$transaction(async tx => {
          const createdOrder = await tx.order.create({
            data: {
              customerId: user.sub,
              status,
              paymentMethod,
              addressId,
              items: {
                create: items.map(item => ({
                  productId: item.productId,
                  variantId: item.variantId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                })),
              },
            },
          })

          if (variantIds.length > 0) {
            const quantitiesByVariant = items.reduce<Record<string, number>>(
              (acc, item) => {
                if (item.variantId) {
                  acc[item.variantId] =
                    (acc[item.variantId] ?? 0) + item.quantity
                }
                return acc
              },
              {},
            )

            await Promise.all(
              Object.entries(quantitiesByVariant).map(
                async ([variantId, totalQuantity]) => {
                  await tx.productVariant.update({
                    where: { id: variantId },
                    data: {
                      stock: {
                        decrement: totalQuantity,
                      },
                    },
                  })
                },
              ),
            )
          }

          return createdOrder
        })

        return reply.status(201).send({
          orderId: order.id,
        })
      } catch {
        throw new BadRequestError('Failed to create order.')
      }
    },
  )
}
