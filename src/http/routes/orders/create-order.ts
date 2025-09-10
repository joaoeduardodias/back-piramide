import { prisma } from '@/lib/prisma'
import { OrderStatus } from '@prisma/client'
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
  customerId: z.uuid('Invalid customer ID format').optional(),
  status: z.enum(OrderStatus).default('PENDING'),
  addressId: z.uuid('Invalid address ID format').optional(),
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
})

export async function createOrder(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/orders',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Create  order',
        body: createOrderSchema,
        response: {
          201: z.object({
            orderId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { customerId, status, addressId, items } = request.body

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
          throw new BadRequestError('Address not found.')
        }
      }

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

      try {
        const order = await prisma.order.create({
          data: {
            customerId,
            status,
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

        return reply.status(201).send({
          orderId: order.id,
        })
      } catch {
        throw new BadRequestError('Failed to create order.')
      }
    },
  )
}
