import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { ProductStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'
const getProductsQuerySchema = z.object({
  page: z.string().transform(val =>
    parseInt(val)).pipe(z.number().int().min(1)).default(1),
  limit: z.string().transform(val =>
    parseInt(val)).pipe(z.number().int().min(1).max(100)).default(10),
  status: z.enum(ProductStatus).optional(),
  categoryId: z.uuid().optional(),
  search: z.string().optional(),
})

const productsResponseSchema = z.object({
  products: z.array(z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    featured: z.boolean().nullable(),
    description: z.string().nullable(),
    price: z.instanceof(Decimal),
    status: z.enum(ProductStatus),
    createdAt: z.date(),
    updatedAt: z.date(),

    categories: z.array(
      z.object({
        categoryId: z.uuid(),
        productId: z.uuid(),
        category: z.object({
          id: z.uuid(),
          name: z.string(),
          slug: z.string(),
          createdAt: z.date(),
          updatedAt: z.date(),
        }),
      }),
    ),

    images: z.array(
      z.object({
        id: z.uuid(),
        url: z.string(),
        alt: z.string().nullable(),
        sortOrder: z.number().int(),
        productId: z.uuid(),
        createdAt: z.date(),
        optionValueId: z.string().uuid().nullable(),
      }),
    ),

    variants: z.array(
      z.object({
        id: z.uuid(),
        price: z.instanceof(Decimal).nullable(),
        sku: z.string().nullable(),
        stock: z.number(),
        productId: z.uuid(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
    ),
  })),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),

})

export async function getAllProducts(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/products',
    {
      schema: {
        tags: ['Products'],
        summary: 'List products',
        querystring: getProductsQuerySchema,
        response: {
          200: productsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { page, limit, status, categoryId, search } = request.query

      const skip = (page - 1) * limit
      const where: Prisma.ProductWhereInput = {}
      if (status) {
        where.status = status
      }

      if (categoryId) {
        where.categories = {
          some: {
            categoryId,
          },
        }
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      }

      try {
        const [products, total] = await Promise.all([
          prisma.product.findMany({
            where,
            skip,
            take: limit,
            include: {
              categories: {
                include: {
                  category: true,
                },
              },
              images: {
                orderBy: { sortOrder: 'asc' },
              },
              variants: true,
            },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.product.count({ where }),
        ])

        const totalPages = Math.ceil(total / limit)

        return reply.send({
          products,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        })
      } catch {
        throw new BadRequestError('Failed to fetch all products.')
      }
    },
  )
}
