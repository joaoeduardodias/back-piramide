import { prisma } from '@/lib/prisma'
import { ProductStatus } from '@/prisma/generated/enums'
import { getUserPermissions } from '@/utils/get-user-permissions'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { UnauthorizedError } from '../_errors/unauthorized-error'

const lowStockItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      sku: z.string().nullable(),
      stock: z.number(),
      price: z.number().nullable(),
      product: z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        status: z.enum(ProductStatus),
      }),
      options: z.array(
        z.object({
          option: z.string(),
          value: z.string(),
        }),
      ),
    }),
  ),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
})

export async function getLowStockProducts(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/stock/low-stock',
    {
      schema: {
        tags: ['Stock'],
        summary: 'Get products with low stock',
        querystring: z.object({
          threshold: z.string().transform(Number)
            .pipe(z.number().int().min(0)).default(10),
          page: z.string().transform(Number)
            .pipe(z.number().int().min(1)).default(1),
          limit: z.string().transform(Number)
            .pipe(z.number().int().min(1).max(100)).default(20),
        }),
        response: {
          200: lowStockItemsSchema,
        },
        security: [
          { bearerAuth: [] },
        ],
      },
    },
    async (request, reply) => {
      const { threshold, page, limit } = request.query
      const { role, sub } = await request.getCurrentUserId()
      const { cannot } = getUserPermissions(sub, role)
      if (cannot('get', 'Stock')) {
        // eslint-disable-next-line @stylistic/quotes
        throw new UnauthorizedError(`You're not allowed to get stock.`)
      }

      const skip = (page - 1) * limit

      const variants = await prisma.productVariant.findMany({
        where: {
          stock: {
            lte: threshold,
          },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
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
        skip,
        take: limit,
        orderBy: [
          { stock: 'asc' },
          { product: { name: 'asc' } },
        ],
      })

      const total = await prisma.productVariant.count({
        where: {
          stock: {
            lte: threshold,
          },
        },
      })

      const lowStockItems = variants.map(variant => ({
        id: variant.id,
        sku: variant.sku,
        stock: variant.stock,
        price: variant.price,
        product: variant.product,
        options: variant.optionValues.map(ov => ({
          option: ov.optionValue.option.name,
          value: ov.optionValue.value,
        })),
      }))

      return reply.send({
        items: lowStockItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    })
}
