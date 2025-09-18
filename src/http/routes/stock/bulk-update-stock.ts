import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/utils/get-user-permissions'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'
import { UnauthorizedError } from '../_errors/unauthorized-error'

const updatedVariantsSchema = z.object({
  updatedVariants: z.array(
    z.object({
      id: z.string(),
      sku: z.string().nullable(),
      stock: z.number(),
      product: z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
      }),
    }),
  ),
})
const bulkUpdateStockSchema = z.object({
  updates: z.array(z.object({
    variantId: z.uuid(),
    stock: z.number().int().min(0, 'Stock cannot be negative'),
  })),
})

export async function bulkUpdateStock(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put('/stock/bulk-update',
    {
      schema: {
        tags: ['Stock'],
        summary: 'Bulk update stock',
        body: bulkUpdateStockSchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: updatedVariantsSchema,
        },
      },
    },
    async (request, reply) => {
      const { updates } = request.body
      const { role, sub } = await request.getCurrentUserId()
      const { cannot } = getUserPermissions(sub, role)
      if (cannot('manage', 'Stock')) {
        // eslint-disable-next-line @stylistic/quotes
        throw new UnauthorizedError(`You're not allowed to manage stock.`)
      }

      const variantIds = updates.map(update => update.variantId)
      const existingVariants = await prisma.productVariant.findMany({
        where: {
          id: { in: variantIds },
        },
        select: { id: true },
      })

      const existingIds = existingVariants.map(v => v.id)
      const missingIds = variantIds.filter(id => !existingIds.includes(id))

      if (missingIds.length > 0) {
        throw new BadRequestError('Some product variants not found')
      }

      const results = await prisma.$transaction(
        updates.map(update =>
          prisma.productVariant.update({
            where: { id: update.variantId },
            data: { stock: update.stock },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          }),
        ),
      )

      return reply.send({
        updatedVariants: results.map(variant => ({
          id: variant.id,
          sku: variant.sku,
          stock: variant.stock,
          product: variant.product,
        })),
      })
    })
}
