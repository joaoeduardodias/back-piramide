import { prisma } from '@/lib/prisma'
import { OrderStatus, type Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const getOrdersQuerySchema = z.object({
  page: z.string().transform(val =>
    parseInt(val)).pipe(z.number().int().min(1)).default(1),
  limit: z.string().transform(val =>
    parseInt(val)).pipe(z.number().int().min(1).max(100)).default(10),
  status: z.enum(OrderStatus).optional(),
  customerId: z.uuid().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
})

const responseOrders = z.object({
  orders: z.array(
    z.object({
      id: z.uuid(),
      createdAt: z.date(),
      updatedAt: z.date(),
      total: z.number(),
      itemsCount: z.number(),
      addressId: z.uuid().nullable(),
      customer: z.object({
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
          variant: z.object({
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
    }),
  ),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
})

export async function getOrders(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/orders',
    {
      schema: {
        tags: ['Orders'],
        summary: 'List all orders',
        security: [
          { bearerAuth: [] },
        ],
        querystring: getOrdersQuerySchema,
        response: {
          200: responseOrders,
        },
      },
    },
    async (request, reply) => {
      const {
        page,
        limit,
        status,
        customerId,
        startDate,
        endDate,
      } = request.query
      const skip = (page - 1) * limit
      const where: Prisma.OrderWhereInput = {}

      if (status) {
        where.status = status
      }

      if (customerId) {
        where.customerId = customerId
      }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) {
          where.createdAt.gte = new Date(startDate)
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate)
        }
      }

      try {
        const [orders, total] = await Promise.all([
          prisma.order.findMany({
            where,
            skip,
            take: limit,
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
            orderBy: { createdAt: 'desc' },
          }),
          prisma.order.count({ where }),
        ])

        const ordersWithTotal = orders.map(order => ({
          ...order,
          total: order.items.reduce((sum, item) => {
            return sum + (Number(item.unitPrice) * item.quantity)
          }, 0),
          itemsCount: order.items.length,
        }))
        const totalPages = Math.ceil(total / limit)
        return reply.send({
          orders: ordersWithTotal,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        })
      } catch {
        throw new BadRequestError('Failed to fetch orders.')
      }
    },
  )
}
