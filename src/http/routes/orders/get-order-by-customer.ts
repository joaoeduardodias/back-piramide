/* eslint-disable @stylistic/indent */
import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/prisma/generated/client'
import { OrderStatus } from '@/prisma/generated/enums'
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
})

const responseOrders = z.object({
  orders: z.array(
    z.object({
      id: z.uuid(),
      status: z.enum(OrderStatus),
      createdAt: z.date(),
      updatedAt: z.date(),
      total: z.number(),
      itemsCount: z.number(),
      customer: z.object({
        id: z.uuid(),
        email: z.email(),
        name: z.string().nullable(),
      }).nullable(),
      items: z.array(
        z.object({
          id: z.uuid(),
          quantity: z.number(),
          unitPrice: z.number(),
          options: z.array(z.object({
            id: z.uuid(),
            name: z.string(),
            optionId: z.uuid().nullable(),
          })),
          product: z.object({
            id: z.uuid(),
            name: z.string(),
            slug: z.string(),
            brand: z.object({
              name: z.string(),
            }).nullable(),
          }),

          variant: z.object({
            optionValues: z.array(
              z.object({
                optionValue: z.object({
                  id: z.uuid(),
                  optionId: z.uuid(),
                  value: z.string(),
                  content: z.string().nullable(),
                }),
              }),
            ),
          }).nullable(),
        }),
      ),
      address: z.object({
        name: z.string(),
        street: z.string(),
        number: z.string().nullable(),
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

export async function getOrdersByCustomer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).get('/orders/customer',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Get orders by customer',
        querystring: getOrdersQuerySchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: responseOrders,
        },
      },
    },
    async (request, reply) => {
      const { sub: customerId } = await request.getCurrentUserId()
      const { page, limit, status } = request.query
      const skip = (page - 1) * limit

      const customer = await prisma.user.findUnique({
        where: { id: customerId },
      })
      if (!customer) {
        throw new BadRequestError('Customer not found.')
      }
      const where: Prisma.OrderWhereInput = { customerId }
      if (status) {
        where.status = status
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
              estimatedDelivery: true,
              status: true,
              createdAt: true,
              updatedAt: true,
              addressId: true,
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
            const unitPrice = Number(item.unitPrice)

            return {
              id: item.id,
              quantity: item.quantity,
              unitPrice,

              options:
                item.variant?.optionValues.map(ov => ({
                  id: ov.optionValue.id,
                  name: ov.optionValue.value,
                  optionId: ov.optionValue.optionId,
                })) ?? [],

              product: {
                id: item.product.id,
                name: item.product.name,
                slug: item.product.slug,
                brand: item.product.brand
                  ? { name: item.product.brand.name }
                  : null,
              },

              // 🔴 ESSENCIAL para bater com o Zod
              variant: item.variant
                ? {
                  optionValues: item.variant.optionValues.map(ov => ({
                    optionValue: {
                      id: ov.optionValue.id,
                      optionId: ov.optionValue.optionId,
                      value: ov.optionValue.value,
                      content: ov.optionValue.content,
                    },
                  })),
                }
                : null,
            }
          })

          return {
            id: order.id,
            createdAt: order.createdAt,
            status: order.status,
            updatedAt: order.updatedAt,
            total: items.reduce(
              (sum, item) => sum + item.unitPrice * item.quantity,
              0,
            ),
            itemsCount: items.length,
            customer: order.customer
              ? {
                id: order.customer.id,
                email: order.customer.email,
                name: order.customer.name,
              }
              : null,
            items,
            address: order.address
              ? {
                name: order.address.name,
                street: order.address.street,
                number: order.address.number,
                complement: order.address.complement,
                district: order.address.district,
                city: order.address.city,
                state: order.address.state,
                postalCode: order.address.postalCode,
              }
              : null,
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
        throw new BadRequestError('Failed to fetch customer orders.')
      }
    },
  )
}
