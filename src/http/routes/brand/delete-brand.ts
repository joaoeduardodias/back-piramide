import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const deleteBrandSchema = z.object({
  id: z.uuid(),
})

export async function deleteBrand(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete('/brand/:id',
    {
      schema: {
        tags: ['Brand'],
        summary: 'Delete brand',
        params: deleteBrandSchema,
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

      const existingBrand = await prisma.brand.findUnique({
        where: { id },
      })

      if (!existingBrand) {
        throw new BadRequestError('Marca não encontrada.')
      }

      try {
        await prisma.brand.delete({
          where: {
            id,
          },
        })
        return reply.status(204).send()
      } catch {
        throw new BadRequestError('Falha ao deletar marca.')
      }
    },
  )
}
