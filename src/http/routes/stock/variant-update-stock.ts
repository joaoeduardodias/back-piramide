import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/utils/get-user-permissions'
import type { Decimal } from '@prisma/client/runtime/library'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'
import { UnauthorizedError } from '../_errors/unauthorized-error'

const updateStockSchema = z.object({
  stock: z.number().int().min(0, 'Stock cannot be negative'),
})

const variantSchema = z.object({
  id: z.uuid(),
  sku: z.string().nullable(),
  stock: z.number(),
  price: z.custom<Decimal>().nullable(),
  product: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
  }),
  options: z.array(
    z.object({
      option: z.string(),
      value: z.string(),
    }),
  ),
})

export async function updateVariantStock(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put('/stock/variants/:id',
    {
      schema: {
        tags: ['Stock'],
        summary: 'Update variant stock',
        params: z.object({
          id: z.uuid(),
        }),
        response: {
          200: variantSchema,
        },
        body: updateStockSchema,
        security: [
          { bearerAuth: [] },
        ],
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { stock } = request.body
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

      const updatedVariant = await prisma.productVariant.update({
        where: { id },
        data: { stock },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          optionValues: {
            include: {
              optionValue: {
                include: {
                  option: true,
                },
              },
            },
          },
        },
      })

      return reply.send({
        id: updatedVariant.id,
        sku: updatedVariant.sku,
        stock: updatedVariant.stock,
        price: updatedVariant.price,
        product: updatedVariant.product,
        options: updatedVariant.optionValues.map(ov => ({
          option: ov.optionValue.option.name,
          value: ov.optionValue.value,
        })),
      })
    })
}
