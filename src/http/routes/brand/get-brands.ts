import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

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
})

export async function getBrands(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/brands',
    {
      schema: {
        tags: ['Brand'],
        summary: 'Get all brands',
        response: {
          200: getBrandsSchema,
        },
      },
    },
    async (_, reply) => {
      try {
        const brands = await prisma.brand.findMany({
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
        })
        return reply.send({ brands })
      } catch {
        throw new BadRequestError('Falha ao Listar marcas.')
      }
    },
  )
}
