import { prisma } from '@/lib/prisma'
import { OrderStatus, type Prisma } from '@prisma/client'
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
      status: z.enum(OrderStatus),
      total: z.number(),
      itemsCount: z.number(),
      createdAt: z.date(),
      updatedAt: z.date(),
      customer: z.object({
        id: z.uuid(),
        email: z.email(),
        name: z.string().nullable(),
      }).nullable(),
      items: z.array(z.object({
        id: z.uuid(),
        quantity: z.number(),
        unitPrice: z.number(),
        product: z.object({
          id: z.uuid(),
          name: z.string(),
          slug: z.string(),
        }),
      })),

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
            select: {
              id: true,
              status: true,
              createdAt: true,
              updatedAt: true,
              items: {
                select: {
                  id: true,
                  quantity: true,
                  unitPrice: true,
                  product: {
                    select: {
                      name: true,
                      id: true,
                      slug: true,
                    },
                  },
                },
              },
              customer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
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
