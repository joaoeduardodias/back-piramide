import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { formatReal } from '@/utils/format-real'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

export async function sendOrderCreatedEmail(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post('/emails/order-created/:orderId', {
      schema: {
        tags: ['Emails'],
        summary: 'Send order created email',
        security: [{ bearerAuth: [] }],
        params: z.object({
          orderId: z.uuid(),
        }),
        response: {
          204: z.null(),
        },
      },
    }, async (request, reply) => {
      console.log('Send order created email endpoint called')
      const { orderId } = request.params
      const { sub } = await request.getCurrentUserId()
      const user = await prisma.user.findUnique({
        where: {
          id: sub,
        },
        select: {
          name: true,
          email: true,
        },
      })
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          number: true,
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
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      })

      if (!order || !order.customer?.email) {
        throw new Error('Order or customer not found')
      }
      const total = order.items.reduce((acc, item) => {
        return acc + item.unitPrice * item.quantity
      }, 0)

      const personalization = [
        {
          email: user?.email,
          data: {
            name: user?.name,
            order: {
              total: formatReal(String(total)),
              number: order.number,
              address: `${order.address?.street},
               ${order.address?.number},
                ${order.address?.district}, 
                ${order.address?.city} - ${order.address?.state}`,
              customer: {
                email: order.customer.email,
                phone: order.customer.phone,
              },
              subtotal: formatReal(String(total)),
            },
            product: order.items.map(item => ({
              name: item.product.name,
              price: formatReal(String(item.unitPrice)),
              quantity: item.quantity,
            })),
          },
        },
      ]

      // await sendEmail({
      //   to: {
      //     email: env.OWNER_EMAIL,
      //     name: 'Piramide Calçados',
      //   },
      //   subject: `Pedido #${order.number} confirmado`,
      //   templateId: 'zr6ke4n66wvlon12',
      //   personalization,
      // })

      // await sendEmail({
      //   to: {
      //     email: order.customer.email,
      //     name: order.customer.name,
      //   },
      //   subject: 'Novo Pedido',
      //   templateId: 'z86org8dd81lew13',
      // })

      return reply.status(204).send()
    })
}
