import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const getCategoriesSchema = z.object({
  categories: z.array(z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    products: z.array(z.object({
      product: z.object({
        id: z.uuid(),
        name: z.string(),
      }),
    }),
    ),
  })),
})

export async function getCategories(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/categories',
    {
      schema: {
        tags: ['Category'],
        summary: 'Get all categories',
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: getCategoriesSchema,
        },
      },
    },
    async (_, reply) => {
      try {
        const categories = await prisma.category.findMany({
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

                  },
                },
              },
            },
          },
        })
        return reply.send({ categories })
      } catch {
        throw new BadRequestError('Falha ao Listar categorias.')
      }
    },
  )
}
