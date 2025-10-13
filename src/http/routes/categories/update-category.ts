import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const updateCategoryParamsSchema = z.object({
  id: z.uuid(),
})

const updateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
})

export async function updateCategory(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put('/categories/:id',
    {
      schema: {
        tags: ['Category'],
        summary: 'Update category',
        params: updateCategoryParamsSchema,
        body: updateCategorySchema,
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
      const { name, slug } = request.body

      const existingCategory = await prisma.category.findUnique({
        where: { id },
      })

      if (!existingCategory) {
        throw new BadRequestError('Categoria não encontrada.')
      }
      if (existingCategory.slug === slug) {
        throw new BadRequestError('Já existe uma categoria com este slug.')
      }

      try {
        await prisma.category.update({
          where: {
            id,
          },
          data: {
            name,
            slug,

          },
        })
        return reply.status(204).send()
      } catch {
        throw new BadRequestError('Falha ao Atualizar a categoria.')
      }
    },
  )
}
