import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const getCategoriesQuerySchema = z.object({
  page: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number().int().min(1))
    .default(1),

  limit: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number().int().min(1))
    .default(10),
})

const responseCategoriesSchema = z.object({
  categories: z.array(z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    products: z.array(z.object({
      id: z.uuid(),
      name: z.string(),
      image: z.url().optional(),
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

export async function getCategories(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/categories',
    {
      schema: {
        tags: ['Category'],
        summary: 'Get all categories',
        querystring: getCategoriesQuerySchema,
        response: {
          200: responseCategoriesSchema,
        },
      },
    },
    async (request, reply) => {
      const { page, limit } = request.query
      const skip = (page - 1) * limit
      try {
        const [categories, total] = await Promise.all([
          prisma.category.findMany({
            skip,
            take: limit,
            orderBy: {
              name: 'asc',
            },
            select: {
              id: true,
              name: true,
              slug: true,
              products: {
                select: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      images: {
                        select: {
                          url: true,
                        },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          }),

          prisma.category.count(),
        ])

        const formattedCategories = categories.map(category => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          products: category.products.map(p => ({
            id: p.product.id,
            name: p.product.name,
            image: p.product.images[0]?.url,
          })),
        }))

        const totalPages = Math.ceil(total / limit)

        return reply.send({
          categories: formattedCategories,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        })
      } catch (err) {
        console.log(err)
        throw new BadRequestError('Falha ao Listar categorias.')
      }
    },
  )
}
