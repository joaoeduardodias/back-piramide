import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import {
  CouponType,
  OrderStatus,
  PaymentMethod,
} from '@/prisma/generated/enums'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const orderItemSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().positive(),
})

const createOrderSchema = z.object({
  status: z.enum(OrderStatus).default('PENDING'),
  paymentMethod: z.enum(PaymentMethod),
  addressId: z.uuid().optional(),
  couponCode: z.string().trim().optional(),
  items: z.array(orderItemSchema).min(1),
})

function calculateSubtotal(
  items: { quantity: number; unitPrice: number }[],
) {
  return items.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice,
    0,
  )
}

function calculateDiscount(
  coupon: { type: CouponType; value: number },
  subtotal: number,
) {
  if (coupon.type === 'PERCENT') {
    return Math.floor((subtotal * coupon.value) / 100)
  }

  return coupon.value
}

export async function createOrder(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/orders',
      {
        schema: {
          tags: ['Orders'],
          summary: 'Create order',
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
        const { status, addressId, items, paymentMethod, couponCode } =
          request.body

        if (addressId) {
          const address = await prisma.address.findUnique({
            where: { id: addressId },
          })

          if (!address || address.customerId !== user.sub) {
            throw new BadRequestError('Endereço inválido.')
          }
        }

        const subtotal = calculateSubtotal(items)

        let coupon: {
          id: string
          type: CouponType
          value: number
          minOrderValue: number | null
          maxUses: number | null
          usedCount: number
          expiresAt: Date | null
          isActive: boolean
        } | null = null

        if (couponCode) {
          coupon = await prisma.coupon.findUnique({
            where: { code: couponCode },
          })

          if (
            !coupon ||
            !coupon.isActive ||
            (coupon.expiresAt && coupon.expiresAt < new Date())
          ) {
            throw new BadRequestError('Cupom inválido ou expirado.')
          }

          if (
            coupon.minOrderValue &&
            subtotal < coupon.minOrderValue
          ) {
            throw new BadRequestError(
              'Valor mínimo do pedido não atingido.',
            )
          }

          if (
            coupon.maxUses &&
            coupon.usedCount >= coupon.maxUses
          ) {
            throw new BadRequestError(
              'Limite de uso do cupom atingido.',
            )
          }

          const alreadyUsed = await prisma.couponUsage.findFirst({
            where: {
              couponId: coupon.id,
              userId: user.sub,
            },
          })

          if (alreadyUsed) {
            throw new BadRequestError(
              'Você já utilizou este cupom.',
            )
          }
        }

        const discount = coupon
          ? calculateDiscount(coupon, subtotal)
          : 0

        const total = Math.max(subtotal - discount, 0)

        try {
          const order = await prisma.$transaction(async tx => {
            const createdOrder = await tx.order.create({
              data: {
                customerId: user.sub,
                status,
                paymentMethod,
                addressId,
                subtotal,
                discount,
                total,
                couponId: coupon?.id,
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

            const variants = items.reduce<Record<string, number>>(
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
              Object.entries(variants).map(
                ([variantId, quantity]) =>
                  tx.productVariant.update({
                    where: { id: variantId },
                    data: {
                      stock: { decrement: quantity },
                    },
                  }),
              ),
            )

            if (coupon) {
              await tx.couponUsage.create({
                data: {
                  couponId: coupon.id,
                  userId: user.sub,
                },
              })

              await tx.coupon.update({
                where: { id: coupon.id },
                data: {
                  usedCount: { increment: 1 },
                },
              })
            }

            return createdOrder
          })

          return reply.status(201).send({
            orderId: order.id,
          })
        } catch {
          throw new BadRequestError('Falha ao criar pedido.')
        }
      },
    )
}
