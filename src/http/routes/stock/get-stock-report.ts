import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/prisma/generated/client'
import { ProductStatus } from '@/prisma/generated/enums'
import { getUserPermissions } from '@/utils/get-user-permissions'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { UnauthorizedError } from '../_errors/unauthorized-error'

const ReportSchema = z.object({
  generatedAt: z.date(),
  filters: z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    productId: z.string().optional(),
  }),
  summary: z.object({
    totalVariants: z.number(),
    totalStock: z.number(),
    lowStockItems: z.number(),
    outOfStockItems: z.number(),
  }),
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
      lastUpdated: z.date(),
    }),
  ),

})

export async function getStockReport(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/stock/report',
    {
      schema: {
        tags: ['Stock'],
        summary: 'Get stock report',
        querystring: z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          productId: z.uuid().optional(),
        }),
        response: {
          200: ReportSchema,
        },
        security: [
          { bearerAuth: [] },
        ],
      },
    },
    async (request, reply) => {
      const { startDate, endDate, productId } = request.query

      const { role, sub } = await request.getCurrentUserId()
      const { cannot } = getUserPermissions(sub, role)
      if (cannot('get', 'Stock')) {
        // eslint-disable-next-line @stylistic/quotes
        throw new UnauthorizedError(`You're not allowed to get stock.`)
      }

      const whereClause: Prisma.ProductVariantWhereInput = {}

      if (productId) {
        whereClause.productId = productId
      }

      if (startDate || endDate) {
        whereClause.updatedAt = {}
        if (startDate) whereClause.updatedAt.gte = new Date(startDate)
        if (endDate) whereClause.updatedAt.lte = new Date(endDate)
      }

      const variants = await prisma.productVariant.findMany({
        where: whereClause,
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
        orderBy: [
          { product: { name: 'asc' } },
          { id: 'asc' },
        ],
      })

      const report = {
        generatedAt: new Date(),
        filters: {
          startDate,
          endDate,
          productId,
        },
        summary: {
          totalVariants: variants.length,
          totalStock: variants.reduce((sum, v) => sum + v.stock, 0),
          lowStockItems: variants.filter(v => v.stock <= 10).length,
          outOfStockItems: variants.filter(v => v.stock === 0).length,
        },
        items: variants.map(variant => ({
          id: variant.id,
          sku: variant.sku,
          stock: variant.stock,
          price: variant.price,
          product: variant.product,
          options: variant.optionValues.map(ov => ({
            option: ov.optionValue.option.name,
            value: ov.optionValue.value,
          })),
          lastUpdated: variant.updatedAt,
        })),
      }

      return reply.send(report)
    })
}
