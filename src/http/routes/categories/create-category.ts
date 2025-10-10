import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),

})

export async function createCategory(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/categories',
    {
      schema: {
        tags: ['Category'],
        summary: 'Create category',
        body: createCategorySchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          201: z.object({
            categoryId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const {
        name,
        slug,
        description,

      } = request.body

      const existingCategory = await prisma.category.findUnique({
        where: { slug },
      })

      if (existingCategory) {
        throw new BadRequestError('Já existe uma categoria com este slug.')
      }

      try {
        const category = await prisma.category.create({
          data: {
            name,
            slug,
            description,
          },
        })

        return reply.status(201).send({
          categoryId: category.id,
        })
      } catch {
        throw new BadRequestError('Falha ao criar categoria.')
      }
    },
  )
}
