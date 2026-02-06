import { prisma } from '@/lib/prisma'
import { OrderStatus, PaymentMethod } from '@/prisma/generated/enums'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const orderIdParamsSchema = z.object({
  id: z.uuid('Invalid order ID format'),
})

const orderItemSchema = z.object({
  productId: z.uuid('Invalid product ID format'),
  variantId: z.uuid('Invalid variant ID format').optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().positive('Unit price must be positive'),
})

const updateOrderSchema = z.object({
  trackingCode: z.string().optional(),
  estimatedDelivery: z.string().optional(),
  customerId: z.uuid('Invalid customer ID format').optional(),
  paymentMethod: z.enum(PaymentMethod).optional(),
  status: z.enum(OrderStatus).optional(),
  addressId: z.uuid('Invalid address ID format').nullish(),
  items: z.array(orderItemSchema).optional(),
})

export async function updateOrder(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put('/orders/:id',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Update a order',
        params: orderIdParamsSchema,
        body: updateOrderSchema,
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
      const {
        customerId,
        estimatedDelivery,
        status,
        addressId,
        paymentMethod,
        trackingCode,
        items,
      } = request.body

      const existingOrder = await prisma.order.findUnique({
        where: { id },
      })

      if (!existingOrder) {
        throw new BadRequestError('Order not found.')
      }

      if (customerId) {
        const customer = await prisma.user.findUnique({
          where: { id: customerId },
        })

        if (!customer) {
          throw new BadRequestError('Customer not found.')
        }
      }

      if (addressId) {
        const address = await prisma.address.findUnique({
          where: { id: addressId },
        })

        if (!address) {
          throw new BadRequestError('Address not found')
        }
      }

      if (items && items.length > 0) {
        const productIds = items.map(item => item.productId)
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
        })

        if (products.length !== productIds.length) {
          throw new BadRequestError('One or more products not found.')
        }

        const variantIds = items.filter(item =>
          item.variantId).map(item => item.variantId!)
        if (variantIds.length > 0) {
          const variants = await prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
          })

          if (variants.length !== variantIds.length) {
            throw new BadRequestError('One or more product variants not found.')
          }
          for (const item of items) {
            if (item.variantId) {
              const variant = variants.find(v => v.id === item.variantId)
              if (variant && variant.productId !== item.productId) {
                throw new BadRequestError(`Variant ${item.variantId}
                   does not belong to product ${item.productId}.`)
              }
            }
          }
        }
      }

      try {
        await prisma.order.update({
          where: { id },
          data: {
            ...(customerId !== undefined && { customerId }),
            ...(paymentMethod !== undefined && { paymentMethod }),
            estimatedDelivery: estimatedDelivery
              ? new Date(estimatedDelivery)
              : null,
            ...(trackingCode !== undefined && { trackingCode }),
            ...(status && { status }),
            ...(addressId !== undefined && { addressId: addressId ?? null }),
            ...(items && {
              items: {
                deleteMany: {},
                create: items.map(item => ({
                  productId: item.productId,
                  variantId: item.variantId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                })),
              },
            }),
          },
        })

        return reply.status(204).send()
      } catch {
        throw new BadRequestError('Failed to update order.')
      }
    },
  )
}
