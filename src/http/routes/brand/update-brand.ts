import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const updateBrandParamsSchema = z.object({
  id: z.uuid(),
})

const updateBrandSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
})

export async function updateBrand(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put('/brand/:id',
    {
      schema: {
        tags: ['Brand'],
        summary: 'Update brand',
        params: updateBrandParamsSchema,
        body: updateBrandSchema,
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

      const existingBrand = await prisma.brand.findUnique({
        where: { id },
      })

      if (!existingBrand) {
        throw new BadRequestError('Categoria não encontrada.')
      }

      try {
        await prisma.brand.update({
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
        throw new BadRequestError('Falha ao Atualizar a marca.')
      }
    },
  )
}
