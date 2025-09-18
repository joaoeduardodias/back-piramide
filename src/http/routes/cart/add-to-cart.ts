import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const addToCartSchema = z.object({
  productId: z.uuid('Invalid product ID'),
  variantId: z.uuid('Invalid variant ID').optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
})

export async function addToCart(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/cart/items',
    {
      schema: {
        tags: ['Cart'],
        summary: 'Add item to cart',
        body: addToCartSchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          201: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { productId, variantId, quantity } = request.body
      const userId = await request.getCurrentUserId()

      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          status: 'PUBLISHED',
        },
        include: {
          variants: variantId
            ? {
              where: { id: variantId },
            }
            : false,
        },
      })

      if (!product) {
        throw new BadRequestError('Product not found or not available')
      }

      if (variantId) {
        const variant = await prisma.productVariant.findFirst({
          where: {
            id: variantId,
            productId,
          },
        })

        if (!variant) {
          throw new BadRequestError('Product variant not found')
        }

        if (variant.stock < quantity) {
          throw new BadRequestError('Insufficient stock for this variant')
        }
      }

      let cart = await prisma.order.findFirst({
        where: {
          customerId: userId,
          status: 'PENDING',
        },
      })

      if (!cart) {
        cart = await prisma.order.create({
          data: {
            customerId: userId,
            status: 'PENDING',
          },
        })
      }

      const existingItem = await prisma.orderItem.findFirst({
        where: {
          orderId: cart.id,
          productId,
          variantId: variantId || null,
        },
      })

      if (existingItem) {
        await prisma.orderItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + quantity,
          },
          include: {
            product: true,
            variant: true,
          },
        })
      } else {
        const unitPrice = variantId
          ? (product.variants?.[0]?.price || product.price)
          : product.price

        await prisma.orderItem.create({
          data: {
            orderId: cart.id,
            productId,
            variantId,
            quantity,
            unitPrice,
          },
          include: {
            product: true,
            variant: true,
          },
        })
      }

      return reply.status(201)
    })
}
