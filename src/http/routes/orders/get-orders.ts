import { prisma } from '@/lib/prisma'
import { OrderStatus, PaymentMethod, type Prisma } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const getOrdersQuerySchema = z.object({
  page: z.string().transform(val =>
    parseInt(val)).pipe(z.number().int().min(1)).default(1),
  limit: z.string().transform(val =>
    parseInt(val)).pipe(z.number().int().min(1).max(100)).default(10),
  // status: z.enum(OrderStatus).optional(),
  status: z.string().optional(),
  customerId: z.uuid().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
})

const responseOrders = z.object({
  orders: z.array(
    z.object({
      id: z.uuid(),
      number: z.number(),
      status: z.enum(OrderStatus),
      paymentMethod: z.enum(PaymentMethod),
      trackingCode: z.string().nullable(),
      total: z.number(),
      itemsCount: z.number(),
      createdAt: z.date(),
      updatedAt: z.date(),
      customer: z.object({
        id: z.uuid(),
        email: z.email(),
        name: z.string().nullable(),
        phone: z.string().nullable(),
        cpf: z.string().nullable(),
      }).nullable(),
      items: z.array(z.object({
        id: z.uuid(),
        quantity: z.number(),
        unitPrice: z.number(),
        product: z.object({
          id: z.uuid(),
          name: z.string(),
          slug: z.string(),
          brandName: z.string().nullable(),
        }),
        options: z.array(z.object({
          id: z.uuid(),
          name: z.string(),
          optionId: z.uuid().nullable(),
        })),
      })),
      address: z.object({
        number: z.string().nullable(),
        name: z.string(),
        street: z.string(),
        complement: z.string().nullable(),
        district: z.string().nullable(),
        city: z.string(),
        state: z.string(),
        postalCode: z.string(),
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
        where.status = status as OrderStatus
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
              number: true,
              paymentMethod: true,
              trackingCode: true,
              status: true,
              createdAt: true,
              updatedAt: true,
              items: {
                select: {
                  id: true,
                  quantity: true,
                  unitPrice: true,
                  variant: {
                    select: {
                      optionValues: {
                        select: {
                          optionValue: true,
                        },
                      },
                    },
                  },
                  product: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      brand: {
                        select: {
                          name: true,
                        },
                      },

                    },
                  },
                },
              },
              address: {
                select: {
                  city: true,
                  district: true,
                  name: true,
                  number: true,
                  street: true,
                  complement: true,
                  postalCode: true,
                  state: true,
                },
              },
              customer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  cpf: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.order.count({ where }),
        ])
        const ordersWithTotal = orders.map(order => {
          const items = order.items.map(item => {
            const options = (item.variant?.optionValues ?? [])
              .map(({ optionValue }) => ({
                id: optionValue.id,
                name: optionValue.value,
                optionId: optionValue.optionId ?? null,
              }))

            return {
              id: item.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              product: {
                id: item.product.id,
                name: item.product.name,
                slug: item.product.slug,
                brandName: item.product.brand?.name ?? null,
              },
              options,
            }
          })

          const total = order.items.reduce((sum, it) => {
            return sum + (Number(it.unitPrice) * it.quantity)
          }, 0)

          return {
            ...order,
            items,
            total,
            itemsCount: items.length,
          }
        })

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
