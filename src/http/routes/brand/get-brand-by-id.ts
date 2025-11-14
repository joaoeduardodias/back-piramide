import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const getBrandByIdParamsSchema = z.object({
  id: z.uuid(),
})

const getBrandByIdSchema = z.object({
  brand: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    products: z.array(z.object({
      id: z.uuid(),
      name: z.string(),
    }),
    ),
  }),
})

export async function getBrandById(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/brand/:id',
    {
      schema: {
        tags: ['brand'],
        summary: 'Get brand by id',
        params: getBrandByIdParamsSchema,
        response: {
          200: getBrandByIdSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const existingBrand = await prisma.brand.findUnique({
        where: { id },
      })

      if (!existingBrand) {
        throw new BadRequestError('Marca não encontrada.')
      }

      try {
        const brand = await prisma.brand.findUniqueOrThrow({
          where: {
            id,
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
        })
        return reply.send({ brand })
      } catch {
        throw new BadRequestError('Falha ao Listar marca.')
      }
    },
  )
}
