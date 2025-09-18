import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/utils/get-user-permissions'
import type { Decimal } from '@prisma/client/runtime/library'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'
import { UnauthorizedError } from '../_errors/unauthorized-error'

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

export async function getVariantStock(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/stock/variants/:id',
    {
      schema: {
        tags: ['Stock'],
        summary: 'Get variant stock',
        params: z.object({
          id: z.uuid(),
        }),
        response: {
          200: variantSchema,
        },
        security: [
          { bearerAuth: [] },
        ],
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const { role, sub } = await request.getCurrentUserId()
      const { cannot } = getUserPermissions(sub, role)
      if (cannot('get', 'Stock')) {
        // eslint-disable-next-line @stylistic/quotes
        throw new UnauthorizedError(`You're not allowed to get stock.`)
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id },
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

      if (!variant) {
        throw new BadRequestError('Product variant not found')
      }

      return reply.send({
        id: variant.id,
        sku: variant.sku,
        stock: variant.stock,
        price: variant.price,
        product: variant.product,
        options: variant.optionValues.map(ov => ({
          option: ov.optionValue.option.name,
          value: ov.optionValue.value,
        })),
      })
    })
}
