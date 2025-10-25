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
    comparePrice: z.instanceof(Decimal).nullable(),
    sales: z.number(),
    categories: z.array(z.object({
      category: z.object({
        id: z.uuid(),
        name: z.string(),
        slug: z.string(),
      }),
    })),
    images: z.array(z.object({
      id: z.string(),
      url: z.string(),
      alt: z.string().nullable(),
    })),
    variants: z.array(z.object({
      id: z.string(),
      price: z.instanceof(Decimal).nullable(),
      sku: z.string(),
      stock: z.number(),
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
            select: {
              id: true,
              name: true,
              description: true,
              featured: true,
              price: true,
              comparePrice: true,
              slug: true,
              sales: true,
              images: {
                orderBy: {
                  sortOrder: 'asc',
                },
                select: {
                  id: true,
                  url: true,
                  alt: true,
                },
              },
              categories: {
                select: {
                  category: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
              variants: {
                select: {
                  id: true,
                  price: true,
                  sku: true,
                  stock: true,
                },
              },
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
