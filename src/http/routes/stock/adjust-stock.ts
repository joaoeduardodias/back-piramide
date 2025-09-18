import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/utils/get-user-permissions'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'
import { UnauthorizedError } from '../_errors/unauthorized-error'

const stockAdjustmentSchema = z.object({
  id: z.uuid(),
  sku: z.string().nullable(),
  previousStock: z.number(),
  adjustment: z.number(),
  newStock: z.number(),
  reason: z.string(),
  product: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
  }),
})

export async function adjustStock(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch('/stock/variants/:id/adjust',
    {
      schema: {
        tags: ['Stock'],
        summary: 'Adjust variant stock',
        params: z.object({
          id: z.uuid(),
        }),
        body: z.object({
          adjustment: z.number().int(),
          reason: z.string().min(1, 'Reason is required'),
        }),
        response: {
          200: stockAdjustmentSchema,
        },
        security: [
          { bearerAuth: [] },
        ],
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { adjustment, reason } = request.body
      const { role, sub } = await request.getCurrentUserId()
      const { cannot } = getUserPermissions(sub, role)
      if (cannot('manage', 'Stock')) {
        // eslint-disable-next-line @stylistic/quotes
        throw new UnauthorizedError(`You're not allowed to manage stock.`)
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id },
      })

      if (!variant) {
        throw new BadRequestError('Product variant not found')
      }

      const newStock = variant.stock + adjustment

      if (newStock < 0) {
        throw new BadRequestError('Stock cannot be negative.')
      }

      const updatedVariant = await prisma.productVariant.update({
        where: { id },
        data: { stock: newStock },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })

      return reply.send({
        id: updatedVariant.id,
        sku: updatedVariant.sku,
        previousStock: variant.stock,
        adjustment,
        newStock: updatedVariant.stock,
        reason,
        product: updatedVariant.product,
      })
    })
}
