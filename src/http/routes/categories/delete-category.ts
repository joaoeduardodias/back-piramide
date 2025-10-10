import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const deleteCategorySchema = z.object({
  id: z.uuid(),
})

export async function deleteCategory(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete('/categories/:id',
    {
      schema: {
        tags: ['Category'],
        summary: 'Delete category',
        params: deleteCategorySchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          204: z.null(),
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
        await prisma.category.delete({
          where: {
            id,
          },
        })
        return reply.status(204).send()
      } catch {
        throw new BadRequestError('Falha ao deletar categoria.')
      }
    },
  )
}
