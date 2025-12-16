/* eslint-disable @stylistic/indent */
import { prisma } from '@/lib/prisma'
import { OrderStatus, PaymentMethod } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const orderIdParamsSchema = z.object({
  id: z.string().uuid('Invalid order ID format'),
})

const responseOrder = z.object({
  order: z.object({
    id: z.uuid(),
    number: z.number(),
    status: z.enum(OrderStatus),
    paymentMethod: z.enum(PaymentMethod),
    trackingCode: z.string().nullable(),
    estimatedDelivery: z.date().nullable(),
    items: z.array(z.object({
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
    })),
    itemsCount: z.number(),
    total: z.number().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    customer: z.object({
      id: z.uuid(),
      email: z.email(),
      name: z.string().nullable(),
      phone: z.string().nullable(),
      cpf: z.string().nullable(),
    }).nullable(),
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
  total: z.number(),
  itemsCount: z.number(),
})

export async function getOrderById(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/orders/:id',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Get order by ID',
        security: [{ bearerAuth: [] }],
        params: orderIdParamsSchema,
        response: {
          200: responseOrder,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      try {
        const order = await prisma.order.findUnique({
          where: { id },
          select: {
            id: true,
            number: true,
            paymentMethod: true,
            trackingCode: true,
            estimatedDelivery: true,
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
        })

        if (!order) {
          throw new BadRequestError('Order not found.')
        }

        const normalizedItems = order.items.map((item) => {
          const unitPriceNumber = Number((item).unitPrice ?? 0) || 0
          const options =
            item.variant?.optionValues?.map((ov) => {
              const v = ov.optionValue
              return {
                id: v.id,
                name: v.value,
                optionId: (v).optionId ?? null,
              }
            }) ?? []

          return {
            id: item.id,
            quantity: item.quantity,
            unitPrice: unitPriceNumber,
            options,
            product: {
              id: item.product.id,
              name: item.product.name,
              slug: item.product.slug,
              brand: item.product.brand
                ? { name: item.product.brand.name }
                : null,
            },
          }
        })

        const total = normalizedItems.reduce((sum, it) => {
          return sum + it.unitPrice * it.quantity
        }, 0)

        const orderForResponse = {
          order: {
            id: order.id,
            number: order.number,
            status: order.status,
            paymentMethod: order.paymentMethod,
            trackingCode: order.trackingCode,
            estimatedDelivery: order.estimatedDelivery,
            items: normalizedItems,
            itemsCount: normalizedItems.length,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            customer: order.customer
              ? {
                id: order.customer.id,
                email: order.customer.email,
                name: order.customer.name,
                phone: order.customer.phone,
                cpf: order.customer.cpf,
              }
              : null,
            address: order.address
              ? {
                number: order.address.number,
                name: order.address.name,
                street: order.address.street,
                complement: order.address.complement,
                district: order.address.district,
                city: order.address.city,
                state: order.address.state,
                postalCode: order.address.postalCode,
              }
              : null,
          },
          total,
          itemsCount: normalizedItems.length,
        }

        return reply.send(orderForResponse)
      } catch {
        // se quiser debugar em dev, pode logar err aqui
        throw new BadRequestError('Failed to fetch order.')
      }
    },
  )
}
