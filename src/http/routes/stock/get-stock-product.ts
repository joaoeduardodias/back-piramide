import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/utils/get-user-permissions'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'
import { UnauthorizedError } from '../_errors/unauthorized-error'

const stockInfoSchema = z.object({

  productId: z.uuid(),
  productName: z.string(),
  variants: z.array(
    z.object({
      id: z.uuid(),
      sku: z.string().nullable(),
      stock: z.number(),
      price: z.number().nullable(),
      options: z.array(
        z.object({
          option: z.string(),
          value: z.string(),
        }),
      ),
    }),
  ),
  totalStock: z.number(),
})

export async function getProductStock(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/stock/products/:id',
    {
      schema: {
        tags: ['Stock'],
        summary: 'Get product stock',
        params: z.object({
          id: z.uuid(),
        }),
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: stockInfoSchema,
        },
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

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          variants: {
            include: {
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
          },
        },
      })

      if (!product) {
        throw new BadRequestError('Product not found')
      }

      const stockInfo = {
        productId: product.id,
        productName: product.name,
        variants: product.variants.map(variant => ({
          id: variant.id,
          sku: variant.sku,
          stock: variant.stock,
          price: variant.price,
          options: variant.optionValues.map(ov => ({
            option: ov.optionValue.option.name,
            value: ov.optionValue.value,
          })),
        })),
        totalStock: product.variants.reduce((sum, variant) =>
          sum + variant.stock, 0),
      }

      return reply.send(stockInfo)
    })
}
