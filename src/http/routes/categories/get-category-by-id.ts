import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const getCategoryByIdParamsSchema = z.object({
  id: z.uuid(),
})

const getCategoryByIdSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export async function getCategoryById(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/categories/:id',
    {
      schema: {
        tags: ['Category'],
        summary: 'Get category by id',
        params: getCategoryByIdParamsSchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: getCategoryByIdSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const existingCategory = await prisma.category.findUnique({
        where: { id },
      })

      if (!existingCategory) {
        throw new BadRequestError('Categoria não encontrada.')
      }

      try {
        const category = await prisma.category.findUniqueOrThrow({
          where: {
            id,
          },
        })
        return reply.send(category)
      } catch {
        throw new BadRequestError('Falha ao Listar categoria.')
      }
    },
  )
}
