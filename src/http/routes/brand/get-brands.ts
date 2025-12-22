import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const getBrandsQuerySchema = z.object({
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

const getBrandsSchema = z.object({
  brands: z.array(z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    products: z.array(z.object({
      id: z.uuid(),
      name: z.string(),
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

export async function getBrands(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/brands',
    {
      schema: {
        tags: ['Brand'],
        summary: 'Get all brands',
        querystring: getBrandsQuerySchema,
        response: {
          200: getBrandsSchema,
        },
      },
    },
    async (request, reply) => {
      const { page, limit } = request.query
      const skip = (page - 1) * limit
      try {
        const [brands, total] = await Promise.all([
          await prisma.brand.findMany({
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
                  id: true,
                  name: true,
                },
              },
            },
          }),

          prisma.brand.count(),
        ])
        const totalPages = Math.ceil(total / limit)
        return reply.send({
          brands,
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
        throw new BadRequestError('Falha ao Listar marcas.')
      }
    },
  )
}
