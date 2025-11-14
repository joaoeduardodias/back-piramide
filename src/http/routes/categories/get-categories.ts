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
      id: z.uuid(),
      name: z.string(),
      image: z.url(),
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
        })

        const formattedCategories = categories.map(category => {
          return {
            id: category.id,
            name: category.name,
            slug: category.slug,
            products: category.products.map(p => {
              return {
                id: p.product.id,
                name: p.product.name,
                image: p.product.images[0].url,
              }
            }),
          }
        })

        return reply.send({ categories: formattedCategories })
      } catch {
        throw new BadRequestError('Falha ao Listar categorias.')
      }
    },
  )
}
