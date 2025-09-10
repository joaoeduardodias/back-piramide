import { prisma } from '@/lib/prisma'
import { OrderStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
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
  customerId: z.uuid('Invalid customer ID format').optional(),
  status: z.enum(OrderStatus).optional(),
  addressId: z.uuid('Invalid address ID format').optional(),
  items: z.array(orderItemSchema).optional(),
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

export async function updateOrder(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put('/orders/:id',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Update order',
        params: orderIdParamsSchema,
        body: updateOrderSchema,
        response: {
          200: responseOrderSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { customerId, status, addressId, items } = request.body

      const existingOrder = await prisma.order.findUnique({
        where: { id },
        include: {
          items: true,
        },
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
        const order = await prisma.order.update({
          where: { id },
          data: {
            ...(customerId !== undefined && { customerId }),
            ...(status && { status }),
            ...(addressId !== undefined && { addressId }),
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
        throw new BadRequestError('Failed to update order.')
      }
    },
  )
}
